"""Link the ski tiles' lifts and runs to the lifts and slopes of the experimental details files, so the map can
draw them by status. Each linked lift or run gets `item`, "<country>/<id>/<item id>": the resort whose
json/<country>/<id>.details.json lists it, and its id there.

There's no shared id: the details come from the resorts' Intermaps slope maps and from the sources that list lifts
and slopes one by one (infosnow, Lumiplan, ...; their ids are made from the name when the source has none), none of
which have coordinates. An item is matched to the OpenStreetMap lines in and around its resort (within NEARBY_KM of
the resort's own lifts) by its number (`ref`, or the code its name starts with), its name with lift-type words left out, its lift type or
slope difficulty and, for lifts, the length and the altitudes of its stations. The best pairs go first, each
lift and slope once; a slope takes every OSM segment with its name and number. A resort's own lines go to its own
list first; a neighbour's list (whose map may show them too) only gets those still unlinked afterwards, and only
with a known status. About 82% of the lifts and 72% of the slopes match, nearly all correctly
(docs/plans/2026-11-13-lift-details.md in liftradar-fetcher).

`lengths` then measures the linked lifts and slopes on the map, for lengths.json, which liftradar-fetcher reads as the
details' `map_length_m` (DEVELOPMENT.md "Ski tiles").

ski_tiles.py calls `link` and `lengths` while it builds the tiles. To link tiles that are already built (e.g. to try it out):

    python3 scripts/lift_links.py ../liftradar-data/json ski
"""

import argparse
import hashlib
import itertools
import json
import math
import re
import sys
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

NEARBY_KM = 4

# --- names ---------------------------------------------------------------------------------------------------

FOLD = str.maketrans({"ß": "ss", "ä": "a", "ö": "o", "ü": "u", "'": "", "’": "", '"': " "})
# Lift-type and slope words, and the maps' abbreviations (10EUB, 6er-SB, KSB, ...), in the Alps' languages.
GENERIC = re.compile(
    r"\b(\d+\s*(er|ser|p|pl)?[-\s]?)?(e?ub|g?eub|kseb|ksb|ksl|ksk|sb|sk|ssb|sl|dsl|ds|gub|gb|pb|lsb|gsb|kb|ts|tsd|"
    r"cb|ss|sesselbahn|sessellift|sessel|gondelbahn|gondel|kabinenbahn|seilbahn|luftseilbahn|pendelbahn|"
    r"standseilbahn|schlepplift|schlepper|tellerlift|zauberteppich|forderband|forderbander|teppich|kombibahn|"
    r"seggiovia|cabinovia|funivia|sciovia|skilift|tapis|telesiege|telecabine|teleski|chairlift|chair|gondola|"
    r"lift|t-bar|express|bahn|sektion|section|tronco|nur fur skischulbetrieb|piste|abfahrt|pista|talabfahrt|"
    r"skiroute|ski route|route|nr|no|verbindung|verbindungspiste|skiweg|schiweg|umfahrung|ubungshang|"
    r"ubungsgelande|ubungslift|uebungslift|variante|pisten|skipiste|mountain|valley|station|berg|tal|mitte)\b"
)
ROMAN = re.compile(r"\b(i{1,3}|iv|v|vi{0,3}|[1-9])\b$")
CODE = re.compile(r"^\s*([A-Za-z]{0,2}\d{1,3}[a-z]?|[IVX]{1,4}|[A-Z])[.)]?(\s+(?=\S)|$)")
NUMBER = re.compile(r"\b(?:nr\.?|no\.?|piste|pista|skiroute)\s*(\d{1,3}[a-z]?)\b", re.IGNORECASE)
TYPE_CODE = re.compile(r"^\d+[A-Z]{2,}\b")  # 10EUB, 6SK: a lift type, not a number
# Kinds of slope that mustn't match each other: a ski way isn't a practice area.
CATEGORIES = [
    ("way", ("skiweg", "schiweg", "verbindung", "umfahrung", "ziehweg", "zubringer")),
    ("practice", ("ubungs", "kinderland", "kinder", "baby", "anfanger", "zauberteppich", "forderband")),
    ("route", ("skiroute", "freeride", "route")),
    ("valley", ("talabfahrt",)),
]


