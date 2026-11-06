# Plan: ośrodki i wyciągi z OpenSkiData w liftradar i TrailRiderze

Ten sam plik leży w obu repozytoriach: `liftradar/docs/ski-data-plan.md` i
`trailrider/docs/ski-data-plan.md`.

**Cel:** TrailRider rozpoznaje w GPX, którymi wyciągami jechał użytkownik (i jakiego typu były),
oraz nazwę ośrodka, a jeśli ośrodek jest w liftradar, to nazwę i link z liftradar.eu. Dane
pochodzą z OpenSkiData, a liftradar.eu tnie je raz w tygodniu na statyczne kafelki.

## Dane wejściowe (stan z 6 listopada 2026)

- Pliki: `https://tiles.openskimap.org/geojson/lifts.geojson` (119 MB) i `ski_areas.geojson`
  (21 MB). Strona projektu to <https://openskidata.org>, a typy pól są w paczce npm
  `openskidata-format`.
- Zasady: automatyczne pobieranie najwyżej raz dziennie. Kafelków wektorowych z
  `tiles.openskimap.org` nie wolno używać bezpośrednio. Format nie jest stabilny, więc pola mogą
  się zmieniać.
- Licencja: ODbL. Atrybucja: *„Data from OpenSkiData / OpenSkiMap.org, © OpenStreetMap
  contributors (ODbL), Skimap.org, Who's On First, © Mapterhorn”*.
- Identyfikatory obiektów OpenSkiData zmieniają się przy każdej codziennej przebudowie. Do
  łączenia używamy identyfikatorów OSM (`sources[].id`, np. `way/123`) albo Wikidata.
- **33 379 wyciągów** i **12 404 ośrodki**. 9 238 ośrodków to tylko punkty bez obrysu, a 6 129
  wyciągów nie ma przypisanego ośrodka (pole `skiAreas` jest puste).
- `liftType` (po polsku w nawiasach):
  - `chair_lift` 9564 (krzesełka)
  - `platter` 4696 (talerzyki)
  - `drag_lift` 4322 (orczyki)
  - `magic_carpet` 3403 (taśmy)
  - `t-bar` 3026 (orczyki dwuosobowe)
  - `funicular` 2553 (koleje linowo-terenowe)
  - `gondola` 2185
  - `rope_tow` 1911 (wyciągi linowe)
  - `cable_car` 1168 (kolejki wahadłowe)
  - `railway` 222, `j-bar` 220, `mixed_lift` 109
- Statusy wyciągów: `operating` 31 015, `abandoned` 1 044, `disused` 923, `proposed` 345,
  `construction` 40, `planned` 12.
- Kafelki z10 (około 25–40 km): **4 665 kafelków z wyciągami**, mediana 2 wyciągi na kafelek,
  95% kafelków ma do 29, najwięcej 252. Dla porównania z9 daje 3 079 kafelków, a z11 6 615.
- Łączenie z liftradar: z 553 obrysów w `liftradar/assets/areas.geojson` 376 łączy się z
  ośrodkiem OpenSkiData po samym identyfikatorze OSM (52 z nich z więcej niż jednym). 647 z 731
  ośrodków liftradar ma ośrodek OpenSkiData w promieniu 3 km.

---

## Plan A: liftradar, czyli kafelki z danymi narciarskimi

**Gdzie:** repozytorium `liftradar` (strona, gałąź `main`), bo tam są już `assets/areas.geojson`
i skrypty OSM. `liftradar-fetcher` zostaje bez zmian.

### A1. Skrypt `scripts/ski_tiles.py`

Wejście: `ski_areas.geojson`, `lifts.geojson`, `../liftradar-data/json/index.json` i
`assets/areas.geojson`. Wyjście: katalog `ski/`.

1. **Filtr wyciągów:** odrzucamy statusy `proposed`, `planned` i `construction`. Zostawiamy
   `disused` i `abandoned`, bo stary GPX mógł jechać wyciągiem, którego już nie ma.
2. **Uproszczenie linii** algorytmem Douglasa–Peuckera z tolerancją około 5 m. Współrzędne
   zaokrąglamy do 5 miejsc po przecinku (około 1 m), wysokość do pełnego metra. Zostawiamy tylko
   pola: typ, nazwa, `ref`, status, identyfikator OSM i ośrodek.
