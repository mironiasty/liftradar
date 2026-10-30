"""Write the ski-area outlines shown on the map, from OpenStreetMap.

Reads every `landuse=winter_sports` area in the regions from the Overpass API and
gives each to a resort: an area within 1 km of several resorts' points is split
between them, each getting the part nearest to its
point; any other area goes to the nearest resort within 2.5 km, or 8 km when the
names share a word. Resorts without an area stay a marker only. Run it by hand
now and then, e.g. after adding resorts, and check the map:

    uv run --no-project --with shapely python3 scripts/resort_areas.py data/json/index.json assets/areas.geojson

When Overpass is down or at capacity, read the areas from OpenStreetMap extracts instead
(scripts/osm_ski_areas.py) and pass its file as a third argument, `elements.json`.

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
# South, west, north, east: all resorts with some margin.
BBOXES = [
    (45.4, 6.7, 48.9, 16.0),  # the Alps
    (48.5, 12.0, 51.1, 18.9),  # Czechia, and the Sudetes in Poland
    (48.7, 18.9, 49.9, 23.0),  # the Polish and Slovak Carpathians
    (43.9, 5.4, 46.9, 7.3),  # the French Alps and the Jura
    (42.4, -1.0, 43.1, 2.3),  # the Pyrenees
    (44.9, 2.6, 45.7, 3.0),  # the Massif Central
    (47.9, 6.7, 48.2, 7.2),  # the Vosges
    (59.9, 21.0, 68.6, 30.0),  # Finland
    (47.6, 7.5, 51.9, 13.0),  # the German uplands (Black Forest to the Harz and the Ore Mountains)
    (58.0, 4.9, 70.5, 25.0),  # Norway
]

# Areas split between the given resorts (or given to the one), however far their points are.
SHARED = {
    "relation/10938000": ["kitzbuehel"],  # KitzSki, reaching Pass Thurn far from the Kitzbühel point
    # Areas near another resort's point that belong to one resort only (not split between them).
    "way/342015965": ["zahmer-kaiser-walchsee"],  # not Amberglift, whose point is the same village
    "way/341994406": ["shuttleberg-flachauwinkl-kleinarl"],  # not Snow Space Salzburg (Flachau)
    "way/461926159": ["zauchensee-flachauwinkl"],  # not Shuttleberg, which starts in Flachauwinkl too
    "way/660590648": ["ehrwalder-wettersteinbahnen"],  # not Tiroler Zugspitzbahn or Ehrwalder Alm
    "way/665167529": ["birkenlift-geigenbuehel-seefeld"],  # not Gschwandtkopf or Rosshütte
    "way/1011845654": ["slotwiny-arena"],  # Słotwiny Arena and Słotwiny are 0.5 km apart
    "way/1354997224": ["slotwiny"],
    "way/253071356": ["nosal"],  # not Kasprowy Wierch (Kuźnice)
    "way/341898611": ["hauser-kaibling"],  # not Planai
    "way/660162742": ["ramsau-am-dachstein"],  # not Dachstein Gletscher, whose point is in Ramsau
    "way/1013572562": ["strazne"],
    "way/1011094044": ["korenov-rejdice"],
    "way/1280389295": ["mala-moravka-koprivna"],
    "way/1172779587": ["ostruzna"],
    "way/1125475308": ["grapa-czarna-gora"],
    "way/961996791": ["beskid-sport-arena"],
    "way/539446463": ["fuessener-joechle-graen"],
    "way/1445279089": ["oberholz-farner"],
    "way/665166827": ["sudelfeld"],  # not Wendelstein, whose point is in Bayrischzell
    "way/1059016836": ["winterberg"],  # not Sahnehang
    "way/1465730346": ["hundseck"],  # not Mehliskopf
    "way/1210934062": ["wurmberg-braunlage"],  # not the Skiwiese in Braunlage
}
# Areas never used.
EXCLUDE = {
    "way/642259707",  # Aiguille du Midi (Chamonix), near Courmayeur's point
    "relation/7768194",  # Stubai: the whole valley, would go to Serlesbahnen Mieders
    # Ski passes grouping separate areas: cut up between their resorts, they'd add the areas we
    # don't cover. Each resort has its own area too.
    "relation/13798382",  # Dolomiti Superski
    "relation/8896547",  # Ski amadé
    "relation/8896546",  # Schladming Dachstein
    "relation/19457834",  # Les Portes du Soleil
    "relation/20949265",  # Espace Liberté
    "relation/7751891",  # Klausberg Skiarena (Klausberg, Speikboden)
    "relation/7718003",  # Hochoetz-Kühtai
    # Areas next to a resort that aren't part of it and have one lift (or none): not covered.
    # Neighbours with more lifts are resorts of their own.
    "way/1560648156",  # Beskidek (Szczyrk)
    "way/389968311",  # Skalite ski jumps (Szczyrk)
    "way/1220968908",  # COS OPO Zakopane: the ski jumps' chairlifts
    "way/1158672530",  # Bania (Białka): a children's area, no published size
    "way/1029327305",  # Żółwik (Karpacz)
    "way/391762114",  # Karpatka Panorama (Karpacz)
    "way/392212792",  # Stok Karpatka (Karpacz)
    "way/391767435",  # Stok Relaks (Karpacz)
    "way/391768061",  # Pod Wangiem (Karpacz)
    "way/460412448",  # Winterpol (Karpacz)
    "way/1013756087",  # Cypisek (Korbielów)
    "way/1013756090",  # Andiamo (Korbielów)
    "way/1561819655",  # Kolej Baba (Korbielów)
    "way/1010774426",  # U Lišáka (Klínovec)
    "way/104293575",  # Start (Deštné)
    "way/310924064",  # Světlý vrch (Albrechtice): two village lifts, no source
    "way/1463727384",  # Schollenwiesenlift Höfen
    "way/362231433",  # Toni Seelos ski jumps (Seefeld)
    "relation/10356622",  # Gföllberglift (Lechtal)
    "way/664675357",  # Hausberglift Waidring
    "way/1016830386",  # Bergisel ski jump (Innsbruck)
    "way/404378976",  # Pyhätunturi - Luosto, both resorts and the fells between them
    "relation/7772597",  # Kleinwalsertal-Oberstdorf, around Fellhorn, Nebelhorn and Söllereck
    "way/1223310721",  # Heini-Klopfer ski-flying hill (Oberstdorf)
    "way/1132486323",  # Nordic Zentrum Oberstdorf
    "way/25094717",  # Orlen Arena ski jumps (Oberstdorf)
    "way/1017065576",  # Olympiaschanzen ski jumps (Garmisch-Partenkirchen)
    "way/777486417",  # Eckbauer (Garmisch-Partenkirchen): never reports
    "way/1021712181",  # Steckenberg (Unterammergau), not Kolbensattel
}

NEAR_KM = 1.0  # an area this close to several resorts is split between them
MAX_KM = 2.5
MAX_KM_SAME_NAME = 8.0
SIMPLIFY_DEG = 0.0002  # about 20 m

# Local equirectangular projection in km, good enough for distances in Central Europe.
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
    """One query per box (all of them at once times out), without the areas boxes share."""
    elements = {}
    for box in BBOXES:
        b = ",".join(map(str, box))
        query = f"""[out:json][timeout:240];