def fold(s: str | None) -> str:
    s = (s or "").lower().translate(FOLD)
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def code_of(name: str | None) -> str | None:
    """The number a name starts with ("A1 Silvrettabahn", "32. Millennium-Express", "Piste Nr. 19")."""
    if TYPE_CODE.match(name or ""):
        return None
    m = CODE.match(name or "") or NUMBER.search(name or "")
    return m.group(1).lower() if m else None


def core(name: str | None) -> tuple[str, str | None]:
    """The distinctive words of a name, and its section numeral (I, II, 2) if it ends with one."""
    s = name or ""
    if not TYPE_CODE.match(s):
        s = CODE.sub("", s)
    s = re.sub(r"\(.*?\)", " ", fold(s))
    s = GENERIC.sub(" ", re.sub(r"[^a-z0-9 ]", " ", s))
    s = re.sub(r"(bahn|lift|sesselbahn|express|abfahrt)\b", " ", s)  # compounds: "kuhalmlift"
    words = s.split()
    numeral = words[-1] if words and ROMAN.match(words[-1]) else None
    return " ".join(w for w in words if w != numeral and len(w) > 1), numeral


def same_numeral(a: str | None, b: str | None) -> bool:
    arabic = {"1": "i", "2": "ii", "3": "iii", "4": "iv"}
    return not (a and b) or arabic.get(a, a) == arabic.get(b, b)


def name_similarity(a: str | None, b: str | None) -> float:
    (ca, na), (cb, nb) = core(a), core(b)
    if not ca or not cb or not same_numeral(na, nb):
        return 0.0
    da, db = set(re.findall(r"\d+[a-z]?", ca)), set(re.findall(r"\d+[a-z]?", cb))
    if da and db and not da & db:
        return 0.0
    ca, cb = re.sub(r"\d+[a-z]?", " ", ca).strip(), re.sub(r"\d+[a-z]?", " ", cb).strip()
    if not ca or not cb:
        return 0.0
    sa, sb = ca.replace(" ", ""), cb.replace(" ", "")
    r = SequenceMatcher(None, sa, sb).ratio()
    short, long_ = sorted((sa, sb), key=len)
    ta, tb = set(ca.split()), set(cb.split())
    small, big = sorted((ta, tb), key=len)
    # One name a large part of the other ("madritschen" in "madritschenbahn"), or all its words in it.
    if len(short) >= 4 and short in long_ and (len(short) >= 0.6 * len(long_) or small <= big):
        r = max(r, 0.9)
    if small and small <= big and sum(map(len, small)) >= 4:
        r = max(r, 0.8 + 0.15 * len(small) / len(big))
    return r


def categories(name: str | None) -> set[str]:
    s = fold(name)
    return {c for c, words in CATEGORIES if any(w in s for w in words)}


def leading_number(name: str | None) -> str | None:
    code = code_of(name)
    return code if code and code[0].isdigit() else None


# --- types ---------------------------------------------------------------------------------------------------

# The details' lift types (liftradar-fetcher's LiftType) against OpenSkiData's.
LIFT_TYPES = {
    "chairlift": {"chair_lift", "mixed_lift"},
    "gondola": {"gondola", "mixed_lift", "cable_car"},
    "cable_car": {"cable_car", "gondola"},
    "funicular": {"funicular", "railway"},
    "drag_lift": {"t-bar", "j-bar", "platter", "drag_lift", "rope_tow"},
    "carpet": {"magic_carpet", "rope_tow"},
}
DIFFICULTIES = {
    "easy": {"novice", "easy"},
    "intermediate": {"intermediate", "easy", "advanced"},
    "difficult": {"advanced", "expert", "intermediate"},
    "ski_route": {"freeride", "expert", "advanced", "extreme"},
}

# --- geometry ------------------------------------------------------------------------------------------------


def metres(a: list, b: list) -> float:
    k = math.cos(math.radians(a[1]))
    return math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111_320


def lift_geometry(c: list) -> tuple[float, float | None, float | None]:
    """A lift's length along the slope, and its lowest and highest elevation (None without elevations)."""
    flat = sum(metres(a, b) for a, b in itertools.pairwise(c))
    heights = [p[2] for p in c if len(p) > 2]
    if not heights:
        return flat, None, None
    return math.hypot(flat, max(heights) - min(heights)), min(heights), max(heights)


# --- scoring -------------------------------------------------------------------------------------------------


def refs_of(item: dict) -> set[str]:
    return {r for r in ((item.get("ref") or "").lower(), code_of(item["name"])) if r}


