"""Cut OpenSkiData's lifts, runs and ski areas into static tiles, for liftradar's map and other apps.

Writes `<out>/v1/10/{x}/{y}.json` (XYZ tiles at zoom 10, only those with lifts, runs or ski areas),
`<out>/v1/resorts.geojson` (each liftradar resort's outline and map point, made from its lifts
and runs), `<out>/v1/meta.json` and `<out>/v1/tile.schema.json`. Each lift and run gets the
liftradar resort it belongs to (`lr`, "<country>/<id>"), when there is one (ski_resorts.py).
The format is in README, "Ski tiles".

    for f in lifts runs ski_areas; do
      curl --compressed -o $f.geojson https://tiles.openskimap.org/geojson/$f.geojson
    done
    uv run --no-project --with shapely --with ijson python3 scripts/ski_tiles.py ski_areas.geojson lifts.geojson \
        runs.geojson ../liftradar-data/json/index.json ski

OpenSkiData may be downloaded at most once a day (.github/workflows/ski.yml does it weekly).
With --previous (the last build's meta.json) the script fails, leaving the old tiles, when
the counts drop by more than MAX_DROP; the counts must reach the MIN_* floors in any case.
"""

import argparse
import hashlib
import itertools
import json
import math
import shutil
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

import ijson
import shapely
import ski_resorts
from shapely.geometry import box, shape

ZOOM = 10
VERSION = 1
SCHEMA = Path(__file__).with_name("ski-tile.schema.json")
ATTRIBUTION = "Data from OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL), Skimap.org, Who's On First, © Mapterhorn"
# Lifts and runs that were never built aren't in the tiles; disused and abandoned ones stay, as an
# old GPX track may have used them.
SKIPPED_STATUS = {"proposed", "planned", "construction"}
SIMPLIFY_M = 5  # Douglas–Peucker tolerance for lifts and runs
OUTLINE_SIMPLIFY_M = 25  # and for ski-area outlines
DENSIFY_M = 1000  # steps along a segment when finding the tiles it crosses
MAX_DROP = 0.15
MIN_LIFTS = 25000  # about 32,000 in November 2026
MIN_RUNS = 180000  # about 231,000 in November 2026
MIN_AREAS = 6000  # downhill areas, or with lifts: about 7,100 in November 2026
M_PER_DEG = 111_320


def tile_of(lon: float, lat: float) -> tuple[int, int]:
    n = 2**ZOOM
    lat = max(-85.0511, min(85.0511, lat))
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def tile_box(x: int, y: int):
    n = 2**ZOOM

    def lat(row: int) -> float:
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * row / n))))

    return box(x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y))


def metres(a, b) -> float:
    """Distance in metres between two (lon, lat) points, flat-earth: fine below some 10 km."""
    k = math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * M_PER_DEG


def simplify(coords: list, tolerance: float) -> list:
    """Douglas–Peucker in local metres, keeping the original points (and their elevations)."""
    if len(coords) < 3:
        return coords
    k = math.cos(math.radians(coords[0][1])) * M_PER_DEG
    xy = [(c[0] * k, c[1] * M_PER_DEG) for c in coords]
    keep = {0, len(xy) - 1}
    stack = [(0, len(xy) - 1)]
    while stack:
        i, j = stack.pop()
        (ax, ay), (bx, by) = xy[i], xy[j]
        length = math.hypot(bx - ax, by - ay)
        best, index = 0.0, None
        for m in range(i + 1, j):
            px, py = xy[m]
            d = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length if length else math.hypot(px - ax, py - ay)
            if d > best:
                best, index = d, m
        if index is not None and best > tolerance:
            keep.add(index)
            stack += [(i, index), (index, j)]
    return [coords[i] for i in sorted(keep)]


def rounded(c: list) -> list:
    point = [round(c[0], 5), round(c[1], 5)]
    if len(c) > 2 and c[2] is not None:
        point.append(round(c[2]))
    return point


