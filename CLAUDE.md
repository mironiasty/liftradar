# liftradar

The website (branch `main`: plain static pages, no build step) for the data that
**liftradar-fetcher** publishes to this repo's `data` branch. liftradar-fetcher is checked out next to
this one at `../liftradar-fetcher`; its `src/liftradar_fetcher/models.py` defines the data format, and its
README documents every source in detail.

- Never edit the `data` branch by hand: every fetch run replaces it.
- This README's "About the data" and `sources.html` are the public description of
  liftradar-fetcher's output. Keep them in sync with what the fetcher does; when in doubt, check
  `../liftradar-fetcher/README.md` and the code there.
- `../liftradar-fetcher/CLAUDE.md` has the full checklist of what to update here after a fetcher
  change, and which fields each page reads.
- Users poll `json/<country>/<id>.json` directly: those URLs are a public
  contract.
