# liftradar

Snow conditions for ski resorts in Austria, Switzerland, Italy, France, Germany, Czechia, Slovakia, Poland, Finland, Norway and Spain, published at
[liftradar.eu](https://liftradar.eu).

- **Data** (branch `data`): `json/<country>/<resort>.json`, `json/index.json`, `json/stats.json`,
  `history/<country>/<resort>.json` and `schema/…`, published by the fetcher twice a day, plus
  `archive/` and `logs/`, which aren't served by the site. Don't edit it by hand: every publish
  replaces it.
  - `json/index.json`: all resorts, with only what the table, map and sources pages read; the
    full report (stations, lift and slope breakdowns, avalanche bulletin, ...) is in
    `json/<country>/<resort>.json`.
  - `json/stats.json`: daily totals per country and region over the last 365 days (resorts
    tracked and open; open lifts, slopes and km, of open resorts only), for `stats.html`.
  - `history/<country>/<resort>.json`: the key numbers of every run over the last 365 days
    (open lifts and slopes, snow, status), one list per value, for the resort page's graphs.
  - `archive/<country>/<resort>/<season>.jsonl` (e.g. `2026-27.jsonl`, from 1 July): every
    run, one JSON object per line, with the full report when it changed. Until 29 October
    2026 the archive was a file per changed report plus an `index.json` per resort, served by
    the site; those files remain in the `data` branch's git history.
  - `logs/<YYYY-MM-DDTHH-MMZ>.json`: each run's log (UTC), what failed for which resort and the
    run's warnings, kept for 30 days. Not served by the site (the site doesn't show errors).
  - Villages merged into one ski area on 26 October 2026 keep their old links, e.g.
    `json/at/soell-skiwelt.json`, as copies of the area's report with its `id` (not in
    `index.json`); new links should use the area's, `json/at/skiwelt.json`. Their archives
    stop at that date, and they have no history.
