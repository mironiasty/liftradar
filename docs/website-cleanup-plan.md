# Website cleanup plan

Response to [issue #91](https://github.com/mironiasty/liftradar/issues/91) (Tim Maurice Bayer's proposal), checked
against `main` at 4a821dea (2026-11-25). Each step is its own PR with no change in behaviour.

**Status (2026-11-26):** all done (A–F); the CDN hashes from "Small extras" are in #97. Vite stays "not now".

## Order

| # | PR | Issue step | Verdict | Status |
|---|---|---|---|---|
| A | Cache rules for versioned assets, plus a guard that every asset link is versioned | 2 | take, with the guard | done, #94 |
| B | Page CSS out of `<style>`: shared rules into `style.css`, the rest into `assets/<page>.css` | 1 | take, dedupe rather than only move | done, #95 (merged only what was identical) |
| C | `scripts/build.mjs` (what `pages.yml` does), `npm run build` / `preview` / `dev`, one list of pages | 3 (first half) | take | done, #96 |
| D | Website into `web/`, ski-tile pipeline into its own folder | 3 (second half) | take after C, optional | done, #110 (D1 `web/`) and D2 `ski-tiles/` |
| E | Split `resort.js` by job (now 7 jobs, weather included) | 4 | take, widen the `[a-z]+` patterns in the same PR | done, #100 |
| F | Named keys for long translations, keeping stale-translation detection | 5 | take only with a fingerprint | done |
| — | Vite | 6 | not now | — |

## A. Caching (issue step 2)

`_headers` today gives `/assets/*` the default `max-age=0, must-revalidate`, though `pages.yml` already adds
`?v=<commit>` to every `assets/*.js|css` link. Add:

```
/assets/*.js
  Cache-Control: public, max-age=31536000, immutable
/assets/*.css
  Cache-Control: public, max-age=31536000, immutable
```

Checked: no script loads a `.js`/`.css` from `/assets/` itself (only `ski-style.json`, which keeps `max-age=0`;
the app's `tools/schema.mjs` fetches that one too). Pages, images and `ski-style.json` are unaffected.

Add a guard to the "Version the asset links" step: fail when any `/assets/…\.(js|css)` link in `_site/**/*.html`
is left without `?v=`. Today that step's pattern is `[a-z]+\.(js|css)`; a file named `resort-lists.js` (step E)
would silently get no version and then be cached for a year. The guard turns that into a failed deploy.

## B. CSS (issue step 1)

About 740 lines of `<style>` across the pages (resort 231, map 166, index 155, 3d 101, stats 48, the text
pages 4–15 each), unminified and copied into all five languages.

Do more than move them: several rules are defined again and again, slightly differently each time:

- `.status-pill` and `::before` in index, map and 3d (three variants of the same pill),
- `.dot` in index, map and resort; `#map` in 3d, map and resort; `table`/`th, td` in index and resort,
- `main`, `h1`, `h2`, `ul`, `li`, `.toc`, `dt`/`dd`, `code` across the text pages (about, api, privacy,
  sources, 404).

Shared components and the text-page rules go into `style.css`; what is left goes into `assets/<page>.css`
(only for pages that still have a meaningful amount: resort, map, index, 3d, stats). Do it after A, so the new
files are cached from the start. Check each page visually in light and dark, desktop and mobile, since merging
the pill variants is the one place behaviour could change.

## C. Build script (issue step 3, first half)

The deploy lives only in `pages.yml` today, and the page list is repeated:

- `pages.yml` copy list (15 names),
- `pages.yml` "Link to the addresses without .html" sed pattern (8 names),
- `scripts/translate.mjs` `PAGES`,
- `scripts/sitemap.mjs` `PAGES` (a deliberate subset),
- `package.json` `html-validate` globs.

Move the `pages.yml` steps into `scripts/build.mjs <data dir> <out dir>` (combine, ski tiles, engine,
translations, sitemap, `.html` links, minify, compact index, version links), with the page list derived from
`*.html` in one place. `pages.yml` then checks out both branches and calls it. Then:

- `npm run build` → `dist/` (git-ignored),
- `npm run preview` → `wrangler dev --assets dist`: exactly what deploys, `/mcp` included,
- `npm run dev` → today's README steps (data links, engine) scripted, serving the source unbuilt.

Also: `npm run check` runs `translate.mjs .`, which writes `de/ fr/ it/ pl/` into the repo root as a side effect.
Write them to a temporary or build folder instead.

## D. `web/` folder (issue step 3, second half)

Worth it for a clean root, now that C is in. Two PRs, each with no change in behaviour; planned 2026-11-26
against `main` at 29ebcade (#107). Git follows the renames, so history is fine: keep the `git mv` in a commit of its
own and the path fixes in the next, so the review and `git log --follow` stay readable.

### What goes where

- **`web/`**: what is served. The 10 `*.html` pages, `assets/`, `.well-known/`, `_headers`, `robots.txt`,
  `openapi.json`.
- **Stays at the root**: `i18n/` (input of the build, not served; TrailRider's `tools/i18n.mjs` points at
  `liftradar/i18n`), `engine.json` (the pin), `scripts/`, `types/`, `worker/`, `docs/`, the config files.
  `scripts/country.html` stays too: in `web/`, `PAGES` (every `*.html` there) would take it for a page and serve it
  at `/country`.
- **Local links into `web/`** (git-ignored): `web/json`, `web/history`, `web/schema`, `web/ski`, and the engine in
  `web/engine/` with its copy `web/engine.json`. Then `web/` runs under any static server
  (`python3 -m http.server -d web`), and `--data` defaults to `web/`. Today `engine.mjs` overwrites the pin at the
  root with the same content; after the move the pin and its copy are different files.

### D1. The website into `web/`

1. `git mv` the files above.
2. Scripts:
   - `translate.mjs`: a `repo` and a `web` folder; `PAGES` and `read("assets", …)` from `web/`, `i18n/` from the
     root.
   - `build.mjs`: copy `web/` whole, without the data links and `engine` (no more `SITE_FILES` list); `--data`
     defaults to `web/`.
   - `serve.mjs`: pages and files from `web/`, the engine checked in `web/engine`, `--data` defaults to `web/`.
   - `engine.mjs`: the site folder defaults to `web/` (the pin is still read from the root).
   - `ski-style-check.mjs`: `../web/assets/ski-style.json`. `types.mjs`: the schemas from `web/schema`.
3. Types: `types/pages/*.json` (9 files) `../../assets/` → `../../web/assets/`; the JSDoc `import("../types/…")` in
   `scene.js` and `resort-lists.js` → `../../types/…`.
4. Config: `biome.json` `includes` and `overrides` → `web/assets/*`; `package.json` `html-validate 'web/*.html'`;
   `.gitignore` the links and the engine under `/web/`. `wrangler.jsonc` and `pages.yml`'s build call stay (still
   `_site`): only comments change.
5. Docs: `README.md` (its header image `assets/og.png` → `web/assets/og.png`), `DEVELOPMENT.md` (every path, the
   `ln -sfn` command, which now links into `web/`, the og-image command), `CLAUDE.md`, comments in `worker/mcp.js`.
6. Outside this repo: the checklist in `../liftradar-fetcher/CLAUDE.md` names site paths (`assets/common.js`,
   `index.html`, `about.html`…): a commit there. Locally: the `site` entry in `.claude/launch.json`, and the data
   links made again.

Check: `npm run build` on real data before and after, and compare the `_site` trees (file list and contents, with
`?v=…` stripped): they should be identical. Then `npm run check`, `npm run dev` through the pages in all five
languages, `npm run preview` with `/mcp`. The addresses and the deploy don't change, so `json/<country>/<id>.json`
is safe.

### D2. The ski-tile pipeline into `ski-tiles/`

`ski_tiles.py`, `ski_resorts.py`, `lift_links.py`, `ski_split_check.py`, `ski_overrides.json`,
`ski-tile.schema.json`. Not `ski/`: that's the data's name. `mini_map.py` and `og-image.svg` stay in `scripts/`:
they make the site's images.

- `ski.yml` and `ski-assign.yml` (their `paths` filters and calls), ruff in `npm run check` (`scripts ski-tiles`),
  `types.mjs` (the tiles' schema), `DEVELOPMENT.md`, the fetcher's `CLAUDE.md` (`ski_overrides.json`).
- Catch: `ski-assign.yml` runs `ski_split_check.py` on both sides, `base` and `site`, and in the PR that moves it
  `base` still has the old layout. Pick the folder for each side (`ski-tiles` when it's there, else `scripts`),
  and drop that once it's merged.
- Its own PR, as it touches other workflows than the deploy.

### Order and risks

- Open #57 changes `assets/`: merge or close it before D1, or rebase it after (git follows the renames). The
  Dependabot PRs don't collide.
- Start from a fresh `main`.

(Done separately: the old mockups in `design/` and `missing-sizes.csv` are gone, and the plans in `docs/` are
committed.)

## E. Split `resort.js` (issue step 4)

The issue counts 1,112 lines and 6 jobs; since #90, #92 and #93 it is 1,474 lines with a seventh job, the weather
forecast (`weatherCard`, `forecastDays`, `forecastNow`, `weatherIcon`, ~160 lines). Proposed:

- `resort.js`: `show()`, header, tiles, status note, data/sources cards, avalanche card,
- `resort-lists.js`: `breakdown()`, lift and slope lists, stations, icons,
- `resort-map.js`: `resortMap()`, `pickOnMap()`, `groupCards()`,
- `resort-weather.js`: the forecast,
- `resort-history.js`: `historyChart()`, `chart()`.

Same PR: widen `[a-z]+\.js` in `translate.mjs` (two places: the page's scripts and the `STRINGS` insertion) and
in `pages.yml` (or `build.mjs` after C), add the files to `types/pages/resort.json` and new names to `biome.json`
globals. With A in place the 4 extra requests are cached. `scene.js` (1,632 lines) next, only where a split
follows a clear seam.

**Done (#100):** after #98 moved the chart and the group helpers to `common.js`, `resort.js` was 1,287 lines with
five jobs. The history was one 25-line function, and `groupCards()` is one of the page's cards, so both stayed in
`resort.js` (476 lines); the rest went to `resort-lists.js` (445), `resort-map.js` (182) and `resort-weather.js`
(189). Nine names cross files. Only `translate.mjs`'s pattern needed widening: the `STRINGS` insertion matches
`common.js` alone, and #95 had widened the deploy's.

## F. Translations (issue step 5)

The issue's diagnosis is slightly off: after a typo fix in English, the paragraph doesn't disappear, it falls
back to English in the four languages, and `npm run check` lists the new key as missing and the old one as
unused. The cost is real, though: 38 keys are over 200 characters (max 1,541), and each edit means
re-pasting the whole paragraph in four files.

Plain named keys have a downside the issue doesn't mention: change the English text and the old translation
stays, silently out of date, with nothing to flag it. English-as-key exists exactly to prevent that.

So: named keys (`data-i18n="about-…"`, already supported) for the long paragraphs, plus a fingerprint of the
English text stored with each translation (e.g. `{"about-sources": {"text": "…", "en": "<short hash>"}}`), and
`translate.mjs --check` reports translations whose English has changed since. A typo fix can then be marked as
"no re-translation needed" by updating the hash. Short UI strings keep English as key.

**Done:** the 38 blocks over 200 characters (index's footer, about, api, sources, privacy) are named
`<page>-<topic>`; their translations moved to `{"text", "en"}` with the same text, so the translated pages came out
byte for byte the same. `--check` warns on an outdated translation (it stays shown meanwhile), and fails on a long
block without a name or a named translation without `en`; `translate.mjs --accept <name>…` re-stamps the fingerprints
after a typo fix. A tag or `{placeholder}` check compares a named translation with the block's English.

## Vite (issue step 6)

Not now. The site's working unbuilt from the repo is deliberate, and the gain is development comfort, not page
speed (Brotli and minifying are in place). Note for later: plain ES modules *without* a bundler would also remove
the `biome.json` globals list, but `import "./common.js"` inside a module wouldn't get `?v=`, so with A's
immutable caching those files would be frozen for a year. Any move to modules needs versioned import specifiers
(or an import map written on deploy) first.

## Small extras

- Every page loads `https://miron.asia/favicon.svg` (8 pages) from another site: self-host it in `assets/`.
- MapLibre (cdnjs) and maplibre-contour (jsDelivr) load without `integrity`; versions are pinned, so add SRI.
  Done in #97, with three.js (and the `three.core.js` it imports) in an import map on `3d.html`.