def osm_refs(feature: dict) -> set[str]:
    refs = {r.strip().lower() for r in re.split(r"[,;]", feature.get("ref") or "") if r.strip()}
    if feature.get("name") and re.fullmatch(r"\s*\d{1,3}[a-z]?\s*", feature["name"]):
        refs.add(feature["name"].strip().lower())  # a slope named only by its number
    return refs


def score(item: dict, feature: dict, kind: str) -> float | None:
    """How well a details item fits an OSM lift or run (higher is better), or None when it doesn't."""
    refs, theirs = refs_of(item), osm_refs(feature)
    ref = bool(refs & theirs)
    if kind == "slopes" and refs and theirs and not ref and any(r[0].isdigit() for r in refs | theirs):
        return None  # both numbered, differently
    names = name_similarity(item["name"], feature.get("name"))
    if kind == "slopes":
        a, b = categories(item["name"]), categories(feature.get("name"))
        if a and b and not a & b:
            names = min(names, 0.4)
    na, nb = leading_number(item["name"]), leading_number(feature.get("name"))
    if na and nb and na != nb:
        return None
    if ref and core(feature.get("name"))[0] and core(item["name"])[0] and names < 0.3:
        ref = False  # same number, unrelated names: often a neighbour's slope with the same numbering
    s = names + (0.6 if ref else 0)

    if kind == "lifts":
        allowed = LIFT_TYPES.get(item.get("type"))
        if allowed and feature.get("type"):
            s += 0.1 if feature["type"] in allowed else -0.4
        geometry_ok = None
        if item.get("length_m") and feature.get("c"):
            length, low, high = lift_geometry(feature["c"])
            ratio = length / item["length_m"]
            geometry_ok = 0.8 < ratio < 1.25
            if low is not None and item.get("bottom_m") and item.get("top_m"):
                geometry_ok = geometry_ok and abs(low - item["bottom_m"]) < 80 and abs(high - item["top_m"]) < 80
            s += 0.3 if geometry_ok else (-0.3 if not 0.5 < ratio < 2 else 0)
        ok = (names >= 0.6 and s >= 0.8) or (ref and s >= 0.7) or (geometry_ok and names >= 0.45)
    else:
        allowed = DIFFICULTIES.get(item.get("difficulty"))
        if allowed and feature.get("difficulty"):
            s += 0.1 if feature["difficulty"] in allowed else -0.3
        ok = (names >= 0.65 and s >= 0.8) or (ref and s >= 0.65)
    return s if ok else None


# --- linking -------------------------------------------------------------------------------------------------


def start(feature: dict) -> list | None:
    if feature.get("c"):
        return feature["c"][0]
    return feature["poly"][0][0] if feature.get("poly") else None


def nearby(features: list[dict], key: str, listed: set[str], neighbours: bool) -> list[dict]:
    """The lifts or runs within NEARBY_KM of the resort's own (a map may cover more). First (`neighbours` false)
    the resort's own and those of resorts without a details file of their own (`listed`); then the still unlinked
    ones of the listed resorts around it. A resort's own list goes first, as a neighbour's map often shows its
    lifts without a status (SkiWelt's map has KitzSki's, all "unknown"), but a lift OSM gives to one resort may be
    in the other's list only (Seiser Alm's Mont Sëuc gondola, in Val Gardena's)."""
    own = [start(f) for f in features if f.get("lr") == key]
    own = [p for p in own if p]
    if not own:
        return []
    pad_lat = NEARBY_KM / 111.32
    pad_lon = pad_lat / math.cos(math.radians(own[0][1]))
    west, east = min(p[0] for p in own) - pad_lon, max(p[0] for p in own) + pad_lon
    south, north = min(p[1] for p in own) - pad_lat, max(p[1] for p in own) + pad_lat

    def wanted(f: dict) -> bool:
        if neighbours:
            return f.get("lr") != key and f.get("lr") in listed and not f.get("item")
        return f.get("lr") == key or f.get("lr") not in listed

    return [f for f in features if (p := start(f)) and west < p[0] < east and south < p[1] < north and wanted(f)]


