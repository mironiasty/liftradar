"""Which liftradar resort each OpenSkiData lift and run belongs to, and each resort's outline and map point.

Used by ski_tiles.py; the rules are in README, "Ski tiles". Distances are in metres, in a flat
projection around each point: fine for the few kilometres compared here.
"""

import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import shapely
from shapely.geometry import LineString, Point, box, mapping

M_PER_DEG = 111_320
NEAR_M = 3000  # a resort claims the nearest ski area with a lift within this
NEAR_NAMED_M = 8000  # or the ones within this whose name matches its own best
SECTOR_M = 6000  # in an area shared by several resorts, a lift goes to the nearest (within this for a resort
# that claimed the area only as its nearest)
LONE_M = 1000  # a lift without a ski area goes to a resort whose point is within this
LIFT_BUFFER_M = 60  # the outline: lifts and downhill runs widened by these,
RUN_BUFFER_M = 50
CLOSE_M = 150  # the gaps between them closed,
OPEN_M = 70  # strips narrower than twice this removed (a lift alone across a valley),
ISLAND_M2 = 50_000  # and pieces smaller than this,
HOLE_M2 = 500_000  # holes smaller than this filled,
OUTLINE_SIMPLIFY_M = 15  # and simplified
OVERRIDES = Path(__file__).with_name("ski_overrides.json")
GENERIC = {"ski", "skigebiet", "area", "sci", "comprensorio", "bergbahnen", "der", "und", "and", "san", "skiarena"}
GENERIC |= {"skiregion", "domaine", "station", "les", "the", "skicentrum", "skicenter", "alpinsenter", "lifte"}
GENERIC |= {"nad", "pod", "sur", "del", "dei", "della", "von", "bei", "skiareal", "areal", "resort"}


def words(text: str | None) -> set[str]:
    """The name's words, lowercase without accents ("Sölden" matches "solden"), without generic ones."""
    folded = "".join(c for c in unicodedata.normalize("NFD", text or "") if not unicodedata.combining(c)).casefold()
    return {w for w in re.split(r"[^a-z0-9]+", folded) if len(w) > 2 and w not in GENERIC}


def around(here: tuple, radius: float):
    """A box of about radius metres around a (lon, lat) point."""
    dy = radius / M_PER_DEG
    dx = dy / math.cos(math.radians(here[1]))
    return box(here[0] - dx, here[1] - dy, here[0] + dx, here[1] + dy)


def projector(here: tuple):
    """Functions to and from local metres around a (lon, lat) point."""
    k = math.cos(math.radians(here[1])) * M_PER_DEG

    def to_m(geom):
        return shapely.transform(geom, lambda c: (c - here) * (k, M_PER_DEG))

    def to_deg(geom):
        return shapely.transform(geom, lambda c: c / (k, M_PER_DEG) + here)

    return to_m, to_deg


def distance(here: tuple, line) -> float:
    """Metres from a (lon, lat) point to a geometry in degrees."""
    to_m, _ = projector(here)
    return to_m(line).distance(Point(0, 0))


def load_overrides() -> dict:
    if not OVERRIDES.exists():
        return {}
    return json.loads(OVERRIDES.read_text(encoding="utf-8"))


def area_matches(area: dict, ref: str) -> bool:
    """An override's reference to an OpenSkiData area: an OSM id, a Wikidata id or the exact name."""
    return ref in area["osm"] or ref == area["wd"] or ref == area["name"]


