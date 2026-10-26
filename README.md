# snow-conditions

Snow conditions for ski resorts in Austria, Switzerland, Italy, France, Czechia, Slovakia and Poland, published at
[snow.miron.asia](https://snow.miron.asia).

- **Data** (branch `data`): `json/<country>/<resort>.json`, `json/index.json`,
  `archive/<country>/<resort>/` and `schema/…`, published by the fetcher twice a day.
  Don't edit it by hand: every publish replaces it.
  - `archive/<country>/<resort>/index.json` lists every run (oldest first) with the
    snapshot holding that run's full report, e.g. `2026-10-25T09-00Z.json` (UTC). Runs
    without changes share the earlier snapshot.
- **Website** (branch `main`, this): `index.html` (table), `map.html` (map),
  `resort.html?r=<country>/<resort>` (one resort: all its data, its area on the map and
  its history from the archive) and `sources.html` (data sources, incl. every URL in the
  current data), plain static pages that load the JSON in the browser. No build step.
  `assets/areas.geojson` holds the ski-area outlines shown on the map; see [Areas](#areas).

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
| Other Salzburg resorts; Planai, Dachstein Gletscher, Feuerkogel | [SalzburgerLand snow report](https://www.salzburgerland.com/de/schneebericht/) |
| Carinthia | [Kärnten snow report](https://www.kaernten.at/golf/service/wetter/schneeberichte) (Kärnten Werbung, tourism board) |
| St. Anton, Lech Zürs, Warth-Schröcken | [skiarlberg.at](https://www.skiarlberg.at/de/live-infos/anlagen): every lift and slope, the lift companies' live info (no report time, no km; no snow depth for Warth-Schröcken) |
| Other resorts in Vorarlberg, Styria, Upper and Lower Austria, some in Carinthia | Their Intermaps slope map only (lifts and slopes, no snow depth) |
| Swiss resorts | [infosnow.ch](https://infosnow.ch/portal/): live lift and slope status as the lift companies publish it |
| Snow depth of Swiss resorts that don't report it | Nearest [SLF](https://www.slf.ch/en/services-and-products/slf-data-service) stations (WSL Institute for Snow and Avalanche Research, CC BY 4.0) |
| Dolomiti Superski areas | [Open Data Hub South Tyrol](https://opendatahub.com): every lift and slope as Dolomiti Superski publishes it (CC0) |
| Valle d'Aosta (and Alagna) | [lovevda.it snow bulletin](https://www.lovevda.it/it/prima-di-partire/bollettino-neve-sci-discesa) |
| Trentino | [visittrentino.info snow bulletin](https://www.visittrentino.info/it/meteo/bollettino-neve-sci-alpino/trentino) |
| South Tyrol outside Dolomiti Superski; snow of the South Tyrol DSS areas | [Open Data Hub](https://tourism.api.opendatahub.com/v1/Weather/SnowReport?lang=en) snow report (province's tourism database) |
| Bormio (with San Colombano), Santa Caterina, Stelvio | [bormio.eu](https://www.bormio.eu/it/live-info/impianti-e-piste) (tourism board) |
| Livigno | [livigno.eu](https://www.livigno.eu/en/lifts) (tourism board, lifts only) |
| French resorts | [Lumiplan](https://www.lumiplan.com), where French resorts enter their daily report: the station's snow bulletin (`bulletinv3.lumiplan.pro`: measuring points, every lift and slope) and, where the resort embeds one, its interactive slope map (`lumiplay.link`: every lift and slope with lengths). No report time |
| Alpe d'Huez | [ATEN Altitude](https://live.aten-altitude.com/alpehuez/) live page the resort embeds: every lift and slope with its state, snow per measuring point. No report time, no lengths |
| Czech resorts | [holidayinfo.cz](https://zima.holidayinfo.cz/cs/snowinfo): every lift and slope and the snow report, as the resorts enter it (Sitour CZ; the same data as CzechTourism's [snow report](https://www.kudyznudy.cz/nahory)) |
| Kasprowy Wierch, Jaworzyna Krynicka, Palenica, Mosorny Groń | [Polskie Koleje Linowe](https://www.pkl.pl/trasy-narciarskie.html) (PKL, the lift company): every lift and slope with snow cover (no report time) |
| Zieleniec | [zieleniec.pl](https://zieleniec.pl/zima/aktualne-warunki): every lift and slope with snow cover (no report time). The site refuses the fetcher's servers for now, so only the area's size is published |
| Jasná, Tatranská Lomnica, Štrbské Pleso, Starý Smokovec, Szczyrk (TMR); Kotelnica Białczańska, Czarna Góra, Szrenica, Karpacz, Pilsko | **Size only** (no live status yet): lift and slope totals and km from the operators' own lists ([TMR slope tables](https://laravel.jasna.sk/api/jasna/snehove-zjazdovky?lang=sk), the resorts' sites; Kotelnica from [visitmalopolska.pl](https://visitmalopolska.pl/en/obiekt/-/poi/osrodek-narciarski-kotelnica-bialczanska)) |
| Lift/slope status of the bigger Austrian areas, Andermatt, Engelberg, Friuli Venezia Giulia and Madesimo | The resort's own Intermaps slope map |
| Ski-area sizes (total slope km, and lift and slope totals a report lacks) | The size on the resort's own website; otherwise [OnTheSnow](https://www.skiinfo.fr/) (the figures resorts enter there) or [skiresort.com](https://www.skiresort.com/) (km, and km by difficulty for some bigger areas); for a sector of a linked area, the sum of the operator's own slope lengths (Ski Arlberg's slope map, infosnow, Dolomiti Superski) |
| Avalanche danger, Tirol | [avalanche.report](https://avalanche.report), Euregio Tirol – South Tyrol – Trentino |
| Avalanche danger, Switzerland | [SLF avalanche bulletin](https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/) |
| Avalanche danger, South Tyrol and Trentino | [avalanche.report](https://avalanche.report) (Euregio) |
| Avalanche danger, other Italian regions | [AINEVA](https://bollettini.aineva.it) joint bulletin |
| Avalanche danger, Krkonoše and Jeseníky (Czechia) | [Horská služba ČR](https://www.horskasluzba.cz/cz/pocasi-na-horach/lavinova-predpoved) (Czech Mountain Rescue), from the EAWS bulletin files on [avalanche.report](https://avalanche.report) |
| Avalanche danger, Jasná, Tatranská Lomnica, Štrbské Pleso | [Slovak Avalanche Prevention Centre](https://www.laviny.sk) (HZS), from the same EAWS bulletin files |
| Avalanche danger, Kasprowy Wierch (Polish Tatras) | [TOPR](https://lawiny.topr.pl) (Tatra Volunteer Rescue), from the same EAWS bulletin files |
| Avalanche danger, French Alps and Pyrenees | [Météo-France](https://meteofrance.com/meteo-montagne) mountain bulletin (by massif), from the same EAWS bulletin files |
| Open km of Kitzsteinhorn and Kaunertal | Slope lengths © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |
| Ski-area outlines on the map | `landuse=winter_sports` areas © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (this branch, not the data) |

The Snow Card, SalzburgerLand and Kärnten pages show the report each resort submits to iSKI;
holidayinfo.cz is where Czech resorts submit theirs (Sitour CZ, part of the iSKI network), Lumiplan
where French resorts do (Alpe d'Huez uses ATEN Altitude instead). Not covered yet in France:
Avoriaz, Val Cenis, Montgenèvre, Saint-Lary, Font-Romeu, Ax 3 Domaines, Auron, Orcières, Chamrousse
and Les Orres (no source we can read). Bergfex (and aggregators such as SkiRadar) is not used. Each file's `sources` lists the URLs used for that report.

### Timing

- Updated twice a day, at about 07:40 and 12:40 Vienna time in winter (08:40 / 13:40 in
  summer time). GitHub starts scheduled runs late at busy times, sometimes by hours, and can
  skip one.
- `fetched_at` is when we read the data; `lifts_updated_at` is the resort's own report time
  (or its slope map's update time; `null` for French resorts, whose sources have none). The resort's report time can move forward without its
  numbers changing: reporting systems refresh it daily.
- Times are ISO 8601 with the Vienna offset (`+01:00` / `+02:00`, the same as Swiss time); archive file names are UTC.

### Status

- `open` / `closed`: from the resort's report, or `open` when its slope map shows open slopes. Swiss resorts are
  `open` when infosnow (or the slope map) shows an open slope: lifts also run for hikers outside the season.
  French resorts likewise, from Lumiplan; a lift or slope "scheduled" to open later that day (as
  the 07:40 run sees them) counts as open, as in Lumiplan's own totals. Some French resorts show
  everything closed overnight, so they can read `closed` in the morning and `open` at midday.
  Alpe d'Huez (ATEN Altitude) follows the same rules; in October 2026 its page still showed a
  chairlift and two slopes as open, so it reads `open` until its season data replaces them.
- `no_report`: the resort hasn't reported for 14 days (e.g. before the season). Only the
  totals of its last report (lifts, slopes, km: the area's size) are kept, with 0 open lifts
  and `slopes.open` null, so last season's open counts and snow never show up as current.
  Where the report lists every lift and slope, the totals of `lifts_by_type` and
  `slopes_by_difficulty` are kept the same way.
  The 0 means "not reported", not that every lift is closed. Some Slovak and Polish areas (TMR's,
  Kotelnica, Czarna Góra, Szrenica, Karpacz, Pilsko; Zieleniec while its site refuses us) are always `no_report` for now: we list
  them with their size only, from the operators' lists, until we read a live status for them.
  French resorts are `no_report` while all their slopes are "hors période" (outside the season),
  with the area's totals; before the season many French bulletins list nothing, and then there
  are no totals either.
- `null`: unknown, usually because fetching failed; see `errors`.
- A **closed** resort always shows 0 open lifts, slopes and km (outside the season some
  resorts count lifts running for hikers), and **no snow depths** (`mountain_cm`,
  `valley_cm`, `fresh_cm`, `condition` are `null`): closed resorts' reports typically still
  carry last season's depths. `last_snowfall` and station measurements are kept.

### Snow

- `mountain_cm` / `valley_cm`: the highest / lowest measuring station (own-website resorts),
  or the report's max / min depth (Snow Card, SalzburgerLand, holidayinfo: depth on the slopes).
- PKL and Zieleniec: the lowest / highest snow cover of the open slopes.
- French resorts: the measuring points of the resort's Lumiplan bulletin (e.g. "Col Balme",
  2500 m), each with depth and snow quality (`condition`, e.g. `Douce`); `fresh_cm` is the last
  snowfall's amount when it fell today or yesterday. Resorts without a bulletin (Sainte Foy,
  Valmorel, Les Contamines, Les 2 Alpes, Les 7 Laux, Le Collet) have no snow depth. Alpe d'Huez:
  the measuring points of its ATEN Altitude page (e.g. "Pic Blanc", 3300 m), the same way.
- `condition` is in the source's language (e.g. `griffig`, `technický`).
- Swiss resorts: the resort's own measuring points where it enters them in infosnow (e.g. Verbier).
  Most don't, and then the depths come from the nearest SLF stations, listed in `snow.stations`
  as "<name> (SLF)": an automatic station on the mountain (about 2000–2900 m) and an observer's
  study plot near the village (read each morning, mostly from November). They're measured on
  open ground, not on pistes, and the station can be a few km from the ski area.
- Regional reports keep a resort's old values until it clears them; check `last_snowfall`.
  SalzburgerLand reports often have no `last_snowfall`.
- Any value can be `null` when the resort doesn't publish it.

### Lifts and slopes

- **One ski area is one resort.** The reports list some areas per village, each with the
  whole area's lift and slope counts (SkiWelt, KitzSki, Zillertal Arena, Mayrhofen, Ski Juwel,
  Snow Space Salzburg, Hochkönig, Dachstein West, Großarltal - Dorfgastein): they're published
  once, under the area's name, from the village report updated last. Snow depths are that
  village's.
- **`slopes.total_km`** is the ski area's size for all but about 20 resorts: the size
  advertised on the resort's own site, otherwise OnTheSnow's or skiresort.com's figure. Sectors
  of a linked area with no figure of their own (St. Anton, Lech Zürs and Warth-Schröcken;
  Gstaad, Lenzerheide, Verbier, Thyon, Champéry, Morgins; Val di Fassa, Val di Fiemme) get the
  sum of the operator's own slope lengths, ski routes included where the map has them; slopes
  without a length (mostly links and practice slopes) are left out, so these can be a little
  low. For the rest it's the reported value, which is only the sum of the slope lengths the
  resort has entered in its reporting system and can be far too low (Kitzbühel reported 4.7 of
  233 km). Advertised sizes are counted in different ways, some with ski routes, and Stubai's
  108 km is its "effective route distance" (65 km by fall line). Rounded up to a whole km.
  Not covered yet: Megève, Crest-Voland, Notre-Dame-de-Bellecombe, Valloire, Valmeinier, La
  Thuile, Val d'Allos, Samoëns and Autrans-Méaudre km, La Rosière and Queyras, and a few
  village lifts nobody publishes a size for.
- **`slopes.open_km`** (0.1 km): summed from the slope map's lengths where complete; from
  the resort's live infobox (Hintertux); from OpenStreetMap lengths of the open slopes
  (Kitzsteinhorn, Kaunertal), which leans low because OSM lines are shorter than official
  lengths; otherwise as reported.
- SalzburgerLand reports and the Trentino bulletin have slope km but no slope counts: the slope
  total comes from the area's size, and `slopes.open` stays `null` (0 when closed). A few small
  areas (Planai, Dachstein Gletscher, Feuerkogel, Uttendorf and some village lifts) still have
  no slope total.
- Lift and slope totals from different sources don't always match the advertised ones:
  slope maps include practice lifts and magic carpets (the SkiWelt map lists 147 lifts, the
  area advertises 81).

### Lift types and slope difficulties

`lifts_by_type` and `slopes_by_difficulty` are only set for resorts with their own slope map
(the bigger areas), for Swiss resorts (from infosnow), for Czech resorts (from holidayinfo), for
French resorts (from Lumiplan) and for the Polish ones (PKL, Zieleniec). Some bigger areas
without one (Hochkönig, Snow Space Salzburg, Schmittenhöhe, Zauchensee, Serre Chevalier, ...)
get `slopes_by_difficulty` from the area's size instead: km per difficulty (skiresort.com),
or slope counts (Paganella, Folgaria), with `open` null (0 when closed). Ski Arlberg's
breakdowns get their km per difficulty the same way, summed from its slope map.

- Lift types (`gondola`, `cable_car`, `chairlift`, `drag_lift`, `carpet`, `funicular`,
  `other`) and difficulties (`easy`, `intermediate`, `difficult`, `ski_route`, `other`) are
  read from the map's display text, so an unusual label can land in `other`. For Swiss resorts
  they come from infosnow's type icons; yellow and orange runs are `ski_route`, mixed
  colours (blue/red) `other`, and rack railways (e.g. Gornergrat) `other`. For Czech resorts they
  come from holidayinfo's codes: two-colour and white slopes are `other`; a lift or slope open only
  on some days (e.g. Wednesday to Sunday) counts as open on those days. Polish slopes follow
  the Polish colours: "łatwa" (blue) `easy`, PKL's "trudna" and Zieleniec's "średnia" (red)
  `intermediate`, "bardzo trudna" / Zieleniec's "trudna" (black) `difficult`. French slopes follow
  the French colours: green (very easy) and blue are both `easy`, red `intermediate`, black
  `difficult`; only alpine slopes count (no snowparks, cross-country or sledding).
- km per difficulty are only given when every slope of that difficulty has a length in the
  map, and they don't add up to `slopes.total_km` (the official size, counted differently;
  each difficulty is also rounded up). Some maps have no lengths at all.
- A map not updated for 14 days is ignored. Maps covering several of our resorts (Gastein,
  Salzburger Sportwelt) aren't used, since they don't say which area a lift belongs to.

### Avalanche danger

- Tirol, Swiss and Italian resorts, and Czech resorts in Krkonoše and Jeseníky (the only
  regions the Czech Mountain Rescue rates; other Czech areas have `null`), and Kasprowy Wierch
  (TOPR, the Polish Tatras; the other Polish areas have no bulletin), French resorts in the Alps
  and Pyrenees (Météo-France, by massif, e.g. Vanoise; the Jura, Vosges and Massif Central have
  none), and Jasná, Tatranská
  Lomnica and Štrbské Pleso (Slovak HZS; found from a point in the ski area, since the villages lie
  below the warning regions). Salzburg and the other Austrian states have no
  machine-readable bulletin, so `avalanche` is `null` for all resorts there (including Lech Zürs
  and Warth-Schröcken in Vorarlberg), and the Snow Card ones in Salzburg (Hochkrimml,
  Königsleiten, Mittersill, Wildkogel).
- Early and late in the season the SLF only rates the alpine regions, so Swiss resorts in the
  Prealps (and e.g. Arosa) can have `null` while others have a rating.
- `null` outside the season and when no bulletin is valid at the time of the run.
- `danger_level` (1–5) is the highest level of the day in the resort's warning region;
  `ratings` has the split by elevation and time of day. The region is found from one point
  per resort, so a resort spanning two regions shows only one.

### Locations

`location` is one point per resort: the Snow Card or infosnow location, a point in the ski area
for the glacier resorts, or the main village or ski station (looked up on OpenStreetMap) for other
Austrian, Italian, French, Czech, Slovak and Polish resorts, Andermatt and Engelberg. It marks the area on a map, not a lift station.

`region` is the state, canton, Italian region, Czech kraj, Polish voivodeship or French département that
point lies in (e.g. `Tirol`, `Valais`, `Valle d'Aosta`, `Liberecký kraj`, `Žilinský kraj`, `Małopolskie`,
`Savoie`; Trentino-Alto Adige by province: `Südtirol`, `Trentino`), looked up on
OpenStreetMap; the table filters by it and by `country`. An area spanning a border is listed
under one of them (Katschberg under Kärnten, Glacier 3000 under Vaud).

### Areas

`assets/areas.geojson` (in this branch, not in the data) has the outline of 295 of the 422
resorts, from OpenStreetMap's ski areas (`landuse=winter_sports`); the others, mostly small
village lifts, are only a marker on the map. The French resorts (added 26 October 2026) have no
outlines yet: the script now covers France, but Overpass refused the queries that day. Each feature has the resort's `id` and the
`osm` ids it was made from. It isn't updated automatically: run
`scripts/resort_areas.py` now and then (e.g. after adding resorts) and check the map:

```sh
uv run --no-project --with shapely python3 scripts/resort_areas.py ../snow-conditions-data/json/index.json assets/areas.geojson
```

An area within 1 km of several resorts is split between them by nearest resort point, so
their parts are approximate. Wrong matches are fixed by hand in the script's `SHARED` and
`EXCLUDE`.

### Archive

- Collected since 24 October 2026; earlier data doesn't exist.
- A snapshot is only written when a report changed (apart from `fetched_at`), and the index
  lists every run. Snapshots keep the format of their time, so older ones may lack newer
  fields.
- Until 25 October 2026 the runs were listed in `history/<country>/<resort>.json`; those files
  remain in the `data` branch's git history.

## Using it in a TRMNL plugin

Let the user paste the resort's JSON URL into a text field, and poll that URL:

(Villages merged into one ski area on 26 October 2026 keep their old links, e.g.
`json/at/soell-skiwelt.json`, as copies of the area's report with its `id`; new plugins should
use the area's link, `json/at/skiwelt.json`. Their archives stop at that date.)

```yaml
polling_verb: get
polling_url: "{{ resort_url }}"
custom_fields:
- keyname: resort_url
  name: Resort
  field_type: string
  description: The JSON link of your ski resort on snow.miron.asia.
  help_text: Open <a href="https://snow.miron.asia" target="_blank">snow.miron.asia</a>, search for your
    resort and open it, then press <strong>Copy</strong> next to its JSON link.
    It looks like <code>https://snow.miron.asia/json/at/soelden.json</code>.
  placeholder: https://snow.miron.asia/json/at/soelden.json
```

A dropdown (`xhrSelect`) doesn't work with GitHub Pages: TRMNL loads its options from the
browser with request headers that need a CORS preflight, which GitHub Pages answers with 405
(POST too). `trmnl/resorts.json` (generated on deploy by `scripts/trmnl_resorts.py`, in the
`xhrSelect` format `[{"Sölden (Tirol, Austria)": "at/soelden"}, …]`) is kept for a host that
can answer the preflight, e.g. a Cloudflare proxy in front of the site.

## Running locally

Put the data next to the pages and serve the folder:

```sh
git worktree add ../snow-conditions-data data   # once
for part in json archive schema; do ln -sfn ../snow-conditions-data/$part .; done
python3 -m http.server 8000                     # http://localhost:8000
```

(The links are git-ignored.)

Data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; map tiles © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA), pistes and lifts from [OpenSnowMap](https://www.opensnowmap.org).
