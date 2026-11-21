"""Find resorts whose share of OpenSkiData's lifts looks wrong, and check a fix to ski_overrides.json.

Reads built ski tiles (`<ski>/v1`, from the release ski-latest or ski_tiles.py) and liftradar's
json/index.json; the rules it checks are ski_resorts.py's (README, "Ski tiles").

    uv run --no-project --with shapely python3 scripts/ski_split_check.py ski ../liftradar-data/json/index.json

- With no option: each resort whose lift count on the map is far from its report's (map counts
  include practice lifts and carpets, so only large gaps are listed), and each area several
  resorts share.
- `--lifts at/planai ...`: those resorts' lifts on the map, by name.
- `--assign`: runs ski_resorts.assign() again on the tiles' lifts, with the current
  scripts/ski_overrides.json and the index's resorts, and lists the resorts whose lift count
  changes. This needs no OpenSkiData download. Add `--before <overrides.json>` (e.g. from
  `git show origin/main:scripts/ski_overrides.json`) to compare with a run on those overrides:
  without it the comparison is with the tiles, which were built from an older index, so a few
  resorts change for that reason alone. Runs aren't in it (their share follows the lifts'), so
  check the map once the tiles are built.
"""

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import ski_resorts
from shapely.geometry import LineString, Point

MORE = 1.6  # listed when the map has this many times the report's lifts (and FEW more),
LESS = 0.6  # or this share of them (and FEW fewer)
FEW = 3


def load_lifts(ski: Path) -> tuple[dict, list]:
    """OpenSkiData's areas (by OSM id, else name) and lifts, once each, from the tiles."""
    areas, lifts, seen = {}, [], set()
    for path in sorted((ski / "v1" / "10").glob("*/*.json")):
        tile = json.loads(path.read_text(encoding="utf-8"))
        for lift in tile["lifts"]:
            if lift["osm"] in seen:
                continue
            seen.add(lift["osm"])
            keys = []
            for i in lift.get("areas", []):
                area = tile["areas"][i]
                key = area.get("osm") or area.get("name")
                areas[key] = {
                    "name": area.get("name"),
                    "osm": [area["osm"]] if area.get("osm") else [],
                    "wd": area.get("wd"),
                }
                keys.append(key)
            # As ski_tiles.py gives them to assign(): the line (for "clip") and the OSM id (for "features").
            lifts.append(
                {
                    "_areas": keys,
                    "_coords": lift["c"],
                    "_geom": LineString([c[:2] for c in lift["c"]]) if len(lift["c"]) > 1 else Point(lift["c"][0][:2]),
                    "properties": {"sources": [{"type": "openstreetmap", "id": lift["osm"]}]},
                    "name": lift.get("name"),
                    "lr": lift.get("lr"),
                }
            )
    if not lifts:
        raise SystemExit(f"no tiles in {ski / 'v1' / '10'}")
    return areas, lifts


def report_lifts(resort: dict) -> int | None:
    return (resort.get("lifts") or {}).get("total")


def gaps(ski: Path, resorts: dict) -> None:
    features = json.loads((ski / "v1" / "resorts.geojson").read_text(encoding="utf-8"))["features"]
    on_map = {f["properties"]["id"]: f["properties"] for f in features}
    print("Lifts on the map far from the report's (report / map):")
    for key, props in sorted(on_map.items()):
        reported = report_lifts(resorts.get(key, {}))
        if reported and (props["lifts"] >= MORE * reported + FEW or props["lifts"] <= LESS * reported - FEW):
            print(f"  {key:40} {reported:4} / {props['lifts']:4}  {', '.join(props['areas'])}")
    shared = defaultdict(list)
    for key, props in on_map.items():
        for area in props["areas"]:
            shared[area].append(key)
    print("\nAreas shared by several resorts (report / map):")
    for area, keys in sorted(shared.items(), key=lambda item: -len(item[1])):
        if len(keys) > 1:
            parts = ", ".join(f"{k} {report_lifts(resorts.get(k, {}))} / {on_map[k]['lifts']}" for k in keys)
            print(f"  {area}: {parts}")


def names(lifts: list, keys: list[str], field: str = "lr") -> None:
    for key in keys:
        found = sorted((f["name"] or "?", f["_coords"][0][0], f["_coords"][0][1]) for f in lifts if f[field] == key)
        print(f"{key} ({len(found)}):")
        for name, lon, lat in found:
            print(f"  {name} [{lon:.3f}, {lat:.3f}]")


def run(areas: dict, lifts: list, resorts: dict) -> dict[int, str]:
    lift_lr, _ = ski_resorts.assign(list(resorts.values()), areas, [dict(f) for f in lifts], [])
    return lift_lr


def assign(areas: dict, lifts: list, resorts: dict, show: list[str], before_file: str | None) -> None:
    if before_file:
        current = ski_resorts.load_overrides
        ski_resorts.load_overrides = lambda: json.loads(Path(before_file).read_text(encoding="utf-8"))
        old = run(areas, lifts, resorts)
        ski_resorts.load_overrides = current
        for i, f in enumerate(lifts):
            f["lr"] = old.get(i)
    new = run(areas, lifts, resorts)
    for i, f in enumerate(lifts):
        f["new"] = new.get(i)
    before, after = Counter(f["lr"] for f in lifts), Counter(f["new"] for f in lifts)
    changed = sorted((k for k in set(before) | set(after) if k and before[k] != after[k]), key=str)
    print(f"Lifts per resort, {'before' if before_file else 'tiles'} → with the current overrides (report):")
    for key in changed:
        print(f"  {key:40} {before[key]:4} → {after[key]:4}  ({report_lifts(resorts.get(key, {}))})")
    if not changed:
        print("  no change")
    if show:
        names(lifts, show, "new")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ski", help="the tiles' folder, holding v1/")
    parser.add_argument("index", help="liftradar's json/index.json")
    parser.add_argument("--lifts", nargs="+", default=[], metavar="RESORT", help='e.g. "at/planai"')
    parser.add_argument("--assign", action="store_true", help="re-run the assignment with the current overrides")
    parser.add_argument("--before", metavar="OVERRIDES", help="with --assign: compare with a run on these overrides")
    args = parser.parse_args()
    ski = Path(args.ski)
    index = json.loads(Path(args.index).read_text(encoding="utf-8"))["resorts"]
    resorts = {f"{r['country']}/{r['id']}": r for r in index}
    if args.assign:
        areas, lifts = load_lifts(ski)
        assign(areas, lifts, resorts, args.lifts, args.before)
    elif args.lifts:
        names(load_lifts(ski)[1], args.lifts)
    else:
        gaps(ski, resorts)


if __name__ == "__main__":
    main()
