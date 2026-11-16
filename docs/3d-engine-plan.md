# TrailRider's 3D engine for LiftRadar

Plan, 2026-11-16. Nothing is built yet: this records what was decided and why, for whoever picks it up. The
mobile app that is to use the same engine is in `docs/mobile-app-plan.md`. Paths below without `../trailrider/`
are in this repo; the engine's are in TrailRider (`../trailrider`, its own README and `docs/`).

## Decision

A resort's 3D view, on the site and in the coming LiftRadar app, is to be drawn by TrailRider's engine, so that
the site, the LiftRadar app and TrailRider all show a resort the same way, and the app can animate smoothly from
the map into the 3D view. The site comes first: it's the cheapest way to see how it looks and to take most of
the risk out before the app.

- Today `3d.html` is a prototype of its own: a diorama cut out of Mapterhorn's terrain in MapLibre, with the
  lifts as three.js models in the map's WebGL context (`assets/scene.js`).
- TrailRider has a Rust core (`core/`) and an engine on three platforms: WebAssembly + WebGPU on the web
  (`web/src/animation/`, wrapped by `web/src/core/`), Metal on iOS and OpenGL ES 3.0 on Android, the phones
  through UniFFI (`core/trailrider-ffi`). It reads this site's ski tiles (`ski/v1`) already, to recognise a ski
  day's lifts and pistes.

What the site tests: a resort scene without a route on all 742 resorts and their real tiles; lift and slope
status in the scene; the map → 3D transition (the site has MapLibre maps, as the app will); real users'
feedback without a store release. What it doesn't: the native renderers, native gestures, phones' performance
and memory. Those stay for the app.

## The look

- **TrailRider's "Realistyczna" map** (`MapStyle` `'realistic'`, `../trailrider/docs/realistic-plan.md`): winter
  mountains lit as in nature (linear light, blue snow in shadow, tone mapping), ambient occlusion and snow/rock
  from the height grid (`terrain_look.rs`), sky and aerial perspective, snowy spruces, pistes as groomed snow
  with a thin line of their difficulty's colour along the edge, and its realistic lifts (`realistic_lift.rs`:
  four-seat chairs, gondolas, T-bars, steel pylons, stations). Houses are still the cartoon ones there (its
  stage 6 isn't finished): fine for a start.
- **No figure, no trail, no timeline.** The chairs and cabins run on every lift (all empty).
- **Smaller lifts.** The engine sizes lifts, trees and figures in a cartoon unit, so they look the same in any
  day's wide view: `pxM = cartoonUnit(halfM, figureScale) = 2 · halfM / wideViewPx · figureScale` metres
  (`look.json`: `wideViewPx` 1000, `figureScale` 0.5). A lift's cable hangs `lift3d.cableHeight` = 27 units
  above the ground: for a resort 6 km across (`halfM` 3 km) that's 3 m a unit, 81 m, against 10–15 m for a
  real chairlift, so they look like toys on the land. In the resort view the unit is metres instead: a fixed
  `pxM` (about 0.5–1 m a unit, cables 13–27 m up), tuned on the dev page (step 0), the same for every resort.
  - The day's `meta.figure_scale` exists for this ("lifts, riders and trees against the mountain, instead of the
    engine's default"), but scales with the land's size: the resort view sets `pxM` itself.
  - Trees shrink with it (`solidPropM` follows the same scale): right for the realistic look, whose forest from
    afar is painted on the ground from the trees' spacing (`realistic.forest`) anyway.
  - Check in step 0 that cables and pylons don't vanish into sub-pixel lines in the wide view of a big area (a
    minimum width in pixels, or a slightly bigger unit when far away).

## Steps

### 0. A dev page in TrailRider (go / no-go on the look)

TypeScript only, no changes to the Rust core or the phones, like the realistic map's own trial:

- `../trailrider/web/dev/resort.html?r=<country>/<id>` (and `src/dev/resort.ts`), with sliders for the lift unit
  (`pxM`), the sun's hour (`REAL.hour`, as `dev/realistic.html`) and the camera's pitch, and a few resorts to
  click through: big and small, glacier and forest (e.g. `at/hintertux`, `at/ski-arlberg`, `ch/zermatt`,
  `pl/kasprowy-wierch`, `fr/val-thorens`, `cz/spindleruv-mlyn`).
