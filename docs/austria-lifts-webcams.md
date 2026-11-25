# Austria: which lifts and slopes are open, and webcams

Research from 12 November 2026, before the season (almost everything was closed). Nothing is built yet:
this is reference material for a future fetcher.

## Summary

Per-lift and per-slope status, and webcam links, already sit in pages the fetcher downloads on every
run. It reduces them to counts today.

| What | Where from | Resorts | Extra requests per run |
| --- | --- | --- | --- |
| Every lift and slope: name, status, type, length | Intermaps maps already read | 61 of 182 Austrian resorts (56 maps) | 0 |
| The same, for more Tirol resorts | Intermaps keys embedded in Snow Card pages, not used yet | 15 single-resort maps + 4 shared | 1 per map |
| The same, for 6 resorts without a map | resort sites and a shared JSON API | Serfaus-Fiss-Ladis, Ski Juwel, St. Johann, Steinplatte, Hochzillertal, Hochfügen | 5 in total |
| Webcam name + viewer link | Snow Card pages (50 of 75 resorts, 190 cams), Intermaps maps (27 of 56 maps, 137 cams) | about 80 | 0 |

Snow Card (iSKI), SalzburgerLand and Kärnten publish totals only, so about 100 Austrian resorts have
no per-lift source yet. Ski Arlberg's tables and Kaunertal's nowbox list every lift and slope by name
too (already parsed; the names are dropped).

