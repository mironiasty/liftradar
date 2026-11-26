// Shared by the map and the resort page: each resort's outline and map point, and the pistes and
// lifts drawn over the map, from the ski tiles (/ski/v1/, built weekly from OpenSkiData by
// .github/workflows/ski.yml; DEVELOPMENT.md "Ski tiles"). Without them (not built yet, or locally) the
// pages show the resorts at their location, without outlines, pistes or lifts.

const SKI_URL = "/ski/v1";
const SKI_ATTRIBUTION =
  '<a href="https://openskimap.org">OpenSkiData</a> (ODbL, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors)';
// How the maps draw the tiles, here and in the apps: colours, layers and what decides them (DEVELOPMENT.md "Ski map
// style"). This file only turns the tiles into features for them, and adds the lifts' and pistes' statuses.
const SKI_STYLE_URL = "/assets/ski-style.json";
// Pistes and lifts appear from this zoom (the style's minZoom): below it they're only clutter, and many tiles.
const SKI_MIN_ZOOM = 11;

// { build, resorts: Map of "<country>/<id>" to its feature, style: assets/ski-style.json }, or null
// without the tiles (or that file).
async function loadSki() {
  try {
    const [meta, style] = await Promise.all(
      [`${SKI_URL}/meta.json`, SKI_STYLE_URL].map(async (url) => (await fetch(url, { cache: "no-cache" })).json()),
    );
    const response = await fetch(`${SKI_URL}/${meta.resorts}?b=${meta.build}`);
    const collection = await response.json();
    return { build: meta.build, resorts: new Map(collection.features.map((f) => [f.properties.id, f])), style };
  } catch {
    return null;
  }
}

// The resort's point on the map, [lon, lat]: in its ski area when the tiles have one.
function skiPoint(r, ski) {
  const point = ski?.resorts.get(resortKey(r))?.properties.point;
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
// Experimental: the status of a lift or piste linked to its resort's details file (`item`), in its tooltip.
const SKI_STATES = { open: t("open"), closed: t("closed"), preparation: t("in preparation") };
const SKI_DIFFICULTIES = {
  novice: t("novice"),
  easy: t("easy"),
  intermediate: t("intermediate"),
  advanced: t("advanced"),
  expert: t("expert"),
  freeride: t("freeride"),
  extreme: t("extreme"),
};
// A run's use on the map, the first of these it has; runs with none of them aren't drawn.
const SKI_USES = ["downhill", "nordic", "skitour", "sled"];

// The style's layers with its names ("@ink", "@runColor") replaced by the theme's colours and its
// definitions, the minZoom of those that start with the pistes (the style's minZoom) set to minZoom.
function skiStyleLayers(style, minZoom) {
  const names = { ...style.defs, ...style.colors[darkMode() ? "dark" : "light"] };
  const resolve = (v) =>
    typeof v === "string" && v.startsWith("@") && v.slice(1) in names
      ? resolve(names[v.slice(1)])
      : Array.isArray(v)
        ? v.map(resolve)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]))
          : v;
  return style.layers.map((layer) => {
    const resolved = resolve(layer);
    if (resolved.minzoom === style.minZoom) resolved.minzoom = minZoom;
    return resolved;
  });
}

// Without the keys whose value is missing: the style's ["has", …] would take them for set.
const skiProperties = (properties) =>
  Object.fromEntries(Object.entries(properties).filter(([, v]) => v != null && v !== false));

function tileOf([lon, lat]) {
  const n = 1024; // zoom 10
  const rad = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n)];
}

// A lift's stations' heights, lowest first (not every lift is drawn from its bottom station), and the difference:
// "2668 → 2751 m (83 m)", or null without them.
/** @param {number[][]} c */
function liftHeights(c) {
  const ends = liftEnds(c);
  return ends && `${ends[0]} → ${ends[1]} m (${ends[1] - ends[0]} m)`;
}

// The heights of a lift's line's two ends, lowest first, or null without them.
/** @param {number[][]} c @returns {[number, number] | null} */
function liftEnds(c) {
  const [a, b] = [c[0][2], c[c.length - 1][2]];
  return a === undefined || b === undefined ? null : [Math.round(Math.min(a, b)), Math.round(Math.max(a, b))];
}

