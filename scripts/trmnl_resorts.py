"""Write the resort list for a TRMNL plugin's `xhrSelect` field.

TRMNL expects a JSON array of one-entry objects, `{"<label>": "<value>"}`:
the label is shown in the plugin settings, the value is stored. The value is
the resort's path, so the plugin can poll https://snow.miron.asia/json/<value>.json.

    python3 scripts/trmnl_resorts.py data/json/index.json _site/trmnl/resorts.json
"""

import json
import sys
import unicodedata
from pathlib import Path

# Same names as assets/common.js.
COUNTRY_NAMES = {"at": "Austria", "ch": "Switzerland", "it": "Italy"}


def fold(text: str) -> str:
    """Lowercase without accents, so "Sölden" sorts like "solden"."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c)).casefold()


def options(index: dict) -> list[dict[str, str]]:
    resorts = sorted(index["resorts"], key=lambda r: (fold(r["name"]), r["country"], r["id"]))
    entries = []
    for r in resorts:
        country = COUNTRY_NAMES.get(r["country"], r["country"].upper())
        place = f"{r['region']}, {country}" if r.get("region") else country
        entries.append((f"{r['name']} ({place})", f"{r['country']}/{r['id']}"))
    labels = [label for label, _ in entries]
    # Labels must be unique, since TRMNL shows only the label.
    return [{label if labels.count(label) == 1 else f"{label} [{value}]": value} for label, value in entries]


def main() -> None:
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    entries = options(json.loads(source.read_text(encoding="utf-8")))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{target}: {len(entries)} resorts")


if __name__ == "__main__":
    main()
