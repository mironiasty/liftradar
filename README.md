# snow-conditions

Snow conditions for ski resorts in Austria, Switzerland, Italy, France, Germany, Czechia, Slovakia, Poland and Finland, published at
[liftradar.eu](https://liftradar.eu).

- **Data** (branch `data`): `json/<country>/<resort>.json`, `json/index.json`,
  `archive/<country>/<resort>/` and `schema/…`, published by the fetcher twice a day.
  Don't edit it by hand: every publish replaces it.
  - `archive/<country>/<resort>/index.json` lists every run (oldest first) with the
    snapshot holding that run's full report, e.g. `2026-10-25T09-00Z.json` (UTC). Runs
    without changes share the earlier snapshot. Until 25 October 2026 the runs were listed in
    `history/<country>/<resort>.json`; those files remain in the `data` branch's git history.
  - `logs/<YYYY-MM-DDTHH-MMZ>.json`: each run's log (UTC), what failed for which resort and the
    run's warnings, kept for 30 days. Not served by the site (the site doesn't show errors).
  - Villages merged into one ski area on 26 October 2026 keep their old links, e.g.
    `json/at/soell-skiwelt.json`, as copies of the area's report with its `id` (not in
    `index.json`); new links should use the area's, `json/at/skiwelt.json`. Their archives
    stop at that date.
