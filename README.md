# snow-conditions

Snow conditions for ski resorts in Tirol and Salzburg, published at
[snow.miron.asia](https://snow.miron.asia).

- **Data** (branch `data`): `json/<country>/<resort>.json`, `json/index.json`,
  `archive/<country>/<resort>/` and `schema/…`, published by the fetcher twice a day.
  Don't edit it by hand: every publish replaces it.
  - `archive/<country>/<resort>/index.json` lists every run (oldest first) with the
    snapshot holding that run's full report, e.g. `2026-10-25T09-00Z.json` (UTC). Runs
    without changes share the earlier snapshot.
- **Website** (branch `main`, this): `index.html` (table) and `map.html` (map), plain
  static pages that load `json/index.json` in the browser. No build step.

`.github/workflows/pages.yml` combines both and deploys to GitHub Pages, on every push
to `main` and after every data update.

## Running locally

Put the data next to the pages and serve the folder:

```sh
git worktree add ../snow-conditions-data data   # once
for part in json archive schema; do ln -sfn ../snow-conditions-data/$part .; done
python3 -m http.server 8000                     # http://localhost:8000
```

(The links are git-ignored.)

Map tiles and data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
