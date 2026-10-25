// map.html: every resort with a location as a marker, coloured by status;
// open resorts show their number of open lifts. A click shows the report.

const STATUS = {
  open: { label: "open", color: "--open" },
  closed: { label: "closed", color: "--closed" },
  no_report: { label: "no report yet", color: "--none" },
  unknown: { label: "unknown / error", color: "--err" },
};
const css = getComputedStyle(document.documentElement);
const color = (status) => css.getPropertyValue(STATUS[status].color).trim();

const map = L.map("map", { zoomSnap: 0.5 });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 17,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

function popup(r, status) {
  const slopes = r.slopes || {};
  const bulletin = r.avalanche;
  const updated = r.lifts_updated_at
    ? new Date(r.lifts_updated_at).toLocaleString("de-AT", { timeZone: "Europe/Vienna", dateStyle: "medium", timeStyle: "short" })
    : null;
  const rows = [
    ["Status", STATUS[status].label],
    ["Mountain", dash(r.snow.mountain_cm, " cm")],
    ["Valley", dash(r.snow.valley_cm, " cm")],
    ["Fresh", dash(r.snow.fresh_cm, " cm")],
    ["Lifts", pair(r.lifts?.open, r.lifts?.total)],
    ["Slopes", pair(slopes.open, slopes.total)],
    ["Slope km", pair(slopes.open_km, slopes.total_km, " km")],
    ["Avalanche", bulletin?.danger_level ? `${bulletin.danger_level} (${bulletin.danger.replace("_", " ")})` : "–"],
    ["Report", dash(updated)],
  ];
  const content = el("div", { class: "popup" },
    el("h3", {}, r.name),
    el("table", {}, ...rows.map(([label, value]) => el("tr", {}, el("td", {}, label), el("td", {}, value)))),
  );
  if (r.errors.length) content.append(el("div", { class: "err" }, r.errors.join("; ")));
  content.append(el("a", { href: resortPath(r) }, "JSON"));
  return content;
}

function show(index) {
  document.getElementById("updated").textContent = updatedText(index);
  const resorts = index.resorts.filter((r) => r.location);
  const layers = {};
  for (const status of Object.keys(STATUS)) layers[status] = L.layerGroup().addTo(map);

  for (const r of resorts) {
    const status = STATUS[r.status] ? r.status : "unknown";
    const pin = el("div", { class: "pin", style: `background:${color(status)}` }, status === "open" ? dash(r.lifts?.open) : "");
    const icon = L.divIcon({ className: "", html: pin, iconSize: null, iconAnchor: [11, 11] });
    L.marker([r.location.lat, r.location.lon], { icon, title: r.name, riseOnHover: true })
      .bindPopup(() => popup(r, status))
      .addTo(layers[status]);
  }
  map.fitBounds(resorts.map((r) => [r.location.lat, r.location.lon]), { padding: [30, 30] });

  const filters = document.getElementById("filters");
  for (const [status, { label }] of Object.entries(STATUS)) {
    const total = resorts.filter((r) => (STATUS[r.status] ? r.status : "unknown") === status).length;
    if (!total) continue;
    const box = el("input", { type: "checkbox" });
    box.checked = true;
    box.addEventListener("change", () => (box.checked ? layers[status].addTo(map) : layers[status].remove()));
    filters.append(el("label", {}, box, el("span", { class: "dot", style: `background:${color(status)}` }), `${label} (${total})`));
  }
}

loadIndex()
  .then(show)
  .catch((error) => {
    document.getElementById("updated").textContent = `Could not load the data (${error.message})`;
    map.setView([47.25, 11.9], 8);
  });