def line_tiles(coords: list) -> set[tuple[int, int]]:
    tiles = set()
    for a, b in itertools.pairwise(coords):
        steps = max(1, math.ceil(metres(a, b) / DENSIFY_M))
        for s in range(steps + 1):
            tiles.add(tile_of(a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps))
    if len(coords) == 1:
        tiles.add(tile_of(*coords[0][:2]))
    return tiles


def geometry_tiles(geom) -> set[tuple[int, int]]:
    west, south, east, north = geom.bounds
    x0, y0 = tile_of(west, north)
    x1, y1 = tile_of(east, south)
    shapely.prepare(geom)
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1) if geom.intersects(tile_box(x, y))}


def osm_ids(properties: dict) -> list[str]:
    return [s["id"] for s in properties.get("sources") or [] if s.get("type") == "openstreetmap"]


def outline(geom) -> list:
    """A simplified outline as GeoJSON polygon coordinates (a list of polygons, outer rings only)."""
    k = math.cos(math.radians(geom.centroid.y)) * M_PER_DEG
    simple = geom.simplify(OUTLINE_SIMPLIFY_M / k)
    polygons = getattr(simple, "geoms", [simple])
    return [[[round(c[0], 5), round(c[1], 5)] for c in p.exterior.coords] for p in polygons if not p.is_empty]


def rings(geom) -> list:
    """A run area's polygon (simplified, holes kept) as GeoJSON polygon coordinates."""
    k = math.cos(math.radians(geom.centroid.y)) * M_PER_DEG
    simple = geom.simplify(SIMPLIFY_M / k)
    if simple.is_empty or simple.geom_type != "Polygon":
        simple = geom
    return [[[round(c[0], 5), round(c[1], 5)] for c in r.coords] for r in [simple.exterior, *simple.interiors]]


def load(path: str, keep: set | None = None):
    """The features of a GeoJSON file, read as a stream (runs.geojson is near 1 GB); with keep,
    only those properties."""
    with open(path, "rb") as f:
        for feature in ijson.items(f, "features.item", use_float=True):
            if keep is not None:
                feature["properties"] = {k: v for k, v in feature["properties"].items() if k in keep}
            yield feature


def compact(properties: dict, fields: dict) -> dict:
    """The given OpenSkiData properties under our names, without the empty ones."""
    return {ours: v for theirs, ours in fields.items() if (v := properties.get(theirs)) not in (None, [], "")}


LIFT_FIELDS = {"liftType": "type", "name": "name", "ref": "ref", "status": "status", "capacity": "capacity"}
LIFT_FIELDS |= {"duration": "duration", "occupancy": "occupancy", "heating": "heating", "bubble": "bubble"}
LIFT_FIELDS |= {"tunnel": "tunnel"}
RUN_FIELDS = {"uses": "uses", "difficulty": "difficulty", "name": "name", "ref": "ref", "grooming": "grooming"}
RUN_FIELDS |= {"lit": "lit", "oneway": "oneway", "gladed": "gladed", "patrolled": "patrolled", "tunnel": "tunnel"}
KEEP = {"sources", "skiAreas", "status", "difficultyConvention"} | set(LIFT_FIELDS) | set(RUN_FIELDS)


