# liftradar

The website (branch `main`: plain static pages in `web/`, no build step) for the data that
**liftradar-fetcher** publishes to this repo's `data` branch. liftradar-fetcher is checked out next to
this one at `../liftradar-fetcher`; its `src/liftradar_fetcher/models.py` defines the data format, its
README describes the data ("Output", "Data details"), and its `docs/sources/` every source in detail.

`README.md` is the short overview for visitors; how this repo works (what's in the data and the site, deploy,
running locally, translations, country pages, MCP, ski tiles, 3D engine, scripts) is in `DEVELOPMENT.md`: read
the section you're changing first, and keep it up to date in the same change.

- Never edit the `data` branch by hand: every fetch run replaces it.
- `web/` is everything the site serves, at the address it has there; the pages and `assets/` named below are in it.
- `about.html` and `sources.html` are the public description of liftradar-fetcher's output. Keep them
  in sync with what the fetcher does; when in doubt, check `../liftradar-fetcher/README.md`, its `docs/sources/` and the code
  there. `about.html` keeps to what a reader needs: per-source detail goes in that README's "Data details".
- `../liftradar-fetcher/CLAUDE.md` has the full checklist of what to update here after a fetcher
  change, and which fields each page reads.
- `/de/`, `/fr/`, `/it/` and `/pl/` are generated on deploy from the English pages and `i18n/<language>.json`
  (DEVELOPMENT.md "Translations"). Always edit the English, and translate in the same change: after editing text marked
  `data-i18n` or in `t("…")`, including `about.html`, `npm run check` lists what's missing in each language and the
  old entries to replace. A block over 200 characters has a name (`data-i18n="about-…"`): after editing one, `npm run
  check` lists its translations as outdated; update them, or `node scripts/translate.mjs --accept <name>` when the
  change doesn't touch the meaning (a typo).
- Users poll `json/<country>/<id>.json` directly: those URLs are a public
  contract.
- The data's fields are type checked (DEVELOPMENT.md "Type check"): when a page reads a new part of the data, give
  it its type in JSDoc (`/** @param {Resort} r */`) rather than leaving it `any`; after the fetcher's schema
  changes, `npm run types`.
- `worker/mcp.js` is the MCP server at `/mcp` (DEVELOPMENT.md "MCP"), the Worker's only script: its tools read the same
  files, so after a fetcher change check them too, and keep `api.html` ("MCP") in step with them.
- TrailRider's 3D engine reaches the site as a release pinned in `engine.json` (DEVELOPMENT.md "3D engine"),
  unpacked into `web/engine/` by `scripts/engine.mjs`: move the pin, never edit what's unpacked.
- Run `npm run check` before committing (`npm run format` fixes the formatting). `package.json` is for
  these checks, for `scripts/build.mjs` (what `pages.yml` deploys: `npm run build`, then `npm run preview` to serve
  it with `/mcp`), for `npm run dev` (the repo served as it is, translations included), and for the MCP server's
  packages, which wrangler bundles: the pages load no npm package and work as they are, with no build step locally.
