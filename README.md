# liftradar

Snow conditions for ski resorts in Austria, Switzerland, Italy, France, Germany, Czechia, Slovakia, Poland, Finland, Norway, Spain, Slovenia, Andorra and Bulgaria, published at
[liftradar.eu](https://liftradar.eu).

- **Data** (branch `data`): `json/<country>/<resort>.json`, `json/index.json`, `json/stats.json`, `json/groups.json`,
  `history/<country>/<resort>.json` and `schema/…`, published by the fetcher twice a day, plus
  `archive/` and `logs/`, which aren't served by the site. Don't edit it by hand: every publish
  replaces it.
  - `json/index.json`: all resorts, with only what the table, map and sources pages read (and
    `linked_area` / `ski_region`, the groups a resort is in, for API clients); the full report (stations, lift and slope breakdowns, avalanche bulletin, ...) is in
    `json/<country>/<resort>.json`.
  - `json/<country>/<resort>.details.json` (experimental, not part of the API): every lift and slope
    with its status, for resorts whose report has `details`: those with an Intermaps slope map, and those whose
    source lists its lifts and slopes one by one (infosnow, Lumiplan, Dolomiti Superski, Fnugg, the resorts' own
    pages, ...; only open or closed there). The resort page lists them, each slope with its own colour (`colour`:
    green, yellow, two-colour slopes) where the source gives one, else its difficulty's.
  - `json/stats.json`: daily totals per country and region over the last 365 days (resorts
    tracked and open; open lifts, slopes and km, of open resorts only), for `stats.html`.
  - `json/groups.json`: the groups of resorts listed separately (linked ski areas, passes and
    regions) by id, which a member's `linked_area` and `ski_region` give (in its report and the index);
    the site doesn't read it yet.
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
    stop at that date, and they have no history. Ski Arlberg's three areas became one resort
    on 7 November 2026, `json/at/ski-arlberg.json`, before their season opened: the old files
    (`st-anton-am-arlberg`, `lech-zuers`, `warth-schroecken`) are gone.
- **Website** (branch `main`, this): `index.html` (table), `map.html` (map),
  `resort.html?r=<country>/<resort>` (one resort: all its data, its area on the map and
  its history), `3d.html?r=<country>/<resort>` (the resort in 3D, as a diorama), `api.html` (the JSON files, for developers, with `openapi.json`: the same in OpenAPI 3.1, referring to the JSON Schemas by URL, so keep its paths and descriptions in step with `api.html`), `sources.html` (data sources, incl. every URL in the
  current data), `about.html` (what the values mean, and their caveats) and `privacy.html` (the privacy policy
  of the site and the phone apps, the URL the app stores ask for: keep it in step with what they download), plain
  static pages that load the JSON in the browser. No build step locally.
  The ski-area outlines, the resorts' points and the pistes and lifts on the map come from the ski
  tiles at `/ski/`, built weekly and not kept in git; see [Ski tiles](#ski-tiles).
  `assets/mini-map-light.webp`, `mini-map-dark.webp` and `mini-map.svg` are the shaded relief
  and country borders of the small map in the table page's header, drawn by
  `scripts/mini_map.py` from Terrain Tiles and Natural Earth (see the script); the page adds the
  resort dots from the data. Redraw them only if resorts appear outside their frame.

`.github/workflows/pages.yml` combines both with `scripts/build.mjs` (as `npm run build` does locally, see [Running locally](#running-locally)), which adds the 3D engine, generates the translated pages (see [Translations](#translations)) and the sitemap, minifies `assets/*.js` and `*.css` with esbuild, compacts `json/index.json` and versions the asset links, and deploys to the Cloudflare Worker `liftradar`
(the files, plus the MCP server at `/mcp`, see [MCP](#mcp); `wrangler.jsonc`; needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets), on every push to `main` and after every data update. It's
also at <https://liftradar.liftradar.workers.dev>. `_headers` lets any origin read `json/`,
`history/`, `schema/` and `openapi.json`, and `404.html` is served for missing files. Cloudflare redirects `about.html` to `/about` (and so on), keeping the query string: the deploy rewrites
the links to the pages without `.html`, so search engines don't reach them through a redirect. Every page but
`404.html` has a canonical address on liftradar.eu (the resort and 3D pages set theirs, with `?r=`, in `setResortAddress()`), so the copy on
workers.dev and the addresses with filters aren't taken for duplicates.

## App links

The phone apps (TrailRider's repo, `apps/liftradar`) open the site's pages they can show, when the site vouches for
them: the first page (`/`), `/resort?r=<country>/<id>[&view=3d]`, the 3D page (`/3d?r=…`) and the map (`/map[?r=…]`),
in each language (`/pl/`, `/pl/resort`…) and as `.html`. Not the site's other pages (about, stats, the API, the JSON
files), which a link still opens in the browser. `.well-known/apple-app-site-association` does it for iOS (the company team's app
ID, `85CCW66723.eu.liftradar.app`; `_headers` serves it as JSON), once the app has the Associated Domains
capability. Android's `.well-known/assetlinks.json` names the app (`eu.liftradar.app`) by the SHA-256 fingerprint of
the key Google Play signs it with (Play Console, the app signing key's certificate); Android checks it when the app
is installed or updated, and then opens those links in the app without asking. A build signed with another key
(the upload key, a debug build) isn't covered and opens them in the browser.

## Sitemap

`scripts/sitemap.mjs` writes `sitemap.xml` on deploy, from the site as it goes out: every page in every language,
each resort's page, and its 3D map when the ski tiles have its area, at the addresses without `.html`. Translations
with `noindex` (still partly in English) are left out. `robots.txt` points to it; Cloudflare adds its own lines to it.

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
| Salzburg resorts; Feuerkogel | [SalzburgerLand snow report](https://www.salzburgerland.com/de/schneebericht/) |
| Hintertux, Sölden, Kitzsteinhorn, Kaunertal, Pitztal | The resorts' own websites (snow measuring stations; last snowfall for Hintertux and Sölden), instead of the regional report |
| Carinthia | [Kärnten snow report](https://www.kaernten.at/golf/service/wetter/schneeberichte) (Kärnten Werbung, tourism board) |
| Schladming 4-Berge-Skischaukel (Planai, Hochwurzen, Hauser Kaibling, Reiteralm, added up), Galsterberg, Ramsau am Dachstein | [Schladming-Dachstein](https://www.schladming-dachstein.at/de/info-und-service/betriebszeiten-bergbahnen-winter) tourism board: each area's page of lifts and slopes with their state. No report time |
| St. Anton, Lech Zürs, Warth-Schröcken | [skiarlberg.at](https://www.skiarlberg.at/de/live-infos/anlagen): every lift and slope, the lift companies' live info (no report time, no km; no snow depth for Warth-Schröcken) |
| Other resorts in Vorarlberg, Styria, Upper and Lower Austria, some in Carinthia | Their Intermaps slope map only (lifts and slopes, no snow depth) |
| Swiss resorts | [infosnow.ch](https://infosnow.ch/portal/): live lift and slope status as the lift companies publish it |
| Engelberg-Titlis, the Jungfrau Ski Region (Grindelwald-Wengen, Grindelwald-First, Mürren-Schilthorn), the Aletsch Arena, Davos Klosters (Parsenn, Jakobshorn, Madrisa, Rinerhorn, Schatzalp) | The operators' own status: Titlis' [SISMEDIA export](https://www.titlis.ch/de/live), [jungfrau.ch's live data](https://www.jungfrau.ch/de-ch/live/pistendaten/), the [Aletsch Arena's status report](https://www.aletscharena.ch/hier-jetzt/live/statusbericht/statusbericht-winter), [davos.ch's lift and slope report](https://www.davos.ch/entdecken/berge-in-davos-klosters/wintersportbericht/anlagen-und-pistenbericht): every lift and slope with its state (Jungfrau and Aletsch with their update time) |
| Snow depth of Swiss resorts that don't report it | Nearest [SLF](https://www.slf.ch/en/services-and-products/slf-data-service) stations (WSL Institute for Snow and Avalanche Research, CC BY 4.0) |
| Dolomiti Superski areas | [Open Data Hub South Tyrol](https://opendatahub.com): every lift and slope as Dolomiti Superski publishes it (CC0) |
| Valle d'Aosta (and Alagna) | [lovevda.it snow bulletin](https://www.lovevda.it/it/prima-di-partire/bollettino-neve-sci-discesa) |
| Trentino | [visittrentino.info snow bulletin](https://www.visittrentino.info/it/meteo/bollettino-neve-sci-alpino/trentino) |
| South Tyrol outside Dolomiti Superski; snow of the South Tyrol DSS areas | [Open Data Hub](https://opendatahub.com) snow report (province's tourism database) |
| Bormio (with San Colombano), Santa Caterina, Stelvio | [bormio.eu](https://www.bormio.eu/it/live-info/impianti-e-piste) (tourism board) |
| Livigno | [livigno.eu](https://www.livigno.eu/en/lifts) (tourism board, lifts only) |
| Riserva Bianca (Limone Piemonte), Aprica, Monte Pora, Campo Felice, Abetone, Ovindoli | The resorts' own status pages ([Riserva Bianca](https://riservabianca.it/impianti-piste), [Aprica](https://www.apricaonline.com/it/situazione-neve-e-piste), [Monte Pora](https://www.montepora.com/impianti/), [Campo Felice](https://www.campofelice.it/ita/impianti.php), [Abetone](https://www.multipassabetone.it/stato-impianti), [Ovindoli](https://www.ovindolimagnola.it/live.html)): every lift and slope with its state (Ovindoli: only how many are open). No report time |
| Monte Cimone, Prato Nevoso, Frabosa Soprana | The resorts' own status pages ([Monte Cimone](https://www.cimonesci.it/impianti-aperti/), [Mondolè Ski](https://www.pratonevoso.com/inverno/live/aperture/)): every lift and slope with its state, and the report's time |
| Roccaraso, Bardonecchia, Artesina and 47 smaller areas (Italy) | **Size only** (no live status yet): lift and slope totals and km from [OnTheSnow](https://www.skiinfo.fr/), or the resort's own (km otherwise skiresort.com's). Each reported there in the 2025/26 season |
| Etna Nord (Sicily) | [EtnaSci](https://www.etnasci.it/localita/k2/bollettino-neve)'s snow report, kept by the Etna's ski school: every lift with its state, snow on the slopes (min–max), dated by the day. The operator (STAR Etna) shows no status. Lifts only; its 4 slopes from staretna.it |
| French resorts | [Lumiplan](https://www.lumiplan.com), where French resorts enter their daily report: the station's snow bulletin (measuring points, every lift and slope) and, where the resort embeds one, its interactive slope map (every lift and slope with lengths). No report time |
| Montgenèvre; the Via Lattea (Sestriere, Sauze d'Oulx, Sansicario, Claviere) | Montgenèvre's own [Infos Neige](https://montgenevre.com/hiver/en-direct/infos-neige/) page, which shows Lumiplan's data (digisnow): every lift and slope of each sector (Montgenèvre's and the Italian ones) with its state. No report time |
| Avoriaz | Its part of the Portes du Soleil's Intermaps slope map: the lifts and slopes whose names match OpenSkiData's Avoriaz area (29 of its 35 lifts, 34 of its 56 slopes; names its neighbours share are left out) |
| Alpe d'Huez | [ATEN Altitude](https://live.aten-altitude.com/alpehuez/) live page the resort embeds: every lift and slope with its state, snow per measuring point. No report time, no lengths |
| Czech resorts | [Kudy z nudy](https://www.kudyznudy.cz/nahory), CzechTourism's (the state tourism agency) snow report: each area's page lists every lift and slope and the snow report, as the resorts enter it. No report time. holidayinfo.cz (Sitour), where they enter it, isn't used: it's a commercial aggregator. Jáchymov isn't on it: "no report" |
| Finnish resorts | [ski.fi](https://ski.fi/hiihtokeskukset/) (Finnish Ski Area Association): the "today" block each resort fills in (open slopes and lifts, dated by the day only) and the area's slopes by colour; used while at most 14 days old, and a resort its list flags closed is closed |
| Ylläs, Ruka, Tahko, Himos, Salla, Ukkohalla, Iso-Syöte, Vuokatti, Laajis, Messilä, Ounasvaara, Riihivuori, Suomutunturi, Kasurila | Live status from the resort itself, instead of ski.fi's block: open/total counters on its own page, a list of its slopes and lifts (Vuokatti, Laajis, Messilä), or its slope map's data on [Panoraama](https://www.panoraama.com/) (Ruka: counters and natural snow; Iso-Syöte: every slope and lift). No report time |
| Sauerland resorts (Germany) | The [Wintersport-Arena Sauerland](https://www.wintersport-arena.de/skifahren-boarden/skigebiete-und-schneehoehen)'s lift overview (the lift operators' association): lifts open/total, one snow depth and an open/closed icon per area. No report time, no slopes or km |
| Winterberg, Postwiese - Neuastenberg, Altastenberg, Sahnehang, Sudelfeld, Brauneck, Spitzingsee, Großer Arber, Ofterschwang, Bolsterlang, Fichtelberg, Zugspitze, Garmisch-Classic, Feldberg, Hohenbogen | Their Intermaps slope map (lifts and slopes). Winterberg's map covers four Sauerland areas, each by its own range of the map's lift and slope numbers; it replaces the Wintersport-Arena's counts for them. The others have only their map (no snow depth) |
| Fellhorn - Kanzelwand, Nebelhorn, Söllereck | The [status page](https://www.ok-bergbahnen.com/skigebiete/status-anlagen-pisten-wege/) of their operator, the Oberstdorf · Kleinwalsertal Bergbahnen: every lift and slope with its state and length. No report time |
| Balderschwang | Its own [lift](https://www.skigebiet-balderschwang.de/lifte/) and [slope](https://www.skigebiet-balderschwang.de/pisten/) pages: every lift and slope with its state. No report time |
| Other German resorts (36) | No source yet: listed as "no report", with their size from the operator's or tourism board's site. Outdooractive, where many of them enter their report, isn't used: its terms allow private use only |
| Snow depth of Finnish resorts | Nearest [FMI](https://en.ilmatieteenlaitos.fi/open-data) weather station measuring snow depth (Finnish Meteorological Institute, CC BY 4.0), as the valley depth |
| Norwegian resorts | [Fnugg](https://fnugg.no) (the Norwegian ski resorts' association, Norske Alpinanlegg og Fjelldestinasjoner): every lift and slope with its state, and the report each resort enters (snow depth, new snow, conditions). No slope lengths; km from skiresort.com. Fnugg's weather (from Yr) isn't used. Its terms ask for a credit and link next to the data, which the resort pages, map and table show |
| Tryvann, Kongsberg, Drammen, Vierli, Grefsenkollen, Haglebu, Savalen, Blomlia | Not on Fnugg: listed as "no report", with their size from skiresort.com |
| La Molina, Vall de Núria, Vallter, Espot, Port Ainé, Boí Taüll | [Pirineu365](https://pirineu365.cat/infoneu-pirineu365/) (FGC, the Catalan government's railways): every lift and slope with its state, snow min/max |
| Baqueira Beret | [baqueira.es](https://www.baqueira.es/es/estado-de-la-estacion), which refuses automated clients: listed as "no report" with its size for now |
| Formigal-Panticosa, Sierra Nevada | Their Intermaps slope map; Formigal is open only with a lift running |
| Valdezcaray, Manzaneda, Valgrande-Pajares, Fuentes de Invierno, Valdesquí, Alto Campoo | The resorts' own snow report pages (Alto Campoo's with a report time) |
| Astún-Candanchú, Cerler, Javalambre, Valdelinares, Masella, Puerto de Navacerrada, Leitariegos, La Covatilla, San Isidro, Tavascán | No status read yet: listed as "no report", with the operator's size where it publishes one. ATUDEM, the resorts' association, has a national report, but its terms require written permission for any use, so it isn't read |
| Krvavec, Mariborsko Pohorje (with Areh), Golte, Stari vrh | The resorts' own sites: every lift and slope with its state ([Krvavec](https://rtc-krvavec.si) and [Stari vrh](https://starivrh.si/razmere/) with snow depth and report time; [Mariborsko Pohorje](https://www.visitpohorje.si/obratovalni-casi/) and [Golte](https://www.golte.si/zima/smucanje/proge/) without) |
| Kranjska Gora, Vogel | [ski-kranjska-gora.com](https://www.ski-kranjska-gora.com/sl/zima/naprave-in-proge): open/total lifts and slopes and snow depth, in season only; [vogel.si](https://vogel.si/naprave-proge-zima/): every lift with its state, no slopes. No report time |
| Soriška planina, Gače | The report their own sites show: every slope (and Soriška's lifts; Gače's lift counts) with its state for each day of the week, snow, report time |
| Rogla, Kope, Cerkno, Velika planina, Ribniško Pohorje | No status read: listed as "no report", with the operator's size, otherwise skiresort.com's. Rogla's report is behind a login built into its site, Kope's under a path its robots.txt excludes. Snežni telefon (7S), where most Slovenian resorts enter their report, is a commercial portal and isn't used |
| Grandvalira, Ordino Arcalís, Pal Arinsal (Andorra) | Each resort's own "Estat de pistes" page ([Grandvalira](https://www.grandvalira.com/ca/estacio/estat-de-pistes), [Ordino Arcalís](https://www.ordinoarcalis.com/ca/estacio/estat-de-pistes), [Pal Arinsal](https://www.palarinsal.com/ca/estacio/comunicat-neu)): every lift and slope of each sector with its state, the snow depth range and the update time |
| Bansko, Borovets, Pamporovo, Vitosha and 8 smaller Bulgarian areas | **Size only** (no live status yet): Borovets' lift and slope counts from [its operator](https://www.borovets-bg.com/), the others' lifts and km from skiresort.com. Bansko's, Borovets' and Vitosha's own sites show each lift's state, to be read once they're in season |
| Kasprowy Wierch, Jaworzyna Krynicka, Palenica, Mosorny Groń | [Polskie Koleje Linowe](https://www.pkl.pl/trasy-narciarskie.html) (PKL, the lift company): every lift and slope with snow cover (no report time) |
| Zieleniec | [zieleniec.pl](https://zieleniec.pl/zima/aktualne-warunki): every lift and slope with snow cover (no report time). The site refuses the fetcher's servers for now, so only the area's size is published |
| Jasná, Tatranská Lomnica, Štrbské Pleso, Starý Smokovec, Szczyrk | [TMR](https://www.jasna.sk)'s lift and slope tables, as its sites show them: every lift and slope with its state. No report time. Outside the season the lift tables list only the summer lifts, so the lift total is the area's size until a slope opens |
| Vrátna, Donovaly (Park Snow), Malinô Brdo, Kubínska hoľa, Bachledka, Veľká Rača, Martinky, Roháče - Spálená and 21 smaller Slovak areas | **Size only** (no live status yet: their sites have none we can read): lift and slope totals and km from each area's [slovakia.travel](https://slovakia.travel/) page (the Slovak tourism agency's), Ski Telgárt's from [its own site](https://skitelgart.sk/zjazdovky-a-vleky/); placed at the GPS point of that page |
| Beskid Sport Arena | Its own [lift](https://beskidsportarena.pl/szczyrk-wyciagi-narciarskie-i-kolej-linowa/) and [slope](https://beskidsportarena.pl/szczyrk-trasy-narciarskie/) tables: every lift and slope with its state. No report time |
| Tylicz.ski | The lift and slope states on its [home page](https://tylicz.ski/) ("Aktualne warunki na trasach"). No report time, no slope lengths: its km from [OpenSkiMap](https://openskimap.org/) |
| Kotelnica Białczańska, Czarna Góra, Szrenica, Karpacz, Pilsko, Słotwiny Arena, Kompleks Narciarski Słotwiny, Nosal, Grapa (Czarna Góra); Wierchomla, Master Ski, Jurgów Ski, Małe Ciche, Laskowa-Kamionna, Kasina Ski, Czarny Groń, Cieńków, Soszów, Nowa Osada, Skolnity, Czantoria, Zwardoń Ski, Kiczera Ski; Füssener Jöchle, Birkenlift & Geigenbühel (Seefeld) | **Size only** (no live status yet): lift and slope totals and km from the operators' own lists (for the small neighbours of covered areas also OnTheSnow and skiresort.com; where a Polish operator publishes no list, [OpenSkiMap](https://openskimap.org/), from OpenStreetMap) (the resorts' sites; Kotelnica from [visitmalopolska.pl](https://visitmalopolska.pl/en/obiekt/-/poi/osrodek-narciarski-kotelnica-bialczanska)) |
| Val Cenis, Saint-Lary, Auron, Les Orres, Chamrousse, Ax 3 Domaines, Orcières, Les Karellis, L'Alpe du Grand Serre, Font-Romeu Pyrénées 2000, Superbagnères and 62 smaller French areas | **Size only** (no live status yet; their slope maps and digisnow widgets load in the browser): lift and slope totals and km from the resort's own site, otherwise [OnTheSnow](https://www.skiinfo.fr/) (km otherwise skiresort.com's). Each reported there in the 2025/26 season |
| Lift/slope status of the bigger Austrian areas, Andermatt, Friuli Venezia Giulia, Madesimo and Schöneben-Haideralm | The resort's own Intermaps slope map |
| Ski-area sizes (total slope km, and lift and slope totals a report lacks) | The size on the resort's own website; otherwise [OnTheSnow](https://www.skiinfo.fr/) (the figures resorts enter there) or [skiresort.com](https://www.skiresort.com/) (km, and km by difficulty for some bigger areas); for a sector of a linked area, the sum of the operator's own slope lengths (Ski Arlberg's slope map, infosnow, Dolomiti Superski) |
| Avalanche danger, Tirol | [avalanche.report](https://avalanche.report), Euregio Tirol – South Tyrol – Trentino |
| Avalanche danger, Switzerland | [SLF avalanche bulletin](https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/) |
| Avalanche danger, South Tyrol and Trentino | [avalanche.report](https://avalanche.report) (Euregio) |
| Avalanche danger, other Italian regions | [AINEVA](https://bollettini.aineva.it) joint bulletin |
| Avalanche danger, Krkonoše and Jeseníky (Czechia) | [Horská služba ČR](https://www.horskasluzba.cz/cz/pocasi-na-horach/lavinova-predpoved) (Czech Mountain Rescue), from the EAWS bulletin files on [avalanche.report](https://avalanche.report) |
| Avalanche danger, Jasná, Tatranská Lomnica, Štrbské Pleso, Vrátna, Martinky, Malinô Brdo, Jasenská dolina, Roháče - Spálená, Strednica - Ždiar | [Slovak Avalanche Prevention Centre](https://www.laviny.sk) (HZS), from the same EAWS bulletin files |
| Avalanche danger, Kasprowy Wierch (Polish Tatras) | [TOPR](https://lawiny.topr.pl) (Tatra Volunteer Rescue), from the same EAWS bulletin files |
| Avalanche danger, Bavarian Alps | [Lawinenwarndienst Bayern](https://www.lawinenwarndienst.bayern.de) (Bavarian Avalanche Warning Service), from the same EAWS bulletin files |
| Avalanche danger, Norwegian mountain regions | [NVE](https://www.varsom.no/en/avalanches/avalanche-warnings/) (Varsom, the Norwegian Water Resources and Energy Directorate), from the same EAWS bulletin files |
| Avalanche danger, Slovenian Alps and Prealps | [ARSO](https://meteo.arso.gov.si/met/sl/avalanche/) (Slovenian Environment Agency), from the same EAWS bulletin files; Pohorje and Gače aren't rated |
| Avalanche danger, French Alps and Pyrenees | [Météo-France](https://meteofrance.com/meteo-montagne) mountain bulletin (by massif), from the same EAWS bulletin files |
| Open km of Kitzsteinhorn and Kaunertal | Slope lengths © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |
| Weather forecast on the resort pages (experimental) | [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), `json/<country>/<id>.weather.json` |
| Ski-area outlines, pistes and lifts on the map | [OpenSkiData](https://openskidata.org) (ODbL), © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (the ski tiles, not the data) |

The Snow Card, SalzburgerLand and Kärnten pages show the report each resort submits to iSKI;
Lumiplan is where French resorts submit theirs (Alpe d'Huez uses ATEN Altitude instead). Not
covered yet in France: a live status for 74 areas listed with their size only (Val Cenis, Saint-Lary,
Font-Romeu, Ax 3 Domaines, Auron, Orcières, Chamrousse, Les Orres, La Chapelle-d'Abondance and 65 smaller
ones), and the areas
with fewer than 3 lifts. Not covered yet in Finland: Levi's own lift list (ski.fi's
block is used), Paljakka, Koli and the smaller hills; Finland has no avalanche ratings to read. Not
covered yet in Germany: a live status for the 36 areas outside the Sauerland without a current
slope map or a page we read (most of the Allgäu and of Upper Bavaria, the Black Forest, the Harz, Saxony, Thuringia), St.
Englmar, Mitterfirmiansreut and other Bavarian Forest areas, Wasserkuppe, Erbeskopf, Hoherodskopf,
single-lift areas and the areas under 3 km of slopes; the German uplands have no avalanche service. Not covered yet in Czechia:
Jáchymov, Velká Úpa (listed with its size), Světlý vrch and the areas under 4 km of slopes. Not covered yet in Spain: a live status for 10 areas (see the table), the nordic areas and Madrid SnowZone. Not covered yet in Norway: a live status for the areas that aren't on Fnugg (Skimore's Tryvann, Kongsberg and Drammen, Vierli, Grefsenkollen, Haglebu, Savalen, Blomlia); only the 70 resorts inside NVE's rated regions have avalanche danger. Not covered yet in Slovenia: a live status for the five areas listed by size, Kanin (its Slovenian side closed in 2025), the areas with fewer than 3 lifts and the nordic areas. Not covered yet in Slovakia: a live status for the 29 areas listed by size (Slovakia has no national report, and their sites show none we can read), and five small areas left out (SKI Bezovec, Ski Mlynky - Biele Vody, Jahodná, Salamandra Resort, Zochova chata - Piesok). Each
file's `source_details` lists the public pages of the sources used for that report (never the addresses the fetcher
reads: an API, a JSON file), as pages with current conditions and pages with the
resort's fixed information, each with `attribution_required` (`true` for Fnugg, `null`, not checked, for the rest);
the site shows them on `sources.html` and the resort page, and falls back to the deprecated `sources` (plain URLs) for
data published before `source_details`.

### Areas

Each resort's outline and point on the map are made weekly from OpenSkiData's lifts and pistes
(see [Ski tiles](#ski-tiles)): a new resort gets them with the next build, or straight away by
running `ski.yml` by hand. 921 of the 933 resorts have one in November 2026; the others are a
marker at their `location`, with no OpenSkiData lift within 3 km.

## Running locally

The pages need the data (the `data` branch) next to them. Check it out once, beside this folder:

```sh
git worktree add ../liftradar-data data   # once; git -C ../liftradar-data pull for newer data
npm install                               # once
```

Then, to work on the pages:

```sh
npm run dev -- --data ../liftradar-data   # http://localhost:8000
```

It serves the repo as it is (`scripts/serve.mjs`): an edit shows on reload, `/de/`, `/fr/`, `/it/` and `/pl/`
translated as they're asked for, `/about` as `about.html` and missing addresses as `404.html`, as on Cloudflare.
It unpacks the 3D engine first if it isn't here yet (see [3D engine](#3d-engine)). Without `--data` it reads
`json/`, `history/`, `schema/` and `ski/` from this folder, where you can link them instead (git-ignored):
`for part in json history schema; do ln -sfn ../liftradar-data/$part .; done`. The ski tiles are optional: built
as in [Ski tiles](#ski-tiles), or unpacked from the release `ski-latest`, into the data's `ski/`.

To see exactly what's deployed, build it, then serve the build with the MCP server, as Cloudflare does:

```sh
npm run build -- --data ../liftradar-data  # into _site/ (git-ignored), as pages.yml does
npm run preview                            # http://localhost:8787, /mcp included
```

Static checks, also run on every push (`.github/workflows/checks.yml`):

```sh
npm install        # once
npm run check      # Biome (JS, CSS), html-validate (translated pages too), the type check, the MCP test, ruff (scripts/)
npm run format     # format the JS, the CSS and scripts/; HTML is validated but not formatted
```

### Type check

`npm run check` also runs TypeScript over `assets/*.js`, so a field the data doesn't have, or a value that
can be `null` used as if it couldn't, fails the check. Only checked: the pages still load the plain `.js`
files, with no build step. Types go in JSDoc comments, e.g. `/** @param {IndexResort} r */`.

- `types/*.d.ts` other than `globals.d.ts` are the data's types, generated by `npm run types` from the
  fetcher's JSON Schemas in `schema/` and the ski tiles' `scripts/ski-tile.schema.json`. Its schemas list
  every field it writes as required (a missing value is `null`), all but the deprecated `errors`. Run it
  after a schema change; `npm run check` fails while they differ (with `schema/` linked, as above).
- `types/globals.d.ts` gives them short names (`Index`, `IndexResort`, `Resort`, `ResortHistory`, `Stats`,
  `SkiTile`, `SkiLift`, ...), and declares `maplibregl` and `mlcontour`, which the pages load from a CDN.
  The pages' own elements (`getElementById`, `querySelector`) are typed `any`: the check is for the data.
- `jsconfig.json` checks each page with the scripts it loads (`types/pages/*.json`): the pages' own
  scripts share top-level names. A new page or script goes in there too.

## Translations

The site is written in English; `/de/`, `/fr/`, `/it/` and `/pl/` are generated from it on deploy by
`scripts/translate.mjs`, from `i18n/<language>.json`, which map English to each language. The data stays at the root, and isn't translated (`condition`
is in the source's language). What can be translated:

- In the HTML, an element marked `data-i18n` (its inner HTML is the key), and `aria-label`, `placeholder`,
  `title` and `alt`.
- In the scripts, `t("…")`, with a literal string, `{names}` for values, and an object of plural forms in the
  dictionary. Text after a `|` isn't shown in English: it tells apart words that need two translations.
- `<div lang="en">` marks what stays English for now (the source lists in `sources.html`).

Always edit the English; never the generated pages. Each marked block's English text is its key in the
dictionary, so a changed block shows in English until it's translated, and can't show an outdated translation.
`npm run check` lists what's missing and what's no longer used (the old text's entry, to replace), and fails
if a translation loses a `{name}` or a tag. It also generates the translated pages (as below) and validates them
with the English ones.

`assets/lang.js` sends visitors arriving on an English page to the translation their browser prefers. The
language menu in the header overrides that, and the choice is remembered in `localStorage`. Links to a
translation always stay there.

Another language needs its own `i18n/<language>.json`, an entry in `LANGUAGES` in `assets/lang.js`, a link in
the language menu of each page's header, its `hreflang` alternates, and a line in `.gitignore`; `<html lang>` then
sets the dates, numbers and country names.

## MCP

`https://liftradar.eu/mcp` is an [MCP](https://modelcontextprotocol.io) server for AI assistants, with no key
(Streamable HTTP, stateless): `worker/mcp.js`, the Worker's only script. `wrangler.jsonc` runs it for `/mcp`
alone (`assets.run_worker_first`); every other address is served from the files as before, without it. Its
tools read the same files through the assets binding (`env.ASSETS`), so they always match the site:

- `search_resorts`: `json/index.json`, filtered by country, status, name (also its region's, and its linked ski
  area's and ski region's from `json/groups.json`, as the site's search), snow, open lifts or distance from a
  point, and sorted.
- `get_resort`: `json/<country>/<id>.json`.
- `get_resort_lifts`: `json/<country>/<id>.details.json` (only resorts whose source lists every lift and slope),
  with its fields copied one by one, so that the tool's output stays the same when that file changes:
  `api.html` doesn't list the file, so only the tool is stable.
- `get_resort_history`: `history/<country>/<id>.json`, as rows, for the last days.
- `get_stats`: `json/stats.json`, for a country or region and the last days.

Unlike the pages, it uses npm packages (`dependencies` in `package.json`: the MCP SDK, zod, and
`@cfworker/json-schema`, as Workers can't run the SDK's default validator), which wrangler bundles at the deploy.
It reads the data with the same types as the pages, so `npm run check` fails when it reads a field that's gone.
`worker/mcp.test.js` calls each tool as a client does, on a few made-up resorts served as its assets, and checks
what it finds (`npm run check` runs it, or `node --test worker/mcp.test.js`): a tool's change goes there too.
After a fetcher change, check its tools too; `api.html` documents it ("MCP").

To try it locally, on a build as in [Running locally](#running-locally):

```sh
npm run build -- --data ../liftradar-data && npm run preview
npx @modelcontextprotocol/inspector   # then connect to http://localhost:8787/mcp (Streamable HTTP)
```

## Ski tiles

`/ski/` has the lifts, pistes and ski areas of [OpenSkiData](https://openskidata.org) cut into static
tiles, and each resort's outline and map point. The map and resort pages draw them (`assets/ski.js`),
and apps use the tiles to recognise lifts in a GPS track (TrailRider). They aren't in git:
`.github/workflows/ski.yml` builds them on Mondays at 03:00 UTC (started by the Cloudflare Worker
`liftradar-trigger`, in liftradar-fetcher's `deploy/trigger/`, as GitHub's own schedule skips runs),
and when the scripts or their fixes change, with `scripts/ski_tiles.py`, and publishes one archive,
`ski.tar.gz`, on the release `ski-latest`; every deploy unpacks it into the site. The build id is a
hash of the files, so a week without changes publishes nothing. OpenSkiData may be downloaded at most
once a day; its own vector tiles may not be used directly.

- `ski/v1/meta.json`: `build` (add `?b=<build>` to the other URLs, to skip stale caches), `built_at`,
  `data_time` (OpenSkiData's build), `zoom`, `resorts`, `lengths` and `elevations` (the files below), the counts, the
  attribution and the license.
- `ski/v1/lengths.json` (experimental): `data_time`, and `resorts`, `{"<country>/<id>": {"lifts": {<item id>:
  metres}, "slopes": {…}}}`, the length on the map of each lift and slope of the details files that
  `lift_links.py` matched (below), rounded to 10 m. liftradar-fetcher reads it every run, as the details' `map_length_m`.
- `ski/v1/elevations.json` (experimental): `data_time`, and `resorts`, `{"<country>/<id>": {"bottom": [lon, lat,
  elevation], "top": […]}}`, the lowest and highest point of the resort's lifts (`lr`, disused and abandoned ones
  left out), from OpenSkiData's elevations. liftradar-fetcher reads it every run, for the details' `bottom` and
  `top` and the weather forecast's points.
- `ski/v1/resorts.geojson`: a feature per liftradar resort with lifts there, `id` `<country>/<id>`:
  its outline (the geometry), `point` (`[lon, lat]`, its marker), and `lifts`, `runs` (downhill),
  `km` (of downhill runs drawn as lines) and `areas` (the OpenSkiData areas' names) as OpenSkiData
  has them, which may differ from the resort's own counts; `links`, when the outline has several parts,
  the stretches of its lifts outside it that join two of them (`[[lon, lat], …]` each), which the map
  draws in the area's colour until the lifts show, so a cable car across a valley doesn't leave two patches.
- `ski/v1/10/{x}/{y}.json`: XYZ tiles at zoom 10 (about 25–40 km), only those with something in them
  (a 404 means nothing). `areas`: the OpenSkiData areas touching the tile (`name`, `lr`: the liftradar
  resort most of its lifts belong to, `osm`, `wd`, `p`: a point in it, `outline`). `lifts`: all but
  proposed, planned and under construction (disused and abandoned ones stay, for old tracks), with
  `type`, `name`, `ref`, `status`, `capacity`, `duration`, `occupancy`, `heating`, `bubble`, `tunnel`, `osm`,
  `lr`, `item` (experimental: the lift in a resort's details file, `<country>/<id>/<item id>`, for its
  status; see below), `areas` (indexes in this tile's `areas`) and `c`, the line simplified to 5 m as
  `[lon, lat, elevation]`. `runs`: every piste and trail, with `uses` (downhill, nordic, skitour,
  sled…), `difficulty`, `conv` (the colour convention when not European: `north_america`, `japan`),
  `name`, `ref`, `grooming`, `lit`, `oneway`, `gladed`, `patrolled`, `tunnel`, `shared` (on a stretch two pistes
  share, numbered for both and as hard as the easier: the harder one's difficulty, whose colour edges it on the maps),
  `osm` (not unique: OpenSkiData splits some ways into several runs), `lr`, `areas`, and `c`
  (`[lon, lat]`) or, for a piste drawn as an area, `poly` (polygon rings). Empty values are left out.
  OpenSkiData makes runs of a ski route relation's members, the lifts the route rides included (Saalbach's
  "The Challenge", the Sellaronda): a run made only from relations loses each segment lying along a lift
  (both ends and its middle within 10 m), and is split there.
  The schema is `ski/v1/tile.schema.json` (`scripts/ski-tile.schema.json`).

Runs get `item` too. `scripts/lift_links.py` sets it during the build: it matches the lifts and slopes of each
`json/<country>/<id>.details.json` (experimental) to the lines in and around that resort by number, name, type
and, for lifts, length and altitudes, as there's no shared id; about 82% of lifts and 72% of slopes match. A resort's
own lines go to its own list first, and a neighbour's list (SkiWelt's map also shows KitzSki's lifts, without a
status) gets only those left unlinked, and only its items with a known status. The map
and resort pages load the details of the resorts in view: open lifts and pistes wide on a light edge, closed ones thin and
dashed, those without a known status thin and faint, and a green or red dot on each lift station ([Ski map style](#ski-map-style)); the map's options panel then shows a legend. Run it on built tiles
with `python3 scripts/lift_links.py ../liftradar-data/json ski`.

It then measures them, for `lengths.json`: a lift is its OSM lines (its sections) along the slope; a slope its
linked segments, and those joined to them (ends within 25 m) that carry its number or one of their names in the
same resort, as OpenSkiData cuts a piste into pieces named differently ("Hochalmkar", only "52", none, "42, 43, 40");
runs made from route relations are left out, their members being runs too, and so are pistes drawn only as areas.
Against the lengths the sources give, lifts agree within 20% nine times in ten (median 1.01); slopes come out a
fifth shorter at the median, by resort much as the resorts' advertised km against OpenSkiData's (Pitztal and the
Stubaier Gletscher about half, Saalbach's certified lengths and Tarvisio about the same). The resort page shows
a map length, with "≈", only where the source has none.

`scripts/ski_resorts.py` gives OpenSkiData's areas to liftradar's resorts. A resort claims the areas
within 8 km whose name matches its own best (and other matching ones within 3 km), and the nearest
area with a lift within 3 km unless another resort claimed that one by name. A lift or piste then goes
to the smallest of its areas that a resort claimed, so a sector keeps its own resort inside a bigger
linked area, and an area grouping a ski pass (Ski amadé, Les Portes du Soleil) only counts when a
resort claims it. An area claimed by several resorts is split between them by nearest point (lifts)
and nearest lift (pistes). A lift without an area goes to a resort within 1 km. A lift whose areas no
resort claimed (only a wider area, such as "Stubai" around the Stubaier Gletscher, has it) joins the
resort with a lift station within 200 m of its own, and such a piste the resort with a lift or piste
end within 50 m (two rounds, for a piste leading to another). Rack railways (the Bayerische Zugspitzbahn,
the Tramway du Mont-Blanc, the Wendelsteinbahn) keep their resort in the tiles but aren't counted among its
lifts or drawn in its outline: they're mapped as dozens of segments, mostly far below the area. The outline is the
resort's lifts and downhill pistes widened, merged and smoothed, without strips narrower than 140 m
(a lone cable car across a valley: such a lift becomes one of its `links`) or pieces under 0.05 km²; the point is the resort's `location`
when that's inside, and otherwise the bottom station nearest to it. Wrong matches are fixed in
`scripts/ski_overrides.json`: `claims` and `ignore` add or remove a resort's areas (by an OSM id of
their sources, Wikidata id or exact name), and `points` move the point a shared area is split by
(Samoëns: its ski area, not its village). `features` gives single lifts and runs (by their OSM id) to a
resort, for one OpenSkiData puts in the wrong area (a run along Kompleks Narciarski Słotwiny's chairlift,
in Słotwiny Arena's, drew Arena's outline over Kompleks; `ski_split_check.py --assign` applies it to
lifts only). `clip` keeps a resort's lifts and runs inside a box `[west, south, east, north]`, for a resort that is
only part of its area (Wierchomla: OpenSkiData's "Dwie Doliny" also has the Szczawnik side, closed since 2019). Check a change on the map, with the tiles built locally.
`scripts/ski_split_check.py` finds wrong splits and checks a fix without the download: from built tiles
(the release `ski-latest`) and `json/index.json`, it lists the resorts whose lift count on the map is far
from their report's and the areas several resorts share; `--lifts <country>/<id>` lists a resort's lifts
by name; `--assign` runs the assignment again on the tiles' lifts with the current overrides
(`--before <overrides.json>` compares with a run on others, e.g. `main`'s). Lifts only: check the map once
the tiles are built. A pull request changing `ski_resorts.py` or `ski_overrides.json` runs `--assign` with
the base's rules and with its own (`.github/workflows/ski-assign.yml`), and lists the resorts whose lift
count changes in the run's summary.

The script fails, keeping the last tiles, if the lifts, runs, areas or assigned lifts or runs drop by
more than 15%. To build the tiles locally (about 290 MB to download, a minute and 3.5 GB of memory)
and see them on the map:

```sh
mkdir -p ../osd
for f in lifts runs ski_areas; do
  curl --compressed -o ../osd/$f.geojson https://tiles.openskimap.org/geojson/$f.geojson
done
uv run --no-project --with shapely --with ijson python3 scripts/ski_tiles.py ../osd/ski_areas.geojson \
  ../osd/lifts.geojson ../osd/runs.geojson ../liftradar-data/json/index.json ../osd/ski
ln -sfn ../osd/ski .   # git-ignored, like the data links
```

Without `ski/`, the pages show the markers at the resorts' locations, without outlines, pistes or
lifts.

Lifts, pistes and ski areas: data from OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL),
Skimap.org, Who's On First, © Mapterhorn. The tiles are a derived database under the
[ODbL](https://opendatacommons.org/licenses/odbl/), as public as the rest of the data.

## Ski map style

`assets/ski-style.json` is how the maps draw the ski tiles, on the site (`assets/ski.js`) and in the phone apps
(TrailRider's repo, `apps/liftradar`), which fetch it from `https://liftradar.eu/assets/ski-style.json`: change the
look there and the apps follow, without a release of their own. It holds MapLibre layers whose values may name
`colors` (one set per theme) and `defs` (expressions, which may name others) as `"@name"`; a client replaces each with
its value, the theme's colours first, then adds the layers under the base map's labels (those with
`metadata["above-labels"]` on top). `sources` lists the GeoJSON sources the client fills, and with which
properties: the resorts' outlines and their links, and the tiles' runs, lifts and lift stations with their fields as
the tiles have them, plus `state`, the status from the details file (`unknown` for the others of a resort with
statuses). Two values come from the client as MapLibre's global state: `picked`, the resort hovered or tapped,
and `highlight`, the resort of a resort page or 3D view (its lines strong, the others faded). `minZoom` is
where the pistes and lifts start; the site's resort page draws them from further out.

The apps put their own roads under the first layer whose id starts with `ski-` (and their town names between the
ski style and the basemap's labels): keep that prefix on every layer. `node scripts/ski-style-check.mjs` (in `npm run check`) checks every name and that the result is a valid
style. Keep to expressions MapLibre Native supports as well as MapLibre GL JS, and to the properties `sources`
lists: the apps fill only those. A change that older apps can't draw needs a new file (and `version`), not an edit.

## 3D engine

TrailRider's resort viewer (its `web/src/viewer.ts`, `docs/3d-engine-plan.md`) draws `3d.html` where the
browser has WebGPU (`assets/scene.js` loads the version `/engine.json` pins). It isn't in git: TrailRider (`../trailrider`, a private repo)
publishes it with `npm run viewer -- --release` on this repo's release `viewer-<commit>` as
`viewer.tar.gz` (`viewer.js`, the engine's WebAssembly beside it, and its types, `viewer.d.ts`).
`engine.json` pins one by its `tag` and the archive's `sha256`; `scripts/engine.mjs` downloads that,
checks it and unpacks it into `engine/<tag>/` (git-ignored), and every deploy does the same into the
site, so each version has its own address, cached for good (`_headers`). A new engine reaches the site
only when the pin moves. Without it (GitHub failing) the deploy goes on without `/engine/`.

To move the site to a newer engine:

1. In TrailRider, on a commit that is pushed, with nothing uncommitted (the release names the commit):
   `cd web && npm run viewer -- --release`. It builds the core's WebAssembly (Rust, as TrailRider's README
   says) and the viewer, publishes them on this repo's pre-release `viewer-<commit>` (`gh`, logged in with
   write access here; never the repo's "Latest", which stays the ski tiles'), and prints the pin. Without
   `--release` it only builds and packs, to try. The releases so far: `gh release list`.
2. Put that pin in `engine.json`, and run `node scripts/engine.mjs` to fetch it into `engine/<tag>/`.
3. Compare the new `engine/<tag>/viewer.d.ts` with `types/viewer.d.ts`, the copy `assets/scene.js` is type
   checked against: if they differ, copy it over, and `npm run check` points at what in `scene.js` no longer
   fits the viewer's options or calls.
4. Open `3d.html?r=<country>/<id>` in a browser with WebGPU, with the data from liftradar.eu (`json/`,
   `history/` and `ski/` aren't on `main`), `npm run check`, and commit `engine.json` ("3D map:
   TrailRider's engine at <commit>", what changed in it), with `types/viewer.d.ts` if it changed. The deploy
   fetches the engine; the old versions stay on GitHub, so moving the pin back is a revert. Old
   `engine/<tag>/` folders here can be deleted.

## Scripts

The pages load `assets/common.js` and then their own script, sharing its top-level names: a
name that's new there also goes in `javascript.globals` in `biome.json`. The map and resort pages
also load MapLibre GL JS 5 (from cdnjs; version 6 is only an ES module there), maplibre-contour
(jsDelivr), `assets/basemap.js` (the base map: OpenFreeMap's Positron, or Fiord in dark mode, with
labels in the page's language, peaks, and hillshading and contours from Terrain Tiles) and
`assets/ski.js` (outlines, points, pistes and lifts from the ski tiles). Each file from a CDN carries its
`integrity` hash (three.js's, and the `three.core.js` it imports, in `3d.html`'s import map), so the browser refuses
anything else: a new version needs its new hash, from cdnjs's page of the file or
`curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

`3d.html` also loads `assets/scene.js`, an ES module (it still sees the shared names). Where the browser
has WebGPU it draws the resort with TrailRider's engine (see "3D engine"): the realistic map from the
Terrain Tiles' elevation and this site's ski tiles, every lift as what it is, the villages round it with
their houses, roads and names (OpenFreeMap's tiles, the engine fetches them; the page writes the names it
gives, `onLabels`, and credits OpenFreeMap when it drew them), a card for a clicked lift or
piste, and + and − and a compass. Elsewhere, or when the engine can't load or draw the resort, it draws a
diorama with three.js (cdnjs): it cuts a box around the resort out of [Mapterhorn](https://mapterhorn.com)'s terrain
(0.5–10 m in the Alps; the elevation tiles go through a MapLibre protocol that flattens everything
outside the box, and the sky, base and the cut's slopes are in the page's background colour, so
the box floats). Only the resort's own pistes and lifts are drawn (`lr`). The lifts are models in a
three.js custom layer, in the map's WebGL context so the terrain hides them: pylons placed where the
cable, sagging 1.5% of its span, would come closer to the ground (read every 10 m from Mapterhorn
at zoom 13) than the lift type allows, or where a span would be too long; stations, the cable on
two tracks, and carriers sized by `occupancy`, moving at the speed from `duration` and spaced by
`capacity` when the data has them. The camera starts over the box, looking the way the lifts go
up; `#view=zoom/lat/lon/bearing/pitch` in the URL keeps a view.

Data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; map tiles from [OpenFreeMap](https://openfreemap.org) © [OpenMapTiles](https://openmaptiles.org); relief from [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen); the 3D terrain from Terrain Tiles with WebGPU, else from [Mapterhorn](https://mapterhorn.com/attribution/); ski areas, pistes and lifts from [OpenSkiData](https://openskidata.org) (ODbL).