3. **Przypisanie wyciągu do ośrodka liftradar (`lr`)**, w tej kolejności:
   1. środek wyciągu leży w obrysie z `areas.geojson`, który już rozdziela obszary dzielone przez
      kilka ośrodków,
   2. ośrodek wyciągu w OpenSkiData ma identyfikator OSM z listy `osm` któregoś ośrodka
      liftradar,
   3. ośrodek liftradar, który po krokach 1–2 nie ma żadnego wyciągu (bez obrysu albo z obrysem,
      który ich nie obejmuje): najbliższy wyciąg do jego `location` (do 3 km) i pozostałe wyciągi
      najmniejszego ośrodka OpenSkiData tego wyciągu w promieniu 4 km; najbliższe ośrodki pierwsze.
      *(Zmienione w implementacji, patrz „Wynik pierwszego uruchomienia”.)*
4. **Ośrodki w kafelku:** każdy ośrodek OpenSkiData, którego wyciągi lub obrys dotykają kafelka,
   także ośrodki będące tylko punktem (na potrzeby nazwy awaryjnej). Dla każdego zapisujemy nazwę
   z OpenSkiData oraz, jeśli jest połączenie, `lr` i **nazwę z liftradar** (z `json/index.json`).
5. **Kafelkowanie z10** w schemacie XYZ (tym samym co kafelki terenu). Wyciąg trafia do każdego
   kafelka, którego dotyka, a puste kafelki pomijamy.
6. **Kontrola jakości:** jeśli liczba wyciągów lub ośrodków spadnie o ponad 15% względem
   poprzedniej wersji, albo zabraknie oczekiwanych pól, skrypt kończy się błędem i zostaje
   poprzednia wersja.

### A2. Format: `ski/v1/10/{x}/{y}.json`

```json
{
  "v": 1,
  "areas": [
    { "name": "Hintertuxer Gletscher",
      "lr": { "id": "at/hintertux", "name": "Hintertux" },
      "osm": "way/123", "wd": "Q…",
      "p": [11.68, 47.08], "outline": [[[11.6, 47.0], …]] }
  ],
  "lifts": [
    { "type": "gondola", "name": "Gletscherbus 1", "ref": "1",
      "status": "operating", "osm": "way/456",
      "areas": [0], "lr": "at/hintertux",
      "c": [[11.6812, 47.0901, 1495], [11.6655, 47.0790, 2100]] }
  ]
}
```

(Wartości w przykładzie są poglądowe.)

- `lifts[].areas` to indeksy w `areas` tego samego kafelka (lista, bo 2 109 wyciągów należy do
  kilku ośrodków OpenSkiData naraz). `areas[].p` to punkt ośrodka, a `outline` jego uproszczony
  (25 m) obrys, potrzebne do nazwy awaryjnej w B4.3.
- `lifts[].lr` to identyfikator ośrodka liftradar w postaci `<country>/<id>`, a nie `areas[].lr`,
  bo obszar dzielony przez kilka ośrodków liftradar rozdziela się na poziomie wyciągów.
- `ski/v1/meta.json` zawiera czas budowy, znacznik czasu danych OSM, zoom, liczby obiektów i
  atrybucję. Aplikacja dokleja z niego `?b=<build>`, żeby nie dostawać starych plików z cache.
- Schemat: `scripts/ski-tile.schema.json`, publikowany jako `ski/v1/tile.schema.json` (katalog
  `schema/` pochodzi z gałęzi `data`).

### A3. Aktualizacja raz w tygodniu

- Nowy workflow `.github/workflows/ski.yml` z cronem raz w tygodniu, np. w poniedziałek o 03:00 UTC
  (OpenSkiData buduje się około 01:00 UTC, pliki z 6 listopada mają `Last-Modified` 00:59 UTC), plus
  `workflow_dispatch` i uruchomienie po zmianie `assets/areas.geojson` na `main`. Codziennie nie ma
  sensu (uzasadnienie w „Uwagach do planu A”). Pobiera dane, uruchamia skrypt, pakuje `ski/` do jednego archiwum
  `tar.gz` i publikuje je jako zasób stałego wydania GitHub `ski-latest`. Na koniec uruchamia
  `pages.yml`.