// A tile's runs and lifts as GeoJSON features, with the properties assets/ski-style.json reads (its
// "sources"), and for the tooltips their kind, heights and resort's name.
/** @param {SkiTile} tile @param {Map<string, string>} names */
function skiFeatures(tile, names) {
  for (const area of tile.areas) if (area.lr && !names.has(area.lr.id)) names.set(area.lr.id, area.lr.name);
  const runs = [];
  const lifts = [];
  const stations = [];
  for (const run of tile.runs) {
    const use = SKI_USES.find((u) => run.uses?.includes(u));
    if (!use) continue;
    const kind =
      use === "downhill"
        ? [t("Piste"), SKI_DIFFICULTIES[run.difficulty]].filter(Boolean).join(", ")
        : use === "nordic"
          ? t("Cross-country trail")
          : use === "skitour"
            ? t("Ski touring route")
            : t("Sledding run");
    runs.push({
      type: "Feature",
      id: run.osm,
      geometry: run.c ? { type: "LineString", coordinates: run.c } : { type: "Polygon", coordinates: run.poly },
      properties: skiProperties({
        use,
        difficulty: run.difficulty,
        conv: run.conv,
        name: run.name,
        lr: run.lr,
        item: run.item,
        tunnel: run.tunnel,
        shared: run.shared,
        kind: run.tunnel ? `${kind}, ${t("in a tunnel")}` : kind,
        resort: run.lr && names.get(run.lr),
      }),
    });
  }
  for (const lift of tile.lifts) {
    const gone = Boolean(lift.status && lift.status !== "operating");
    const properties = skiProperties({
      type: lift.type,
      name: lift.name,
      status: lift.status,
      tunnel: lift.tunnel,
      lr: lift.lr,
      item: lift.item,
      kind: [
        SKI_LIFT_TYPES[lift.type] ?? t("Lift"),
        gone ? t("out of service") : "",
        lift.tunnel ? t("in a tunnel") : "",
      ]
        .filter(Boolean)
        .join(", "),
      heights: liftHeights(lift.c),
      resort: lift.lr && names.get(lift.lr),
    });
    const line = { type: "LineString", coordinates: lift.c };
    lifts.push({ type: "Feature", id: lift.osm, geometry: line, properties });
    // A station at each end: the style draws the top one only when the lift's status is known.
    const start = { type: "Point", coordinates: lift.c[0] };
    stations.push({ type: "Feature", id: lift.osm, geometry: start, properties: { ...properties } });
    const top = { type: "Point", coordinates: lift.c.at(-1) };
    stations.push({ type: "Feature", id: lift.osm, geometry: top, properties: { ...properties, top: true } });
  }
  return { runs, lifts, stations };
}

function skiLabel({ properties: p }) {
  const box = el("div", {}, el("b", {}, p.name || p.kind));
  if (p.name) box.append(el("div", {}, p.kind));
  if (p.heights) box.append(el("div", {}, p.heights));
  if (SKI_STATES[p.state]) box.append(el("div", {}, capitalized(SKI_STATES[p.state])));
  if (p.resort) box.append(el("div", { class: "sub" }, p.resort));
  return box;
}

