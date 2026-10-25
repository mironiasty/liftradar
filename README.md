# snow-conditions

Snow conditions for ski resorts in Tirol, Salzburg, Switzerland and Italy, published at
[snow.miron.asia](https://snow.miron.asia).

- **Data** (branch `data`): `json/<country>/<resort>.json`, `json/index.json`,
  `archive/<country>/<resort>/` and `schema/…`, published by the fetcher twice a day.
  Don't edit it by hand: every publish replaces it.
  - `archive/<country>/<resort>/index.json` lists every run (oldest first) with the
    snapshot holding that run's full report, e.g. `2026-10-25T09-00Z.json` (UTC). Runs
    without changes share the earlier snapshot.
- **Website** (branch `main`, this): `index.html` (table), `map.html` (map) and
  `sources.html` (data sources, incl. every URL in the current data), plain
  static pages that load `json/index.json` in the browser. No build step.

`.github/workflows/pages.yml` combines both and deploys to GitHub Pages, on every push
to `main` and after every data update.

## About the data

Read this before relying on a number. The format is defined by the JSON Schema in
`schema/` (`resort.schema.json`, `index.schema.json`, `archive.schema.json`).

### Sources

| What | Where it comes from |
|---|---|
| Hintertux, Sölden, Kitzsteinhorn, Kaunertal, Pitztal | The resorts' own websites (snow stations) |
| Other Tirol resorts | [Tirol Snow Card](https://www.snowcard.tirol.at/skigebiete) resort reports |
| Other Salzburg resorts | [SalzburgerLand snow report](https://www.salzburgerland.com/de/schneebericht/) |
| Swiss resorts | [infosnow.ch](https://infosnow.ch/portal/): live lift and slope status as the lift companies publish it |
| Snow depth of Swiss resorts that don't report it | Nearest [SLF](https://www.slf.ch/en/services-and-products/slf-data-service) stations (WSL Institute for Snow and Avalanche Research, CC BY 4.0) |
| Dolomiti Superski areas | [Open Data Hub South Tyrol](https://opendatahub.com): every lift and slope as Dolomiti Superski publishes it (CC0) |
| Valle d'Aosta (and Alagna) | [lovevda.it snow bulletin](https://www.lovevda.it/it/prima-di-partire/bollettino-neve-sci-discesa) |
| Trentino | [visittrentino.info snow bulletin](https://www.visittrentino.info/it/meteo/bollettino-neve-sci-alpino/trentino) |
| South Tyrol outside Dolomiti Superski; snow of the South Tyrol DSS areas | [Open Data Hub](https://tourism.api.opendatahub.com/v1/Weather/SnowReport?lang=en) snow report (province's tourism database) |
| Bormio, Cima Piazzi - San Colombano | [bormioski.eu](https://www.bormioski.eu/info-impianti-e-piste/) (lifts only) |
| Lift/slope status of the bigger Austrian areas, Andermatt, Engelberg, Friuli Venezia Giulia and Madesimo | The resort's own Intermaps slope map |
| Total slope km of the bigger areas | The official size on the resort's own website |
| Avalanche danger, Tirol | [avalanche.report](https://avalanche.report), Euregio Tirol – South Tyrol – Trentino |
| Avalanche danger, Switzerland | [SLF avalanche bulletin](https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/) |
| Avalanche danger, South Tyrol and Trentino | [avalanche.report](https://avalanche.report) (Euregio) |
| Avalanche danger, other Italian regions | [AINEVA](https://bollettini.aineva.it) joint bulletin |
| Open km of Kitzsteinhorn and Kaunertal | Slope lengths © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |

The Snow Card and SalzburgerLand pages show the report each resort submits to iSKI. Bergfex
is not used. Each file's `sources` lists the URLs used for that report.

### Timing

- Updated twice a day, at about 07:40 and 12:40 Vienna time in winter (08:40 / 13:40 in
  summer time). GitHub starts scheduled runs late at busy times, sometimes by hours, and can
  skip one.
- `fetched_at` is when we read the data; `lifts_updated_at` is the resort's own report time
  (or its slope map's update time). The resort's report time can move forward without its
  numbers changing: reporting systems refresh it daily.
- Times are ISO 8601 with the Vienna offset (`+01:00` / `+02:00`, the same as Swiss time); archive file names are UTC.

### Status

- `open` / `closed`: from the resort's report, or `open` when its slope map shows open slopes. Swiss resorts are
  `open` when infosnow (or the slope map) shows an open slope: lifts also run for hikers outside the season.
- `no_report`: the resort hasn't reported for 14 days (e.g. before the season). No values are
  published then, so last season's numbers never show up as current.
- `null`: unknown, usually because fetching failed; see `errors`.
- A **closed** resort always shows 0 open lifts, slopes and km (outside the season some
  resorts count lifts running for hikers), and **no snow depths** (`mountain_cm`,
  `valley_cm`, `fresh_cm`, `condition` are `null`): closed resorts' reports typically still
  carry last season's depths. `last_snowfall` and station measurements are kept.

### Snow

- `mountain_cm` / `valley_cm`: the highest / lowest measuring station (own-website resorts),
  or the report's max / min depth (Snow Card, SalzburgerLand).
- Swiss resorts: the resort's own measuring points where it enters them in infosnow (e.g. Verbier).
  Most don't, and then the depths come from the nearest SLF stations, listed in `snow.stations`
  as "<name> (SLF)": an automatic station on the mountain (about 2000–2900 m) and an observer's
  study plot near the village (read each morning, mostly from November). They're measured on
  open ground, not on pistes, and the station can be a few km from the ski area.
- Regional reports keep a resort's old values until it clears them; check `last_snowfall`.
  SalzburgerLand reports often have no `last_snowfall`.
- Any value can be `null` when the resort doesn't publish it.

### Lifts and slopes

- **Villages of one ski area share its numbers.** SkiWelt, Zillertal Arena, KitzSki,
  Mayrhofen, Hochkönig, Snow Space Salzburg and Dachstein West are listed per village, each
  with the whole area's lift and slope counts (and, mostly, km). Don't add them up.
- **`slopes.total_km`** is the official, advertised ski-area size for the bigger areas, the
  same for all its villages. For other resorts it's the reported value, which is only the sum
  of the slope lengths the resort has entered in its reporting system and can be far too low
  (Kitzbühel reported 4.7 of 233 km). Advertised sizes are counted in different ways, some
  with ski routes, and Stubai's 108 km is its "effective route distance" (65 km by fall line).
  Rounded up to a whole km.
- **`slopes.open_km`** (0.1 km): summed from the slope map's lengths where complete; from
  the resort's live infobox (Hintertux); from OpenStreetMap lengths of the open slopes
  (Kitzsteinhorn, Kaunertal), which leans low because OSM lines are shorter than official
  lengths; otherwise as reported.
- SalzburgerLand reports have slope km but no slope counts, so `slopes.open` / `total` can be
  `null` while the km are set.
- Lift and slope totals from different sources don't always match the advertised ones:
  slope maps include practice lifts and magic carpets (the SkiWelt map lists 147 lifts, the
  area advertises 81).

### Lift types and slope difficulties

`lifts_by_type` and `slopes_by_difficulty` are only set for resorts with their own slope map
(the bigger areas) and for Swiss resorts (from infosnow).

- Lift types (`gondola`, `cable_car`, `chairlift`, `drag_lift`, `carpet`, `funicular`,
  `other`) and difficulties (`easy`, `intermediate`, `difficult`, `ski_route`, `other`) are
  read from the map's display text, so an unusual label can land in `other`. For Swiss resorts
  they come from infosnow's type icons; yellow and orange runs are `ski_route`, mixed
  colours (blue/red) `other`, and rack railways (e.g. Gornergrat) `other`.
- km per difficulty are only given when every slope of that difficulty has a length in the
  map, and they don't add up to `slopes.total_km` (the official size, counted differently;
  each difficulty is also rounded up). Some maps have no lengths at all.
- A map not updated for 14 days is ignored. Maps covering several of our resorts (Gastein,
  Salzburger Sportwelt) aren't used, since they don't say which area a lift belongs to.

### Avalanche danger

- Tirol, Swiss and Italian resorts. Salzburg has no machine-readable bulletin, so `avalanche` is
  `null` for all Salzburg resorts, including the Snow Card ones in Salzburg (Hochkrimml,
  Königsleiten, Mittersill, Wildkogel).
- Early and late in the season the SLF only rates the alpine regions, so Swiss resorts in the
  Prealps (and e.g. Arosa) can have `null` while others have a rating.
- `null` outside the season and when no bulletin is valid at the time of the run.
- `danger_level` (1–5) is the highest level of the day in the resort's warning region;
  `ratings` has the split by elevation and time of day. The region is found from one point
  per resort, so a resort spanning two regions shows only one.

### Locations

`location` is one point per resort: the Snow Card or infosnow location, a point in the ski area
for the glacier resorts, or the main village (looked up on OpenStreetMap) for Salzburg and
Italian resorts, Andermatt and Engelberg. It marks the area on a map, not a lift station.

`region` is the state, canton or Italian region that point lies in (e.g. `Tirol`, `Valais`,
`Valle d'Aosta`; Trentino-Alto Adige by province: `Südtirol`, `Trentino`), looked up on
OpenStreetMap; the table filters by it and by `country`. An area spanning a border is listed
under one of them (Katschberg under Kärnten, Glacier 3000 under Vaud).

### Archive

- Collected since 24 October 2026; earlier data doesn't exist.
- A snapshot is only written when a report changed (apart from `fetched_at`), and the index
  lists every run. Snapshots keep the format of their time, so older ones may lack newer
  fields.
- Until 25 October 2026 the runs were listed in `history/<country>/<resort>.json`; those files
  remain in the `data` branch's git history.

## Running locally

Put the data next to the pages and serve the folder:

```sh
git worktree add ../snow-conditions-data data   # once
for part in json archive schema; do ln -sfn ../snow-conditions-data/$part .; done
python3 -m http.server 8000                     # http://localhost:8000
```

(The links are git-ignored.)

Map tiles and data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