- **Website** (branch `main`, this): `index.html` (table), `map.html` (map),
  `resort.html?r=<country>/<resort>` (one resort: all its data, its area on the map and
  its history from the archive), `sources.html` (data sources, incl. every URL in the
  current data) and `about.html` (how the values are computed, and their caveats), plain
  static pages that load the JSON in the browser. No build step.
  `assets/areas.geojson` holds the ski-area outlines shown on the map; see [Areas](#areas).
  `assets/mini-map-light.webp`, `mini-map-dark.webp` and `mini-map.svg` are the shaded relief
  and country borders of the small map in the table page's header, drawn by
  `scripts/mini_map.py` from Terrain Tiles and Natural Earth (see the script); the page adds the
  resort dots from the data. Redraw them only if resorts appear outside their frame.

`.github/workflows/pages.yml` combines both and deploys to GitHub Pages, on every push
to `main` and after every data update.

## About the data

How every value is computed, what `null` and 0 mean, and the caveats (timing, status, snow,
lifts and slopes, lift types and slope difficulties, avalanche danger, locations, map areas,
archive) are on the site: [About the data](https://liftradar.eu/about.html) (`about.html`).
Keep it up to date with the fetcher. The format is defined by the JSON Schema in `schema/`
(`resort.schema.json`, `index.schema.json`, `archive.schema.json`).

### Sources

| What | Where it comes from |
|---|---|
| Tirol resorts | [Tirol Snow Card](https://www.snowcard.tirol.at/skigebiete) resort reports |
| Salzburg resorts; Planai, Dachstein Gletscher, Feuerkogel | [SalzburgerLand snow report](https://www.salzburgerland.com/de/schneebericht/) |
| Hintertux, Sölden, Kitzsteinhorn, Kaunertal, Pitztal | The resorts' own websites (snow measuring stations), instead of the regional report |
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
| Finnish resorts | [ski.fi](https://ski.fi/hiihtokeskukset/) (Finnish Ski Area Association): the "today" block each resort fills in (open slopes and lifts, dated by the day only) and the area's slopes by colour; used while at most 14 days old, and a resort its list flags closed is closed |
| Ylläs, Ruka, Tahko, Himos, Salla, Ukkohalla, Iso-Syöte, Vuokatti, Laajis, Messilä, Ounasvaara, Riihivuori, Suomutunturi, Kasurila | Live status from the resort itself, instead of ski.fi's block: open/total counters on its own page, a list of its slopes and lifts (Vuokatti, Laajis, Messilä), or its slope map's data on [Panoraama](https://www.panoraama.com/) (Ruka: counters and natural snow; Iso-Syöte: every slope and lift). No report time |
| German resorts | [Outdooractive](https://www.outdooractive.com/de/skiresorts/): the snow report each resort (or its tourism board) enters on its Outdooractive page, which the Sauerland's [Wintersport-Arena](https://www.wintersport-arena.de/skifahren-boarden/skigebiete-und-schneehoehen) also publishes: snow in the valley and on the mountain, lifts open/total, slope km open/total. Dated by the day only, no slope counts; used while at most 14 days old |
| Winterberg, Sudelfeld, Brauneck, Spitzingsee, Großer Arber, Ofterschwang, Bolsterlang, Fichtelberg, Zugspitze; Hohenbogen | Their Intermaps slope map (lifts and slopes), instead of the Outdooractive counts; Hohenbogen has only its map |
| Snow depth of Finnish resorts | Nearest [FMI](https://en.ilmatieteenlaitos.fi/open-data) weather station measuring snow depth (Finnish Meteorological Institute, CC BY 4.0), as the valley depth |
| Kasprowy Wierch, Jaworzyna Krynicka, Palenica, Mosorny Groń | [Polskie Koleje Linowe](https://www.pkl.pl/trasy-narciarskie.html) (PKL, the lift company): every lift and slope with snow cover (no report time) |
| Zieleniec | [zieleniec.pl](https://zieleniec.pl/zima/aktualne-warunki): every lift and slope with snow cover (no report time). The site refuses the fetcher's servers for now, so only the area's size is published |
| Jasná, Tatranská Lomnica, Štrbské Pleso, Starý Smokovec, Szczyrk (TMR); Kotelnica Białczańska, Czarna Góra, Szrenica, Karpacz, Pilsko, Słotwiny Arena, Słotwiny, Nosal, Grapa (Czarna Góra), Beskid Sport Arena; Hauser Kaibling, Ramsau am Dachstein, Füssener Jöchle, Birkenlift & Geigenbühel (Seefeld) | **Size only** (no live status yet): lift and slope totals and km from the operators' own lists (for the small neighbours of covered areas also OnTheSnow and skiresort.com) ([TMR slope tables](https://laravel.jasna.sk/api/jasna/snehove-zjazdovky?lang=sk), the resorts' sites; Kotelnica from [visitmalopolska.pl](https://visitmalopolska.pl/en/obiekt/-/poi/osrodek-narciarski-kotelnica-bialczanska)) |
| Lift/slope status of the bigger Austrian areas, Andermatt, Engelberg, Friuli Venezia Giulia and Madesimo | The resort's own Intermaps slope map |
| Ski-area sizes (total slope km, and lift and slope totals a report lacks) | The size on the resort's own website; otherwise [OnTheSnow](https://www.skiinfo.fr/) (the figures resorts enter there) or [skiresort.com](https://www.skiresort.com/) (km, and km by difficulty for some bigger areas); for a sector of a linked area, the sum of the operator's own slope lengths (Ski Arlberg's slope map, infosnow, Dolomiti Superski) |
| Avalanche danger, Tirol | [avalanche.report](https://avalanche.report), Euregio Tirol – South Tyrol – Trentino |
| Avalanche danger, Switzerland | [SLF avalanche bulletin](https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/) |
| Avalanche danger, South Tyrol and Trentino | [avalanche.report](https://avalanche.report) (Euregio) |
| Avalanche danger, other Italian regions | [AINEVA](https://bollettini.aineva.it) joint bulletin |
| Avalanche danger, Krkonoše and Jeseníky (Czechia) | [Horská služba ČR](https://www.horskasluzba.cz/cz/pocasi-na-horach/lavinova-predpoved) (Czech Mountain Rescue), from the EAWS bulletin files on [avalanche.report](https://avalanche.report) |
| Avalanche danger, Jasná, Tatranská Lomnica, Štrbské Pleso | [Slovak Avalanche Prevention Centre](https://www.laviny.sk) (HZS), from the same EAWS bulletin files |
| Avalanche danger, Kasprowy Wierch (Polish Tatras) | [TOPR](https://lawiny.topr.pl) (Tatra Volunteer Rescue), from the same EAWS bulletin files |
| Avalanche danger, Bavarian Alps | [Lawinenwarndienst Bayern](https://www.lawinenwarndienst.bayern.de) (Bavarian Avalanche Warning Service), from the same EAWS bulletin files |
| Avalanche danger, French Alps and Pyrenees | [Météo-France](https://meteofrance.com/meteo-montagne) mountain bulletin (by massif), from the same EAWS bulletin files |
| Open km of Kitzsteinhorn and Kaunertal | Slope lengths © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |
| Ski-area outlines on the map | `landuse=winter_sports` areas © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (this branch, not the data) |

The Snow Card, SalzburgerLand and Kärnten pages show the report each resort submits to iSKI;
holidayinfo.cz is where Czech resorts submit theirs (Sitour CZ, part of the iSKI network), Lumiplan
where French resorts do (Alpe d'Huez uses ATEN Altitude instead). Not covered yet in France:
Avoriaz, Val Cenis, Montgenèvre, Saint-Lary, Font-Romeu, Ax 3 Domaines, Auron, Orcières, Chamrousse
and Les Orres (no source we can read). Not covered yet in Finland: Levi's own lift list (ski.fi's
block is used), Paljakka, Koli and the smaller hills; Finland has no avalanche ratings to read. Not
covered yet in Germany: areas without an Outdooractive page or a status of their own (St. Englmar,
Mitterfirmiansreut and other Bavarian Forest areas, Wasserkuppe, Erbeskopf, Hoherodskopf) and
single-lift areas; the German uplands have no avalanche service. Each
file's `sources` lists the URLs used for that report.

### Areas

`assets/areas.geojson` (in this branch, not in the data) has the outline of 295 of the 422
resorts, from OpenStreetMap's ski areas (`landuse=winter_sports`); the others, mostly small
village lifts, are only a marker on the map. The French resorts (added 26 October 2026), the
Finnish ones (27 October 2026) and the German ones (28 October 2026) have no outlines yet: the
script now covers them, but Overpass refused or didn't answer the queries when they were added. Each feature has the resort's `id` and the
`osm` ids it was made from. It isn't updated automatically: run
`scripts/resort_areas.py` now and then (e.g. after adding resorts) and check the map:

```sh
uv run --no-project --with shapely python3 scripts/resort_areas.py ../snow-conditions-data/json/index.json assets/areas.geojson
```

An area within 1 km of several resorts is split between them by nearest resort point, so
their parts are approximate. Wrong matches are fixed by hand in the script's `SHARED` and
`EXCLUDE`.

## Running locally

Put the data next to the pages and serve the folder:

```sh
git worktree add ../snow-conditions-data data   # once
for part in json archive schema; do ln -sfn ../snow-conditions-data/$part .; done
python3 -m http.server 8000                     # http://localhost:8000
```

(The links are git-ignored.)

Data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; map tiles © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA), pistes and lifts from [OpenSnowMap](https://www.opensnowmap.org).