// The ski style's sources and layers (assets/ski-style.json), under the labels, and the pistes and lifts
// of the tiles in view in them. With highlight (a resort's key, or several, as a ski area's page has), those
// resorts' are drawn strong and the others faded, and without, those of areas liftradar has no resort for are grey; names maps resort keys
// to the names shown in the tooltips (otherwise those the tiles give); minZoom, from where they're drawn;
// tips: false for no tooltips (the map page, where a click on the area shows the resort). The resorts'
// outlines go in the source "ski-areas" and their links in "ski-links" (the map page fills them).
// Resolves once the tiles of the first view are drawn, with the features of every tile loaded (it grows as more load).
// onStates: called when the statuses of a resort in view have loaded (for a legend).
function skiLayers(
  map,
  ski,
  {
    highlight = /** @type {string | string[] | null} */ (null),
    names = new Map(),
    minZoom = SKI_MIN_ZOOM,
    tips = true,
    onStates = /** @type {(() => void) | null} */ (null),
  } = {},
) {
  const empty = { type: "FeatureCollection", features: [] };
  for (const id of Object.keys(ski.style.sources)) {
    map.addSource(id, { type: "geojson", data: empty, ...(id === "ski-runs" && { attribution: SKI_ATTRIBUTION }) });
  }
  // Several resorts as "|at/a|at/b|", which the style finds each of in (DEVELOPMENT.md "Ski map style").
  map.setGlobalStateProperty(
    "highlight",
    Array.isArray(highlight) ? (highlight.length ? `|${highlight.join("|")}|` : "") : (highlight ?? ""),
  );
  map.setGlobalStateProperty("picked", "");
  const before = firstLabel(map);
  for (const layer of skiStyleLayers(ski.style, minZoom)) {
    map.addLayer(layer, layer.metadata?.["above-labels"] ? undefined : before);
  }
  if (tips) hoverTip(map, ["ski-runs", "ski-runs-dashed", "ski-run-areas", "ski-lifts", "ski-lifts-dashed"], skiLabel);

  const data = { runs: [], lifts: [], stations: [] };
  const sources = { runs: "ski-runs", lifts: "ski-lifts", stations: "ski-stations" };
  const loaded = new Set();
  const drawn = new Set();
  const draw = (key) => map.getSource(sources[key]).setData({ type: "FeatureCollection", features: data[key] });

  // Experimental: lifts and pistes linked to a resort's details file get its status (`state`), and the
  // others of a resort with statuses "unknown"; the style draws each by it.
  const states = new Map(); // "<country>/<id>/<item id>" -> status
  const withStates = new Set(); // the resorts whose details are loaded
  const asked = new Set();
  const restyle = (f) => {
    const p = f.properties;
    const state = states.get(p.item) ?? (withStates.has(p.lr) ? "unknown" : null);
    if (state) p.state = state;
    else delete p.state;
  };
  /** @param {SkiTile} tile */
  const loadStates = (tile) => {
    for (const f of [...tile.lifts, ...tile.runs]) {
      const resort = f.item?.split("/").slice(0, 2).join("/");
      if (!resort || asked.has(resort)) continue;
      asked.add(resort);
      fetch(`/json/${resort}.details.json`, { cache: "no-cache" })
        .then((response) => (response.ok ? /** @type {Promise<ResortDetails>} */ (response.json()) : null))
        .then((details) => {
          if (!details) return;
          // Files with only the resort's bottom and top have no lists.
          for (const i of [...(details.lifts ?? []), ...(details.slopes ?? [])])
            if (i.status) states.set(`${resort}/${i.id}`, i.status);
          withStates.add(resort);
          for (const key of Object.keys(data)) {
            data[key].forEach(restyle);
            draw(key);
          }
          onStates?.();
        })
        .catch(() => asked.delete(resort));
    }
  };

  const add = (tile) => {
    loadStates(tile);
    for (const [key, list] of Object.entries(skiFeatures(tile, names))) {
      for (const f of list) {
        // A line crossing tiles is in each of them, whole. Its OSM id alone isn't enough:
        // OpenSkiData splits some ways into several runs, which share it.
        const line = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates;
        const id = `${key}:${f.id}:${line[0]}:${line.length}:${f.properties.top ?? ""}`;
        if (drawn.has(id)) continue;
        drawn.add(id);
        restyle(f);
        data[key].push(f);
      }
      draw(key);
    }
  };
  const update = () => {
    const fetches = [];
    if (map.getZoom() < minZoom) return fetches;
    const bounds = map.getBounds();
    const [x0, y0] = tileOf([bounds.getWest(), bounds.getNorth()]);
    const [x1, y1] = tileOf([bounds.getEast(), bounds.getSouth()]);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 16) return fetches;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const path = `${x}/${y}`;
        if (loaded.has(path)) continue;
        loaded.add(path);
        // 404: nothing there.
        fetches.push(
          fetch(`${SKI_URL}/10/${path}.json?b=${ski.build}`)
            .then((response) => (response.ok ? /** @type {Promise<SkiTile>} */ (response.json()) : null))
            .then((tile) => tile && add(tile))
            .catch(() => loaded.delete(path)),
        );
      }
    }
    return fetches;
  };
  map.on("moveend", update);
  return Promise.all(update()).then(() => data);
}

// The pistes and lifts over the map, when there are ski tiles. Resolves once those in view are drawn (see skiLayers).
function addPistes(map, ski, options = {}) {
  return ski ? skiLayers(map, ski, options) : Promise.resolve(null);
}
