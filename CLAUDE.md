# liftradar

The website (branch `main`: plain static pages, no build step) for the data that
**liftradar-fetcher** publishes to this repo's `data` branch. liftradar-fetcher is checked out next to
this one at `../liftradar-fetcher`; its `src/liftradar_fetcher/models.py` defines the data format, and its
README documents every source in detail.

- Never edit the `data` branch by hand: every fetch run replaces it.
- `about.html` and `sources.html` are the public description of liftradar-fetcher's output. Keep them
  in sync with what the fetcher does; when in doubt, check `../liftradar-fetcher/README.md` and the code
  there. `about.html` keeps to what a reader needs: per-source detail goes in that README's "Data details".
- `../liftradar-fetcher/CLAUDE.md` has the full checklist of what to update here after a fetcher
  change, and which fields each page reads.
- `/de/`, `/fr/`, `/it/` and `/pl/` are generated on deploy from the English pages and `i18n/<language>.json`
  (README "Translations"). Always edit the English, and translate in the same change: after editing text marked
  `data-i18n` or in `t("…")`, including `about.html`, `npm run check` lists what's missing in each language and the
  old entries to replace.
- Users poll `json/<country>/<id>.json` directly: those URLs are a public
  contract.
- The data's fields are type checked (README "Type check"): when a page reads a new part of the data, give
  it its type in JSDoc (`/** @param {Resort} r */`) rather than leaving it `any`; after the fetcher's schema
  changes, `npm run types`.
- `worker/mcp.js` is the MCP server at `/mcp` (README "MCP"), the Worker's only script: its tools read the same
  files, so after a fetcher change check them too, and keep `api.html` ("MCP") in step with them.
- Run `npm run check` before committing (`npm run format` fixes the formatting). `package.json` is for
  these checks, for minifying `assets/*.js` and `*.css` on deploy (`pages.yml`), and for the MCP server's packages,
  which wrangler bundles: the pages load no npm package and work as they are, with no build step locally.
