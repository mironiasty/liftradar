// Shared by the map and the resort page: each resort's outline and map point, and the pistes and
// lifts drawn over the map, from the ski tiles (/ski/v1/, built weekly from OpenSkiData by
// .github/workflows/ski.yml; README "Ski tiles"). Without them (not built yet, or locally) the
// pages fall back to the resort's location and OpenSnowMap's pistes.

const SKI_URL = "/ski/v1";
const SKI_ATTRIBUTION =
  '<a href="https://openskimap.org">OpenSkiData</a> (ODbL, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors)';
// Pistes and lifts appear from this zoom: below it they're only clutter, and many tiles.
const SKI_MIN_ZOOM = 11;

// { build, resorts: Map of "<country>/<id>" to its feature }, or null without the tiles.
async function loadSki() {
  try {
    const meta = await (await fetch(`${SKI_URL}/meta.json`, { cache: "no-cache" })).json();
    const response = await fetch(`${SKI_URL}/${meta.resorts}?b=${meta.build}`);
    const collection = await response.json();
    return { build: meta.build, resorts: new Map(collection.features.map((f) => [f.properties.id, f])) };
  } catch {
    return null;
  }
}

const skiKey = (r) => `${r.country}/${r.id}`;

// The resort's point on the map, [lat, lon]: in its ski area when the tiles have one.
function skiPoint(r, ski) {
  const point = ski?.resorts.get(skiKey(r))?.properties.point;
  if (point) return [point[1], point[0]];
  return r.location ? [r.location.lat, r.location.lon] : null;
}

const SKI_LIFT_TYPES = {
  chair_lift: t("Chairlift"),
  gondola: t("Gondola"),
  cable_car: t("Cable car"),
  mixed_lift: t("Chairlift and gondola"),
  funicular: t("Funicular"),
  railway: t("Railway"),
  "t-bar": t("T-bar"),
  "j-bar": t("Drag lift"),
  platter: t("Drag lift"),
  drag_lift: t("Drag lift"),
  rope_tow: t("Rope tow"),
  magic_carpet: t("Magic carpet"),
};
const SKI_DIFFICULTIES = {
  novice: t("novice"),
  easy: t("easy"),
  intermediate: t("intermediate"),
  advanced: t("advanced"),
  expert: t("expert"),
  freeride: t("freeride"),
  extreme: t("extreme"),
};
// Piste colours by the country's convention: Europe, North America, Japan.
const PISTE_COLORS = {
  europe: { novice: "#2e9e3f", easy: "#1f6fd1", intermediate: "#d62828", advanced: "#111", expert: "#111" },
  north_america: { novice: "#2e9e3f", easy: "#2e9e3f", intermediate: "#1f6fd1", advanced: "#111", expert: "#111" },
  japan: { novice: "#2e9e3f", easy: "#2e9e3f", intermediate: "#d62828", advanced: "#111", expert: "#111" },
};
const OFF_PISTE = "#ef8a00";
const NORDIC = "#7a5cc7";

