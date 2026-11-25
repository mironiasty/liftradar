# Open and closed lifts and pistes on the 3D map

Plan from 22 November 2026. Nothing is built yet.

## Where things stand

- The 2D map and the resort page show each lift's and piste's status (#69): open lines wide on a light edge,
  closed ones thin and dashed, unknown ones thin and faint, a green dot or red ring on each lift station. The
  statuses come from `json/<country>/<id>.details.json`, linked to the tiles' lines by `item`
  (`scripts/lift_links.py`).
- `3d.html` draws a resort in two ways:
  - **TrailRider's engine** (WebGPU; most visitors). It is pinned in `engine.json` and built in `../trailrider`
    (`core/trailrider-core`, `web/src/viewer.ts`). It reads the ski tiles itself, but **not `item`**
    (`ski/types.rs`), and its API (`MountOptions`, `MountedResort`) has no way to receive statuses. Each
    lift's cable already has its own speed (`lift_scene.rs`, `Cable.velocity`). A picked lift's cables are
    already drawn amber, and a picked piste in full colour, so per-lift and per-piste styling exists.
  - **The diorama** (`assets/scene.js`, three.js; without WebGPU). Its pistes are `addPistes` with
    `highlight`, so they already get the 2D look. Its lifts are three.js models with moving carriers
    (`buildLifts`, `liftLayer`), and know nothing of statuses.

## How it should look

The aim: tell at a glance, from any angle, which lifts run and which pistes are open. The 3D view's own
language is used where it reads best (motion, light), and the same colours as the 2D legend are kept.

1. **Running lifts move, closed ones stand still.** This is the strongest cue in 3D and needs no legend.
   - Open: the carriers move as now.
   - Closed: the cable stands. Detachable lifts (gondolas, detachable chairs, as `stationDesign` tells them
     apart) also have no carriers on the line, because they're parked in the station at night and off
     season. Fixed chairs and T-bars hang still.
   - Unknown: they move as now. We don't claim a lift is closed without a source.
2. **A status pin over each station of a lift with a known status:** a green dot for running, a red ring with
   × for closed, the same as the 2D map. It's screen-sized and drawn by the engine (see below), so it stays
   readable when the lift is far away or seen from the side. Pins sit at the bottom station only
   when zoomed out, and at both stations close up.
3. **Pistes:**
   - Open: full colour, a little wider, as on the 2D map.
   - Closed: the same hue, desaturated and at about half the opacity. Dashes, as on the 2D map, flicker on
     terrain seen at a slant, so the 3D view uses colour strength instead, and the legend says so.
   - Unknown: as now.
4. **The cable of a closed lift** is drawn a little greyer and thinner, so a closed lift doesn't stand out
   more than an open one. The amber of a picked lift stays as it is.
5. **"Only what's open"** in the 3D settings menu: closed lifts' carriers and cables, and closed pistes,
   are hidden. Pylons and stations stay faint, for orientation. This answers "where can I ski today" in one
   click.
6. **The card of a picked lift or piste** gets its status and the time of the report: "Open · as of 08:40".
7. **A legend** in the settings menu, only when statuses are loaded: running / standing / not known.

Considered and left out:
- **Lighting closed areas darker (a shadow over them):** it fights the sun slider and reads as weather.
- **Recolouring lift models green and red:** on small models it's noise, and red also marks the
  difficulty of pistes.
- **Night lights at the stations:** a nice touch, but not a status.

## Built once, in TrailRider's core

The same view comes to the phones: the TrailRider app already draws resorts with the core (`trailrider-ffi`,
`ResortLoader`), and the LiftRadar app's 3D view (its phase 2) will too. So everything that isn't UI goes into
the Rust core (`../trailrider/core/trailrider-core`), behind one API that the web viewer (`trailrider-wasm`,
`web/src/viewer.ts`) and the apps (`trailrider-ffi`, Swift and Kotlin through UniFFI) only pass through:

| In the core, once | On each platform (web, iOS, Android) |
| --- | --- |
| The details file's address (`details_json_url`, next to `resort_json_url`) | Fetching it (the apps keep a copy with its ETag, as with the other files) |
| Reading the details JSON, and matching it to the tiles' lines by `item` | Passing the JSON text in, and again after a refresh |
| Stopped cables, parked carriers, the cable and piste styling, in the shared shaders | — |
| The station pins, drawn in the scene as screen-sized sprites | — |
| "Only what's open" (a switch) | The switch in its settings |
| A picked lift's or piste's status and report time, in `Picked` | The card's text, in its language |
| — | The legend, in its language |

The pins are drawn by the engine, not over the canvas as the place names are: they're shapes without text, so
drawing them once saves three overlays that would drift apart. How they look (colours, sizes, when the top
station gets one) goes into TrailRider's `docs/look-spec.md`, a new section "Stany wyciągów i tras", next to
the lifts (5.1) and pistes (6). The colours are the 2D map's (`OPEN_COLOR`, `CLOSED_COLOR`, `CASING` in liftradar's
`assets/ski.js`), so the site, the apps' 2D maps and the 3D view agree.

