# Website cleanup plan

Response to [issue #91](https://github.com/mironiasty/liftradar/issues/91) (Tim Maurice Bayer's proposal), checked
against `main` at 4a821dea (2026-11-25). Each step is its own PR with no change in behaviour.

**Status (2026-11-25):** A, B and C are merged and deployed; the CDN hashes from "Small extras" are in
#97. D, E and F are open.

## Order

| # | PR | Issue step | Verdict | Status |
|---|---|---|---|---|
| A | Cache rules for versioned assets, plus a guard that every asset link is versioned | 2 | take, with the guard | done, #94 |
| B | Page CSS out of `<style>`: shared rules into `style.css`, the rest into `assets/<page>.css` | 1 | take, dedupe rather than only move | done, #95 (merged only what was identical) |
| C | `scripts/build.mjs` (what `pages.yml` does), `npm run build` / `preview` / `dev`, one list of pages | 3 (first half) | take | done, #96 |
| D | Website into `web/`, ski-tile pipeline into its own folder | 3 (second half) | take after C, optional | open |
| E | Split `resort.js` by job (now 7 jobs, weather included) | 4 | take, widen the `[a-z]+` patterns in the same PR | open (#95 widened the deploy's pattern) |
| F | Named keys for long translations, keeping stale-translation detection | 5 | take only with a fingerprint | open |
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

Worth it for a clean root, but only after C, and as its own PR, because it touches more than code: this
CLAUDE.md, `../liftradar-fetcher/CLAUDE.md` (its checklist names site paths), the README, `jsconfig.json` /
`types/pages/*.json`, `biome.json`, `.gitignore`. Git follows the renames, so history is fine.

If we do it, also give the Python ski-tile pipeline its own folder (`scripts/ski_*.py`, `lift_links.py`,
`mini_map.py`, `ski_overrides.json`, `ski-tile.schema.json`): it is tooling for `ski.yml`, not the website, and
today sits next to the site's own scripts. (Done separately: the old mockups in `design/` and `missing-sizes.csv`
are gone, and the plans in `docs/` are committed.)

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
