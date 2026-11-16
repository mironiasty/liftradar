# LiftRadar mobile app

Plan, 2026-11-16. Nothing is built yet: this records what was decided and why, for whoever picks it up. The
resort's 3D view the app shows comes from TrailRider's engine, which goes to the site first:
`docs/3d-engine-plan.md`.

## Decisions

- **Two separate apps.** TrailRider (`../trailrider`, GPX → animation, `eu.liftradar.rider`) stays its own
  product. LiftRadar gets its own app for iOS and Android, showing the same data as this site.
- **Native, not Expo / React Native / Flutter.** SwiftUI (iOS 17+) and Jetpack Compose (API 26+), the same
  stack as TrailRider, so that both apps share TrailRider's Rust core (through UniFFI) and its 3D engine
  (Metal, OpenGL ES 3.0).
  - Why: the app should animate smoothly from the map or a resort's page into the resort's 3D view. That
    needs the 3D view in the same native view hierarchy as the rest of the UI (one camera, transitions,
    gestures, no reload). In React Native it would be a native module wrapping a Metal/GL view: four layers
    (RN, Swift, Kotlin, Rust) instead of three, two of which exist already.
  - Widgets (WidgetKit, Glance) and notifications are native anyway.
  - A thin WebView/Capacitor wrapper of the site risks App Store rejection (guideline 4.2) and adds nothing.
- **Where the code lives:** most likely a third app in the TrailRider repo (monorepo), next to the engine split
  out as a Swift Package and a Gradle module (`docs/3d-engine-plan.md`, step 6). Separate repos would need
  submodules or published artifacts and a release for every engine change.

## Data

The app reads the same public files as the site; no backend of its own for the data:

- `json/index.json` (all resorts; ~960 KB, ~58 KB gzipped), `json/<country>/<id>.json` (one resort, a few
  KB), `history/<country>/<id>.json` (~4 KB), `json/stats.json`, and the ski tiles `ski/v1/…` (README "Ski
  tiles"; `?b=<build>` skips stale caches).
- Data changes twice a day (about 08:40 and 13:40 Vienna time): cache with ETags, keep the favourites'
  reports for offline use (no signal on the mountain).
- Models: Codable (iOS) and kotlinx.serialization (Android), generated from `schema/*.schema.json` (e.g.
  quicktype), with a check that they're up to date, like `npm run types` here.
- **Compatibility:** app versions stay installed for months. Schema changes in liftradar-fetcher must be
  backward compatible (add fields; remove only after a transition period), and the app must handle unknown
  values (a new `status`) gracefully. This belongs in `../liftradar-fetcher/CLAUDE.md` once the app exists.
- Attribution as on the site: `source_details[].attribution_required` (Fnugg) shown next to the data,
  OpenSkiData (ODbL) and OpenStreetMap credits on the map and 3D view, and the "not an official source, check
  the resort's website" caveat on the resort screen. If the app is ever paid or carries ads, re-check the
  sources' terms.

## Screens (first version)

1. **List:** search, filters (country, open, km of slopes), favourites on top, sort by fresh snow / open lifts.
2. **Map:** MapLibre Native (iOS; Android with `maplibre-compose`), same basemap as the site (OpenFreeMap,
   Mapterhorn); resort outlines and points from `ski/v1/resorts.geojson` coloured by status, pistes and
   lifts from the zoom-10 tiles when zoomed in.
3. **Resort:** status, lifts and slopes, snow, avalanche danger, history graphs, sources, link to the
   resort's own site; its 3D view, entered from the map with the transition built on the web first
   (`docs/3d-engine-plan.md`, step 5).
4. **Favourites:** kept on the device (like the site's `localStorage` list, `assets/common.js`).
5. **Settings / About the data:** language (en, de, fr, it, pl, as on the site), units, notifications, a short
   version of `about.html` with a link to it.

## Notifications: FCM topics, no token database

Firebase Cloud Messaging on both platforms (on iOS FCM forwards to APNs). The app subscribes to a resort's
topics when it's made a favourite and unsubscribes when it isn't; favourites never reach our servers, and
nothing is stored server side.

```
data deploy (pages.yml) ──► "notify" step after the deploy
     1. before deploying: fetch the live https://liftradar.eu/json/index.json (the previous state)
     2. after deploying: compare it with the new json/index.json
     3. for each change: send one FCM message to its topic, e.g. "at.skiwelt.open"
```

- A deploy after a push to `main` doesn't change the data, so the diff is empty and nothing is sent; a failed
  deploy sends nothing, as the step comes after it. No state to keep.
- Sent from GitHub Actions (a Node script in `scripts/`, the Firebase service account key in the secrets),
  not the Worker. FCM is free.

| Topic | When |
|---|---|
| `<country>.<id>.open` | `status` goes from `closed` to `open` |
| `<country>.<id>.snow` | `snow.fresh_cm` crosses a threshold (e.g. from < 10 to ≥ 10 cm) |
| `<country>.<id>.avalanche` | `avalanche.danger_level` rises to 3 or more |

- Ignore changes to or from `no_report` (the source just didn't answer). Only a crossing counts, not the value,
  so snow reported several days running doesn't repeat.
- The message carries a localisation key and arguments (`title_loc_key`, `loc_args`; both APNs and Android
  support them), so the app translates it and the server needs no language. Its data has
  `resort: "<country>/<id>"`, opened the same way as a deep link.
- iOS: Push Notifications capability, Firebase Messaging through SPM, the APNs key (`.p8`) uploaded once to
  Firebase; Firebase in `PrivacyInfo.xcprivacy` and the privacy policy. Android: `firebase-messaging`, the
  `POST_NOTIFICATIONS` permission from Android 13.
- Limits: thresholds are the same for everyone (a few levels as topics, `.snow10`, `.snow20`, `.snow30`, if
  needed; an iOS app can't silently drop a notification it received). Per-user thresholds, a whole country
  or "any resort within 100 km" would need a token database later (e.g. a Worker with D1), sending to tokens;
  topics don't block that.
- Without Firebase on iOS: APNs directly (fine from GitHub Actions) and FCM for Android only, but APNs has no
  topics, so a token database is needed from the start. Not for the first version.

## Deep links

`liftradar.eu/resort?r=<country>/<id>` opens the app: add `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json` to this site, with the right content type in `_headers`.

## Phases

The engine's steps 1–5 (`docs/3d-engine-plan.md`) come first, on the site; the app's 2D parts don't depend on
them and can start alongside.

| Phase | Scope |
|---|---|
| 1. MVP | List, resort, favourites, offline, 2D map |
| 2. 3D in the app | The engine as a package (engine plan, step 6), the resort's 3D view with its lifts' and slopes' status, the map → 3D transition |
| 3. Release | Stores (Apple Developer $99/year, Google Play $25 once), deep links |
| 4. Notifications and widgets | FCM topics and the notify step; WidgetKit and Glance |

Aim to have a first release out before the season's peak (December–January); if the 3D view isn't ready by
then, release phase 1 and add it in an update.
