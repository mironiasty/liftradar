// Shared by the map and the resort page: each resort's outline and map point, and the pistes and
// lifts drawn over the map, from the ski tiles (/ski/v1/, built weekly from OpenSkiData by
// .github/workflows/ski.yml; README "Ski tiles"). Without them (not built yet, or locally) the
// pages show the resorts at their location, without outlines, pistes or lifts.

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

// The resort's point on the map, [lon, lat]: in its ski area when the tiles have one.
function skiPoint(r, ski) {
  const point = ski?.resorts.get(skiKey(r))?.properties.point;
  if (point) return point;
  return r.location ? [r.location.lon, r.location.lat] : null;
}

// The bounds of a GeoJSON geometry, for fitBounds.
function geometryBounds(geometry) {
  const bounds = new maplibregl.LngLatBounds();
  const walk = (c) => (typeof c[0] === "number" ? bounds.extend(c) : c.forEach(walk));
  walk(geometry.coordinates);
  return bounds;
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
// Black pistes and lifts are light on the dark map.
const INK = darkMode() ? "#eee" : "#222";
if (darkMode()) for (const colors of Object.values(PISTE_COLORS)) colors.advanced = colors.expert = INK;
const OFF_PISTE = "#ef8a00";
const NORDIC = "#7a5cc7";

function tileOf([lon, lat]) {
  const n = 1024; // zoom 10
  const rad = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n)];
}

// A tile's runs and lifts as GeoJSON features, with what the layers and tooltips need.
function skiFeatures(tile, highlight, names) {
  for (const area of tile.areas) if (area.lr && !names.has(area.lr.id)) names.set(area.lr.id, area.lr.name);
  const runs = [];
  const lifts = [];
  const stations = [];
  const faded = (f) => highlight && f.lr !== highlight;
  for (const run of tile.runs) {
    const uses = run.uses ?? [];
    const downhill = uses.includes("downhill");
    if (!downhill && !uses.includes("nordic") && !uses.includes("skitour") && !uses.includes("sled")) continue;
    const offPiste = run.difficulty === "freeride" || run.difficulty === "extreme";
    const kind = downhill
      ? [t("Piste"), SKI_DIFFICULTIES[run.difficulty]].filter(Boolean).join(", ")
      : uses.includes("nordic")
        ? t("Cross-country trail")
        : uses.includes("skitour")
          ? t("Ski touring route")
          : t("Sledding run");
    runs.push({
      type: "Feature",
      id: run.osm,
      geometry: run.c ? { type: "LineString", coordinates: run.c } : { type: "Polygon", coordinates: run.poly },
      properties: {
        color: !downhill
          ? NORDIC
          : offPiste
            ? OFF_PISTE
            : (PISTE_COLORS[run.conv ?? "europe"][run.difficulty] ?? "#777"),
        dashed: offPiste || !downhill,
        width: downhill ? 2.5 : 1.5,
        opacity: (faded(run) ? 0.35 : 1) * (downhill ? 0.9 : 0.7),
        name: run.name ?? "",
        lr: run.lr ?? "",
        kind,
        resort: names.get(run.lr) ?? "",
      },
    });
  }
  for (const lift of tile.lifts) {
    const gone = Boolean(lift.status && lift.status !== "operating");
    const properties = {
      type: lift.type ?? "",
      lr: lift.lr ?? "",
      color: gone ? "#888" : INK,
      dashed: gone,
      opacity: faded(lift) ? 0.35 : 1,
      name: lift.name ?? "",
      kind: [SKI_LIFT_TYPES[lift.type] ?? t("Lift"), gone ? t("out of service") : ""].filter(Boolean).join(", "),
      resort: names.get(lift.lr) ?? "",
    };
    lifts.push({ type: "Feature", id: lift.osm, geometry: { type: "LineString", coordinates: lift.c }, properties });
    stations.push({ type: "Feature", id: lift.osm, geometry: { type: "Point", coordinates: lift.c[0] }, properties });
  }
  return { runs, lifts, stations };
}

