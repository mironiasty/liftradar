// Checks assets/ski-style.json (README "Ski map style"), which the site and the apps read: every "@name" is a colour
// of both themes or a definition, and the layers, with the names replaced as the clients do, are a valid MapLibre style.
import { readFileSync } from "node:fs";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";

const style = JSON.parse(readFileSync(new URL("../assets/ski-style.json", import.meta.url), "utf8"));
const problems = [];
const light = Object.keys(style.colors.light).sort().join();
if (light !== Object.keys(style.colors.dark).sort().join()) problems.push("light and dark name different colours");
for (const name of Object.keys(style.colors.light))
  if (name in style.defs) problems.push(`@${name}: colour and definition`);

for (const theme of ["light", "dark"]) {
  const names = { ...style.defs, ...style.colors[theme] };
  const resolve = (v, seen = []) => {
    if (typeof v === "string" && v.startsWith("@")) {
      const name = v.slice(1);
      if (!(name in names)) problems.push(`${v}: no such colour or definition`);
      else if (seen.includes(name)) problems.push(`${v}: defined by itself`);
      else return resolve(names[name], [...seen, name]);
      return v;
    }
    if (Array.isArray(v)) return v.map((x) => resolve(x, seen));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x, seen)]));
    return v;
  };
  const layers = style.layers.map((layer) => resolve(layer));
  for (const layer of layers) {
    if (!(layer.source in style.sources)) problems.push(`${layer.id}: source ${layer.source} isn't in "sources"`);
  }
  const empty = { type: "geojson", data: { type: "FeatureCollection", features: [] } };
  const errors = validateStyleMin({
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    state: style.state,
    sources: Object.fromEntries(Object.keys(style.sources).map((id) => [id, empty])),
    layers,
  });
  for (const e of errors) problems.push(`${theme}: ${e.message}`);
}

if (problems.length) {
  console.error(`assets/ski-style.json:\n  ${[...new Set(problems)].join("\n  ")}`);
  process.exit(1);
}
console.log(`assets/ski-style.json: ${style.layers.length} layers, valid`);
