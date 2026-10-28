"""Read the ski areas (`landuse=winter_sports`) from OpenStreetMap extracts, for resort_areas.py.

When Overpass is down or at capacity, download the Geofabrik extracts covering resort_areas.py's
BBOXES (https://download.geofabrik.de, e.g. europe/austria-latest.osm.pbf; regional ones for
Italy, France, Poland and Germany) and run:

    uv run --no-project --with osmium python3 scripts/osm_ski_areas.py elements.json extracts/*.osm.pbf

It writes the areas in the shape of Overpass's `out geom` (ways with `geometry`, relations with
`members` that carry theirs), the ones in several extracts once. Then pass the file to
resort_areas.py as its third argument. Data © OpenStreetMap contributors (ODbL).
"""

import json
import sys
from pathlib import Path

import osmium
from osmium.filter import IdFilter, TagFilter
from osmium.osm import NODE, RELATION, WAY


def read(path: Path) -> list[dict]:
    """The extract's ski areas: three passes, each reading only what the one before needs."""
    ways, relations = {}, {}
    for o in osmium.FileProcessor(str(path), WAY | RELATION).with_filter(TagFilter(("landuse", "winter_sports"))):
        tags = dict(o.tags)
        if o.is_way():
            ways[o.id] = {"tags": tags, "nodes": [n.ref for n in o.nodes]}
        else:
            members = [(m.ref, m.role) for m in o.members if m.type == "w"]
            relations[o.id] = {"tags": tags, "members": members}
    member_ids = {ref for r in relations.values() for ref, _ in r["members"]} - set(ways)
    member_nodes = {}
    if member_ids:
        for w in osmium.FileProcessor(str(path), WAY).with_filter(IdFilter(member_ids)):
            member_nodes[w.id] = [n.ref for n in w.nodes]
    node_ids = {n for w in ways.values() for n in w["nodes"]} | {n for nodes in member_nodes.values() for n in nodes}
    points = {}
    if node_ids:
        for n in osmium.FileProcessor(str(path), NODE).with_filter(IdFilter(node_ids)):
            points[n.id] = {"lat": round(n.location.lat, 7), "lon": round(n.location.lon, 7)}

    def geometry(nodes: list[int]) -> list[dict]:
        return [points[n] for n in nodes if n in points]  # nodes cut off at the extract's edge are left out

    elements = [{"type": "way", "id": i, "tags": w["tags"], "geometry": geometry(w["nodes"])} for i, w in ways.items()]
    for i, r in relations.items():
        members = []
        for ref, role in r["members"]:
            nodes = ways[ref]["nodes"] if ref in ways else member_nodes.get(ref)
            if nodes:
                members.append({"type": "way", "ref": ref, "role": role, "geometry": geometry(nodes)})
        elements.append({"type": "relation", "id": i, "tags": r["tags"], "members": members})
    return elements


def complete(element: dict) -> int:
    """How many points the element has: of an area in two extracts, the one cut least by an edge wins."""
    if element["type"] == "way":
        return len(element["geometry"])
    return sum(len(m["geometry"]) for m in element["members"])


def main() -> None:
    target, sources = Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]]
    elements: dict[tuple[str, int], dict] = {}
    for path in sources:
        found = read(path)
        print(f"{path.name}: {len(found)} areas")
        for e in found:
            key = (e["type"], e["id"])
            if key not in elements or complete(e) > complete(elements[key]):
                elements[key] = e
    target.write_text(json.dumps(list(elements.values())) + "\n", encoding="utf-8")
    print(f"{target}: {len(elements)} areas")


if __name__ == "__main__":
    main()