def assign(resorts: list, areas: dict, lifts: list, runs: list) -> tuple[dict, dict]:
    """The liftradar resort ("<country>/<id>") of each lift and run, by their index.

    Each resort claims ski areas: those near it whose name matches its own best (or at all,
    within NEAR_M), and the nearest one with a lift within NEAR_M unless another resort claimed
    that one by name (scripts/ski_overrides.json adds or removes claims).
    A lift or run then goes to the smallest of its areas that was claimed: an area that is a
    sector of a bigger one claimed by another resort stays with its own resort, and an area a
    ski pass groups (Ski amadé, Les Portes du Soleil) only counts when a resort claims it. In an
    area claimed by several resorts, a lift goes to the nearest of them (within SECTOR_M for a
    resort that only claimed it as its nearest), and a run with the nearest of that area's lifts.
    """
    overrides = load_overrides()
    keys = {f"{r['country']}/{r['id']}": r for r in resorts if r.get("location")}
    here = {k: (r["location"]["lon"], r["location"]["lat"]) for k, r in keys.items()}
    anchor = here | {k: tuple(p) for k, p in overrides.get("points", {}).items() if k in here}
    size = defaultdict(int)
    for f in lifts:
        for a in f["_areas"]:
            size[a] += 1
    for f in lifts + runs:
        f["_areas"].sort(key=lambda a: (size.get(a, 0), a))  # smallest first
    lines = [LineString([c[:2] for c in f["_coords"]]) for f in lifts]
    tree = shapely.STRtree(lines)

    claims = defaultdict(set)  # area -> resorts
    by_name = defaultdict(set)  # area -> the resorts that claimed it by name
    nearest = {}
    for k, p in here.items():
        found: dict[str, float] = {}  # area -> distance to its nearest lift
        for i in tree.query(around(p, NEAR_NAMED_M)):
            d = distance(p, lines[int(i)])
            for a in lifts[int(i)]["_areas"]:
                found[a] = min(d, found.get(a, math.inf))
        own = words(keys[k]["name"]) | words(keys[k]["id"])
        overlap = {a: len(words(areas[a]["name"]) & own) for a, d in found.items() if d <= NEAR_NAMED_M}
        best = max(overlap.values(), default=0)
        for a, n in overlap.items():
            # The best match, and any other match in reach (Alpe Lusia - San Pellegrino).
            if n and (n == best or found[a] <= NEAR_M):
                claims[a].add(k)
                by_name[a].add(k)
        if close := [(d, size[a], a) for a, d in found.items() if d <= NEAR_M]:
            nearest[k] = min(close)[2]
    # The nearest area too, unless another resort claimed it by name (Shuttleberg, by Snow Space
    # Salzburg's point); a resort without a name match takes it in any case, as a sector.
    for k, a in nearest.items():
        named = any(k in v for v in by_name.values())
        if not named or not by_name.get(a):
            claims[a].add(k)
    for k, refs in overrides.get("claims", {}).items():
        for a, area in areas.items():
            if any(area_matches(area, ref) for ref in refs):
                claims[a].add(k)
                by_name[a].add(k)
    for k, refs in overrides.get("ignore", {}).items():
        for a, area in areas.items():
            if any(area_matches(area, ref) for ref in refs):
                claims[a].discard(k)

    def claimed(f):
        return next((a for a in f["_areas"] if claims.get(a)), None)

    lift_lr: dict[int, str] = {}
    for i, f in enumerate(lifts):
        a = f["_home"] = claimed(f)
        if a:
            claimants = claims[a]
            if len(claimants) == 1:
                lift_lr[i] = next(iter(claimants))
            else:
                options = [(distance(anchor[k], lines[i]), k) for k in claimants]
                options = [(d, k) for d, k in options if k in by_name[a] or d <= SECTOR_M]
                if options:
                    lift_lr[i] = min(options)[1]
        elif not f["_areas"]:
            start = f["_coords"][0]
            options = [(distance(p, lines[i]), k) for k, p in here.items() if abs(p[1] - start[1]) < 0.05]
            if options := [o for o in options if o[0] <= LONE_M]:
                lift_lr[i] = min(options)[1]

    lifts_in = defaultdict(list)  # area -> its assigned lifts, for the runs of shared areas
    for i, k in lift_lr.items():
        if a := lifts[i]["_home"]:
            lifts_in[a].append(i)
    trees = {}
    run_lr: dict[int, str] = {}
    for j, f in enumerate(runs):
        a = f["_home"] = claimed(f)
        if not a:
            continue
        if len(claims[a]) == 1:
            run_lr[j] = next(iter(claims[a]))
        elif lifts_in[a]:
            if a not in trees:
                trees[a] = shapely.STRtree([lines[i] for i in lifts_in[a]])
            run_lr[j] = lift_lr[lifts_in[a][int(trees[a].nearest(f["_geom"].centroid))]]
    return lift_lr, run_lr