function tileOf(latlng) {
  const n = 1024; // zoom 10
  const lat = (latlng.lat * Math.PI) / 180;
  return [Math.floor(((latlng.lng + 180) / 360) * n), Math.floor(((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * n)];
}

const toLatLngs = (coords) => coords.map(([lon, lat]) => [lat, lon]);

// Pistes and lifts of the tiles in view, on a canvas under the markers. With highlight (a resort's
// key), that resort's are drawn strong and the others faded; names maps resort keys to the names
// shown in the tooltips (otherwise those the tiles give). Returns the layer, already on the map.
function skiLayer(map, ski, { highlight = null, names = new Map() } = {}) {
  const layer = L.layerGroup().addTo(map);
  // Under the resort areas and markers (the overlay pane is 400).
  if (!map.getPane("pistes")) map.createPane("pistes").style.zIndex = 350;
  const renderer = L.canvas({ padding: 0.5, pane: "pistes" });
  const loaded = new Set();
  const drawn = new Set();
  const opacity = (f) => (!highlight || f.lr === highlight ? 1 : 0.35);
  const resortName = (key) => (key && names.get(key)) || "";

  function piste(run) {
    const uses = run.uses ?? [];
    const downhill = uses.includes("downhill");
    if (!downhill && !uses.includes("nordic") && !uses.includes("skitour") && !uses.includes("sled")) return;
    const offPiste = run.difficulty === "freeride" || run.difficulty === "extreme";
    const color = downhill
      ? offPiste
        ? OFF_PISTE
        : (PISTE_COLORS[run.conv ?? "europe"][run.difficulty] ?? "#777")
      : NORDIC;
    const style = {
      renderer,
      color,
      weight: downhill ? 2.5 : 1.5,
      opacity: opacity(run) * (downhill ? 0.9 : 0.7),
      dashArray: offPiste || !downhill ? "4 4" : null,
    };
    const kind = downhill
      ? [t("Piste"), SKI_DIFFICULTIES[run.difficulty]].filter(Boolean).join(", ")
      : uses.includes("nordic")
        ? t("Cross-country trail")
        : uses.includes("skitour")
          ? t("Ski touring route")
          : t("Sledding run");
    const shape = run.c
      ? L.polyline(toLatLngs(run.c), style)
      : L.polygon(run.poly.map(toLatLngs), { ...style, weight: 1, fillOpacity: 0.2 * opacity(run) });
    return shape.bindTooltip(label(run.name, kind, resortName(run.lr)), { sticky: true });
  }

  function lift(l) {
    const gone = l.status && l.status !== "operating";
    const line = toLatLngs(l.c);
    const style = {
      renderer,
      color: gone ? "#888" : "#222",
      weight: 2.5,
      opacity: opacity(l),
      dashArray: gone ? "3 5" : null,
    };
    const kind = [SKI_LIFT_TYPES[l.type] ?? t("Lift"), gone ? t("out of service") : ""].filter(Boolean).join(", ");
    return L.featureGroup([
      L.polyline(line, style),
      L.circleMarker(line[0], {
        renderer,
        radius: 2.5,
        color: style.color,
        opacity: opacity(l),
        fillOpacity: opacity(l),
      }),
    ]).bindTooltip(label(l.name, kind, resortName(l.lr)), { sticky: true });
  }

  function label(name, kind, resort) {
    const box = el("div", {}, el("b", {}, name ?? kind));
    if (name) box.append(el("div", {}, kind));
    if (resort) box.append(el("div", {}, resort));
    return box;
  }

  function add(tile) {
    for (const [list, draw] of [
      [tile.runs, piste],
      [tile.lifts, lift],
    ]) {
      for (const f of list) {
        // A line crossing tiles is in each of them.
        const id = f.osm ?? JSON.stringify(f.c?.[0] ?? f.poly[0][0]);
        if (drawn.has(id)) continue;
        drawn.add(id);
        draw(f)?.addTo(layer);
      }
    }
    for (const area of tile.areas) if (area.lr && !names.has(area.lr.id)) names.set(area.lr.id, area.lr.name);
  }

  function update() {
    if (map.getZoom() < SKI_MIN_ZOOM) return;
    const bounds = map.getBounds();
    const [x0, y0] = tileOf(bounds.getNorthWest());
    const [x1, y1] = tileOf(bounds.getSouthEast());
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 16) return;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const path = `${x}/${y}`;
        if (loaded.has(path)) continue;
        loaded.add(path);
        // 404: nothing there.
        fetch(`${SKI_URL}/10/${path}.json?b=${ski.build}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((tile) => tile && add(tile))
          .catch(() => loaded.delete(path));
      }
    }
  }
  const showAtZoom = () => (map.getZoom() < SKI_MIN_ZOOM ? layer.remove() : layer.addTo(map));
  map.on("moveend", update);
  map.on("zoomend", showAtZoom);
  // Once the map has a view: the pages set it after adding this.
  map.whenReady(() => {
    showAtZoom();
    update();
  });
  return layer;
}

// The pistes over the map: ours from the tiles, or OpenSnowMap's without them.
function addPistes(map, ski, options = {}) {
  if (ski) {
    map.attributionControl.addAttribution(SKI_ATTRIBUTION);
    return skiLayer(map, ski, options);
  }
  return L.tileLayer("https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png", {
    minZoom: 10,
    maxZoom: 17,
    attribution: '<a href="https://www.opensnowmap.org">OpenSnowMap</a>',
  }).addTo(map);
}
