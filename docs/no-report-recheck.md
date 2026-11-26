# Re-checking the resorts without a report

Plan, 2026-11-15. Data: `json/index.json` from the `data` branch (run of 2026-11-15 13:42), sizes from the
site's own map outlines (`/ski/v1/resorts.geojson`, OpenSkiData lifts and slope km).

## What "no report" covers today

442 of the 742 resorts are `no_report`. They fall in three groups, and only the first two need research:

| Group | What it is | Resorts | ≥ 40 km | 15–40 km | 5–15 km | < 5 km |
|---|---|---|---|---|---|---|
| **A** | No live source found: listed from `countries/*/data/size_only_resorts.json` (DE 83, ES 12, PL 11, NO 8, SI 5, AT 4, SK 4, CZ 1) | 128 | 5 | 21 | 39 | 63 |
| **B** | A source is wired, but it gave nothing usable (empty pre-season bulletin, site refuses us, no size) | 28 | 5 | 10 | 9 | 4 |
| **C** | Source works, it is just pre-season (report > 14 days old) | 285 | 74 | 81 | 68 | 62 |

Not on the site at all, and worth the same treatment: France's Avoriaz, Val Cenis, Montgenèvre, Saint-Lary,
Font-Romeu, Ax 3 Domaines, Auron, Orcières, Chamrousse, Les Orres; Germany's St. Englmar, Mitterfirmiansreut,
Wasserkuppe, Erbeskopf, Hoherodskopf; Finland's Pyhä, Luosto, Olos, Pallas, Paljakka, Koli.

**Size** is the larger of the official slope km and the OSM km, so areas with no official figure (most of
Germany) still rank. Ties go by lift count.

## Order of work

Biggest first, in waves. Each wave is one sitting of research; the fetcher change for whatever it finds is a
separate commit per country.

1. **Wave 1, now (Nov 2026): A and B ≥ 15 km, plus the unlisted French resorts.** 26 + 15 resorts, and Avoriaz,
   Saint-Lary, Val Cenis and the other big French ones. These are the gaps a reader notices. Many already
   have leads in the fetcher's `docs/todo.md` (Aramón's `partes/parteNieve` for Cerler, Javalambre,
   Valdelinares; Masella's `estado-pistas`; Skimore for Vierli; the Garmisch/Oberstdorf/Feldberg list).
2. **Wave 2, early Dec: re-run B, and sweep C.** Most sites publish their first real report between late
   November and mid December. On 2026-12-15, list every group C resort still `no_report`, biggest first:
   an area that opened by then and still reads no report has a broken parser or a moved page, which is
   a fix, not research. Group B gets its second look in the same pass (Sierra Nevada's map, La Rosière,
   Heiligenblut, Madesimo, Diedamskopf…).
3. **Wave 3, Dec: A 5–15 km** (39 resorts, mostly Allgäu, Black Forest, Norwegian and Polish areas).
4. **Wave 4, Jan 2027: A < 5 km** (63 resorts). Research only where one operator page covers several
   areas (a lift association, a municipality running a few tows); for the rest, decide whether a
   single-tow area is worth listing at all.
5. **Final sweep, mid Jan 2027**, with everything in season: anything still empty in A or B gets its
   reason written down and its next check date.

## Checks for each resort

In this order, stopping at the first that gives a live lift or slope status:

1. **Is it on a platform the fetcher already reads?** Intermaps (`data/intermaps_maps.json`), Lumiplan,
   iSKI / Snow Card, Infosnow, Fnugg, ski.fi, Pirineu365. The cheapest win: one line of config.
2. **The operator's own site**: the lift/slope status page, its slope map, and the JSON it loads (browser
   network tab). Note the report time, if any, and whether it lists every lift and slope.
3. **Can we use it?** robots.txt and terms. Don't reconsider the sources already ruled out: Outdooractive,
   Snežni telefon, holidayinfo.cz, ATUDEM, skiresort.com's status (commercial or private-use only).
4. **Does it answer GitHub's servers?** A source that 403s there goes on the local-fetch list (the Raspberry
   Pi job), like Golte and Soriška planina, not into the main fetch.
5. **Size**: if it's missing, take lifts, slopes and km from the operator.

Record one of these outcomes in the "Result" column below:

- **source** — URL and platform; then implement it in the fetcher (per its CLAUDE.md checklist) and update
  `about.html` / `sources.html` and their translations here.
- **in season** — the page exists but is empty until the season; re-check date.
- **blocked** — refuses automated clients, login, robots, or terms; who to ask, if anyone.
- **none** — no status published anywhere usable; re-check next season.

Whatever the outcome, update the resort's entry in `size_only_resorts.json` (size, note) and the fetcher
README "To do", so the next check starts from what we found.