def best_pairs(items: list[dict], candidates: list, kind: str, key: str, first) -> dict[int, int]:
    """Item index -> candidate index, best scores first, each once; the resort's own lines win ties."""
    scored = []
    for a, item in enumerate(items):
        for b, candidate in enumerate(candidates):
            f = first(candidate)
            s = score(item, f, kind)
            if s is not None:
                scored.append((s + (0.05 if f.get("lr") == key else 0), a, b))
    pairs, used = {}, set()
    for _, a, b in sorted(scored, reverse=True):
        if a not in pairs and b not in used:
            pairs[a] = b
            used.add(b)
    return pairs


def link_items(
    items: list[dict], features: list[dict], kind: str, key: str, listed: set[str], neighbours: bool, done: set[int]
) -> None:
    """Link the resort's lifts or slopes (`items`) not linked yet (`done`, their indexes, updated) to the lines
    nearby. A neighbour's line only takes an item with a known status."""
    todo = [a for a, item in enumerate(items) if a not in done and not (neighbours and item["status"] == "unknown")]
    groups = defaultdict(list)
    for f in nearby(features, key, listed, neighbours):
        if kind == "lifts":
            # One OSM lift each, by its OSM id (the same lift is in several tiles).
            groups[f.get("osm") or id(f)].append(f)
        elif f.get("name") or f.get("ref"):
            # Every OSM segment with the slope's name and number.
            groups[(f.get("name"), f.get("ref"), f.get("lr"))].append(f)
    candidates = list(groups.values())
    pairs = best_pairs([items[a] for a in todo], candidates, kind, key, lambda c: c[0])
    for i, b in pairs.items():
        done.add(todo[i])
        for f in candidates[b]:
            f["item"] = f"{key}/{items[todo[i]]['id']}"
    if kind == "lifts":
        # A lift OSM has in sections ("Fimbabahn I", "II") with one number: the other sections too.
        linked = {(c[0].get("ref"), c[0].get("lr")): c[0]["item"] for c in candidates if c[0].get("item")}
        for c in candidates:
            if not c[0].get("item") and c[0].get("ref") and (item := linked.get((c[0]["ref"], c[0].get("lr")))):
                for f in c:
                    f["item"] = item


def load_details(details_dir: Path) -> list[dict]:
    """The details files that list lifts and slopes: the others only have the resort's bottom and top."""
    files = (json.loads(p.read_text(encoding="utf-8")) for p in sorted(Path(details_dir).glob("*/*.details.json")))
    return [d for d in files if d.get("lifts") is not None and d.get("slopes") is not None]


def link(details_dir: Path, lifts: list[dict], runs: list[dict]) -> dict:
    """Set `item` on the lifts and runs (tile dicts; the same lift may be several dicts, one per tile) that match
    an item of a details file. Returns the counts, per resort and in all."""
    lifts = [f for f in lifts if f.get("status", "operating") == "operating" and f.get("c")]
    runs = [f for f in runs if "downhill" in (f.get("uses") or [])]
    files = load_details(details_dir)
    listed = {f"{details['country']}/{details['id']}" for details in files}
    done = {key: (set(), set()) for key in listed}  # the indexes of the linked lifts and slopes
    for neighbours in (False, True):
        for details in files:
            key = f"{details['country']}/{details['id']}"
            link_items(details["lifts"], lifts, "lifts", key, listed, neighbours, done[key][0])
            link_items(details["slopes"], runs, "slopes", key, listed, neighbours, done[key][1])

    counts = {"lifts": [0, 0], "slopes": [0, 0], "resorts": {}}
    for details in files:
        key = f"{details['country']}/{details['id']}"
        lm, sm = (len(d) for d in done[key])
        counts["lifts"][0] += lm
        counts["lifts"][1] += len(details["lifts"])
        counts["slopes"][0] += sm
        counts["slopes"][1] += len(details["slopes"])
        counts["resorts"][key] = (lm, len(details["lifts"]), sm, len(details["slopes"]))
    return counts


# --- lengths -------------------------------------------------------------------------------------------------

TOUCH_M = 25  # a piste's segments meet within this


def line_metres(c: list) -> float:
    """A line's length, along the slope when it has elevations."""
    total = 0.0
    for a, b in itertools.pairwise(c):
        flat = metres(a, b)
        total += math.hypot(flat, b[2] - a[2]) if len(a) > 2 < len(b) and None not in (a[2], b[2]) else flat
    return total


def from_relation(feature: dict) -> bool:
    """A run OpenSkiData made from a route relation: its members are runs of their own too."""
    return (feature.get("osm") or "").startswith("relation/")


