[![LiftRadar: status of ski resorts across Europe](web/assets/og.png)](https://liftradar.eu)

# liftradar

The website of [liftradar.eu](https://liftradar.eu): which ski resorts are open, and how much of each (lifts, slopes,
snow, avalanche danger), in Austria, Switzerland, Italy, France, Germany, Czechia, Slovakia, Poland, Finland, Norway,
Spain, Slovenia, Andorra and Bulgaria. The data comes from the resorts' own reports and the regional snow reports,
twice a day, about 08:40 and 13:40 CET. It's not an official source: check the resort's own site before you go.

The site is in English, German, French, Italian and Polish.

## What's here

- **The site** (branch `main`): plain static pages that load the data in the browser. There's no framework and no
  build step to work on them.
  - The [table](https://liftradar.eu/) and [map](https://liftradar.eu/map) of every resort
  - A page for each resort (its lifts and slopes, snow, weather, history) and its ski area in 3D
  - A page for each country ([Austria](https://liftradar.eu/austria)…) and for linked ski areas and passes
  - [Stats](https://liftradar.eu/stats) for the season so far, and [what the numbers mean](https://liftradar.eu/about)
- **The data** (branch `data`): the JSON files the site reads, published twice a day by liftradar-fetcher, a separate
  repository that reads the sources. Every run replaces the branch.

## Using the data

The data is free to use, with no key:

- `https://liftradar.eu/json/index.json`: every resort, with its status and key numbers
- `https://liftradar.eu/json/<country>/<id>.json`: one resort's full report
- `https://liftradar.eu/mcp`: an [MCP](https://modelcontextprotocol.io) server for AI assistants

The [API page](https://liftradar.eu/api) documents every file and field (also as
[OpenAPI](https://liftradar.eu/openapi.json) and JSON Schema), and [Sources](https://liftradar.eu/sources) lists
where each resort's report comes from.

## Running it locally

You need Node.js 24 and git. Check the data out next to this folder, then serve the site:

```sh
git worktree add ../liftradar-data data   # the data; git -C ../liftradar-data pull for newer
npm install
npm run dev -- --data ../liftradar-data   # http://localhost:8000
```

An edit shows on reload. Before committing, run `npm run check` (`npm run format` fixes the formatting).

How the site is built, deployed and translated, and everything else you need to change it, is in
[DEVELOPMENT.md](DEVELOPMENT.md).

## Credits

Data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; map tiles from
[OpenFreeMap](https://openfreemap.org) © [OpenMapTiles](https://openmaptiles.org); relief from
[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen); the 3D terrain from Terrain Tiles with WebGPU,
else from [Mapterhorn](https://mapterhorn.com/attribution/); ski areas, pistes and lifts from
[OpenSkiData](https://openskidata.org) (ODbL). Each resort's sources are credited on its page and on
[Sources](https://liftradar.eu/sources).
