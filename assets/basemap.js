// Shared by the map and resort pages: the base map in MapLibre. OpenFreeMap's vector tiles
// (Positron, or Fiord with the page's dark mode) with labels in the page's language, mountain peaks,
// and relief: hillshading and contour lines from Terrain Tiles (Mapzen, on AWS Open Data), the
// contours drawn in the browser by maplibre-contour.

const BASE_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};
const DEM_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const DEM_ATTRIBUTION = '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a> (Mapzen)';
const MAP_FONT = ["Noto Sans Regular"];
const darkMode = () => matchMedia("(prefers-color-scheme: dark)").matches;

// One elevation source for the hillshading and the contours, and one registration with MapLibre.
let demSource = null;
function dem() {
  if (!demSource) {
    demSource = new mlcontour.DemSource({ url: DEM_TILES, encoding: "terrarium", maxzoom: 13, worker: true });
    demSource.setupMaplibre(maplibregl);
  }
  return demSource;
}

// Labels in the page's language where OpenStreetMap has it, otherwise the local name.
function withLanguage(style) {
  const name = LANG === "en" ? "name_en" : `name:${LANG}`;
  for (const layer of style.layers) {
    const field = layer.layout?.["text-field"];
    if (layer.type === "symbol" && field) {
      layer.layout["text-field"] = JSON.parse(JSON.stringify(field).replaceAll('"name_en"', `"${name}"`));
    }
  }
  return style;
}

// Hillshading and contours under the water and roads; peaks with the other labels.
function withRelief(style) {
  const dark = darkMode();
  const ink = dark ? "rgba(255,255,255,0.28)" : "rgba(90,70,40,0.38)";
  style.sources.dem = {
    type: "raster-dem",
    tiles: [dem().sharedDemProtocolUrl],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 13,
    attribution: DEM_ATTRIBUTION,
  };
  style.sources.contours = {
    type: "vector",
    tiles: [
      dem().contourProtocolUrl({
        thresholds: { 11: [200, 1000], 12: [100, 500], 13: [50, 250], 14: [20, 100] },
        contourLayer: "contours",
        elevationKey: "ele",
        levelKey: "level",
      }),
    ],
    maxzoom: 15,
  };
  const relief = [
    {
      id: "hillshade",
      type: "hillshade",
      source: "dem",
      paint: {
        "hillshade-exaggeration": dark ? 0.5 : 0.4,
        "hillshade-shadow-color": dark ? "#000" : "#473b24",
        "hillshade-highlight-color": dark ? "#555" : "#fff",
      },
    },
    {
      id: "contour-lines",
      type: "line",
      source: "contours",
      "source-layer": "contours",
      minzoom: 11,
      paint: { "line-color": ink, "line-width": ["match", ["get", "level"], 1, 1, 0.5] },
    },
    {
      id: "contour-labels",
      type: "symbol",
      source: "contours",
      "source-layer": "contours",
      minzoom: 12,
      filter: ["==", ["get", "level"], 1],
      layout: {
        "symbol-placement": "line",
        "text-field": ["concat", ["number-format", ["get", "ele"], {}], " m"],
        "text-font": MAP_FONT,
        "text-size": 10,
      },
      paint: { "text-color": ink, "text-halo-color": dark ? "#2e3850" : "#f2f3f0", "text-halo-width": 1 },
    },
  ];
  const peaks = {
    id: "peaks",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "mountain_peak",
    minzoom: 11,
    layout: {
      "text-field": [
        "concat",
        ["coalesce", ["get", LANG === "en" ? "name_en" : `name:${LANG}`], ["get", "name"], ""],
        ["case", ["has", "ele"], ["concat", "\n", ["to-string", ["get", "ele"]], " m"], ""],
      ],
      "text-font": MAP_FONT,
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.3],
    },
    paint: {
      "text-color": dark ? "#bbb" : "#5a4a30",
      "text-halo-color": dark ? "#2e3850" : "#fff",
      "text-halo-width": 1.2,
    },
  };
  const at = (test) => {
    const i = style.layers.findIndex(test);
    return i < 0 ? style.layers.length : i;
  };
  style.layers.splice(
    at((l) => l.id === "waterway"),
    0,
    ...relief,
  );
  style.layers.splice(
    at((l) => /^(label|place)_/.test(l.id)),
    0,
    peaks,
  );
  return style;
}

// The first label layer: what the pistes, lifts and areas go under.
const firstLabel = (map) => map.getStyle().layers.find((l) => l.type === "symbol")?.id;

// A map in container, resolved once its style has loaded. options go to maplibregl.Map.
async function baseMap(container, options = {}) {
  const response = await fetch(BASE_STYLES[darkMode() ? "dark" : "light"]);
  const style = withRelief(withLanguage(await response.json()));
  const map = new maplibregl.Map({
    container,
    style,
    attributionControl: { compact: true },
    locale: {
      "NavigationControl.ZoomIn": t("Zoom in"),
      "NavigationControl.ZoomOut": t("Zoom out"),
      "AttributionControl.ToggleAttribution": t("Map data sources"),
      "Popup.Close": t("Close"),
    },
    dragRotate: false,
    pitchWithRotate: false,
    ...options,
  });
  map.touchZoomRotate.disableRotation();
  // Icons a style names but its sprite lacks: drawn as nothing, rather than a warning each.
  map.on("styleimagemissing", (e) => {
    if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
  await new Promise((resolve) => map.once("load", resolve));
  // The attribution starts folded: it would cover much of a small map.
  map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  return map;
}

// A colour of the page (a CSS custom property, e.g. "--accent"), as the map needs it.
const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// A small popup that follows the mouse over the given layers, with text(feature) as its content.
function hoverTip(map, layers, text) {
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "map-tip", offset: 12 });
  for (const layer of layers) {
    map.on("mousemove", layer, (e) => {
      map.getCanvas().style.cursor = "pointer";
      tip.setLngLat(e.lngLat).setDOMContent(text(e.features[0])).addTo(map);
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
      tip.remove();
    });
  }
  return tip;
}