(way["landuse"="winter_sports"]({b});relation["landuse"="winter_sports"]({b}););
out geom;"""
        request = urllib.request.Request(
            OVERPASS_URL,
            data=urllib.parse.urlencode({"data": query}).encode(),
            headers={"User-Agent": "liftradar (https://liftradar.eu)"},
        )
        with urllib.request.urlopen(request, timeout=300) as response:
            elements |= {(e["type"], e["id"]): e for e in json.load(response)["elements"]}
    return list(elements.values())


def in_boxes(element: dict) -> bool:
    """Whether the element has a point in one of BBOXES (what Overpass would have returned)."""
    points = element.get("geometry") or [p for m in element.get("members", []) for p in m.get("geometry", [])]
    return any(s <= p["lat"] <= n and w <= p["lon"] <= e for p in points for s, w, n, e in BBOXES)


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
    if len(sys.argv) > 3:  # read from extracts (scripts/osm_ski_areas.py)
        elements = [e for e in json.loads(Path(sys.argv[3]).read_text(encoding="utf-8")) if in_boxes(e)]
    else:
        elements = download()
    collection = areas(index, elements)
    target.write_text(json.dumps(collection, separators=(",", ":")) + "\n", encoding="utf-8")
    found = {f["properties"]["id"] for f in collection["features"]}
    missing = sorted(r["name"] for r in index["resorts"] if r["id"] not in found)
    print(f"{target}: {len(found)} of {len(index['resorts'])} resorts")
    print("Without an area:", ", ".join(missing))


if __name__ == "__main__":
    main()