## Wave 1 results (2026-11-15)

Checked from a home connection (not GitHub's servers), pre-season. The 41 resorts of groups A and B
with at least 15 km, plus the unlisted French resorts. Each result is in the tables below.

**New sources, ready to implement (13 resorts):**

| Resort(s) | Source | What it gives |
|---|---|---|
| Feldberg | Intermaps `feldberg` (the operator links it as its own piste map) | 17 lifts, 16 slopes with state; `lastUpdate`. October's stale states are gone. Just add it to `intermaps_maps.json` |
| Ramsau am Dachstein | Intermaps `ramsau_dachstein` | Rittisberg lifts only (and the Dachstein glacier cable car, which belongs to the glacier resort), no slopes |
| Hauser Kaibling (and Reiteralm, Hochwurzen, not covered yet) | `schladming-dachstein.at/de/info-und-service/betriebszeiten-bergbahnen-winter/<area>_resort_<id>.md`, a Markdown export of the tourism board's "Anlagen" list | every lift with state, open/total; robots.txt allows it |
| Fellhorn-Kanzelwand, Nebelhorn, Söllereck (and Ifen, Walmendingerhorn, Heuberg in Kleinwalsertal) | `ok-bergbahnen.com/skigebiete/status-anlagen-pisten-wege/` | each lift and slope with `data-berg` (mountain), type and state icon (Tramino) |
| Garmisch-Classic | `zugspitze.de/anlagen` | live state of every lift on the Zugspitze, the Wank and Garmisch-Classic; check in winter that slopes are listed too |
| Balderschwang | `skigebiet-balderschwang.de/lifte/` | 11 lifts, state and hours ("Lifte (0/11)") |
| Valdesquí | `valdesqui.es/valdesqui-hoy/` | every lift and slope, open/closed icon, counts and km |
| Alto Campoo | `altocampoo.com/partes/parte-de-nieve-<dd-mm-yyyy>/` | update time, every slope with state, km by colour |
| Beskid Sport Arena | `beskidsportarena.pl/szczyrk-trasy-narciarskie/` | 4 slopes, Otwarta/Zamknięta |
| Jasná, Tatranská Lomnica, Szczyrk | TMR's `laravel.jasna.sk/api/<area>/{lanovky,snehove-zjazdovky}` | already planned (fetcher's `docs/todo.md`); all six tables answer |
| Montgenèvre (not listed yet) | `montgenevre.com/hiver/en-direct/infos-neige/` | Lumiplan's digisnow rendered into the page: update time, open/total slopes by colour for Montgenèvre and the Voie Lactée, each slope and lift |