- `pages.yml` przy każdym wdrożeniu rozpakowuje ostatnie archiwum do `_site/ski/`. Dzięki temu:
  - zasada „najwyżej jedno pobranie dziennie” jest zachowana, choć strona wdraża się dwa razy
    dziennie,
  - w git nie przybywa codziennie około 4,7 tys. zmienionych plików,
  - zostaje jeden Worker bez R2.
- Limit plików statycznych w Workerze: 20 000 na wersję w planie Free, 100 000 w Paid (od wrangler
  4.34; w `pages.yml` jest 4.155.0), 25 MiB na plik. Dziś `_site` ma około 1,5 tys. plików danych
  plus strony i tłumaczenia, więc z 4,7 tys. kafelków z10 wychodzi około 6,5 tys. Mieści się nawet
  z11 (6,6 tys.). Na limit trzeba uważać dopiero przy kafelkach mapy z Planu C.

### A4. Nagłówki, dokumentacja i licencja

- W `_headers` dla `/ski/*` ustawiamy `Access-Control-Allow-Origin: *`, bo TrailRider działa na
  `rider.liftradar.eu`, czyli innym originie, oraz `Cache-Control: public, max-age=604800` (dla `meta.json` `max-age=3600`).
- `about.html`: w części „For developers” opis `ski/` i licencja **ODbL**. Kafelki są publiczne,
  więc warunek share-alike jest spełniony.
- `sources.html`: atrybucja OpenSkiData (jak wyżej).
- Tłumaczenia de/fr/it/pl w tej samej zmianie, zgodnie z `CLAUDE.md` (`npm run check`), oraz
  README z sekcją „Ski tiles”.

### Wynik pierwszego uruchomienia (6 listopada 2026)

- 5 198 kafelków (więcej niż 4 665, bo są też kafelki z samymi ośrodkami), 32 982 wyciągi,
  7 115 ośrodków (zjazdowe albo z wyciągami). Razem 7,8 MB: mediana 442 B, 95% do 5,8 kB,
  największy 80 kB. Archiwum `tar.gz` ma 2,1 MB. Budowa trwa kilka sekund.
- `lr` ma 8 309 wyciągów i 715 z 731 ośrodków liftradar. W 627 ośrodkach z liczbą wyciągów w
  raporcie przypisanych jest 7 753 wobec 7 402 zgłoszonych.
- Bez wyciągów zostaje 16 ośrodków, głównie takie, których `location` jest dalej niż 3 km od
  wyciągów (np. Rauland) albo których wyciągi zabrał obrys sąsiada (Gschwandtkopf przez obrys
  `birkenlift-geigenbuehel-seefeld`).
- Większość dużych rozbieżności wynika z `assets/areas.geojson`, a nie ze skryptu. Za małe obrysy:
  Châtel 0,04 km², Kongsberg 0,01 km². Obrysy obejmujące sąsiadów: Seefeld, Aussois, Tarvisio,
  Thyon. Obrysy pokrywające tylko część ośrodka: Chamonix 26/82, Val di Fiemme 8/26, Portes du
  Mont-Blanc 6/22. Poprawki w `SHARED` i `EXCLUDE` w `resort_areas.py` poprawią też mapę.

### Uwagi do planu A (przegląd z 6 listopada 2026)

**Co wymaga poprawki:**

- **A1.3.2:** `json/index.json` nie ma pola `osm`. Listy `osm` są tylko we właściwościach
  `assets/areas.geojson` (`{"id": …, "osm": [...]}`), czyli dokładnie u tych 553 ośrodków, które
  mają już obrys z kroku 1. Krok 2 przyda się więc tylko dla wyciągów, których środek leży tuż poza
  obrysem. Dla pozostałych 178 ośrodków (731 − 553) zostaje krok 3. Wszystkie 731 ośrodków ma
  `location`, więc krok 3 zawsze ma z czym pracować.
- **A1.3.3:** promień 2 km od `location` (która często jest wioską w dolinie) przypisze też wyciągi
  sąsiedniego ośrodka. Lepiej: najpierw ośrodek OpenSkiData najbliższy `location` (do 3 km, jak w
  statystyce na górze), a potem wszystkie jego wyciągi, bez osobnego promienia na wyciąg.
