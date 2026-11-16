# TrailRider's 3D engine for LiftRadar

Plan, 2026-11-16. Nothing is built yet: this records what was decided and why, for whoever picks it up. The
mobile app that is to use the same engine is in `docs/mobile-app-plan.md`.

## Decision

A resort's 3D view, on the site and in the coming LiftRadar app, is to be drawn by TrailRider's engine
(`../trailrider`), so that the site, the LiftRadar app and TrailRider all show a resort the same way, and the
app can animate smoothly from the map into the 3D view.

- Today `3d.html` is a prototype of its own: a diorama cut out of Mapterhorn's terrain in MapLibre, with the
  lifts as three.js models in the map's WebGL context (`assets/scene.js`).
- TrailRider has a Rust core (`core/`) and an engine on three platforms: WebAssembly + WebGPU on the web
  (`web/src/animation/`, wrapped by `web/src/core/`), Metal on iOS (`ios/TrailRider/Engine/`) and OpenGL
  ES 3.0 on Android (`android/.../engine/`), the phones through UniFFI (`core/trailrider-ffi`). It reads
  liftradar.eu's ski tiles (`ski/v1`) already, to recognise a ski day's lifts and pistes.

## The site first

Replace `3d.html` with the engine before starting the app: it's the cheapest way to see how it looks and to
take most of the risk out.

What it tests:

- **A resort scene without a route** (below), on all 742 resorts and their real tiles, not one sample day.
- **Lift and slope status in the scene**, the biggest unknown (below).
- **The map → 3D transition**: the site has MapLibre maps (`map.html`, `resort.html`), as the app will, so
  converting MapLibre's camera to the engine's and the crossfade can be built and tuned on the web first.
- How a resort looks and performs without a figure and a timeline: camera, framing, trees, labels.
- It ships to real users, with feedback, without a store release.

What it doesn't test, and stays for the app:

- The native renderers (Metal, GL ES), native gestures, and performance and memory on phones.
- Scene assembly, unless the resort scene is built in Rust (next section): the web engine puts a day's
  scene together in TypeScript (`web/src/animation/player.ts`), the phones in Rust (`trailrider-ffi`,
  `scene.rs`).

## Steps

### 1. A resort scene in the core

A new entry point (e.g. `ResortLoader` / `ResortScene`) that takes a resort, `<country>/<id>` with its outline
and point from `ski/v1/resorts.geojson`, and builds the land's heights, the lifts and pistes from the zoom-10
tiles, the trees and houses, with no figure and no timeline. Most of it exists for a ski day: `DayMeta`'s
`resort_lifts` (lifts nobody rode) and `pistes` (`web/src/animation-api.d.ts`).

Build its assembly in Rust and expose it to both bindings (`trailrider-wasm` and `trailrider-ffi`), so the web
runs the same code as the phones will, rather than a second assembly in TypeScript. The camera: an orbit
around the outline, framed to it (the core already fits the wide view to the picture).

### 2. Delivering the engine to the site

The site has no build step and loads no npm package; the engine is TypeScript (Vite) plus about 1.2 MB of
WebAssembly. Keep it that way:

- TrailRider builds a separate **viewer bundle** (the engine and the core's WebAssembly, no app UI or fonts)
  with a small API, e.g. `mountResort(canvas, { resort, tiles, status })`, and publishes it as a release
  archive, as this site's ski tiles are (`ski.tar.gz` on `ski-latest`).
- `pages.yml` unpacks it into the site (e.g. `/engine/`), and `3d.html` imports it as a module. Locally a
  script fetches the same archive, as for the ski tiles.
- Its version is pinned in this repo, so an engine change reaches the site only when the pin moves.

### 3. `3d.html` on the engine

- Same address (`3d.html?r=<country>/<id>`, a public link and in the sitemap), same page chrome, credits
  (OpenSkiData ODbL, OpenStreetMap, the terrain's sources).
- WebGPU is in current Chrome, Edge and Safari, not everywhere: without it keep the current MapLibre diorama
  (`assets/scene.js`) as the fallback, or say the browser can't show it. Decide after measuring how many
  visitors lack it.
- Load the engine only when the 3D view opens, not with the resort page.

### 4. Lift and slope status in the scene

Open lifts and slopes drawn as such (closed ones dimmed, lifts standing still), from `json/<country>/<id>.json`.
This needs the report's lifts and slopes matched to OpenSkiData's objects in the tiles, by name, `ref` and
position, which is not 1:1 (sources name them differently, some list sectors, some only counts). Measure first
how many resorts' reports list lifts and slopes by name, and how many of those names match; if the matching
belongs in the fetcher or the tile build (`scripts/ski_resorts.py`), the scene only reads the result.

### 5. The map → 3D transition on the web

From `resort.html`'s map (or `map.html`) into the 3D view: MapLibre's camera (centre, zoom, pitch, bearing, in
Web Mercator) converted to the engine's, so the 3D view starts exactly where the map is, crossfades, and flies
into the orbit. This is the core of the "smooth animation" the app wants; done here, the app ports it.

### 6. Native

Split the engine out of TrailRider as a Swift Package and a Gradle module `:engine`, the core as an XCFramework /
AAR, with TrailRider on them unchanged; the resort scene from step 1 through `trailrider-ffi`. Then the app
(`docs/mobile-app-plan.md`).

## Afterwards

When the engine draws `3d.html`, `assets/scene.js` and three.js go (unless kept as the fallback), and README's
description of the 3D page and `sitemap.mjs`'s rule for it (the 3D map is listed when the ski tiles have the
resort's area) are checked against what the new page needs.
