"""Write the ski-area outlines shown on the map, from OpenStreetMap.

Reads every `landuse=winter_sports` area in the region from the Overpass API and
gives each to a resort: an area within 1 km of several resorts' points (SkiWelt,
Zillertal Arena) is split between them, each getting the part nearest to its
point; any other area goes to the nearest resort within 2.5 km, or 8 km when the
names share a word. Resorts without an area stay a marker only. Run it by hand
now and then, e.g. after adding resorts, and check the map:

    uv run --no-project --with shapely python3 scripts/resort_areas.py data/json/index.json assets/areas.geojson

Fix wrong matches in SHARED and EXCLUDE below.
"""

import json
import math
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import shapely
from shapely.geometry import LineString, MultiPoint, Point, Polygon, mapping
from shapely.ops import polygonize, unary_union

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
BBOX = (45.4, 6.7, 48.9, 16.0)  # south, west, north, east: all resorts with some margin

# Areas split between the given resorts, however far their points are.
SHARED = {
    "relation/10938000": ["kitzbuehel", "mittersill-pass-thurn-kitzbuehel"],  # KitzSki
}
# Areas never used.
EXCLUDE = {
    "way/642259707",  # Aiguille du Midi (Chamonix), near Courmayeur's point
    "relation/7768194",  # Stubai: the whole valley, would go to Serlesbahnen Mieders
}

NEAR_KM = 1.0  # an area this close to several resorts is split between them
MAX_KM = 2.5
MAX_KM_SAME_NAME = 8.0
SIMPLIFY_DEG = 0.0002  # about 20 m

# Local equirectangular projection in km, good enough for distances in the Alps.
KM_PER_DEG = (111.32 * math.cos(math.radians(47)), 111.32)


def to_km(geom):
    return shapely.transform(geom, lambda c: c * KM_PER_DEG)


def to_deg(geom):
    return shapely.transform(geom, lambda c: c / KM_PER_DEG)


def fold(text: str) -> str:
    """Lowercase without accents, so "Sölden" matches "solden"."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c)).casefold()


GENERIC = {"ski", "skigebiet", "area", "sci", "comprensorio", "bergbahnen", "der", "und", "and", "san", "skiarena", "skiregion"}


def words(text: str) -> set[str]:
    return {w for w in re.split(r"[^a-z0-9]+", fold(text)) if len(w) > 2 and w not in GENERIC}


def download() -> list[dict]:
    south, west, north, east = BBOX
    query = f"""[out:json][timeout:240];
(way["landuse"="winter_sports"]({south},{west},{north},{east});
 relation["landuse"="winter_sports"]({south},{west},{north},{east}););
out geom;"""
    request = urllib.request.Request(
        OVERPASS_URL,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "snow-conditions (https://snow.miron.asia)"},
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)["elements"]


def outline(element: dict):
    """The element's polygon in degrees, or None when it isn't a closed area."""
    line = lambda points: LineString([(p["lon"], p["lat"]) for p in points])
    if element["type"] == "way":
        points = element["geometry"]
        if len(points) < 4 or points[0] != points[-1]:
            return None
        geom = Polygon([(p["lon"], p["lat"]) for p in points])
    else:
        members = [m for m in element["members"] if m.get("geometry")]
        rings = lambda role: unary_union(list(polygonize(unary_union([line(m["geometry"]) for m in members if m.get("role") == role]))))
        geom = rings("outer").difference(rings("inner"))
    geom = geom if geom.is_valid else geom.buffer(0)
    return None if geom.is_empty else geom


def split(area, points: dict[str, Point]) -> dict:
    """The part of the area nearest to each point."""
    cells = shapely.voronoi_polygons(MultiPoint(list(points.values())), extend_to=area.envelope.buffer(50))
    parts = {}
    for resort_id, point in points.items():
        cell = next(c for c in cells.geoms if c.contains(point))
        part = area.intersection(cell)
        if not part.is_empty:
            parts[resort_id] = part
    return parts


def areas(index: dict, elements: list[dict]) -> dict:
    resorts = {r["id"]: r for r in index["resorts"] if r.get("location")}
    points = {i: to_km(Point(r["location"]["lon"], r["location"]["lat"])) for i, r in resorts.items()}
    parts: dict[str, list] = {}  # resort id -> [(osm id, area in km)]

    for element in elements:
        osm_id = f"{element['type']}/{element['id']}"
        if osm_id in EXCLUDE or not (geom := outline(element)):
            continue
        area = to_km(geom)
        name = words(element.get("tags", {}).get("name", ""))
        if osm_id in SHARED:
            near = [i for i in SHARED[osm_id] if i in points]
        else:
            near = [i for i, p in points.items() if area.distance(p) <= NEAR_KM]
        if len(near) > 1:
            for resort_id, part in split(area, {i: points[i] for i in near}).items():
                parts.setdefault(resort_id, []).append((osm_id, part))
            continue
        candidates = []
        for resort_id, point in points.items():
            same_name = bool(name & (words(resorts[resort_id]["name"]) | words(resort_id)))
            distance = area.distance(point)
            if distance <= (MAX_KM_SAME_NAME if same_name else MAX_KM):
                candidates.append((distance - (3 if same_name else 0), resort_id))
        if candidates:
            parts.setdefault(min(candidates)[1], []).append((osm_id, area))

    features = []
    for resort_id in sorted(parts, key=lambda i: (resorts[i]["country"], i)):
        geom = to_deg(unary_union([area for _, area in parts[resort_id]])).simplify(SIMPLIFY_DEG, preserve_topology=True)
        geom = json.loads(json.dumps(mapping(geom)), parse_float=lambda f: round(float(f), 5))
        osm = sorted({osm_id for osm_id, _ in parts[resort_id]})
        features.append({"type": "Feature", "properties": {"id": resort_id, "osm": osm}, "geometry": geom})
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    index = json.loads(source.read_text(encoding="utf-8"))
    collection = areas(index, download())
    target.write_text(json.dumps(collection, separators=(",", ":")) + "\n", encoding="utf-8")
    found = {f["properties"]["id"] for f in collection["features"]}
    missing = sorted(r["name"] for r in index["resorts"] if r["id"] not in found)
    print(f"{target}: {len(found)} of {len(index['resorts'])} resorts")
    print("Without an area:", ", ".join(missing))


if __name__ == "__main__":
    main()