- **Identyfikatory:** `areas.geojson` ma samo `id` bez kraju. Dziś `id` są unikalne w całym
  `index.json`, ale `lr` w kafelku to `<country>/<id>`, więc skrypt powinien brać kraj z
  `index.json` i kończyć się błędem przy zdublowanym `id`.
- **Wejście w CI:** `../liftradar-data/` to lokalna ścieżka. W `ski.yml` trzeba wymeldować gałąź
  `data` (jak w `pages.yml`) i podać ścieżkę jako argument.
- **Pobieranie:** serwer oddaje pliki skompresowane gzipem (`lifts` 31 MB zamiast 119 MB,
  `ski_areas` 4,7 MB). Pobierać z `Accept-Encoding: gzip` (`curl --compressed`) i dekompresować
  strumieniowo.
- **A1.6:** spadek o ponad 15% to dobra bramka, ale trzeba też porównać z poprzednim archiwum
  `ski-latest`. W pierwszym uruchomieniu nie ma z czym porównać, więc wtedy sprawdzamy tylko
  minimalne liczby (np. ponad 25 000 wyciągów).

**Wykonalność:** wysoka. To jeden skrypt w Pythonie (shapely do uproszczenia i punktu w wielokącie,
reszta to zwykła arytmetyka kafelków), bez zmian w fetcherze i bez nowej infrastruktury. Największa
niewiadoma to jakość przypisania `lr` w ośrodkach dzielonych. Warto ją sprawdzić ręcznie na kilku
przypadkach (np. Ski Arlberg, Paradiski, Zillertal Arena) zanim powstanie B2.

**Czy aktualizować codziennie?** Nie ma takiej potrzeby:

- Linie wyciągów zmieniają się rzadko: nowe wyciągi powstają głównie latem, a w OSM pojawiają się
  pojedynczo. Do dopasowania GPX (B2) liczy się geometria, a kilkudniowe opóźnienie nowego wyciągu
  niczego nie psuje. Stary wyciąg i tak zostaje w danych (`disused` i `abandoned`).
- Identyfikatory OpenSkiData zmieniają się codziennie, ale my ich nie używamy, więc częste
  przebudowy nie dają stabilności, tylko generują nowe `?b=<build>` i unieważniają cache u
  użytkowników bez zmiany treści.
- Zasada OpenSkiData mówi „najwyżej raz dziennie”, a nie „codziennie”. Rzadziej znaczy też mniej
  pobrań (około 36 MB, a z trasami z Planu C około 290 MB) i mniej uruchomień Actions.

**Propozycja:** raz w tygodniu, plus ręcznie (`workflow_dispatch`) i po zmianie
`assets/areas.geojson`, bo wtedy zmienia się `lr`. Dodatkowo skrypt liczy skrót treści kafelków
(bez czasu budowy): jeśli się nie zmienił, workflow nie publikuje nowego archiwum i `build` zostaje
ten sam. Przy tygodniowym rytmie `Cache-Control` dla kafelków można podnieść do 7 dni
(`max-age=604800`), bo `?b=<build>` i tak omija stary cache, a `meta.json` zostaje przy krótkim
`max-age=3600`. Jeśli pokaże się potrzeba (np. dużo nowych ośrodków liftradar na początku sezonu),
wystarczy zmienić cron, bez zmian w formacie.

---

## Plan A+: obrysy, punkty, trasy i wyciągi na mapie z OpenSkiData (bez Overpass)

Ustalenia z 6 listopada 2026:

- **Zgodność wsteczna dotyczy tylko `json/<country>/<id>.json`**: mogą w nim dojść pola, ale nic
  się nie zmienia ani nie znika (`location` zostaje, bo fetcher liczy z niego region i rejon
  lawinowy). Wszystko inne (`assets/areas.geojson`, `index.json`, kafelki `ski/v1`, które nie są
  jeszcze wdrożone) może zmienić format.
- **Punkt ośrodka na mapie może się przesunąć** w miejsce wynikające z OpenSkiData.
- **Trasy i wyciągi przechowujemy i publikujemy**, bo docelowo rysujemy je sami zamiast
  nakładki OpenSnowMap.