def piece_refs(feature: dict) -> set[str]:
    return osm_refs(feature) | {r.strip().lower() for r in (feature.get("ref") or "").split("/") if r.strip()}


def piece_names(feature: dict) -> set[str]:
    """The names a segment of several pistes carries ("Hochalm, Panorama"), without bare numbers."""
    parts = re.split(r"[,;/]", feature.get("name") or "")
    return {fold(p).strip() for p in parts if p.strip() and not re.fullmatch(r"\s*\d{1,3}[a-z]?\s*", p)}


def grow(item: dict, key: str, seeds: list[int], lines: list[dict], touching) -> list[int]:
    """A slope's segments: those it's linked to, and the ones joined to them that carry its number, or one of the
    seeds' names, in the same resort. OpenSkiData cuts a piste into pieces named differently (its name, only its
    number, none, several pistes' names), and `link` takes only the pieces with one name and number."""
    resorts = {lines[i].get("lr") for i in seeds}
    refs = refs_of(item) | {r for i in seeds for r in piece_refs(lines[i])}
    names = {n for i in seeds for n in piece_names(lines[i])}

    def fits(f: dict) -> bool:
        if from_relation(f) or f.get("lr") not in resorts:
            return False
        theirs = piece_refs(f)
        if f.get("item") and f["item"] != key and not refs & theirs:
            return False  # another slope's, not shared with this one
        if refs and theirs:
            return bool(refs & theirs)
        return bool(names & piece_names(f))

    have, todo = set(seeds), list(seeds)
    while todo:
        for j in touching(todo.pop()):
            if j not in have and fits(lines[j]):
                have.add(j)
                todo.append(j)
    ways = [i for i in have if not from_relation(lines[i])]
    return ways or sorted(have)


def lengths(details_dir: Path, lifts: list[dict], runs: list[dict], measured: dict[int, float] | None = None) -> dict:
    """After `link`: the length of each linked lift and slope on the map, in metres (rounded to 10), as
    {"<country>/<id>": {"lifts": {item id: m}, "slopes": {...}}}. A lift is the sum of its OSM lines (its sections),
    along the slope; a slope the sum of its segments (`grow`), drawn as lines (a piste drawn only as an area has
    none). `measured`: id() of a line -> its length from the full geometry, before simplifying."""
    measured = measured or {}
    items = {
        f"{d['country']}/{d['id']}/{slope['id']}": slope for d in load_details(details_dir) for slope in d["slopes"]
    }

    def length(f: dict) -> float:
        return measured.get(id(f)) or line_metres(f["c"])

    out: dict = defaultdict(lambda: {"lifts": {}, "slopes": {}})

    def put(item: str, kind: str, m: float) -> None:
        if m >= 10:
            resort, item_id = item.rsplit("/", 1)
            out[resort][kind][item_id] = int(round(m, -1))

    seen, by_item = set(), defaultdict(float)
    for f in lifts:
        if f.get("item") and f.get("c") and (f.get("osm") or id(f)) not in seen:
            seen.add(f.get("osm") or id(f))
            by_item[f["item"]] += length(f)
    for item, m in by_item.items():
        put(item, "lifts", m)

    lines = [f for f in runs if f.get("c") and "downhill" in (f.get("uses") or [])]
    cell = lambda p: (round(p[0] * 400), round(p[1] * 600))  # cells of about 150-200 m
    ends = defaultdict(list)
    for i, f in enumerate(lines):
        for p in (f["c"][0], f["c"][-1]):
            ends[cell(p)].append(i)
    near: dict[int, set[int]] = {}

    def touching(i: int) -> set[int]:
        """The segments with an end within TOUCH_M of a point of this one."""
        if i not in near:
            found = set()
            for p in lines[i]["c"]:
                x, y = cell(p)
                for j in {j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in ends.get((x + dx, y + dy), ())}:
                    if (
                        j != i
                        and j not in found
                        and min(metres(p, lines[j]["c"][0]), metres(p, lines[j]["c"][-1])) < TOUCH_M
                    ):
                        found.add(j)
            near[i] = found
        return near[i]

    seeds = defaultdict(list)
    for i, f in enumerate(lines):
        if f.get("item"):
            seeds[f["item"]].append(i)
    for item, mine in seeds.items():
        details = items.get(item)
        segments = grow(details, item, mine, lines, touching) if details else mine
        put(item, "slopes", sum(length(lines[i]) for i in segments))
    return {k: out[k] for k in sorted(out)}


