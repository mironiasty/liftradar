// The resort page's map (resort.html, with resort.js): the resort's area, and the lists' lifts and slopes on it.

// The resort map's lifts and pistes linked to the lists (their `item`), once drawn, and how to show one of them
// there: null without a map or ski tiles.
/**
 * @typedef {{ items: Set<string>, show: (key: string, button: HTMLElement) => void, clear: () => void,
 *   rise: (key: string) => number | null } | null} MapItems
 */
/** @type {(value: MapItems) => void} */
let mapItemsReady = () => {};
/** @type {Promise<MapItems>} */
// biome-ignore lint/correctness/noUnusedVariables: resort-lists.js uses it
const mapItems = new Promise((resolve) => {
  mapItemsReady = resolve;
});

// A lift or piste picked in a list: a wide band under its line, and the map moved onto it.
// From the features of every tile loaded (skiLayers), not those the map has in view: one picked out of view
// wouldn't be found, and one partly in view only partly.
/**
 * @param {import("maplibre-gl").Map} map @param {HTMLElement} container
 * @param {{ runs: import("geojson").Feature[], lifts: import("geojson").Feature[] } | null} features
 * @returns {MapItems}
 */
function pickOnMap(map, container, features) {
  if (!features) return null;
  const sources = ["ski-runs", "ski-lifts"].filter((id) => map.getSource(id));
  const linked = () => [...features.lifts, ...features.runs].filter((f) => f.properties?.item);
  const items = new Set(linked().map((f) => f.properties?.item));
  if (!items.size) return null;
  for (const id of sources) {
    map.addLayer(
      {
        id: `picked-${id}`,
        type: "line",
        source: id,
        filter: ["==", ["get", "item"], ""],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssColor("--accent"), "line-width": 16, "line-opacity": 0.55, "line-blur": 2 },
      },
      // Under the lifts and pistes themselves.
      map.getLayer("ski-run-areas") ? "ski-run-areas" : undefined,
    );
  }
  /** @type {HTMLElement | null} */
  let picked = null;
  /** @type {import("maplibre-gl").FilterSpecification} */
  const none = ["==", ["get", "item"], ""];
  return {
    items,
    // How far a lift climbs on the map: from the lowest to the highest end of its lines. A lift with a middle
    // station can be two lines (its sections) linked to the one item, as its length is their sum.
    rise(key) {
      const ends = features.lifts
        .filter((f) => f.properties?.item === key && f.geometry.type === "LineString")
        .map((f) => liftEnds(/** @type {import("geojson").LineString} */ (f.geometry).coordinates))
        .filter((e) => e !== null);
      if (!ends.length) return null;
      return Math.max(...ends.map((e) => e[1])) - Math.min(...ends.map((e) => e[0]));
    },
    clear() {
      picked?.setAttribute("aria-pressed", "false");
      picked = null;
      for (const id of sources) map.setFilter(`picked-${id}`, none);
    },
    show(key, button) {
      const off = picked === button;
      picked?.setAttribute("aria-pressed", "false");
      picked = off ? null : button;
      button.setAttribute("aria-pressed", String(!off));
      /** @type {import("maplibre-gl").FilterSpecification} */
      const filter = ["==", ["get", "item"], off ? "" : key];
      for (const id of sources) map.setFilter(`picked-${id}`, filter);
      if (off) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const f of linked()) if (f.properties?.item === key) bounds.extend(geometryBounds(f.geometry));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      container.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
  };
}