- **Website** (branch `main`, this): `index.html` (table), `map.html` (map),
  `resort.html?r=<country>/<resort>` (one resort: all its data, its area on the map and
  its history), `sources.html` (data sources, incl. every URL in the
  current data) and `about.html` (what the values mean, and their caveats), plain
  static pages that load the JSON in the browser. No build step.
  `assets/areas.geojson` holds the ski-area outlines shown on the map; see [Areas](#areas).
  `assets/mini-map-light.webp`, `mini-map-dark.webp` and `mini-map.svg` are the shaded relief
  and country borders of the small map in the table page's header, drawn by
  `scripts/mini_map.py` from Terrain Tiles and Natural Earth (see the script); the page adds the
  resort dots from the data. Redraw them only if resorts appear outside their frame.

`.github/workflows/pages.yml` combines both and deploys to the Cloudflare Worker `liftradar`
(static assets only, `wrangler.jsonc`; needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets), on every push to `main` and after every data update. It's
also at <https://liftradar.liftradar.workers.dev>. `_headers` lets any origin read `json/`,
`history/` and `schema/`, and `404.html` is served for missing files. Cloudflare redirects `about.html` to `/about` (and so on), keeping the query string.

## About the data

What readers need to know (timing, status, snow, lifts and slopes, avalanche danger, the map,
history, and a section for developers) is on the site: [About the data](https://liftradar.eu/about.html)
(`about.html`). It keeps to what matters to a reader: how each value is computed per source is in
`../liftradar-fetcher/README.md`, "Data details". Keep both up to date with the fetcher. The format is defined by the JSON Schema in `schema/`
(`resort.schema.json`, `index.schema.json`, `history.schema.json`, `stats.schema.json`).

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
| Czech resorts | [Kudy z nudy](https://www.kudyznudy.cz/nahory), CzechTourism's (the state tourism agency) snow report: each area's page lists every lift and slope and the snow report, as the resorts enter it. No report time. holidayinfo.cz (Sitour), where they enter it, isn't used: it's a commercial aggregator. Jáchymov isn't on it: "no report" |
| Finnish resorts | [ski.fi](https://ski.fi/hiihtokeskukset/) (Finnish Ski Area Association): the "today" block each resort fills in (open slopes and lifts, dated by the day only) and the area's slopes by colour; used while at most 14 days old, and a resort its list flags closed is closed |
| Ylläs, Ruka, Tahko, Himos, Salla, Ukkohalla, Iso-Syöte, Vuokatti, Laajis, Messilä, Ounasvaara, Riihivuori, Suomutunturi, Kasurila | Live status from the resort itself, instead of ski.fi's block: open/total counters on its own page, a list of its slopes and lifts (Vuokatti, Laajis, Messilä), or its slope map's data on [Panoraama](https://www.panoraama.com/) (Ruka: counters and natural snow; Iso-Syöte: every slope and lift). No report time |
| Sauerland resorts (Germany) | The [Wintersport-Arena Sauerland](https://www.wintersport-arena.de/skifahren-boarden/skigebiete-und-schneehoehen)'s lift overview (the lift operators' association): lifts open/total, one snow depth and an open/closed icon per area. No report time, no slopes or km |
| Winterberg, Sudelfeld, Brauneck, Spitzingsee, Großer Arber, Ofterschwang, Bolsterlang, Fichtelberg, Zugspitze, Hohenbogen | Their Intermaps slope map (lifts and slopes); Winterberg's replaces the Wintersport-Arena's counts, the others have only their map (no snow depth) |
| Other German resorts (83) | No source yet: listed as "no report", without a size. Outdooractive, where many of them enter their report, isn't used: its terms allow private use only |
| Snow depth of Finnish resorts | Nearest [FMI](https://en.ilmatieteenlaitos.fi/open-data) weather station measuring snow depth (Finnish Meteorological Institute, CC BY 4.0), as the valley depth |
| Norwegian resorts | [Fnugg](https://fnugg.no) (the Norwegian ski resorts' association, Norske Alpinanlegg og Fjelldestinasjoner): every lift and slope with its state, and the report each resort enters (snow depth, new snow, conditions). No slope lengths; km from skiresort.com. Fnugg's weather (from Yr) isn't used. Its terms ask for a credit and link next to the data, which the resort pages, map and table show |
| Tryvann, Kongsberg, Drammen, Vierli, Grefsenkollen, Haglebu, Savalen, Blomlia | Not on Fnugg: listed as "no report", with their size from skiresort.com |
| La Molina, Vall de Núria, Vallter, Espot, Port Ainé, Boí Taüll | [Pirineu365](https://pirineu365.cat/infoneu-pirineu365/) (FGC, the Catalan government's railways): every lift and slope with its state, snow min/max |
| Baqueira Beret | [baqueira.es](https://www.baqueira.es/es/estado-de-la-estacion), which refuses automated clients: listed as "no report" with its size for now |
| Formigal-Panticosa, Sierra Nevada | Their Intermaps slope map; Formigal is open only with a lift running |
| Valdezcaray, Manzaneda, Valgrande-Pajares, Fuentes de Invierno | The resorts' own snow report pages |
| Astún-Candanchú, Cerler, Javalambre, Valdelinares, Masella, Puerto de Navacerrada, Valdesquí, Alto Campoo, Leitariegos, La Covatilla, San Isidro, Tavascán | No status read yet: listed as "no report", with the operator's size where it publishes one. ATUDEM, the resorts' association, has a national report, but its terms require written permission for any use, so it isn't read |
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
| Avalanche danger, Norwegian mountain regions | [NVE](https://www.varsom.no/en/avalanches/avalanche-warnings/) (Varsom, the Norwegian Water Resources and Energy Directorate), from the same EAWS bulletin files |
| Avalanche danger, French Alps and Pyrenees | [Météo-France](https://meteofrance.com/meteo-montagne) mountain bulletin (by massif), from the same EAWS bulletin files |
| Open km of Kitzsteinhorn and Kaunertal | Slope lengths © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |
| Ski-area outlines on the map | `landuse=winter_sports` areas © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (this branch, not the data) |

The Snow Card, SalzburgerLand and Kärnten pages show the report each resort submits to iSKI;
Lumiplan is where French resorts submit theirs (Alpe d'Huez uses ATEN Altitude instead). Not
covered yet in France: Avoriaz, Val Cenis, Montgenèvre, Saint-Lary, Font-Romeu, Ax 3 Domaines,
Auron, Orcières, Chamrousse and Les Orres (no source we can read). Not covered yet in Finland: Levi's own lift list (ski.fi's
block is used), Paljakka, Koli and the smaller hills; Finland has no avalanche ratings to read. Not
covered yet in Germany: a live status for the 83 areas outside the Sauerland without a current
slope map (the Allgäu, most of Upper Bavaria, the Black Forest, the Harz, Saxony, Thuringia), St.
Englmar, Mitterfirmiansreut and other Bavarian Forest areas, Wasserkuppe, Erbeskopf, Hoherodskopf
and single-lift areas; the German uplands have no avalanche service. Not covered yet in Czechia:
Jáchymov, Světlý vrch and the areas under 4 km of slopes. Not covered yet in Spain: a live status for 12 areas (see the table), the nordic areas and Madrid SnowZone. Not covered yet in Norway: a live status for the areas that aren't on Fnugg (Skimore's Tryvann, Kongsberg and Drammen, Vierli, Grefsenkollen, Haglebu, Savalen, Blomlia); only the 70 resorts inside NVE's rated regions have avalanche danger. Each
file's `sources` lists the URLs used for that report.

### Areas

`assets/areas.geojson` (in this branch, not in the data) has the outline of 553 of the 731
resorts, from OpenStreetMap's ski areas (`landuse=winter_sports`); the others, mostly small
village lifts, are only a marker on the map. Each feature has the resort's `id` and the
`osm` ids it was made from. It isn't updated automatically: run
`scripts/resort_areas.py` now and then (e.g. after adding resorts) and check the map:

```sh
uv run --no-project --with shapely python3 scripts/resort_areas.py ../liftradar-data/json/index.json assets/areas.geojson
```

The script queries Overpass. When Overpass is down or at capacity (it was from 26 to 28 October
2026), read the areas from Geofabrik's OpenStreetMap extracts instead (the countries, or for Italy,
France, Poland and Germany the regions, covering the script's `BBOXES`; about 11 GB) and pass the
result as a third argument:

```sh
uv run --no-project --with osmium python3 scripts/osm_ski_areas.py elements.json extracts/*.osm.pbf
uv run --no-project --with shapely python3 scripts/resort_areas.py ../liftradar-data/json/index.json assets/areas.geojson elements.json
```

The outlines of 28 October 2026 were made that way (extracts of that day), the first to include the
French, Finnish and German resorts.
The Norwegian outlines were added on 30 October 2026 from Overpass, merged into that file (run
for Norway only, so the others stayed as they were).
The Spanish outlines were added the same way on 30 October 2026 (22 of 25 resorts; Baqueira Beret,
Puerto de Navacerrada and Vall de Núria have no OpenStreetMap area there).

An area within 1 km of several resorts is split between them by nearest resort point, so
their parts are approximate. Wrong matches are fixed by hand in the script's `SHARED` and
`EXCLUDE`.

## Running locally

Put the data next to the pages and serve the folder:

```sh
git worktree add ../liftradar-data data   # once
for part in json history schema; do ln -sfn ../liftradar-data/$part .; done
python3 -m http.server 8000                     # http://localhost:8000
```

(The links are git-ignored.)

Data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; map tiles © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA), pistes and lifts from [OpenSnowMap](https://www.opensnowmap.org).
