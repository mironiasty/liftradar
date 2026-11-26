# Developing liftradar

How the site is built, deployed and checked, for whoever changes it (people and agents alike). What the project is,
and the short way to run it, is in the [README](README.md).

## What's where


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
    regions) by id, which a member's `linked_area` and `ski_region` give (in its report and the index),
    for the resort page's group cards and `area.html`.
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
  its history), `area.html?g=<group>` (a linked ski area or a pass from `json/groups.json`: its totals, its
  resorts ranked and on the map, its lifts and slopes, and its season so far, summed from the members' files),
  each country's page (`/austria`, `/de/oesterreich`…, a country at a glance; see [Country pages](#country-pages)),
  `3d.html?r=<country>/<resort>` (the resort in 3D, as a diorama), `api.html` (the JSON files, for developers, with `openapi.json`: the same in OpenAPI 3.1, referring to the JSON Schemas by URL, so keep its paths and descriptions in step with `api.html`), `sources.html` (data sources, incl. every website in the
  current data), `about.html` (what the values mean, and their caveats) and `privacy.html` (the privacy policy
  of the site and the phone apps, the URL the app stores ask for: keep it in step with what they download), plain
  static pages that load the JSON in the browser. No build step locally. Everything the site serves is in `web/`
  (the pages, `assets/`, `.well-known/`, `_headers`, `robots.txt`, `openapi.json`), at the address it has there:
  `about.html` and `assets/…` below are `web/about.html` and `web/assets/…` in the repo.
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
each resort's page, and its 3D map when the ski tiles have its area, and each group's `area.html` page, at the
addresses without `.html`. Translations
with `noindex` (still partly in English) are left out. `robots.txt` points to it; Cloudflare adds its own lines to it.

## Social preview

Each page's `<head>` has a `description` and Open Graph tags, for the card a link shows on social media and in
chats; the translations get theirs from `i18n/<language>.json`, and `og:url` follows the canonical. Crawlers don't
run scripts, so the resort, area and country pages show the site's card, not the resort's. The image,
`assets/og.png` (1200×630, also the README's header), is drawn in `scripts/og-image.svg`; after changing it:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars --window-size=1200,630 --screenshot="$PWD/web/assets/og.png" "file://$PWD/scripts/og-image.svg"
```

## About the data

What readers need to know (timing, status, snow, lifts and slopes, avalanche danger, the map,
history, and a section for developers) is on the site: [About the data](https://liftradar.eu/about.html)
(`about.html`). It keeps to what matters to a reader: how each value is computed per source is in
`../liftradar-fetcher/README.md`, "Data details". Keep both up to date with the fetcher. The format is defined by the JSON Schema in `schema/`
(`resort.schema.json`, `index.schema.json`, `history.schema.json`, `stats.schema.json`).

Where each resort's data comes from is on [Sources](https://liftradar.eu/sources.html) (`sources.html`, which lists
every website in the current data) and, with what isn't covered yet, in `../liftradar-fetcher/README.md`, "Sources".

Each file's `source_details` lists the sources used for that report, each once, by its website's home page (never the
addresses the fetcher reads: an API, a JSON file; a page only for credit and licence pages and the resort's Fnugg page),
as sources with current conditions and sources with the resort's fixed information, each with `attribution_required` (`true` for Fnugg, `null`, not checked, for the rest);
the site shows them on `sources.html`, the resort page and the area page. The deprecated `sources` (the same URLs,
plain) isn't read by the site any more.

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

It serves `web/` as it is (`scripts/serve.mjs`): an edit shows on reload, `/de/`, `/fr/`, `/it/` and `/pl/`
translated as they're asked for, `/about` as `about.html` and missing addresses as `404.html`, as on Cloudflare.
It unpacks the 3D engine first if it isn't here yet (see [3D engine](#3d-engine)). Without `--data` it reads
`json/`, `history/`, `schema/` and `ski/` from `web/`, where you can link them instead (git-ignored):
`for part in json history schema; do ln -sfn ../../liftradar-data/$part web/; done`. With them there, any static
server works too, without the translations (`python3 -m http.server -d web`). The ski tiles are optional: built
as in [Ski tiles](#ski-tiles), or unpacked from the release `ski-latest`, into the data's `ski/`.

To see exactly what's deployed, build it, then serve the build with the MCP server, as Cloudflare does:

```sh
npm run build -- --data ../liftradar-data  # into _site/ (git-ignored), as pages.yml does
npm run preview                            # http://localhost:8787, /mcp included
```

Static checks, also run on every push (`.github/workflows/checks.yml`):

```sh
npm install        # once
npm run check      # Biome (JS, CSS), html-validate (translated pages too), the type check, the MCP test, ruff (scripts/, ski-tiles/)
npm run format     # format the JS, the CSS and the Python (scripts/, ski-tiles/); HTML is validated but not formatted
```

### Type check

`npm run check` also runs TypeScript over `assets/*.js`, so a field the data doesn't have, or a value that
can be `null` used as if it couldn't, fails the check. Only checked: the pages still load the plain `.js`
files, with no build step. Types go in JSDoc comments, e.g. `/** @param {IndexResort} r */`.

- `types/*.d.ts` other than `globals.d.ts` are the data's types, generated by `npm run types` from the
  fetcher's JSON Schemas in `schema/` and the ski tiles' `ski-tiles/ski-tile.schema.json`. Its schemas list
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

- In the HTML, an element marked `data-i18n` (its inner HTML is the key, or the name it's given), and
  `aria-label`, `placeholder`, `title` and `alt`.
- In the scripts, `t("…")`, with a literal string, `{names}` for values, and an object of plural forms in the
  dictionary. Text after a `|` isn't shown in English: it tells apart words that need two translations.
- `<div lang="en">` marks what stays English for now (the source lists in `sources.html`).

Always edit the English; never the generated pages. Each marked block's English text is its key in the
dictionary, so a changed block shows in English until it's translated, and can't show an outdated translation.
`npm run check` lists what's missing and what's no longer used (the old text's entry, to replace), and fails
if a translation loses a `{name}` or a tag.

A block over 200 characters (the long paragraphs of the text pages) has a name instead, `data-i18n="about-sources"`
(the page and what the block is about), so a small edit doesn't mean pasting the whole paragraph again in each
dictionary. Its translation records the English it was made from, as a fingerprint:
`"about-sources": {"text": "Jede Zahl …", "en": "46873d6a"}`. After the English changes, the old translation
still shows, and `npm run check` lists it as outdated: update the translation and its `en` (or, when the change
doesn't touch the meaning, a typo, say, `node scripts/translate.mjs --accept about-sources` updates the
fingerprints in every language). `npm run check` fails on a block over 200 characters without a name, and on a
named block's translation without `en`. It also generates the translated pages (as below) and validates them
with the English ones.

`assets/lang.js` sends visitors arriving on an English page to the translation their browser prefers. The
language menu in the header overrides that, and the choice is remembered in `localStorage`. Links to a
translation always stay there.

Another language needs its own `i18n/<language>.json`, an entry in `LANGUAGES` in `assets/lang.js`, a link in
the language menu of each page's header, its `hreflang` alternates, and a line in `.gitignore`; `<html lang>` then
sets the dates, numbers and country names.

## Country pages

Each country has a page of its own in each language, at an address in that language: `/austria`, `/de/oesterreich`,
`/fr/autriche`, `/it/austria`, `/pl/austria` (the slugs are in `assets/countries.js`, which the pages load to link to
them and the scripts read: a new country needs its line there). `scripts/countries.mjs` builds them on deploy, after
the translations, from `scripts/country.html` (the template, translated as the other pages) and `json/index.json`:
each with its title and description (the country's name, how many resorts, how many open), its canonical address,
language alternates and `x-default` (before `lang.js`, which sends a visitor to their language's version by them), its
breadcrumbs as JSON-LD, the header's Table, Map and Stats links filtered to the country, and, for search engines, the
heading, that sentence, the records and numbers (with the ski tiles' elevations when the build has them), every resort
by region as plain links, and the other countries' pages. `assets/country.js` then draws the page:
how much is open, a resort of the day (one of the open resorts, else of all, picked by a hash of the day in Vienna
and the country), the records (the biggest ski area, the most lifts, the highest lift and the biggest vertical drop,
the last two from the ski tiles' `elevations.json`), the country in numbers (totals and medians of the resorts we
follow), the regions with their resorts, the linked areas and passes from
`json/groups.json`, a map and the season so far from `json/stats.json`. `npm run dev` builds a page as it's asked for;
`npm run check` builds them from made-up resorts, to validate them and count their strings. The sitemap lists them,
and the table, the resort and area pages and the home page's list of countries link to them. A link to
`/<English slug>` in a page goes to the country's page in the page's language once translated (`translate.mjs`).

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
and when the scripts or their fixes change, with `ski-tiles/ski_tiles.py`, and publishes one archive,
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
  and rack railways left out), from OpenSkiData's elevations. liftradar-fetcher reads it every run, for the details' `bottom` and
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
  The schema is `ski/v1/tile.schema.json` (`ski-tiles/ski-tile.schema.json`).

Runs get `item` too. `ski-tiles/lift_links.py` sets it during the build: it matches the lifts and slopes of each
`json/<country>/<id>.details.json` (experimental) to the lines in and around that resort by number, name, type
and, for lifts, length and altitudes, as there's no shared id; about 82% of lifts and 72% of slopes match. A resort's
own lines go to its own list first, and a neighbour's list (SkiWelt's map also shows KitzSki's lifts, without a
status) gets only those left unlinked, and only its items with a known status. The map
and resort pages load the details of the resorts in view: open lifts and pistes wide on a light edge, closed ones thin and
dashed, those without a known status thin and faint, and a green or red dot on each lift station ([Ski map style](#ski-map-style)); the map's options panel then shows a legend. Run it on built tiles
with `python3 ski-tiles/lift_links.py ../liftradar-data/json ski`.

It then measures them, for `lengths.json`: a lift is its OSM lines (its sections) along the slope; a slope its
linked segments, and those joined to them (ends within 25 m) that carry its number or one of their names in the
same resort, as OpenSkiData cuts a piste into pieces named differently ("Hochalmkar", only "52", none, "42, 43, 40");
runs made from route relations are left out, their members being runs too, and so are pistes drawn only as areas.
Against the lengths the sources give, lifts agree within 20% nine times in ten (median 1.01); slopes come out a
fifth shorter at the median, by resort much as the resorts' advertised km against OpenSkiData's (Pitztal and the
Stubaier Gletscher about half, Saalbach's certified lengths and Tarvisio about the same). The resort page shows
a map length, with "≈", only where the source has none.

`ski-tiles/ski_resorts.py` gives OpenSkiData's areas to liftradar's resorts. A resort claims the areas
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
`ski-tiles/ski_overrides.json`: `claims` and `ignore` add or remove a resort's areas (by an OSM id of
their sources, Wikidata id or exact name), and `points` move the point a shared area is split by
(Samoëns: its ski area, not its village). `features` gives single lifts and runs (by their OSM id) to a
resort, for one OpenSkiData puts in the wrong area (a run along Kompleks Narciarski Słotwiny's chairlift,
in Słotwiny Arena's, drew Arena's outline over Kompleks; `ski_split_check.py --assign` applies it to
lifts only). `clip` keeps a resort's lifts and runs inside a box `[west, south, east, north]`, for a resort that is
only part of its area (Wierchomla: OpenSkiData's "Dwie Doliny" also has the Szczawnik side, closed since 2019). Check a change on the map, with the tiles built locally.
`ski-tiles/ski_split_check.py` finds wrong splits and checks a fix without the download: from built tiles
(the release `ski-latest`) and `json/index.json`, it lists the resorts whose lift count on the map is far
from their report's and the areas several resorts share; `--lifts <country>/<id>` lists a resort's lifts
by name; `--assign` runs the assignment again on the tiles' lifts with the current overrides
(`--before <overrides.json>` compares with a run on others, e.g. `main`'s). Lifts only: check the map once
the tiles are built. A pull request changing `ski_resorts.py` or `ski_overrides.json` runs `--assign` with
the base's rules and with its own (`.github/workflows/ski-assign.yml`), and lists the resorts whose lift
count changes in the run's summary.

The script fails, keeping the last tiles, if the lifts, runs, areas or assigned lifts or runs drop by
more than 15%, or below the `MIN_*` floors in `ski_tiles.py` (all that's checked when the last build can't be read: the
run warns). To build the tiles locally (about 290 MB to download, a minute and 3.5 GB of memory)
and see them on the map:

```sh
mkdir -p ../osd
for f in lifts runs ski_areas; do
  curl --compressed -o ../osd/$f.geojson https://tiles.openskimap.org/geojson/$f.geojson
done
uv run --no-project --with shapely --with ijson python3 ski-tiles/ski_tiles.py ../osd/ski_areas.geojson \
  ../osd/lifts.geojson ../osd/runs.geojson ../liftradar-data/json/index.json ../osd/ski
ln -sfn ../../osd/ski web/   # git-ignored, like the data links
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
and `highlight`, the resort of a resort page or 3D view (its lines strong, the others faded), or the resorts of a ski
area's page as `|at/a|at/b|` (each found in it, so a single key works as before). `minZoom` is
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
checks it and unpacks it into `web/engine/<tag>/`, with a copy of the pin in `web/engine.json` (both git-ignored), and every deploy does the same into the
site, so each version has its own address, cached for good (`_headers`). A new engine reaches the site
only when the pin moves. Without it (GitHub failing) the deploy goes on without `/engine/`.

To move the site to a newer engine:

1. In TrailRider, on a commit that is pushed, with nothing uncommitted (the release names the commit):
   `cd web && npm run viewer -- --release`. It builds the core's WebAssembly (Rust, as TrailRider's README
   says) and the viewer, publishes them on this repo's pre-release `viewer-<commit>` (`gh`, logged in with
   write access here; never the repo's "Latest", which stays the ski tiles'), and prints the pin. Without
   `--release` it only builds and packs, to try. The releases so far: `gh release list`.
2. Put that pin in `engine.json`, and run `node scripts/engine.mjs` to fetch it into `web/engine/<tag>/`.
3. Compare the new `web/engine/<tag>/viewer.d.ts` with `types/viewer.d.ts`, the copy `assets/scene.js` is type
   checked against: if they differ, copy it over, and `npm run check` points at what in `scene.js` no longer
   fits the viewer's options or calls.
4. Open `3d.html?r=<country>/<id>` in a browser with WebGPU, with the data from liftradar.eu (`json/`,
   `history/` and `ski/` aren't on `main`), `npm run check`, and commit `engine.json` ("3D map:
   TrailRider's engine at <commit>", what changed in it), with `types/viewer.d.ts` if it changed. The deploy
   fetches the engine; the old versions stay on GitHub, so moving the pin back is a revert. Old
   `web/engine/<tag>/` folders here can be deleted.

## Scripts

The pages load `assets/common.js` and then their own script, sharing its top-level names: a
name that's new there also goes in `javascript.globals` in `biome.json`. The resort page's script is in four, by
job: `resort-lists.js` (lifts by type, slopes by difficulty, every lift and slope), `resort-map.js`, `resort-weather.js`,
then `resort.js`, which shows the resort with them (its `show()` runs as it loads, so it comes last). A name one of
them takes from another goes in those globals too, and the file that defines it marks it
`// biome-ignore lint/correctness/noUnusedVariables` with the file that uses it. The map and resort pages
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