Dlaczego OpenSkiData wystarcza, choć ma tylko 2/3 naszych obrysów `landuse`: duże ośrodki są w
OSM relacjami `site=piste` i OpenSkiData eksportuje je jako punkt (1 457 takich ośrodków, np.
Ischgl, Sölden, Laax). Wyciągi i trasy mają jednak przypisany ośrodek, więc obrys budujemy z nich.
Wszystkie 22 ośrodki, których „nie było”, są w OpenSkiData: 14 to sektory połączonych ośrodków
(Les Sybelles, Grand Massif, Espace Diamant…), 7 ma punkt poza naszym obrysem, a Kongsberg ma u nas
błędny obrys.

### A+1. Przynależność (rdzeń dla mapy i TrailRidera)

Każdy wyciąg i trasa OpenSkiData dostaje ośrodek liftradar (`lr`), niezależnie od
`areas.geojson`:

1. Ośrodek OpenSkiData odpowiadający jednemu ośrodkowi liftradar: wszystkie jego wyciągi i trasy.
2. Ośrodek połączony z kilkoma sektorami liftradar: podział wyciągów według najbliższej
   `location` sektora (jak dziś Woronoj w `resort_areas.py`, ale na wyciągach). Trasy idą za
   najbliższym wyciągiem.
3. Ręczne poprawki w `scripts/ski_overrides.json` (zamiast `SHARED` i `EXCLUDE`), według
   identyfikatorów OSM, bo te z OpenSkiData zmieniają się codziennie.

### A+2. `ski/v1/resorts.geojson`

Jeden obiekt na ośrodek liftradar: `id` w postaci `<country>/<id>`, obrys (wyciągi i trasy z
buforem około 100–150 m, połączone i wygładzone; ewentualnie obrys `landuse` z OpenSkiData, gdzie
pasuje 1:1), punkt na mapie (wewnątrz obrysu, a bez wyciągów `location`), liczba wyciągów i tras z
OpenSkiData oraz identyfikatory OSM. Zastępuje `assets/areas.geojson`, `resort_areas.py`,
`osm_ski_areas.py` i Overpass.

### A+3. Trasy w kafelkach

Kafelki z10 dostają `runs` obok `lifts`: `uses`, `difficulty` (z konwencją kolorów), `name`, `ref`,
`grooming`, `lit`, `oneway`, `status`, `lr`, `areas` i geometrię (linia albo wielokąt). Wyciągi
dostają pola do popupu (`capacity`, `duration`, `occupancy`, `heating`), jeśli są. Jeśli kafelki
z Alp przekroczą około 0,5 MB, trasy idą do osobnych plików albo na z12.

### A+4. Strony

- `map.js` i `resort.js`: punkt i obrys z `resorts.geojson` (bez niego `location`, jak dziś bez
  obrysu), a od zoomu około 11 własne rysowanie tras i wyciągów z kafelków (canvas w Leaflecie)
  zamiast OpenSnowMap. Na stronie ośrodka jego trasy i wyciągi są wyróżnione przez `lr`.
- `index.html` (mała mapa) zostaje przy `location`.
- `about.html` „Map”, README i checklista w `../liftradar-fetcher/CLAUDE.md`: nowy ośrodek dostaje
  obrys w najbliższej budowie, bez ręcznego skryptu.

### A+ zrobione (6 listopada 2026)

- `scripts/ski_resorts.py` (przynależność, obrysy, punkty), `scripts/ski_overrides.json` (poprawki:
  `claims`, `ignore`, `points`), `scripts/ski_tiles.py` (trasy w kafelkach, `resorts.geojson`,
  strumieniowe czytanie przez `ijson`: 3,4 GB pamięci, około 45 s).
- Wynik: 720 z 731 ośrodków z obrysem i punktem; 8 042 przypisane wyciągi wobec 7 421 zgłoszonych
  w 630 ośrodkach; 7 830 kafelków, 106 MB (największy 624 kB, po gzipie 147 kB), archiwum 25 MB.
- `assets/ski.js`: punkt i obrys z `resorts.geojson`, trasy i wyciągi z kafelków od zoomu 11 (na
  stronie ośrodka jego własne wyróżnione), bez `/ski/` powrót do `location` i OpenSnowMap.
- Usunięte: `assets/areas.geojson`, `scripts/resort_areas.py`, `scripts/osm_ski_areas.py`.
- Podział sektorów według wiosek bywa niedokładny (np. Samoëns, poprawiony kotwicą w `points`):
  kolejne przypadki poprawiamy w `ski_overrides.json` po obejrzeniu mapy.