def build(args) -> dict:
    with open(args.index, encoding="utf-8") as f:
        resorts = json.load(f)["resorts"]
    by_key = {f"{r['country']}/{r['id']}": r for r in resorts}

    areas = {}
    for f in load(args.ski_areas):
        p = f["properties"]
        geom = shape(f["geometry"])
        areas[p["id"]] = {
            "name": p.get("name"),
            "osm": osm_ids(p),
            "wd": p.get("wikidataID"),
            "geom": geom,
            "point": geom if geom.geom_type == "Point" else geom.representative_point(),
            "downhill": "downhill" in (p.get("activities") or []),
        }

    def prepare(f):
        f["_areas"] = [
            a["properties"]["id"] for a in f["properties"].pop("skiAreas", None) or [] if a["properties"]["id"] in areas
        ]
        f["_geom"] = shape(f["geometry"])
        return f

    lifts = []
    for f in load(args.lifts, KEEP):
        if f["properties"].get("status") in SKIPPED_STATUS or f["geometry"]["type"] != "LineString":
            continue
        f["_coords"] = f["geometry"]["coordinates"]
        lifts.append(prepare(f))
    runs = []
    for f in load(args.runs, KEEP):
        if f["properties"].get("status") in SKIPPED_STATUS or f["geometry"]["type"] not in ("LineString", "Polygon"):
            continue
        runs.append(prepare(f))

    lift_lr, run_lr = ski_resorts.assign(resorts, areas, lifts, runs)
    features = ski_resorts.outlines(resorts, lifts, runs, lift_lr, run_lr, areas)

    # An OpenSkiData area's liftradar resort: the one most of its lifts belong to.
    votes = defaultdict(Counter)
    for i, key in lift_lr.items():
        for a in lifts[i]["_areas"]:
            votes[a][key] += 1
    area_lr = {a: v.most_common(1)[0][0] for a, v in votes.items()}

    tiles = defaultdict(lambda: {"areas": {}, "lifts": [], "runs": []})
    # Areas: in every tile their outline (or point) touches; and in those of their lifts and runs, below.
    lifted = {a for f in lifts for a in f["_areas"]}
    for a, area in areas.items():
        if not (area["downhill"] or a in lifted):
            continue
        for t in geometry_tiles(area["geom"]):
            tiles[t]["areas"][a] = None
    for i, f in enumerate(lifts):
        p = f["properties"]
        lift = compact(p, LIFT_FIELDS)
        if osm := osm_ids(p):
            lift["osm"] = osm[0]
        if i in lift_lr:
            lift["lr"] = lift_lr[i]
        lift["c"] = [rounded(c) for c in simplify(f["_coords"], SIMPLIFY_M)]
        for t in line_tiles(f["_coords"]):
            for a in f["_areas"]:
                tiles[t]["areas"][a] = None
            tiles[t]["lifts"].append((lift, f["_areas"]))
    for j, f in enumerate(runs):
        p = f["properties"]
        run = compact(p, RUN_FIELDS)
        if (convention := p.get("difficultyConvention")) and convention != "europe":
            run["conv"] = convention
        if osm := osm_ids(p):
            run["osm"] = osm[0]
        if j in run_lr:
            run["lr"] = run_lr[j]
        if f["geometry"]["type"] == "LineString":
            coords = f["geometry"]["coordinates"]
            run["c"] = [rounded(c[:2]) for c in simplify(coords, SIMPLIFY_M)]
            covered = line_tiles(coords)
        else:
            run["poly"] = rings(f["_geom"])
            covered = geometry_tiles(f["_geom"])
        for t in covered:
            for a in f["_areas"]:
                tiles[t]["areas"][a] = None
            tiles[t]["runs"].append((run, f["_areas"]))

    def area_entry(a: str) -> dict:
        area = areas[a]
        entry = {"name": area["name"]} if area["name"] else {}
        if a in area_lr:
            key = area_lr[a]
            entry["lr"] = {"id": key, "name": by_key[key]["name"]}
        if area["osm"]:
            entry["osm"] = area["osm"][0]
        if area["wd"]:
            entry["wd"] = area["wd"]
        entry["p"] = rounded(list(area["point"].coords[0]))
        if area["geom"].geom_type != "Point":
            entry["outline"] = outline(area["geom"])
        return entry

    out = Path(args.out) / f"v{VERSION}"
    new = out.with_name(out.name + ".new")
    if new.exists():
        shutil.rmtree(new)
    digest = hashlib.sha256()
    sizes = []
    for (x, y), tile in sorted(tiles.items()):
        index = {a: n for n, a in enumerate(tile["areas"])}
        body = {
            "v": VERSION,
            "areas": [area_entry(a) for a in tile["areas"]],
            "lifts": [insert_areas(lift, [index[a] for a in la]) for lift, la in tile["lifts"]],
            "runs": [insert_areas(run, [index[a] for a in ra]) for run, ra in tile["runs"]],
        }
        text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
        path = new / str(ZOOM) / str(x) / f"{y}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        digest.update(f"{x}/{y}:".encode() + text.encode())
        sizes.append(len(text.encode()))
    collection = {"type": "FeatureCollection", "features": features}
    resorts_text = json.dumps(collection, ensure_ascii=False, separators=(",", ":"))
    digest.update(resorts_text.encode())

    counts = {
        "tiles": len(tiles),
        "lifts": len(lifts),
        "runs": len(runs),
        "areas": len({a for t in tiles.values() for a in t["areas"]}),
        "lifts_lr": len(lift_lr),
        "runs_lr": len(run_lr),
        "resorts_lr": len(features),
    }
    meta = {
        "$schema": "tile.schema.json",
        "v": VERSION,
        "build": digest.hexdigest()[:12],
        "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "data_time": args.data_time,
        "zoom": ZOOM,
        "tiles": f"{ZOOM}/{{x}}/{{y}}.json",
        "resorts": "resorts.geojson",
        "counts": counts,
        "attribution": ATTRIBUTION,
        "license": "ODbL-1.0",
    }
    if problems := check(counts, args.previous):
        shutil.rmtree(new)
        sys.exit("Not written, the previous tiles stay: " + "; ".join(problems))
    (new / "resorts.geojson").write_text(resorts_text + "\n", encoding="utf-8")
    (new / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copy(SCHEMA, new / "tile.schema.json")
    if out.exists():
        shutil.rmtree(out)
    new.rename(out)
    sizes.sort()
    print(json.dumps(meta["counts"]), f"build {meta['build']}")
    print(
        f"tile bytes: median {sizes[len(sizes) // 2]}, 95% {sizes[int(len(sizes) * 0.95)]}, "
        f"max {sizes[-1]}, total {sum(sizes) / 1e6:.1f} MB; resorts.geojson {len(resorts_text) / 1e6:.2f} MB"
    )
    return meta


def insert_areas(feature: dict, indexes: list) -> dict:
    """The feature with its areas' indexes in the tile, before its geometry."""
    geometry = {k: feature[k] for k in ("c", "poly") if k in feature}
    rest = {k: v for k, v in feature.items() if k not in geometry}
    return {**rest, "areas": indexes, **geometry}


def check(counts: dict, previous: str | None) -> list[str]:
    problems = []
    if counts["lifts"] < MIN_LIFTS:
        problems.append(f"{counts['lifts']} lifts, fewer than {MIN_LIFTS}")
    if counts["runs"] < MIN_RUNS:
        problems.append(f"{counts['runs']} runs, fewer than {MIN_RUNS}")
    if counts["areas"] < MIN_AREAS:
        problems.append(f"{counts['areas']} areas, fewer than {MIN_AREAS}")
    if previous and Path(previous).exists():
        before = json.loads(Path(previous).read_text(encoding="utf-8"))["counts"]
        for key in ("lifts", "runs", "areas", "lifts_lr", "runs_lr"):
            if before.get(key) and counts[key] < before[key] * (1 - MAX_DROP):
                problems.append(f"{key}: {counts[key]}, down from {before[key]}")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ski_areas")
    parser.add_argument("lifts")
    parser.add_argument("runs")
    parser.add_argument("index", help="liftradar's json/index.json")
    parser.add_argument("out", help="output directory, e.g. ski")
    parser.add_argument("--previous", help="the last build's meta.json, to compare the counts with")
    parser.add_argument("--data-time", help="when OpenSkiData built the files (their Last-Modified), ISO 8601")
    build(parser.parse_args())


if __name__ == "__main__":
    main()