// Resort map: only this resort's area (or point), with its pistes and lifts strong and the
// neighbours' faded; "Map of all resorts" shows the other resorts. The wheel zooms it only
// once it has been clicked, so the page scrolls past it. Shown once it has drawn the base map, the
// relief and the pistes (or after a few seconds), rather than each as it comes.
/** @param {Resort} r */
// biome-ignore lint/correctness/noUnusedVariables: resort.js uses it
async function resortMap(r, container) {
  container.classList.add("loading");
  const loader = liftLoader();
  container.append(loader);
  const start = r.location
    ? { center: [r.location.lon, r.location.lat], zoom: 12 }
    : { center: [11.9, 47.25], zoom: 6 };
  const loading = loadSki();
  // Above the map, as soon as the ski tiles say the resort has an area (the 3D map needs it, which the resorts
  // without one lack), rather than once the map has drawn.
  loading.then((ski) => {
    if (!ski?.resorts.has(skiKey(r))) return;
    // A block of land cut out with its peaks, seen from above at an angle: the 3D map's diorama. The block's
    // sides in two shades, the ridges in the accent.
    const icon = el("span", { class: "icon", "aria-hidden": "true" });
    icon.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24"><path fill="currentColor" opacity=".45" d="M2 15.5v2.5l10 5v-2.5z"/><path fill="currentColor" opacity=".7" d="M22 15.5v2.5l-10 5v-2.5z"/><path fill="currentColor" d="M2 15.5 7.5 9l3 3.2L14.5 5l4 6 3.5 4.5-10 5z"/><path fill="none" stroke="var(--accent)" stroke-width="1.2" stroke-linejoin="round" d="M14.5 5 13.5 11l2.4 2.6M7.5 9l.2 4.3"/></svg>';
    container.before(
      el(
        "a",
        { class: "map-3d", href: `3d.html?r=${skiKey(r)}` },
        icon,
        el(
          "span",
          { class: "text" },
          el("b", {}, t("See the resort in 3D")),
          t("Every lift and piste on the real terrain"),
        ),
        el("span", { class: "go", "aria-hidden": "true" }, "→"),
      ),
    );
  });
  // Opened on the area when there is one, rather than moving there once it's known.
  const view = loading.then((ski) => {
    const area = ski?.resorts.get(skiKey(r));
    if (!area) return start;
    return { bounds: geometryBounds(area.geometry), fitBoundsOptions: { padding: 20, maxZoom: 14 } };
  });
  const [map, ski] = await Promise.all([
    baseMap(
      container,
      view.then((v) => ({ ...v, scrollZoom: false })),
      { controls: "top-right" },
    ),
    loading,
  ]);
  map.once("click", () => map.scrollZoom.enable());
  /** @type {MapItems} */
  let onMap = null;
  // Back to the view the map opened at, once it has moved (zoomed, dragged, or onto a lift picked in a list),
  // and nothing picked.
  const home = { center: map.getCenter(), zoom: map.getZoom() };
  const label = t("Show the whole resort");
  const reset = el("button", { type: "button", class: "map-reset", title: label, "aria-label": label });
  reset.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const resetBox = el("div", { class: "maplibregl-ctrl maplibregl-ctrl-group", hidden: "" }, reset);
  map.addControl({ onAdd: () => resetBox, onRemove: () => resetBox.remove() }, "top-right");
  reset.addEventListener("click", () => {
    onMap?.clear();
    map.easeTo(home);
  });
  map.on("moveend", () => {
    const off = map.project(home.center).dist(map.project(map.getCenter()));
    resetBox.hidden = Math.abs(map.getZoom() - home.zoom) < 0.05 && off < 20;
  });
  const area = ski?.resorts.get(skiKey(r));
  if (area) {
    map.addSource("area", { type: "geojson", data: area });
    map.addLayer(
      {
        id: "area",
        type: "line",
        source: "area",
        // Dashed: a boundary, not one more piste.
        paint: { "line-color": cssColor("--boundary"), "line-width": 2, "line-dasharray": [3, 2] },
      },
      firstLabel(map),
    );
  }
  const pistes = addPistes(map, ski, {
    highlight: skiKey(r),
    names: new Map([[skiKey(r), r.name]]),
    // From the zoom the map opens at, however large the resort: its lifts and pistes are always shown.
    minZoom: Math.min(SKI_MIN_ZOOM, Math.floor(map.getZoom())),
  });
  const drawn = pistes.then(() => !map.loaded() && new Promise((resolve) => map.once("idle", resolve)));
  Promise.all([pistes, drawn]).then(([features]) => {
    onMap = pickOnMap(map, container, features);
    mapItemsReady(onMap);
  });
  await Promise.race([drawn, new Promise((resolve) => setTimeout(resolve, 4000))]);
  container.classList.remove("loading");
  loader.remove();
}
