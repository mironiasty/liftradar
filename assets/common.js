// Shared by the table and the map: loading the data and formatting values.
// The data is published by snow-fetcher (json/, history/, archive/, schema/).

const INDEX_URL = "json/index.json";
const AREAS_URL = "assets/areas.geojson";

async function loadIndex() {
  const response = await fetch(INDEX_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${INDEX_URL}: HTTP ${response.status}`);
  return response.json();
}

// Same path layout as snow-fetcher's models.resort_path().
const resortPath = (r) => `json/${r.country}/${r.id}.json`;
const archivePath = (r) => `archive/${r.country}/${r.id}/`;
// The resort's page (resort.html), e.g. resort.html?r=at/soelden.
const resortPage = (r) => `resort.html?r=${r.country}/${r.id}`;

// Lowercase without accents, so "Sölden" sorts and matches like "solden".
const fold = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const dash = (value, unit = "") => (value === null || value === undefined ? "–" : `${value}${unit}`);

function pair(a, b, unit = "") {
  const missing = (v) => v === null || v === undefined;
  return missing(a) && missing(b) ? "–" : `${dash(a)}/${dash(b)}${unit}`;
}

const STATUS_LABELS = { open: "open", closed: "closed", no_report: "no report yet" };

// Same as the table and the map.
const STATUS_COLORS = { open: "var(--open)", closed: "var(--closed)", no_report: "var(--none)", unknown: "var(--err)" };
const statusKey = (r) => (STATUS_LABELS[r.status] ? r.status : "unknown");

const viennaTime = (iso, options = { dateStyle: "medium", timeStyle: "short" }) =>
  new Date(iso).toLocaleString("de-AT", { timeZone: "Europe/Vienna", ...options });

const COUNTRY_NAMES = { at: "Austria", ch: "Switzerland", it: "Italy" };
const countryName = (code) => COUNTRY_NAMES[code] ?? code.toUpperCase();

function updatedText(index) {
  const time = new Date(index.generated_at);
  const formatted = time.toLocaleString("de-AT", { timeZone: "Europe/Vienna", dateStyle: "medium", timeStyle: "short" });
  return `Updated ${formatted}`;
}

function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}