- The resort's data from the tiles, in TS: its outline and point from `ski/v1/resorts.geojson`; from the zoom-10
  tiles under the outline (`loadSkiData`'s reading, by tiles instead of a day), every lift with `lr` = the
  resort as a `ResortLift` (kind from `liftKind(type)`, its line between the ends of `c`, the lower one first)
  and every downhill run with `lr` = the resort as a `Piste` (`pisteColour`, `c` as a line or `poly` as areas),
  in local mercator metres from the outline's centre. The land: the outline's box plus a margin, square.
- `createResortViewer(canvas, resort, options)` beside `createPlayer` (`web/src/animation/`), from the same parts
  as `player.ts`'s `start()` without the motion: `loadHeightGrid`, `paintPistes`, `buildLifts` with no rides
  (only `resort_lifts`, standing lines), `scatterPines` with no route, the realistic props and lift kit,
  `createDayScene` with no trail, `terrainLook`. The camera: the orbit (`createOrbit`) with wheel and pinch zoom,
  framed to the outline (`fitDistance`), slowly turning until touched. Check what in them assumes a route (empty
  sample arrays, zero-sized GPU buffers) and give it the smallest stand-in rather than reworking it.
- **Gate:** screenshots of those resorts accepted, and the lift unit chosen.

### 1. The resort scene in the core

Once the look is accepted, move what step 0 did in TS into the Rust core, so the phones run the same code:

- `trailrider-core/src/ski/`: a resort's lifts and pistes from the tiles (`resort_view(data, resort_id)`), beside
  the day's `lift_match::resort_lifts` and its pistes, with fixtures in `shared/fixtures/` (WebAssembly bit for
  bit, native to a float's last bit, like the rest).
- Its land (centre, `half_m`) in `plan.rs` beside `plan_day`, and the resort view's numbers (`pxM`, margin, pitch,
  turning speed) in `shared/look.json` → a new `resort` section (`npm run look` for the phones).
- Bindings in `trailrider-wasm` (the dev page and the viewer use it instead of their TS) and `trailrider-ffi` (a
  `Scene` built for a resort: the phones' step 6). Assembling the scene stays the web engine's own, in TS, as it
  is for a day: the phones assemble theirs in `trailrider-ffi`, as they do now.

- **Status (16 November 2026): done** in TrailRider's `resort-core` branch.
  - **Core:** `ski::find_resort` (resorts.geojson → id, name, outline), `ski::outline_tiles`, `plan::plan_resort`
    (the land), and `ski::resort_view`. The lifts are `lifts_of_resort`. The pistes now take the core's downhill and
    connection runs, with their shared edges.
  - **Numbers:** `shared/look.json` → `resort` (lift and tree metres, pylon spacing, speed, piste fill, margin, pitch,
    turning, hour), generated for the phones.
  - **Bindings:** WebAssembly `findResort`, `resortTiles`, `SkiTiles.resortView`; the FFI `ResortLoader` (name, tile
    URLs, `load` → the view as JSON). The phones' scene for it is still step 6.
  - **Fixtures:** `shared/fixtures/resorts/` (Hintertux, Kasprowy) on a two-resort `inputs/ski/resorts.geojson`.

### 2. The viewer bundle, delivered to the site

The site has no build step and loads no npm package; the engine is TypeScript (Vite) plus about 1.2 MB of
WebAssembly. Keep it that way:

- TrailRider builds a separate **viewer bundle**: a Vite library build of `createResortViewer` and what it needs
  (the engine and the core's WebAssembly, no app UI or fonts), e.g. `web/viewer.ts` → `dist-viewer/viewer.js` +
  `core_bg-<hash>.wasm`, published as `viewer.tar.gz` on a release `viewer-<version>`, as this site's ski tiles
  are (`ski.tar.gz` on `ski-latest`). Its API, typed in a `viewer.d.ts` it ships:
  `mountResort(canvas, { resort: "<country>/<id>", base: "https://liftradar.eu", onStatus })` → `{ destroy() }`,
  later `setStatus(...)` (step 4) and `fromCamera(...)` (step 5).
- This repo pins the version (e.g. `engine.json`: the release tag and the archive's sha256). `pages.yml` downloads
  and checks it and unpacks it into the site (`/engine/<version>/`, so each version is its own cacheable URL), and
  `3d.html` imports it as a module. Locally `scripts/engine.mjs` fetches the same archive into `engine/` (not in
  git), as for the ski tiles. An engine change reaches the site only when the pin moves.
- The engine fetches the ski tiles from the site it runs on (`base`), and the elevation tiles (Mapzen Terrain
  Tiles on AWS) itself: the credits on the page change with them (today's 3D page uses Mapterhorn).

### 3. `3d.html` on the engine

- Same address (`3d.html?r=<country>/<id>`, a public link, in the sitemap), same page chrome and language
  handling, the credits (OpenSkiData ODbL, OpenStreetMap, the elevation tiles' sources).
- WebGPU is in current Chrome, Edge and Safari, not everywhere: without it (`navigator.gpu`, or no adapter, as
  `player.ts` checks) keep the current diorama (`assets/scene.js`) as the fallback. Decide later, from how many
  visitors lack WebGPU, whether the fallback stays or becomes a message.
- Load the engine only when the 3D view opens, not with the resort page. Check `npm run check` (html-validate,
  types: a `viewer.d.ts` in `types/`), the translations (`i18n/*.json`) for any new text, and the README's
  description of the 3D page.

### 4. Lift and slope status in the scene

Open lifts and slopes drawn as such (closed ones standing still and dimmed), from `json/<country>/<id>.json`.
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
AAR, with TrailRider on them unchanged; the resort scene from step 1 through `trailrider-ffi`, drawn by the
realistic shaders the phones already have. Then the app (`docs/mobile-app-plan.md`).

## Afterwards

When the engine draws `3d.html`, `assets/scene.js` and three.js go (unless kept as the fallback), and README's
description of the 3D page and `sitemap.mjs`'s rule for it (the 3D map is listed when the ski tiles have the
resort's area) are checked against what the new page needs.
