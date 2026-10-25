// map.html: every resort with a location as a marker, coloured by status;
// the number on a marker is the value chosen in the options panel (open lifts
// by default). A click shows the report.
// Resorts with an area (assets/areas.geojson, from OpenStreetMap) also show it.

const STATUS = {
  open: { label: "open", color: "--open" },
  closed: { label: "closed", color: "--closed" },
  no_report: { label: "no report yet", color: "--none" },
  unknown: { label: "unknown / error", color: "--err" },
};
// Values a marker can show: open or total, or a single value. Open counts are
// only shown for open resorts: closed ones are 0, and resorts without a recent
// report have no open counts.
const METRICS = {
  lifts: { label: "Lifts", open: (r) => r.lifts?.open, total: (r) => r.lifts?.total },
  slopes: { label: "Slopes", open: (r) => r.slopes?.open, total: (r) => r.slopes?.total },
  km: { label: "Slope km", open: (r) => r.slopes?.open_km, total: (r) => r.slopes?.total_km },
  snow: { label: "Snow", value: (r) => r.snow.mountain_cm, hint: "Snow depth on the mountain, cm." },
  fresh: { label: "Fresh snow", value: (r) => r.snow.fresh_cm, hint: "Fresh snow, cm." },
  avalanche: { label: "Avalanche", value: (r) => r.avalanche?.danger_level, hint: "Avalanche danger level, 1–5." },
};
const MODES = { open: "Open", total: "Total" };
const LABEL_KEY = "map-label";

function labelText(r, status, { metric, mode }) {
  const m = METRICS[metric];
  const openOnly = !m.value && mode === "open";
  const v = (m.value ?? m[mode])(r);
  if ((openOnly && status !== "open") || v === null || v === undefined) return "";
  return String(Math.round(v));
}

function hintText({ metric, mode }) {
  const m = METRICS[metric];
  if (m.hint) return m.hint;
  return mode === "open" ? `Open ${m.label.toLowerCase()}, shown for open resorts.` : `All ${m.label.toLowerCase()} of the area.`;
}

const css = getComputedStyle(document.documentElement);
const color = (status) => css.getPropertyValue(STATUS[status].color).trim();

const map = L.map("map", { zoomSnap: 0.5 });
L.tileLayer("https://tile.opentopomap.org/{z}/{x}/{y}.png", {
  maxZoom: 17,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (map and ski areas), '
    + '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
}).addTo(map);
// Pistes and lifts over the map; hidden when zoomed out, where they're only clutter.
L.tileLayer("https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png", {
  minZoom: 10,
  maxZoom: 17,
  attribution: '<a href="https://www.opensnowmap.org">OpenSnowMap</a>',
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

// The resort areas are optional: without them the map shows only the markers.
const loadAreas = () =>
  fetch(AREAS_URL, { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);

function show([index, areas]) {
  document.getElementById("updated").textContent = updatedText(index);
  const resorts = index.resorts.filter((r) => r.location);
  const layers = {};
  for (const status of Object.keys(STATUS)) layers[status] = L.layerGroup().addTo(map);

  const markers = [];
  const areaOf = new Map((areas?.features ?? []).map((f) => [f.properties.id, f]));

  for (const r of resorts) {
    const status = STATUS[r.status] ? r.status : "unknown";
    const area = areaOf.get(r.id);
    if (area) {
      const style = { color: color(status), weight: 1.5, fillOpacity: 0.25 };
      L.geoJSON(area, { style, interactive: true })
        .on("mouseover", (e) => e.layer.setStyle({ weight: 3, fillOpacity: 0.45 }))
        .on("mouseout", (e) => e.layer.setStyle(style))
        .bindTooltip(r.name, { sticky: true })
        .bindPopup(() => popup(r, status))
        .addTo(layers[status]);
    }
    const marker = L.marker([r.location.lat, r.location.lon], { title: r.name, riseOnHover: true })
      .bindPopup(() => popup(r, status))
      .addTo(layers[status]);
    markers.push({ marker, r, status });
  }

  const setLabels = (choice) => {
    for (const { marker, r, status } of markers) {
      const pin = el("div", { class: "pin", style: `background:${color(status)}` }, labelText(r, status, choice));
      marker.setIcon(L.divIcon({ className: "", html: pin, iconSize: null, iconAnchor: [0, 0] }));
    }
  };
  let choice = { metric: "lifts", mode: "open" };
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_KEY));
    if (METRICS[saved?.metric] && MODES[saved?.mode]) choice = saved;
  } catch {}
  const metricButtons = Object.entries(METRICS).map(([metric, { label }]) =>
    button("chip", label, () => choose({ metric })),
  );
  const modeButtons = Object.entries(MODES).map(([mode, label]) => button("", label, () => choose({ mode })));
  document.getElementById("metrics").append(...metricButtons);
  document.getElementById("mode").append(...modeButtons);
  const choose = (change) => {
    choice = { ...choice, ...change };
    Object.keys(METRICS).forEach((metric, i) => metricButtons[i].setAttribute("aria-pressed", metric === choice.metric));
    const single = Boolean(METRICS[choice.metric].value);
    Object.keys(MODES).forEach((mode, i) => {
      modeButtons[i].setAttribute("aria-pressed", !single && mode === choice.mode);
      modeButtons[i].disabled = single;
    });
    document.getElementById("hint").textContent = hintText(choice);
    setLabels(choice);
    try {
      localStorage.setItem(LABEL_KEY, JSON.stringify(choice));
    } catch {}
  };
  choose({});
  map.fitBounds(resorts.map((r) => [r.location.lat, r.location.lon]), { padding: [30, 30] });

  const filters = document.getElementById("filters");
  for (const [status, { label }] of Object.entries(STATUS)) {
    const total = resorts.filter((r) => (STATUS[r.status] ? r.status : "unknown") === status).length;
    if (!total) continue;
    const chip = button("chip", "", () => {
      const on = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", on);
      on ? layers[status].addTo(map) : layers[status].remove();
    });
    chip.setAttribute("aria-pressed", true);
    const name = label[0].toUpperCase() + label.slice(1);
    chip.append(el("span", { class: "dot", style: `--c:${color(status)}` }), name, el("span", { class: "count" }, String(total)));
    filters.append(chip);
  }
}

function button(className, text, onClick) {
  const node = el("button", { type: "button", class: className }, text);
  node.addEventListener("click", onClick);
  return node;
}

// The panel starts collapsed on small screens, and doesn't pan or zoom the map.
const panel = document.getElementById("panel");
if (matchMedia("(max-width: 640px)").matches) panel.open = false;
L.DomEvent.disableClickPropagation(panel);
L.DomEvent.disableScrollPropagation(panel);

Promise.all([loadIndex(), loadAreas()])
  .then(show)
  .catch((error) => {
    document.getElementById("updated").textContent = `Could not load the data (${error.message})`;
    map.setView([47.25, 11.9], 8);
  });
