// Shared by the table and the map: loading the data and formatting values.
// The data is published by snow-fetcher (json/, archive/, schema/; also logs/, not served).

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
// sessionStorage key of the resort list's last filters and order (its query string), set by table.js.
const LIST_KEY = "resort-list";
// The map zoomed in on the resort (map.html), e.g. map.html?r=at/soelden.
const resortOnMap = (r) => `map.html?r=${r.country}/${r.id}`;

// Lowercase without accents, so "Sölden" sorts and matches like "solden".
const fold = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const dash = (value, unit = "") => (value === null || value === undefined ? "–" : `${value}${unit}`);

function pair(a, b, unit = "") {
  const missing = (v) => v === null || v === undefined;
  return missing(a) && missing(b) ? "–" : `${dash(a)}/${dash(b)}${unit}`;
}

const STATUS_LABELS = { open: "open", closed: "closed", no_report: "no report" };

// Same as the table and the map.
const STATUS_COLORS = { open: "var(--open)", closed: "var(--closed)", no_report: "var(--none)" };
// Data published before 27.10.2026 can have a null status (fetching failed): shown as no report.
const statusKey = (r) => (STATUS_LABELS[r.status] ? r.status : "no_report");

const viennaTime = (iso, options = { dateStyle: "medium", timeStyle: "short" }) =>
  new Date(iso).toLocaleString("de-AT", { timeZone: "Europe/Vienna", ...options });

// When we last read the resort's report (status_from when the latest run couldn't) and when the
// resort last changed it. Stale: an open resort whose report the latest run couldn't read, or that
// hasn't changed for STALE_DAYS (slope maps keep their time while nothing opens or closes).
const STALE_DAYS = 7;
function reportTimes(r) {
  const checked = r.status_from ?? r.fetched_at;
  const changed = r.lifts_updated_at;
  const days = changed ? Math.floor((new Date(r.fetched_at) - new Date(changed)) / 864e5) : 0;
  const stale = statusKey(r) === "open" && (Boolean(r.status_from) || days > STALE_DAYS);
  return { checked, changed, days, stale };
}

const COUNTRY_NAMES = { at: "Austria", ch: "Switzerland", it: "Italy", fr: "France", cz: "Czechia", sk: "Slovakia", pl: "Poland", fi: "Finland" };
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