LENGTHS_FILE = "lengths.json"


def write_lengths(out: Path, measured: dict, data_time: str | None) -> str:
    """Write lengths.json next to the tiles (DEVELOPMENT.md "Ski tiles"); returns its text."""
    body = {"data_time": data_time, "resorts": measured}
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n"
    (out / LENGTHS_FILE).write_text(text, encoding="utf-8")
    return text


ELEVATIONS_FILE = "elevations.json"
# Lifts kept on the map for old tracks, but no longer the resort's.
GONE = {"disused", "abandoned"}


def elevations(lifts: list[dict]) -> dict:
    """Each resort's lowest and highest point on its lifts (`lr`), `[lon, lat, elevation]`: its bottom and top, for
    elevations.json. Resorts whose lifts have no elevations are left out."""
    ends = {}
    for lift in lifts:
        if not (key := lift.get("lr")) or lift.get("status") in GONE:
            continue
        for point in lift.get("c") or []:
            if len(point) < 3:
                continue
            low, high = ends.get(key, (point, point))
            ends[key] = (point if point[2] < low[2] else low, point if point[2] > high[2] else high)
    return {key: {"bottom": low, "top": high} for key, (low, high) in sorted(ends.items())}


def write_elevations(out: Path, found: dict, data_time: str | None) -> str:
    """Write elevations.json next to the tiles (DEVELOPMENT.md "Ski tiles"); returns its text."""
    body = {"data_time": data_time, "resorts": found}
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n"
    (out / ELEVATIONS_FILE).write_text(text, encoding="utf-8")
    return text


def summary(counts: dict) -> str:
    (lm, lt), (sm, st) = counts["lifts"], counts["slopes"]
    resorts = len(counts["resorts"])
    return f"linked {lm} of {lt} lifts and {sm} of {st} slopes of {resorts} resorts' details"


def length_summary(measured: dict) -> str:
    lifts = sum(len(r["lifts"]) for r in measured.values())
    slopes = sum(len(r["slopes"]) for r in measured.values())
    return f"measured {lifts} lifts and {slopes} slopes on the map"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("details", help="the data's json/ folder, with <country>/<id>.details.json")
    parser.add_argument("ski", help="built ski tiles, e.g. ski: their lifts and runs get `item`, in place")
    parser.add_argument("-v", "--verbose", action="store_true", help="the counts per resort")
    args = parser.parse_args()
    out = Path(args.ski) / "v1"
    tiles = {path: json.loads(path.read_text(encoding="utf-8")) for path in sorted(out.glob("10/*/*.json"))}
    if not tiles:
        sys.exit(f"no tiles in {out}")
    for tile in tiles.values():
        for f in tile["lifts"] + tile["runs"]:
            f.pop("item", None)
    lifts = [f for t in tiles.values() for f in t["lifts"]]
    runs = [f for t in tiles.values() for f in t["runs"]]
    counts = link(Path(args.details), lifts, runs)
    # A line crossing tiles is in each of them: measured once.
    once = {}
    for kind, features in (("lifts", lifts), ("runs", runs)):
        for f in features:
            once.setdefault((kind, f.get("osm"), json.dumps(f.get("c") or f.get("poly"))), f)
    measured = lengths(
        Path(args.details),
        [f for (k, *_), f in once.items() if k == "lifts"],
        [f for (k, *_), f in once.items() if k == "runs"],
    )
    meta_path = out / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    digest = hashlib.sha256()
    for path, tile in tiles.items():
        text = json.dumps(tile, ensure_ascii=False, separators=(",", ":"))
        path.write_text(text, encoding="utf-8")
        digest.update(text.encode())
    digest.update(write_lengths(out, measured, meta.get("data_time")).encode())
    meta["lengths"] = LENGTHS_FILE
    meta["build"] = digest.hexdigest()[:12]  # so browsers don't keep the unlinked tiles
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.verbose:
        for key, (lm, lt, sm, st) in counts["resorts"].items():
            print(f"{key:40} lifts {lm:3}/{lt:3}  slopes {sm:3}/{st:3}")
    print(summary(counts))
    print(length_summary(measured))


if __name__ == "__main__":
    main()