def outlines(resorts: list, lifts: list, runs: list, lift_lr: dict, run_lr: dict, areas: dict) -> list:
    """A feature per resort with lifts: outline, map point and counts (ski/v1/resorts.geojson)."""
    members = defaultdict(lambda: ([], []))
    for i, k in lift_lr.items():
        members[k][0].append(i)
    for j, k in run_lr.items():
        members[k][1].append(j)
    features = []
    for r in resorts:
        k = f"{r['country']}/{r['id']}"
        if k not in members or not r.get("location"):
            continue
        lift_ids, run_ids = members[k]
        here = (r["location"]["lon"], r["location"]["lat"])
        to_m, to_deg = projector(here)
        pieces = [to_m(LineString([c[:2] for c in lifts[i]["_coords"]])).buffer(LIFT_BUFFER_M) for i in lift_ids]
        downhill = [j for j in run_ids if "downhill" in (runs[j]["properties"].get("uses") or [])]
        for j in downhill:
            g = to_m(runs[j]["_geom"])
            pieces.append(g if g.geom_type in ("Polygon", "MultiPolygon") else g.buffer(RUN_BUFFER_M))
        geom = shape_outline(shapely.union_all(pieces))
        km = sum(to_m(runs[j]["_geom"]).length for j in downhill if runs[j]["_geom"].geom_type == "LineString") / 1000
        point = map_point(here, geom, [lifts[i]["_coords"] for i in lift_ids], to_m, to_deg)
        outline = json.loads(json.dumps(mapping(to_deg(geom))), parse_float=lambda f: round(float(f), 5))
        names = sorted({areas[a]["name"] for i in lift_ids if (a := lifts[i]["_home"]) and areas[a]["name"]})
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": k,
                    "point": point,
                    "lifts": len(lift_ids),
                    "runs": len(downhill),
                    "km": round(km, 1),
                    "areas": names,
                },
                "geometry": outline,
            }
        )
    return features


def shape_outline(geom):
    """Lifts and runs widened and merged into an area: gaps closed, then strips narrower than
    OPEN_M (a long cable car or train across a valley) and islands under ISLAND_M2 removed,
    unless that would leave nothing (a small area of one lift and run), and small holes filled."""
    closed = geom.buffer(CLOSE_M).buffer(-CLOSE_M)
    opened = closed.buffer(-OPEN_M).buffer(OPEN_M)
    parts = [p for p in getattr(opened, "geoms", [opened]) if p.area >= ISLAND_M2]
    if not parts:
        parts = sorted(getattr(closed, "geoms", [closed]), key=lambda p: -p.area)[:1]
    return fill_holes(shapely.union_all(parts)).simplify(OUTLINE_SIMPLIFY_M)


def fill_holes(geom):
    polygons = getattr(geom, "geoms", [geom])
    filled = []
    for p in polygons:
        if p.is_empty:
            continue
        holes = [h for h in p.interiors if shapely.Polygon(h).area >= HOLE_M2]
        filled.append(shapely.Polygon(p.exterior, holes))
    return shapely.MultiPolygon(filled) if len(filled) > 1 else filled[0]


def map_point(here: tuple, geom, lift_coords: list, to_m, to_deg) -> list:
    """The resort's point on the map: its location when that's in the outline; otherwise the
    bottom station nearest to it in the outline's part nearest to it, where the area starts."""
    if geom.buffer(1).contains(Point(0, 0)):
        return [round(here[0], 5), round(here[1], 5)]
    main = min(getattr(geom, "geoms", [geom]), key=lambda p: p.distance(Point(0, 0))).buffer(LIFT_BUFFER_M)
    inside = [c for c in lift_coords if main.intersects(to_m(LineString([x[:2] for x in c])))]
    bottoms = []
    for coords in inside or lift_coords:
        a, b = coords[0], coords[-1]
        low = a if len(a) < 3 or len(b) < 3 or (a[2] or 0) <= (b[2] or 0) else b
        bottoms.append(low[:2])
    best = min(bottoms, key=lambda c: to_m(Point(c)).distance(Point(0, 0)))
    return [round(best[0], 5), round(best[1], 5)]
