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
- Run `npm run check` before committing (`npm run format` fixes the formatting). `package.json` is for
  these checks and for minifying `assets/*.js` and `*.css` on deploy (`pages.yml`): the pages load no npm
  package and work as they are, with no build step locally.