## Plan A: the core (`../trailrider`, a new viewer release)

- [ ] `ski/types.rs`: read `item` (optional) on lifts and runs, and keep it on the resort view's lifts and
      pistes.
- [ ] A `LiftStatus` (open, closed, preparation, unknown) and `ResortStatuses::from_details(json)`: read
      `json/<country>/<id>.details.json` (`lifts`, `slopes`, `updated_at` / `fetched_at`; unknown fields and
      values are ignored, as the apps do with the other files). Several files can be given: the resort's and
      those of its linked area's members, which the view also shows. Tests on real files (Sölden, Kitzbühel,
      SkiWelt).
- [ ] The scene takes the statuses (`set_statuses`), at any time, and without them draws everything as now:
  - [ ] `lift_scene.rs`: the cable of a closed or in-preparation lift stops (velocity 0). A detachable lift
        has no carriers on the line.
  - [ ] Shaders (`trailrider-shaders`, the same on every platform): a closed lift's cable a little greyer and
        thinner; a closed piste desaturated at half opacity; an open piste a little wider. The amber of a picked
        lift stays.
  - [ ] Station pins as sprites: a green dot or a red ring with ×, screen-sized; at the bottom station only
        when far, at both up close; none for an unknown status.
  - [ ] `set_only_open(bool)`: closed lifts' cables and carriers, and closed pistes, hidden; pylons and
        stations faint.
  - [ ] `Picked` gets `item`, the status and the report time.
- [ ] `trailrider-wasm` and `web/src/viewer.ts`: `MountOptions.details` (the JSON texts),
      `MountedResort.setDetails()` and `setOnlyOpen()`. `trailrider-ffi`: the same on `ResortLoader` / `Scene`.
- [ ] `docs/look-spec.md`: the section on statuses. A release, then `engine.json` in liftradar moved to it.

## Plan B: the platforms

**liftradar** (`assets/scene.js`, `3d.html`):

- [ ] Fetch the details files of the resort and of its linked area's members, and pass them to
      `mountResort` (`details`).
- [ ] The pick card: the status and the report time. The settings menu: the legend, and "Only what's open"
      (remembered in `localStorage`, like the names' layers).
- [ ] Diorama (three.js, without WebGPU): it isn't on the phones, so only the least is done here. `liftsIn`
      keeps `item`, and a closed lift's carriers stand still. The pistes already have the 2D look.
- [ ] i18n strings in all languages, `npm run types`, `npm run check`. `about.html` ("Map"): one sentence on
      the statuses, on the 2D and 3D maps.

**TrailRider and LiftRadar apps** (when their 3D view shows a liftradar resort):

- [ ] Fetch the details files as the other files are (with the ETag copy), pass them to the scene, and
      add the card's status, the legend and the switch to their settings.
- [ ] The LiftRadar app's 2D map: the 2D look (as `SKI_LOOKS` in `assets/ski.js`), in MapLibre Native's style,
      from the same spec.

## Checking it

- **Resorts with statuses today:** Sölden and Hintertux (a glacier open, the rest closed), Kitzbühel (mostly
  closed, some open at Resterhöhe), and a resort without a details file, which must look exactly as before.
- **Every renderer:** WebGPU on the web (Chrome, Safari 26), the TrailRider app on iOS and Android with the
  same resorts, and the diorama (with WebGPU switched off).
- **Light and dark mode, a phone's width.** The pins must not crowd the place names.
- **Performance:** a stopped cable saves work. The pins are at most two per lift, and SkiWelt has about 150 lifts.