### A+5. Kolejność

1. Prototyp A+1–A+3 lokalnie, z pomiarem rozmiarów i porównaniem obrysów na przypadkach: Ischgl,
   Sölden, Châtel, Seefeld i Gschwandtkopf, Chamonix, Les Sybelles, Grand Massif, Kongsberg,
   Kasprowy.
2. Decyzja o wyglądzie obrysów i miejscu tras.
3. A+4, potem usunięcie starych skryptów i Plan C na gotowych danych.

---

## Plan C: mapa liftradar na własnych danych i kafelkach OpenFreeMap

**Dziś:** `map.html` (`assets/map.js`) i mapa na `resort.html` (`resortMap` w `assets/resort.js`)
to Leaflet 1.9.4 z rastrem `tile.opentopomap.org` i nakładką `tiles.opensnowmap.org/pistes`
(od z10). Obie usługi są utrzymywane przez wolontariuszy, bywają wolne lub niedostępne, nie mają
trybu ciemnego, a etykiety są w języku lokalnym, a nie w języku strony.

**Cel:** podkład wektorowy z OpenFreeMap, a na nim wyciągi, trasy i ośrodki z OpenSkiData,
budowane tym samym workflow co Plan A. Ośrodki liftradar dostają wyróżnione wyciągi i link.

### C1. Podkład: OpenFreeMap

- Kafelki wektorowe w schemacie OpenMapTiles, bez klucza API i bez limitów, atrybucja wymagana:
  *„OpenFreeMap © OpenMapTiles Data from OpenStreetMap”* (MapLibre dokleja ją sam z TileJSON).
  Usługa jest „as is”, więc warto mieć zapasowy styl (np. Positron z innym hostem) w konfiguracji.
- Wymaga **MapLibre GL JS** (cdnjs ma `maplibre-gl`, wersja przypięta jak Leaflet). Koszt: około
  220 kB gzip zamiast około 40 kB Leafleta i WebGL zamiast DOM.
- Styl trzymamy u siebie (`assets/map-style.json`), bo OpenFreeMap wymaga hostowania zmienionych
  stylów samodzielnie. Bazą jest Positron (jasny) i Dark (ciemny), przełączane razem z motywem
  strony. Dzięki temu mapa przestaje się gryźć z ciemnym trybem.
- Etykiety w języku strony: OpenMapTiles ma `name:de`, `name:fr`, `name:it`, `name:pl`, więc
  wyrażenie `coalesce(name:<lang>, name)` daje nazwy po polsku na `/pl/` itd.
- OpenMapTiles ma już wyciągi (`transportation`, klasa `aerialway`), ale bez tras narciarskich i
  bez typów potrzebnych liftradarowi. W naszym stylu ukrywamy je i rysujemy własne z C2.

### C2. Rzeźba terenu

Bez tego mapa narciarska jest płaska, a OpenTopoMap daje dziś cieniowanie i poziomice:

- Cieniowanie: warstwa `hillshade` MapLibre z kafelków Terrarium na AWS
  (`s3.amazonaws.com/elevation-tiles-prod/terrarium`), których `scripts/mini_map.py` już używa.
  Alternatywa to Mapterhorn (już w atrybucji OpenSkiData), do sprawdzenia warunki i adres.
- Poziomice: wtyczka `maplibre-contour` liczy je w przeglądarce z tych samych kafelków DEM, więc
  nie trzeba niczego budować ani hostować.

### C3. Nakładka narciarska: `ski/map/{z}/{x}/{y}.pbf`

Kafelki JSON z A2 są zrobione pod TrailRidera (jeden zoom, pełne linie). Do rysowania lepiej
zbudować w tym samym workflow osobny zestaw kafelków wektorowych:

- Wejście: `lifts.geojson`, `ski_areas.geojson` i nowy **`runs.geojson`** (254 MB gzip, około
  1 GB po rozpakowaniu: największy plik, więc tylko w CI i strumieniowo). Bez tras nowa mapa
  straciłaby to, co dziś daje OpenSnowMap.
- Narzędzie: `tippecanoe` (warstwy `lifts`, `runs`, `areas`), z10–z13, z overzoomem w MapLibre
  powyżej z13. Właściwości: typ wyciągu, `difficulty` trasy, nazwa, `lr`, status (`disused` i
  `abandoned` rysujemy szaro albo wcale, inaczej niż w A, gdzie są potrzebne do GPX).
