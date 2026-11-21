"""Link the ski tiles' lifts and runs to the lifts and slopes of the experimental details files, so the map can
draw them by status. Each linked lift or run gets `item`, "<country>/<id>/<item id>": the resort whose
json/<country>/<id>.details.json lists it, and its id there.

There's no shared id: the details come from the resorts' Intermaps slope maps, which have no coordinates. An
item is matched to the OpenStreetMap lines in and around its resort (within NEARBY_KM of the resort's own lifts)
by its number (`ref`, or the code its name starts with), its name with lift-type words left out, its lift type or
slope difficulty and, for lifts, the length and the altitudes of its stations. The best pairs go first, each
lift and slope once; a slope takes every OSM segment with its name and number. About 85% of the lifts and 78%
of the slopes match, nearly all correctly (docs/plans/2026-11-13-lift-details.md in liftradar-fetcher).

ski_tiles.py calls `link` while it builds the tiles. To link tiles that are already built (e.g. to try it out):

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


def nearby(features: list[dict], key: str) -> list[dict]:
    """The resort's own lifts or runs, and the others within NEARBY_KM of them (a map may cover more)."""
    own = [start(f) for f in features if f.get("lr") == key]
    own = [p for p in own if p]
    if not own:
        return []
    pad_lat = NEARBY_KM / 111.32
    pad_lon = pad_lat / math.cos(math.radians(own[0][1]))
    west, east = min(p[0] for p in own) - pad_lon, max(p[0] for p in own) + pad_lon
    south, north = min(p[1] for p in own) - pad_lat, max(p[1] for p in own) + pad_lat
    return [f for f in features if (p := start(f)) and west < p[0] < east and south < p[1] < north]


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


def link(details_dir: Path, lifts: list[dict], runs: list[dict]) -> dict:
    """Set `item` on the lifts and runs (tile dicts; the same lift may be several dicts, one per tile) that match
    an item of a details file. Returns the counts, per resort and in all."""
    lifts = [f for f in lifts if f.get("status", "operating") == "operating" and f.get("c")]
    runs = [f for f in runs if "downhill" in (f.get("uses") or [])]
    counts = {"lifts": [0, 0], "slopes": [0, 0], "resorts": {}}
    for path in sorted(Path(details_dir).glob("*/*.details.json")):
        details = json.loads(path.read_text(encoding="utf-8"))
        key = f"{details['country']}/{details['id']}"

        # Lifts: one OSM lift each, by its OSM id (the same lift is in several tiles).
        by_osm = defaultdict(list)
        for f in nearby(lifts, key):
            by_osm[f.get("osm") or id(f)].append(f)
        candidates = list(by_osm.values())
        pairs = best_pairs(details["lifts"], candidates, "lifts", key, lambda c: c[0])
        for a, b in pairs.items():
            for f in candidates[b]:
                f["item"] = f"{key}/{details['lifts'][a]['id']}"
        # A lift OSM has in sections ("Fimbabahn I", "II") with one number: the other sections too.
        linked = {(c[0].get("ref"), c[0].get("lr")): c[0]["item"] for c in candidates if c[0].get("item")}
        for c in candidates:
            if not c[0].get("item") and c[0].get("ref") and (item := linked.get((c[0]["ref"], c[0].get("lr")))):
                for f in c:
                    f["item"] = item

        # Slopes: every OSM segment with the slope's name and number.
        groups = defaultdict(list)
        for f in nearby(runs, key):
            if f.get("name") or f.get("ref"):
                groups[(f.get("name"), f.get("ref"), f.get("lr"))].append(f)
        candidates = list(groups.values())
        slope_pairs = best_pairs(details["slopes"], candidates, "slopes", key, lambda c: c[0])
        for a, b in slope_pairs.items():
            for f in candidates[b]:
                f["item"] = f"{key}/{details['slopes'][a]['id']}"

        counts["lifts"][0] += len(pairs)
        counts["lifts"][1] += len(details["lifts"])
        counts["slopes"][0] += len(slope_pairs)
        counts["slopes"][1] += len(details["slopes"])
        counts["resorts"][key] = (len(pairs), len(details["lifts"]), len(slope_pairs), len(details["slopes"]))
    return counts


def summary(counts: dict) -> str:
    (lm, lt), (sm, st) = counts["lifts"], counts["slopes"]
    resorts = len(counts["resorts"])
    return f"linked {lm} of {lt} lifts and {sm} of {st} slopes of {resorts} resorts' details"


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
    counts = link(
        Path(args.details),
        [f for t in tiles.values() for f in t["lifts"]],
        [f for t in tiles.values() for f in t["runs"]],
    )
    digest = hashlib.sha256()
    for path, tile in tiles.items():
        text = json.dumps(tile, ensure_ascii=False, separators=(",", ":"))
        path.write_text(text, encoding="utf-8")
        digest.update(text.encode())
    meta_path = out / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["build"] = digest.hexdigest()[:12]  # so browsers don't keep the unlinked tiles
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.verbose:
        for key, (lm, lt, sm, st) in counts["resorts"].items():
            print(f"{key:40} lifts {lm:3}/{lt:3}  slopes {sm:3}/{st:3}")
    print(summary(counts))


if __name__ == "__main__":
    main()