function skiLabel({ properties: p }) {
  const box = el("div", {}, el("b", {}, p.name || p.kind));
  if (p.name) box.append(el("div", {}, p.kind));
  if (p.resort) box.append(el("div", { class: "sub" }, p.resort));
  return box;
}

// Pistes and lifts of the tiles in view, under the labels. With highlight (a resort's key), that
// resort's are drawn strong and the others faded; names maps resort keys to the names shown in the
// tooltips (otherwise those the tiles give).
function skiLayers(map, ski, { highlight = null, names = new Map() } = {}) {
  const empty = { type: "FeatureCollection", features: [] };
  map.addSource("ski-runs", { type: "geojson", data: empty, attribution: SKI_ATTRIBUTION });
  map.addSource("ski-lifts", { type: "geojson", data: empty });
  map.addSource("ski-stations", { type: "geojson", data: empty });
  const before = firstLabel(map);
  const line = (id, source, filter, extra = {}) =>
    map.addLayer(
      {
        id,
        type: "line",
        source,
        minzoom: SKI_MIN_ZOOM,
        filter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-opacity": ["get", "opacity"],
          "line-width": ["coalesce", ["get", "width"], 2.5],
          ...extra,
        },
      },
      before,
    );
  map.addLayer(
    {
      id: "ski-run-areas",
      type: "fill",
      source: "ski-runs",
      minzoom: SKI_MIN_ZOOM,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": ["get", "color"], "fill-opacity": ["*", ["get", "opacity"], 0.2] },
    },
    before,
  );
  const isLine = ["==", ["geometry-type"], "LineString"];
  line("ski-runs", "ski-runs", ["all", isLine, ["!", ["get", "dashed"]]]);
  line("ski-runs-dashed", "ski-runs", ["all", isLine, ["get", "dashed"]], { "line-dasharray": [2, 2] });
  line("ski-lifts", "ski-lifts", ["!", ["get", "dashed"]]);
  line("ski-lifts-dashed", "ski-lifts", ["get", "dashed"], { "line-dasharray": [1.5, 2] });
  map.addLayer(
    {
      id: "ski-stations",
      type: "circle",
      source: "ski-stations",
      minzoom: SKI_MIN_ZOOM,
      paint: { "circle-radius": 2.5, "circle-color": ["get", "color"], "circle-opacity": ["get", "opacity"] },
    },
    before,
  );
  map.addLayer({
    id: "ski-lift-names",
    type: "symbol",
    source: "ski-lifts",
    minzoom: 13,
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "name"],
      "text-font": MAP_FONT,
      "text-size": 11,
      "text-offset": [0, -0.8],
    },
    paint: {
      "text-color": INK,
      "text-halo-color": darkMode() ? "#000" : "#fff",
      "text-halo-width": 1.2,
      "text-opacity": ["get", "opacity"],
    },
  });
  hoverTip(map, ["ski-runs", "ski-runs-dashed", "ski-run-areas", "ski-lifts", "ski-lifts-dashed"], skiLabel);

  const data = { runs: [], lifts: [], stations: [] };
  const sources = { runs: "ski-runs", lifts: "ski-lifts", stations: "ski-stations" };
  const loaded = new Set();
  const drawn = new Set();
  const add = (tile) => {
    for (const [key, list] of Object.entries(skiFeatures(tile, highlight, names))) {
      for (const f of list) {
        // A line crossing tiles is in each of them.
        const id = `${key}:${f.id ?? JSON.stringify(f.geometry.coordinates[0])}`;
        if (drawn.has(id)) continue;
        drawn.add(id);
        data[key].push(f);
      }
      map.getSource(sources[key]).setData({ type: "FeatureCollection", features: data[key] });
    }
  };
  const update = () => {
    if (map.getZoom() < SKI_MIN_ZOOM) return;
    const bounds = map.getBounds();
    const [x0, y0] = tileOf([bounds.getWest(), bounds.getNorth()]);
    const [x1, y1] = tileOf([bounds.getEast(), bounds.getSouth()]);
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
  };
  map.on("moveend", update);
  update();
}

// The pistes and lifts over the map, when there are ski tiles.
function addPistes(map, ski, options = {}) {
  if (ski) skiLayers(map, ski, options);
}