- Zasięg: tylko kafelki w pobliżu ośrodków (w praktyce Europa), a nie cały świat. Liczbę kafelków
  trzeba zmierzyć w kroku 1 „Kolejności”. Szacunkowo kilka tysięcy przy z13, a z14 mogłoby
  przekroczyć limit 20 000 plików planu Free. Jeśli zabraknie miejsca: jeden plik PMTiles w R2,
  albo w Workerze, jeśli obsługuje żądania `Range` i plik zmieści się w 25 MiB (do sprawdzenia).
- `_headers`: `Content-Type: application/x-protobuf` dla `/ski/map/*`, CORS jak w A4. Kafelki
  wrzucamy bez kompresji (`--no-tile-compression`), bo Cloudflare sam kompresuje odpowiedzi.
- `meta.json` z A2 dostaje też wersję zestawu mapy, a URL źródła w stylu ma `?b=<build>`.

### C4. Zmiany na stronach

- `assets/map.js`: Leaflet na MapLibre. Markery ośrodków z liczbami to dziś `divIcon`. W MapLibre
  najprościej zrobić z nich warstwę `circle` + `symbol` ze źródła GeoJSON zbudowanego z
  `json/index.json` (szybsze niż 731 markerów DOM), a popup przenieść do `maplibregl.Popup` bez
  zmian w treści. Obrysy z `assets/areas.geojson` jako warstwa `fill` + `line`.
- `resortMap` w `assets/resort.js`: to samo, plus wyróżnienie wyciągów i tras tego ośrodka filtrem
  `["==", ["get", "lr"], "<country>/<id>"]`, a wyciągów sąsiadów na szaro.
- Kliknięcie wyciągu: nazwa i typ (teksty `t("…")`, tłumaczone jak zawsze), a jeśli ma `lr`, to
  link do strony ośrodka.
- `index.html` (statyczny obrazek `mini-map-*.webp`) zostaje bez zmian.
- `sources.html`, `about.html`, README: zamiast OpenTopoMap i OpenSnowMap wpisujemy OpenFreeMap,
  OpenMapTiles, OpenSkiData (ODbL), Terrarium/Mapzen i MapLibre. Tłumaczenia w tej samej zmianie.

### C5. Ocena

- **Za:** brak zależności od dwóch wolontariackich serwerów rastrowych, ostra mapa na każdym
  ekranie, tryb ciemny, etykiety w języku strony, klikalne wyciągi powiązane z liftradarem,
  te same dane co w TrailRiderze.
- **Przeciw:** większy JavaScript i wymóg WebGL, przepisanie obu map (to większość pracy), większe
  pobranie w CI (`runs.geojson`), własny styl do utrzymania, a OpenFreeMap nadal jest zewnętrzną
  usługą bez gwarancji.
- **Ryzyko:** czy rzeźba z C2 jest wystarczająco czytelna w porównaniu z OpenTopoMap. Warto
  zrobić prototyp `map.html` na jednym ośrodku zanim przepiszemy obie mapy.

**Kolejność:** po wdrożeniu A (A1–A4). Najpierw prototyp mapy z OpenFreeMap + C2 + kafelki z C3
lokalnie, potem decyzja, potem `map.html`, a na końcu `resort.html` i dokumentacja.

---

## Plan B: TrailRider, czyli korzystanie z kafelków

### B1. Pobieranie: `web/src/ski.ts`

- Z obszaru trasy plus 1 km marginesu liczymy kafelki z10. Zwykle to 1–2 pliki.
- Pobieramy `meta.json` i kafelki z `https://liftradar.eu/ski/v1/…`. Odpowiedź 404 oznacza brak
  danych dla kafelka, a błąd sieci oznacza zachowanie takie jak dziś.
- Linie przeliczamy do lokalnych metrów merkatora, tak jak robi to `prepare.ts`.

### B2. Dopasowanie wyciągów

Na każdym odcinku `LIFT` z `prepare.ts`:

- **Kandydaci:** wyciągi, których obszar leży w promieniu 200 m od odcinka.
- **Ocena:**
  - średnia odległość punktów odcinka od linii wyciągu, około 40 m lub mniej,
  - początek blisko dolnej stacji, a koniec blisko górnej, czyli zgodny kierunek pod górę,
  - pokryta część długości wyciągu, co najmniej około 60%.
- **Przejazdy, których zegarek nie nagrał** (Auto Run): mamy tylko końce, więc dopasowujemy dolną
  i górną stację w promieniu około 100 m.
- Wynik na każdy odcinek to `{ lift, score }` albo brak dopasowania.
- Później można też dociągnąć trasę wyciągu do prawdziwej linii liny.

### B3. Typy wyciągów w silniku

Dziś `web/src/animation/player.ts` (około linii 333) buduje jeden `createLiftStage` dla
wszystkich wyciągów jednym zestawem modeli. Do zmiany:

- `web/src/animation-api.d.ts`: do `DayMeta` dochodzi
  `lifts?: { from: number; to: number; type: LiftType }[]` (zakresy próbek),
- w `player.ts` osobny `createLiftStage` dla każdego typu, z `LIFT_KITS[map][type]`
  (`web/src/animation/meshes.ts`).
- **Mapowanie:**
  - `chair_lift` → `chair`
  - `gondola`, `cable_car`, `mixed_lift` → `gondola`
  - `t-bar`, `j-bar`, `platter`, `drag_lift`, `rope_tow` → `tbar`
  - `magic_carpet`, `funicular`, `railway` i wyciągi bez dopasowania → `chair`, jak dziś,
    dopóki nie powstaną dla nich modele.

### B4. Nazwa ośrodka

1. Większość głosów wśród dopasowanych wyciągów po polu `lr`, a wtedy **nazwa i link z
   liftradar**: `https://liftradar.eu/resort.html?r=<country>/<id>`.
2. Jeśli nic nie ma `lr`: nazwa ośrodka z OpenSkiData, według większości głosów.
3. Jeśli nie ma żadnego dopasowania: ośrodek, w którego obrysie leży trasa, a potem najbliższy
   punkt ośrodka w promieniu 3 km.
4. W przeciwnym razie nazwy nie pokazujemy.

Jeśli ośrodek jest w liftradar, można później dociągnąć `json/<country>/<id>.json`, np. żeby
pokazać warunki śniegowe.

### B5. Interfejs i zapis

- **Nazwa ośrodka:** pokazujemy ją na podglądzie, w bibliotece i ewentualnie w tytule pliku
  wideo. Teksty dodajemy w `shared/i18n/en.json` i `pl.json`.
- **Biblioteka:** w `web/src/library.ts` przy zapisanym pliku przechowujemy nazwę ośrodka, `lr` i
  typy wyciągów, żeby nie pobierać ich ponownie.
- **Linki do przejazdu** (`web/src/share.ts`): niczego nie dodajemy. Po otwarciu linku
  dopasowanie liczy się od nowa.
- **Atrybucja:** dopisek OpenSkiData i OSM, gdy pokazujemy nazwę lub dopasowane wyciągi.
- **README, sekcja „Internet”:** zapytania o kafelki do liftradar.eu zdradzają obszar około
  30 km, tak jak kafelki terenu. Sam GPX nadal nie opuszcza przeglądarki.

### B6. Testy

- Dopasowanie na danych syntetycznych: krzesełko, orczyk, przejazd z Auto Run, dwa równoległe
  wyciągi.
- Zapisany kafelek z Kasprowego jako dane testowe i `shared/samples/kasprowy-zjazd.gpx`:
  oczekiwane wyciągi i nazwa ośrodka.
- Brak sieci lub 404, i aplikacja działa jak dziś.

Android i iOS mogą później korzystać z tych samych kafelków. W pierwszym etapie zmiany obejmują
tylko web.

---

## Kolejność

1. Plan A, kroki A1–A2 lokalnie: skrypt i sprawdzenie rozmiarów kafelków, w tym tego z 252
   wyciągami.
2. Plan B, kroki B1–B2 na lokalnych kafelkach: czy dopasowanie działa na prawdziwych
   przejazdach.
3. Plan A, kroki A3–A4: workflow, nagłówki i dokumentacja, wdrożenie.
4. Plan B, kroki B3–B6.
5. Plan C (mapa): prototyp, decyzja, potem `map.html` i `resort.html`.