**Waiting for the season (re-check mid December):** all 15 of group B except Baqueira. Their sources work
(Intermaps maps, iSKI, Lumiplan) and are just empty before the season. Also Cerler, Javalambre, Valdelinares
(Aramón's report page has an issue time and says "Estación cerrada"), Masella, Oberjoch (its `/status/`
page lists lifts and slopes), Cerkno, Todtnauberg (free text only), and Steibis and Hündle (huendle-imberg.de
shows only the main gondola's state).

**Blocked or nothing found:** Baqueira (refuses us), Astún-Candanchú (login in the site script: your call),
San Isidro, Vierli, Kranzegg (sites don't answer), Kotelnica (still nothing).

**France, unlisted:** none of them is on Lumiplan yet. Montgenèvre is above. Orcières and Chamrousse still
use only the MQTT digisnow widget. Val Cenis answers 403, and Saint-Lary, Ax 3 Domaines, Auron and Les Orres
show nothing new: re-check in December.

### Two leads that unlock more than one resort

- **Shared Intermaps maps.** Some Intermaps maps cover several of our resorts in one list, with no area per
  item and positions from a drawing, not the ground. Two examples, each its own region: the
  Oberstdorf-Kleinwalsertal map (Fellhorn, Nebelhorn, Söllereck, Ifen, …) and the Portes du Soleil map
  (Avoriaz, Morzine, Châtel, Champéry, …). Oberstdorf didn't need it: its operator's status page names
  the mountain of every item. For Avoriaz the map's names are now matched to OpenSkiData's Avoriaz
  lifts and runs (see below).
- **Toubiz (Black Forest).** feldberg-erlebnis.de reads live ski-area data from
  `mein.toubiz.de/api/v2/public/skiArea/<id>` with a bearer key embedded in its script. Hochschwarzwald
  Tourismus runs Toubiz for the region, so it may cover many of the small Black Forest areas. Using the
  embedded key is your call, as with Astún; better to ask Toubiz or Hochschwarzwald for access
  (hochschwarzwald.de answered 403 here).

## Implemented (2026-11-15, liftradar-fetcher, not committed yet)

All read live, tested against pages saved on 15.11.2026 (before the season: everything closed). Each
parser's open state is from the page's legend or code, not seen yet: the fetcher's `docs/todo.md` lists
what to check in December.

| Resort(s) | Source as built | Notes |
|---|---|---|
| Hauser Kaibling, Ramsau am Dachstein | Schladming-Dachstein's area pages (HTML; the `.md` export has counts only) | Ramsau's type icons are wrong, so names decide |
| Feldberg | Intermaps `feldberg` | 17 lifts, 16 slopes, 24 km |
| Garmisch-Classic | Intermaps `zugspitzbahn_garmisch` (found while checking; zugspitze.de/anlagen lists only summer lifts now) | its 19 lifts include the rack railway and the Wankbahn |
| Fellhorn - Kanzelwand, Nebelhorn, Söllereck | OK Bergbahnen's status page, by `data-berg` | slope lengths give the km |
| Balderschwang | its lift and slope pages | 11 lifts, 35 slopes |
| Valdesquí, Alto Campoo | their own pages | Alto Campoo has a report time |
| Jasná, Tatranská Lomnica, Štrbské Pleso, Starý Smokovec, Szczyrk | TMR's tables | lift tables used only while a slope is open (summer lifts otherwise) |
| Beskid Sport Arena | its lift and slope tables | lift column read "Otwarty" for all lifts in November |
| Montgenèvre (new) | its Infos Neige page (digisnow in the HTML) | 49 of its 78 slopes listed there |
| Avoriaz (new) | its part of the Portes du Soleil map, `data/intermaps_splits.json` from `scripts/intermaps_splits.py` | 29 of 35 lifts, 34 of 56 slopes; names shared with Les Gets-Morzine left out |

Still to do for these: commit both repos; after the next ski-tiles build, check Avoriaz's and Montgenèvre's
outlines on the map (Avoriaz's lifts are given to Champéry today) and update the "731 of the 742" count.

## Ranked lists

### Group A: no source found (size-only lists)

| # | Tier | Resort | Country | Official km | Lifts | OSM km | OSM lifts | Checked | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | L | Astún-Candanchú (`es/astun-candanchu`) | ES | 101 | 40 | 67.7 | 41 | 2026-11-15 | blocked: feed needs the login in its site script (owner's call, README Spain) |
| 2 | L | Cerler (`es/cerler`) | ES | 81 | 19 | 61.9 | 22 | 2026-11-15 | in season: Aramón `partes/parteNieve` has an issue time, empty while closed |
| 3 | L | Masella (`es/masella`) | ES | 74 | 17 | 51.7 | 18 | 2026-11-15 | in season: `estado-pistas` empty pre-season |
| 4 | L | Ramsau am Dachstein (`at/ramsau-am-dachstein`) | AT | 13 | 8 | 63.8 | 31 | 2026-11-15 | **source**: Intermaps `ramsau_dachstein` (Rittisberg lifts, no slopes) or Schladming-Dachstein `.md` |
| 5 | L | Jasná Nízke Tatry (`sk/jasna`) | SK | 51 | 20 | 46.4 | 27 | 2026-11-15 | **source**: TMR tables answer; implement in Dec (README To do) |
| 6 | M | Garmisch-Classic (`de/garmisch-classic`) | DE | – | – | 37.8 | 20 | 2026-11-15 | **source**: `zugspitze.de/anlagen` (every lift, state) |
| 7 | M | Hauser Kaibling (`at/hauser-kaibling`) | AT | 37 | 11 | 28.8 | 13 | 2026-11-15 | **source**: `schladming-dachstein.at/…/hauser-kaibling_resort_6323.md` (17 lifts, state) |
| 8 | M | Fellhorn - Kanzelwand (`de/fellhorn-kanzelwand`) | DE | – | – | 36.4 | 12 | 2026-11-15 | **source**: OK Bergbahnen `status-anlagen-pisten-wege` (per mountain) |
| 9 | M | Szczyrk Mountain Resort (with COS Skrzyczne) (`pl/szczyrk-mountain-resort`) | PL | 32 | – | 11.7 | 10 | 2026-11-15 | **source**: TMR `szczyrkowski` tables |
| 10 | M | Balderschwang (`de/balderschwang`) | DE | – | – | 25.9 | 11 | 2026-11-15 | **source**: `skigebiet-balderschwang.de/lifte/` (11 lifts, state) |
| 11 | M | Vierli - Rauland (`no/vierli`) | NO | 9 | 5 | 25.3 | 16 | 2026-11-15 | none: visitrauland.com/vierli has no status |
| 12 | M | Alto Campoo (`es/alto-campoo`) | ES | 24 | 10 | 19.5 | 12 | 2026-11-15 | **source**: dated `partes/parte-de-nieve-<date>` (time, every slope) |
| 13 | M | San Isidro (`es/san-isidro`) | ES | – | – | 23.6 | 16 | 2026-11-15 | none: sanisidro.es has no report page; old domain down |
| 14 | M | Feldberg (`de/feldberg`) | DE | – | – | 22.2 | 20 | 2026-11-15 | **source**: Intermaps `feldberg` (17 lifts, 16 slopes; the operator's own map) |
| 15 | M | Valdesquí (`es/valdesqui`) | ES | 22 | 15 | 20.5 | 15 | 2026-11-15 | **source**: `valdesqui.es/valdesqui-hoy/` (every lift and slope, open/closed icon) |
| 16 | M | Bad Hindelang - Oberjoch (`de/oberjoch`) | DE | – | – | 21.9 | 5 | 2026-11-15 | in season: `/status/` lists lifts and slopes; closed for maintenance now |
| 17 | M | Steibis (Imberger Horn) (`de/steibis`) | DE | – | – | 20.4 | 15 | 2026-11-15 | partial: huendle-imberg.de shows the gondola only; check piste plan in season |
| 18 | M | Beskid Sport Arena (Szczyrk) (`pl/beskid-sport-arena`) | PL | 4 | 3 | 20.0 | 13 | 2026-11-15 | **source**: `szczyrk-trasy-narciarskie` table (Otwarta/Zamknięta per slope) |
| 19 | M | Kranzegg (Adelharz- und Breitensteinlifte) (`de/kranzegg`) | DE | – | – | 19.3 | 12 | 2026-11-15 | none: operator sites don't answer; re-check Dec |
| 20 | M | Kotelnica Białczańska (Białka Tatrzańska) (`pl/kotelnica-bialczanska`) | PL | 14 | 10 | 18.7 | 23 | 2026-11-15 | none: still nothing on bialkatatrzanska.pl (kotelnica.pl is unrelated) |
| 21 | M | Cerkno (`si/cerkno`) | SI | 18 | 7 | 9.3 | 8 | 2026-11-15 | in season: "Stanje na smučišču" block on hotel-cerkno.com/sl/smucisce |
| 22 | M | Hündle - Thalkirchdorf (`de/huendle-thalkirchdorf`) | DE | – | – | 17.6 | 8 | 2026-11-15 | partial: gondola state only (huendle-imberg.de) |
| 23 | M | Valdelinares (`es/valdelinares`) | ES | 17 | 10 | 9.4 | 12 | 2026-11-15 | in season: Aramón `parteNieve`, as Cerler |
| 24 | M | Todtnauberg (`de/todtnauberg`) | DE | – | – | 16.7 | 6 | 2026-11-15 | in season: free-text Schneebericht on skilifte-todtnauberg.de |
| 25 | M | Tatranská Lomnica (`sk/tatranska-lomnica`) | SK | 15 | 10 | 12.7 | 11 | 2026-11-15 | **source**: TMR `vt` tables |
| 26 | M | Javalambre (`es/javalambre`) | ES | 15 | 9 | 8.4 | 9 | 2026-11-15 | in season: Aramón `parteNieve`, as Cerler |
| 27 | S | Münstertal - Wieden (`de/muenstertal-wieden`) | DE | – | – | 14.8 | 6 | | |
| 28 | S | Sierra de Béjar - La Covatilla (`es/la-covatilla`) | ES | – | – | 14.7 | 4 | | |
| 29 | S | Pilsko (Korbielów) (`pl/pilsko`) | PL | 13 | 7 | 11.9 | 15 | | |
| 30 | S | Wurmberg - Braunlage (`de/wurmberg-braunlage`) | DE | – | – | 12.5 | 6 | | |
| 31 | S | Rogla (`si/rogla`) | SI | 12 | 12 | 12.5 | 13 | | |
| 32 | S | Czarna Góra (Sienna) (`pl/czarna-gora`) | PL | 12 | 9 | 9.7 | 13 | | |
| 33 | S | Kope (`si/kope`) | SI | 12 | 7 | 7.7 | 7 | | |
| 34 | S | Haldenköpfle - Notschrei (`de/notschrei`) | DE | – | – | 11.9 | 12 | | |
| 35 | S | Nebelhorn (`de/nebelhorn`) | DE | – | – | 11.6 | 7 | | |
| 36 | S | Söllereck (`de/soellereck`) | DE | – | – | 11.4 | 11 | | |
| 37 | S | Oslo - Tryvann (Skimore) (`no/tryvann`) | NO | 10 | 8 | 11.4 | 11 | | |
| 38 | S | Ski Arena Szrenica (Szklarska Poręba) (`pl/szklarska-poreba-szrenica`) | PL | 11 | 8 | 10.2 | 8 | | |
| 39 | S | Kongsberg (Skimore) (`no/skimore-kongsberg`) | NO | 9 | 6 | 9.7 | 9 | | |
| 40 | S | Rossfeld (`de/rossfeld`) | DE | – | – | 9.6 | 4 | | |
| 41 | S | Füssener Jöchle - Grän (`at/fuessener-joechle-graen`) | AT | 9 | 4 | 9.4 | 5 | | |
| 42 | S | Grasgehren - Obermaiselstein (`de/grasgehren`) | DE | – | – | 9.3 | 4 | | |
| 43 | S | Leitariegos (`es/leitariegos`) | ES | 9 | 8 | 6.6 | 6 | | |
| 44 | S | Wendelstein (`de/wendelstein`) | DE | – | – | 8.8 | 52 | | |
| 45 | S | Karpacz Ski Arena (`pl/karpacz`) | PL | 6 | 9 | 8.5 | 12 | | |
| 46 | S | Kreuzberg - Bischofsheim (`de/kreuzberg-bischofsheim`) | DE | – | – | 8.3 | 3 | | |
| 47 | S | Geißkopf (`de/geisskopf`) | DE | – | – | 8.2 | 8 | | |
| 48 | S | Słotwiny Arena (Krynica-Zdrój) (`pl/slotwiny-arena`) | PL | 8 | 3 | 6.6 | 4 | | |
| 49 | S | Štrbské Pleso (`sk/strbske-pleso`) | SK | 8 | 8 | 7.2 | 7 | | |
| 50 | S | Ribniško Pohorje (`si/ribnisko-pohorje`) | SI | 3 | 3 | 7.8 | 4 | | |
| 51 | S | Alpspitze Nesselwang (`de/alpspitze-nesselwang`) | DE | – | – | 7.5 | 7 | | |
| 52 | S | Götschen (`de/goetschen`) | DE | – | – | 7.5 | 3 | | |
| 53 | S | St. Blasien - Menzenschwand (`de/menzenschwand`) | DE | – | – | 7.4 | 3 | | |
| 54 | S | Unterjoch (Spieserlifte) (`de/unterjoch`) | DE | – | – | 7.1 | 4 | | |
| 55 | S | Muggenbrunn (`de/muggenbrunn`) | DE | – | – | 7.0 | 7 | | |
| 56 | S | Puerto de Navacerrada (`es/puerto-navacerrada`) | ES | 7 | 6 | 0.8 | 7 | | |
| 57 | S | Silbersattel Steinach (`de/silbersattel-steinach`) | DE | – | – | 6.3 | 4 | | |
| 58 | S | Kranzberg - Mittenwald (`de/kranzberg-mittenwald`) | DE | – | – | 6.2 | 9 | | |
| 59 | S | Haglebu (`no/haglebu`) | NO | 6 | 3 | 4.6 | 3 | | |
| 60 | S | Wertach (Buron-Skilifte) (`de/wertach`) | DE | – | – | 5.6 | 10 | | |
| 61 | S | Birkenlift & Geigenbühel - Seefeld (`at/birkenlift-geigenbuehel-seefeld`) | AT | 5 | 3 | 2.6 | 9 | | |
| 62 | S | Grapa - Litwinka (Czarna Góra) (`pl/grapa-czarna-gora`) | PL | 5 | 4 | 2.5 | 4 | | |
| 63 | S | Hörnle - Bad Kohlgrub (`de/hoernle-bad-kohlgrub`) | DE | – | – | 5.0 | 3 | | |
| 64 | S | Tegelberg (`de/tegelberg`) | DE | – | – | 5.0 | 7 | | |
| 65 | S | Savalen (`no/savalen`) | NO | 5 | 3 | – | – | | |
| 66 | XS | Ochsenkopf (`de/ochsenkopf`) | DE | – | – | 4.8 | 7 | | |
| 67 | XS | St. Andreasberg (Matthias-Schmidt-Berg) (`de/st-andreasberg`) | DE | – | – | 4.8 | 3 | | |
| 68 | XS | Holzhau (`de/holzhau`) | DE | – | – | 4.6 | 4 | | |
| 69 | XS | Hinterzarten (Skizentrum Thoma) (`de/hinterzarten`) | DE | – | – | 4.6 | 3 | | |
| 70 | XS | Breitenberg - Pfronten (`de/breitenberg-pfronten`) | DE | – | – | 4.4 | 12 | | |
| 71 | XS | Unterstmatt (`de/unterstmatt`) | DE | – | – | 4.3 | 5 | | |
| 72 | XS | Tavascán (`es/tavascan`) | ES | – | – | 4.2 | 3 | | |
| 73 | XS | Isny im Allgäu (`de/isny`) | DE | – | – | 4.1 | 5 | | |
| 74 | XS | Enzklösterle (Hirschkopflifte) (`de/enzkloesterle`) | DE | – | – | 4.1 | 2 | | |
| 75 | XS | Drammen (Skimore) (`no/skimore-drammen`) | NO | 4 | 3 | 3.1 | 4 | | |
| 76 | XS | Jáchymov (`cz/jachymov`) | CZ | – | – | 3.9 | 4 | | |
| 77 | XS | Sonnenberg (St. Andreasberg) (`de/sonnenberg`) | DE | – | – | 3.8 | 4 | | |
| 78 | XS | Bernau (`de/bernau`) | DE | – | – | 3.8 | 4 | | |
| 79 | XS | Hahnenklee (Bocksberg) (`de/hahnenklee-bocksberg`) | DE | – | – | 3.7 | 4 | | |
| 80 | XS | Grefsenkollen - Oslo (`no/grefsenkollen`) | NO | 3 | 4 | 3.2 | 4 | | |
| 81 | XS | Starý Smokovec (`sk/stary-smokovec`) | SK | 2 | 3 | 3.1 | 9 | | |
| 82 | XS | Słotwiny (Krynica-Zdrój) (`pl/slotwiny`) | PL | 3 | 4 | 1.8 | 4 | | |
| 83 | XS | Waltersdorf (`de/waltersdorf`) | DE | – | – | 3.0 | 5 | | |
| 84 | XS | Sunnfjord - Blomlia (`no/blomlia`) | NO | 3 | 3 | – | 3 | | |
| 85 | XS | Velika planina (`si/velika-planina`) | SI | 3 | 4 | 2.8 | 8 | | |
| 86 | XS | Hundseck (`de/hundseck`) | DE | – | – | 2.9 | 3 | | |
| 87 | XS | Eschach (`de/eschach`) | DE | – | – | 2.8 | 13 | | |
| 88 | XS | Obersalzberg (Gutshof) (`de/obersalzberg`) | DE | – | – | 2.8 | 5 | | |
| 89 | XS | Oberwilhams (`de/oberwilhams`) | DE | – | – | 2.7 | 3 | | |
| 90 | XS | Bad Sachsa (Ravensberg) (`de/bad-sachsa`) | DE | – | – | 2.7 | 3 | | |
| 91 | XS | Waldau (Schneeberglifte) (`de/waldau`) | DE | – | – | 2.6 | 4 | | |
| 92 | XS | Schöneck (Skiwelt) (`de/schoeneck`) | DE | – | – | 2.6 | 5 | | |
| 93 | XS | Rehefeld-Zaunhaus (`de/rehefeld-zaunhaus`) | DE | – | – | 2.5 | 2 | | |
| 94 | XS | Herrischried (`de/herrischried`) | DE | – | – | 2.4 | 2 | | |
| 95 | XS | Mehliskopf (`de/mehliskopf`) | DE | – | – | 2.3 | 5 | | |
| 96 | XS | Erlbach - Kegelberg (`de/erlbach-kegelberg`) | DE | – | – | 2.3 | 3 | | |
| 97 | XS | Altenberg (`de/altenberg`) | DE | – | – | 2.2 | 6 | | |
| 98 | XS | Hirschberglifte Kreuth (`de/hirschberg-kreuth`) | DE | – | – | 2.1 | 4 | | |
| 99 | XS | Nosal (Zakopane) (`pl/nosal`) | PL | 2 | 6 | 1.2 | 6 | | |
| 100 | XS | Weiler-Simmerberg (`de/weiler-simmerberg`) | DE | – | – | 2.0 | 2 | | |
| 101 | XS | Schulenberg (Ski-Alpinum) (`de/schulenberg`) | DE | – | – | 2.0 | 2 | | |
| 102 | XS | Scheidegg - Luggi-Leitner-Lift (`de/scheidegg`) | DE | – | – | 1.6 | 2 | | |
| 103 | XS | Ruhestein (`de/ruhestein`) | DE | – | – | 1.4 | 3 | | |
| 104 | XS | Sinswang (`de/sinswang`) | DE | – | – | 1.2 | 4 | | |
| 105 | XS | Jenner (`de/jenner`) | DE | – | – | 1.1 | 3 | | |
| 106 | XS | Lenzkirch-Saig (`de/saig`) | DE | – | – | 1.1 | 1 | | |
| 107 | XS | Heubach (`de/heubach`) | DE | – | – | 1.1 | 3 | | |
| 108 | XS | Stinesser - Fischen (`de/stinesser-fischen`) | DE | – | – | 1.0 | 2 | | |
| 109 | XS | Fischbach - Schluchsee (`de/fischbach-schluchsee`) | DE | – | – | 1.0 | 2 | | |
| 110 | XS | Oedberg - Gmund (`de/oedberg`) | DE | – | – | 0.9 | 3 | | |
| 111 | XS | Ersteberg (`de/ersteberg`) | DE | – | – | 0.9 | 1 | | |
| 112 | XS | Mehlmeisel (Klausenlift) (`de/mehlmeisel`) | DE | – | – | 0.8 | 5 | | |
| 113 | XS | Altenau (Auf der Rose) (`de/altenau`) | DE | – | – | 0.8 | 2 | | |
| 114 | XS | Kaltenbronn (`de/kaltenbronn`) | DE | – | – | 0.8 | 2 | | |
| 115 | XS | Braunlage - Skiwiese am Rathaus (`de/braunlage-skiwiese`) | DE | – | – | 0.7 | 2 | | |
| 116 | XS | Eisenbach (Bad Lifte) (`de/eisenbach`) | DE | – | – | 0.7 | 2 | | |
| 117 | XS | Seimberg (`de/seimberg`) | DE | – | – | 0.7 | 1 | | |
| 118 | XS | Sebnitz (`de/sebnitz`) | DE | – | – | 0.6 | 3 | | |
| 119 | XS | Kolbensattel - Oberammergau (`de/kolbensattel`) | DE | – | – | 0.5 | 10 | | |
| 120 | XS | Kirchberglifte Kreuth (`de/kirchberg-kreuth`) | DE | – | – | 0.3 | 1 | | |
| 121 | XS | Thalerhöhe (`de/thalerhoehe`) | DE | – | – | – | – | | |
| 122 | XS | Augustusburg (Rosts Wiesen) (`de/augustusburg`) | DE | – | – | – | 11 | | |
| 123 | XS | Eibenstock (`de/eibenstock`) | DE | – | – | – | 3 | | |
| 124 | XS | Jöhstadt (Am Gründelwald) (`de/joehstadt`) | DE | – | – | – | – | | |
| 125 | XS | Homberg - Ziegenhelle (`de/homberg-ziegenhelle`) | DE | – | – | – | – | | |
| 126 | XS | Breitnau (Wirbsteinlift) (`de/breitnau-wirbstein`) | DE | – | – | – | – | | |
| 127 | XS | Döllberg (`de/doellberg`) | DE | – | – | – | 1 | | |
| 128 | XS | Klingenthal (`de/klingenthal`) | DE | – | – | – | 1 | | |

### Group B: source known, but it published nothing usable yet

| # | Tier | Resort | Country | Official km | Lifts | OSM km | OSM lifts | Checked | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | L | Baqueira Beret (`es/baqueira-beret`) | ES | 175 | 36 | 154.6 | 36 | 2026-11-15 | blocked: refuses non-browser clients (ask Baqueira) |
| 2 | L | Sierra Nevada (`es/sierra-nevada`) | ES | 112 | 24 | 105.4 | 22 | 2026-11-15 | in season: Intermaps map, all `unknown` pre-season |
| 3 | L | La Rosière (`fr/la-rosiere`) | FR | – | – | 58.9 | 25 | 2026-11-15 | in season: Lumiplan bulletin lists nothing yet |
| 4 | L | Heiligenblut (`at/heiligenblut`) | AT | 55 | – | 24.2 | 14 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 5 | L | Madesimo (`it/madesimo`) | IT | 40 | – | 35.3 | 15 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 6 | M | Innerkrems (`at/innerkrems`) | AT | 36 | – | 23.0 | 9 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 7 | M | Diedamskopf (`at/diedamskopf`) | AT | – | – | 34.9 | 10 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 8 | M | Queyras (`fr/queyras`) | FR | – | – | 33.7 | 18 | 2026-11-15 | in season: Lumiplan bulletin lists nothing yet |
| 9 | M | Hochalmlifte Christlum - Achenkirch (`at/hochalmlifte-christlum-achenkirch`) | AT | 27 | 10 | 15.1 | 9 | 2026-11-15 | in season: iSKI report, pre-season |
| 10 | M | Zoncolan (`it/zoncolan`) | IT | – | – | 26.3 | 17 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 11 | M | Hochkar (`at/hochkar`) | AT | – | – | 18.8 | 9 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 12 | M | Koralpe (`at/koralpe`) | AT | 18 | 6 | 12.5 | 5 | 2026-11-15 | in season: iSKI report, pre-season |
| 13 | M | Muttereralm (`at/muttereralm`) | AT | 17 | 5 | 4.3 | 1 | 2026-11-15 | in season: iSKI report, pre-season |
| 14 | M | Petzen (`at/petzen`) | AT | 17 | – | 10.6 | 5 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 15 | M | Sappada (`it/sappada`) | IT | – | – | 15.0 | 13 | 2026-11-15 | in season: Intermaps map, empty pre-season |
| 16 | S | Piancavallo (`it/piancavallo`) | IT | – | – | 14.9 | 16 | | |
| 17 | S | Forni di Sopra (`it/forni-di-sopra`) | IT | – | – | 13.3 | 10 | | |
| 18 | S | Nesselwängle im Tannheimer Tal (`at/nesselwaengle-im-tannheimer-tal`) | AT | 13 | 5 | – | 4 | | |
| 19 | S | Ankogel - Mallnitz (`at/ankogel-mallnitz`) | AT | 13 | 6 | 11.8 | 6 | | |
| 20 | S | Annaberg (Niederösterreich) (`at/annaberg-niederoesterreich`) | AT | 13 | – | 9.7 | 8 | | |
| 21 | S | Golte (`si/golte`) | SI | 12 | – | 9.9 | 6 | | |
| 22 | S | Rofanseilbahn - Maurach (`at/rofanseilbahn-maurach`) | AT | 11 | 4 | 7.4 | 3 | | |
| 23 | S | Großer Arber (`de/arber`) | DE | – | – | 11.0 | 10 | | |
| 24 | S | Sella Nevea (`it/sella-nevea`) | IT | – | – | 10.1 | 10 | | |
| 25 | XS | Katzenkopf Leutasch (`at/katzenkopf-leutasch`) | AT | 4 | 3 | 0.9 | 2 | | |
| 26 | XS | Niederthai (`at/niederthai`) | AT | 4 | 4 | 1.1 | 1 | | |
| 27 | XS | Tirolina Thiersee (`at/tirolina-thiersee`) | AT | 4 | 2 | 3.3 | 2 | | |
| 28 | XS | Brixlegg (`at/brixlegg`) | AT | – | – | 3.9 | 5 | | |

### Group C: sourced, waiting for the season (285 resorts, biggest 30)

| # | Resort | Country | km |
|---|---|---|---|
| 1 | Serre Chevalier (`fr/serre-chevalier`) | FR | 250 |
| 2 | Alpe d'Huez (`fr/alpe-d-huez`) | FR | 250 |
| 3 | La Plagne (`fr/la-plagne`) | FR | 225 |
| 4 | Les 2 Alpes (`fr/les-2-alpes`) | FR | 220 |
| 5 | Les Arcs (`fr/les-arcs`) | FR | 208.1 |
| 6 | Chamonix Mont-Blanc (`fr/chamonix`) | FR | 169 |
| 7 | Les Menuires (`fr/les-menuires`) | FR | 160 |
| 8 | Val d'Isère (`fr/val-d-isere`) | FR | 152 |
| 9 | Courchevel (`fr/courchevel`) | FR | 150 |
| 10 | Méribel (`fr/meribel`) | FR | 150 |
| 11 | Val Thorens (`fr/val-thorens`) | FR | 150 |
| 12 | Tignes (`fr/tignes`) | FR | 150 |
| 13 | Flaine (`fr/flaine`) | FR | 146 |
| 14 | Megève (`fr/megeve`) | FR | 141.0 |
| 15 | Morzine (`fr/morzine`) | FR | 132 |
| 16 | Villard-de-Lans - Corrençon (`fr/villard-de-lans`) | FR | 125 |
| 17 | Val d'Allos (`fr/val-d-allos`) | FR | 120.7 |
| 18 | Saint-Sorlin-d'Arves (`fr/saint-sorlin-d-arves`) | FR | 120 |
| 19 | Isola 2000 (`fr/isola-2000`) | FR | 120 |
| 20 | Les Gets (`fr/les-gets`) | FR | 117 |
| 21 | Châtel (`fr/chatel`) | FR | 117 |
| 22 | Livigno (`it/livigno`) | IT | 115 |
| 23 | Ski Juwel Alpbachtal Wildschönau (`at/ski-juwel`) | AT | 114 |
| 24 | Les Portes du Mont-Blanc (`fr/portes-du-mont-blanc`) | FR | 111.9 |
| 25 | Les Saisies (`fr/les-saisies`) | FR | 105.1 |
| 26 | Vars (`fr/vars`) | FR | 100 |
| 27 | SuperDévoluy (`fr/superdevoluy`) | FR | 100 |
| 28 | Grand Tourmalet (`fr/grand-tourmalet`) | FR | 100 |
| 29 | Valmorel (`fr/valmorel`) | FR | 95 |
| 30 | Le Corbier (`fr/le-corbier`) | FR | 90 |