Terms (see [below](#terms-of-use)): Intermaps has none and the data is the resorts' own status;
feratel and Panomax images need permission, plain links to their viewers are fine.

## Intermaps

`https://winter.intermaps.com/<key>/data?lang=en`: JSON with `lifts`, `slopes`, `routes`, `pois` (a
dict keyed by POI type id), `lookup` and `lastUpdate` (local time, no zone). Keys are in the fetcher's
`data/intermaps_maps.json` (key → resort ids). Some maps are also on regional hosts
(`zillertal.intermaps.com/hochfuegen`) with the same data.

A lift or slope:

```json
{
  "popup": {
    "lynx-type": "lift",
    "number": "C30",
    "title": "10EUB Giggijoch",
    "additional-info": {"length": 2650, "capacity": 4500, "altitude-valley": 1362, "altitude-mountain": 2648},
    "status": "open",
    "subtitle": "Mono-cable gondola"
  },
  "number": "C30",
  "status": "open",
  "id": "L_69378",
  "subtitle": "Mono-cable gondola"
}
```

- `status`: `open`, `closed`, `closed_outoforder`, `in_preparation`, `unknown`.
- `id`: `L_…` lifts, `R_…` slopes; stable.
- Slopes have `additional-info.length` only; `subtitle` like `Slopes, Easy`, `Ski routes`.
- All 56 Austrian maps answered and every lift had a name.
- Maps spanning several of our resorts (`ski_gastein`, `salzburger_sportwelt`, `schladming_dachstein`,
  `montafon`, `skiarlberg`) don't say which area an item belongs to: fine for a list, not for
  per-resort counts.

### Keys found on Snow Card pages, not used yet

All answered, updated between 21.10 and 12.11.2026.

| Key | Resort(s) | Lifts | Slopes | Webcams |
| --- | --- | --- | --- | --- |
| `axamer_lizum` | Axamer Lizum | 12 | 31 | 4 |
| `bergeralm` | Bergeralm | 7 | 16 | 0 |
| `berwang` | Berwang | 46 | 108 | 0 |
| `galtuer` | Galtür | 9 | 27 | 0 |
| `glungezer` | Glungezer | 6 | 10 | 4 |
| `hochzeiger` | Hochzeiger | 9 | 24 | 0 |
| `kals_matrei` | Grossglockner Resort Kals-Matrei | 18 | 35 | 0 |
| `koessen` | Kössen | 11 | 16 | 0 |
| `muttereralm_ski` | Muttereralm | 6 | 10 | 2 |
| `rofan` | Rofanseilbahn Maurach | 4 | 6 | 0 |
| `sillian` | Sillian Hochpustertal | 8 | 14 | 0 |
| `st_jakob` | St. Jakob | 7 | 20 | 0 |
| `venet` | Landeck-Zams-Fliess Venet | 7 | 12 | 0 |
| `vent` | Venter Seilbahnen | 4 | 8 | 2 |
| `wettersteinbahnen_ehrwald` | Ehrwalder Wettersteinbahnen | 5 | 16 | 5 |
| `innsbruck` (shared) | Nordkette, Patscherkofel, Elferbahnen, Rangger Köpfl | 126 | 212 | 47 |
| `zugspitz_arena` (shared) | Ehrwalder Alm, Lermoos, Tiroler Zugspitzbahn | 50 | 108 | 5 |
| `hochoetz_kuehtai` (shared) | Hochoetz, Kühtai | 27 | 60 | 3 |
| `kappl_see` (shared) | Kappl, See | 21 | 50 | 0 |

Berwang's 46 lifts include 33 with status `unknown`. The SalzburgerLand page also links `zell_am_see`
and `ankogel` maps (not checked).

## Snow Card pages

`https://www.snowcard.tirol.at/skigebiet/<slug>` (about 6 KB, already fetched every run) has three
tabs: the iSKI report (counts only), webcams and the slope map.

- **Webcams:** `<div class="location_webcamitem"><h6>name</h6><iframe src="…">`. Names are sometimes
  escaped twice (`Sch&amp;#246;njoch`).
- **Map key:** `<iframe src="https://winter.intermaps.com/<key>?menu=true…">` in the `lc_pistenplan` tab.
- **Duplicates:** resorts with old and new pages repeat cameras, sometimes as `design=v3` and `design=v5`
  URLs: de-duplicate by the `cam=` id.

Over the 75 resorts (105 pages): 50 have webcams (190 cameras: 165 feratel; the rest sjon.at, megacam,
foto-webcam.eu, it-wms.com, Panomax, PanoCloud, wetter.at); 11 embed a map we use, 26 a new one
(table above), 38 none.

## Resorts without a map

| Resort | Source | Format | Requests |
| --- | --- | --- | --- |
| Serfaus-Fiss-Ladis | [ski area status page](https://www.serfaus-fiss-ladis.at/en/winter-holiday/ski-area-status%20and%20piste%20map) (also `/de/winterurlaub/skigebietsstatus-und-pistenplan`) | HTML tables | 1 (~720 KB) |
| Ski Juwel Alpbachtal Wildschönau | [lifte-und-pisten](https://www.skijuwel.com/de/winter/lifte-und-pisten) (already its `resort_info` URL) | HTML table | 1 (~340 KB) |
| St. Johann in Tirol | SGM `ListFacilities` JSON | JSON | 1 (~32 KB) |
| Steinplatte-Winklmoosalm | SGM `ListFacilities` JSON | JSON | 1 |
| Hochzillertal + Hochfügen | Intermaps `hochfuegen` | Intermaps JSON | 1 for both |

### Serfaus-Fiss-Ladis

246 rows in `table-area` blocks:
`<tr><td><span class="icon …"></span><span class="ms-2 pb-1">Closed</span></td><td>Komperdellbahn</td><td>Cable car</td>…`.
Status text seen: `Closed`, `Partially open`, `Status unknown`. Third column: lift type (`Cable car`,
`8-seater`, `T-bar lift`, `Ski tows`, `Underground`) or slope difficulty (`Easy`, `Medium`, `Expert`,
`Medium difficulty ski route`, `Difficult ski route`); also cross-country trails and attractions.
Webcams: 9 feratel on the Snow Card page.

### Ski Juwel

182 `<tr>` rows; status in `table__status--closed` (or `--open`), lift type in `icon-<type>-lift`
(`tbar`, `magic-carpet`, `chairlift-4`, `chairlift-6`), slope colour in `slope-difficulty--blue|red|black`.
Row text like `Arenalift M5`, `Piste leicht Ungnadenabfahrt keine Nummer`. Page script
`/static/build/js/lift-status.*.js`; map at `map.skijuwel.com` (not checked).

### St. Johann and Steinplatte: SGM (Micado SkigebieteManager)

Both run Micado's ski area manager; the same API probably serves other resorts on it.

```
https://www.bergbahnen-stjohann.at/SkigebieteManager/Micado.SkigebieteManager.Plugin.FacilityApi/ListFacilities.api?lang=de&region=stjohann&location=stjohann&client=https://sgm.bergbahnen-stjohann.at
https://www.steinplatte.tirol/SkigebieteManager/Micado.SkigebieteManager.Plugin.FacilityApi/ListFacilities.api?lang=de&region=steinplatte&client=https://sgm.steinplatte.tirol
```

- Optional `&type=lift` or `&type=piste`. Without `region` it answers `{"msg":"Mandatory parameter 'Region' not found"}`.
- Steinplatte without `location` covers both parts (`region` field: `Bergbahnen Steinplatte-Waidring`,
  `Skigebiet Winklmoosalm`); with `location=steinplatte` only Steinplatte.
- Response: `count` (`length`, `lengthOpen` in m, `open`, `total`), `meta.lastUpdate` (local time),
  `facilities[]` with `id`, `title`, `type`, `typename`, `status`, `length`, `height`, `feratelID`,
  `pagename`, `region`.
- `type`: `ropeway`, `chairlift4|6|8`, `draglift`, `easy-piste`, `medium-piste`, `difficult-piste2`,
  `skiroute`, `skitour-route`, `cross-country-skiing-trail`, `funpark`, `webcam`, `inn-hut`, `parking-lot`, …
- `status`: `1` open, `2` closed (inferred: webcams and one open hut show 1). **Confirm in season.**
- Counts match ours: St. Johann 9 lifts, 18 slopes; Steinplatte 14 lifts, 23 slopes incl. 2 ski routes
  (we have 22).
- HTML fallbacks for Steinplatte: `/de/liftstatus.html`, `/de/pistenstatus-highlights.html` (Next.js,
  status label `Geschlossen` per row).
- The St. Johann app's code: `client`, `region`, `location` props in `static/js/main.*.js`.

### Hochzillertal and Hochfügen

Hochfügen's [interactive map page](https://www.hochfuegenski.com/entdecken-erleben/das-skigebiet/interaktiver-pistenplan/)
embeds `https://zillertal.intermaps.com/hochfuegen`. The map covers the whole linked Ski Optimal area:
38 lifts, 50 slopes, 1 webcam. We publish two resorts (Hochzillertal 25 lifts, Hochfügen 13), so
splitting needs a fixed name list per resort, or the two merge. Hochfügen's own
[status page](https://www.hochfuegenski.com/live-aktuelles/geoeffnete-lifte-pisten/) shows only counts
("Letzter Stand laut SRM", from the same Intermaps system); Hochzillertal's site has no status list.

## Webcams

| Provider | Viewer link | Image | Found on |
| --- | --- | --- | --- |
| feratel | `https://webtv.feratel.com/webtv/?design=v5&pg=<partner GUID>&cam=<id>` | `https://wtvpict.feratel.com/picture/37/<id>.jpeg`, thumbnails `wtvthmb.feratel.com/thumbnails/<id>.jpeg` | Snow Card, Intermaps, SGM (`feratelID`) |
| Panomax | `https://<name>.panomax.com/<cam>` | `https://panodata.panomax.com/cams/<id>/preview_og.jpg` (also `live-image.panomax.com`) | Intermaps, Snow Card |
| PanoCloud | `https://<name>.panocloud.webcam/` | `…/panorama1.jpg` | Intermaps, Snow Card |
| Others | sjon.at, megacam.at, foto-webcam.eu, it-wms.com, resort sites | varies | Snow Card |

- Intermaps webcam POIs: `subtitle` contains `Webcam` (e.g. `Webcam (Panomax)`, `Webcams (Feratel)`,
  `Webcams (pictures)`); `popup.title` is the name, `popup.desc` the viewer link, `popup.thumbnail` an
  Intermaps resize proxy whose `link=` parameter is the live image.
- Images were current (Last-Modified within minutes for Panomax, hours for feratel).
- The `pg=` GUID `A2CA5813-2332-446C-A7E6-3A5480304592` is the partner id Snow Card and Intermaps embed
  with; a partner of our own would get its own.
- webtv.feratel.com answered 404 to a bare `Mozilla/5.0` user agent and 200 to a full browser one.

## Terms of use

- **Intermaps:** no terms of use published. The [imprint](https://intermaps.com/en/Imprint.html) is
  company details only, and the map page has an "© intermaps All Rights Reserved" HTML comment. The
  data endpoint sends `access-control-allow-origin: *`. The statuses are the resorts' own reports: the
  same footing as the counts the fetcher reads now. Publishing every lift is more of the database than
  totals (EU database right), still low risk; office@intermaps.com could confirm.
- **feratel:** the [imprint](https://www.feratel.com/en/imprint) forbids copying or using its content
  without express consent, so no hotlinked or stored images. It runs a free
  [online partner programme](https://www.feratel.com/en/feratel-online-partners) to embed its
  MediaPlayer v5 (about 300 partners, bergfex among them); apply at contentpartner@feratel.com.
  Embedding would need a Privacy page update (the player loads from feratel).
- **Panomax:** its [terms](https://www.panomax.com/en/terms-of-use) are a contract with camera owners
  only. [Content distribution](https://www.panomax.com/en/content-distribution): the embed code is for
  the owner's site, API access goes to partners the owner approves ("no extra license fees for
  approved use"). Viewer pages send no `X-Frame-Options`. Link freely; images or embeds need the resort's
  or Panomax's approval.
- **Resort sites and SGM:** not checked; like the Slovenian sites, read only the facts.

## Open questions

- SGM `status` codes beyond 1 and 2 (partly open, in preparation): check in season.
- Hochzillertal / Hochfügen: split by lift names, or merge into one resort?
- Shared Intermaps maps (`innsbruck`, `zugspitz_arena`, `hochoetz_kuehtai`, `kappl_see`): split by
  name lists, or only list lifts without per-resort counts?
- Which other Austrian resorts run SGM: search their sites for `SkigebieteManager`.
- The ~100 resorts from SalzburgerLand and Kärnten without a map: look for maps or SGM per resort.
