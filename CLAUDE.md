# snow-conditions

The website (branch `main`: plain static pages, no build step) for the data that
**snow-fetcher** publishes to this repo's `data` branch. snow-fetcher is checked out next to
this one at `../snow-fetcher`; its `src/snow_fetcher/models.py` defines the data format, and its
README documents every source in detail.

- Never edit the `data` branch by hand: every fetch run replaces it.
- This README's "About the data" and `sources.html` are the public description of
  snow-fetcher's output. Keep them in sync with what the fetcher does; when in doubt, check
  `../snow-fetcher/README.md` and the code there.
- `../snow-fetcher/CLAUDE.md` has the full checklist of what to update here after a fetcher
  change, and which fields each page reads.
- `COUNTRY_NAMES` is duplicated in `assets/common.js` and `scripts/trmnl_resorts.py`; change
  both.
- Users' TRMNL plugins poll `json/<country>/<id>.json` directly: those URLs are a public
  contract.
