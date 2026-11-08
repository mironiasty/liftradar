// map.html: every resort with a location as a marker, coloured by status;
// the number on a marker is the value chosen in the options panel (open lifts
// by default). A click shows the report.
// Resorts with a ski area in the ski tiles (assets/ski.js) also show it, and the pistes and lifts
// appear when zoomed in; from there, the area takes the marker's place: hovering it names the
// resort, and a click shows the report (the pistes and lifts have no tooltips of their own here).

const STATUS = {
  open: { label: STATUS_LABELS.open, color: "--open" },
  closed: { label: STATUS_LABELS.closed, color: "--closed" },
  no_report: { label: STATUS_LABELS.no_report, color: "--none" },
};
// Markers stack in the order they're added: open resorts go above all others (z-index), and a
// hovered marker above those.
const OPEN_ON_TOP = 1;
// Values a marker can show: open or total, or a single value. Open counts are
// only shown for open resorts: closed ones are 0, and resorts without a recent
// report have no open counts.
const METRICS = {
  lifts: {
    label: t("Lifts"),
    open: (r) => r.lifts?.open,
    total: (r) => r.lifts?.total,
    hints: { open: t("Open lifts, shown for open resorts."), total: t("All lifts of the area.") },
  },
  slopes: {
    label: t("Slopes"),
    open: (r) => r.slopes?.open,
    total: (r) => r.slopes?.total,
    hints: { open: t("Open slopes, shown for open resorts."), total: t("All slopes of the area.") },
  },
  km: {
    label: t("Slope km"),
    open: (r) => r.slopes?.open_km,
    total: (r) => r.slopes?.total_km,
    hints: { open: t("Open slope km, shown for open resorts."), total: t("All slope km of the area.") },
  },
  snow: { label: t("Snow"), value: (r) => r.snow.mountain_cm, hint: t("Snow depth on the mountain, cm.") },
  fresh: { label: t("Fresh snow"), value: (r) => r.snow.fresh_cm, hint: t("Fresh snow, cm.") },
  avalanche: {
    label: t("Avalanche danger"),
    value: (r) => r.avalanche?.danger_level,
    hint: t("Avalanche danger level, 1–5."),
  },
};
const MODES = { open: t("Open"), total: t("Total") };
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
  return m.hint ?? m.hints[mode];
}

const color = (status) => cssColor(STATUS[status].color);
// Where the map opens: every resort, from Sierra Nevada to Lapland. Fixed rather than taken from
// the data, so the map draws at once; widen it if resorts appear outside.
const ALL_RESORTS = { bounds: [-7.3, 37.1, 29.2, 70.1], fitBoundsOptions: { padding: 30 } };

// A bar for the open share, for open resorts: elsewhere open counts are 0 or not reported.
function meter(open, total, active) {
  if (!active || open === null || open === undefined || !total) return [];
  const bar = el("span", { style: `width:${Math.min(100, (100 * open) / total)}%` });
  return [el("div", { class: "meter", title: t("{share}% open", { share: Math.round((100 * open) / total) }) }, bar)];
}

// The report like a resort card on the phone table: name and status pill, region,
// then the values that are there (empty ones left out); at the bottom, when it was checked, and
// the ways on: the resort's page, and its 3D map when it has an area (in3d).
function popup(r, status, in3d) {
  const { snow, lifts, slopes, avalanche } = r;
  const active = status === "open";
  const values = [];
  const add = (title, text, ...content) => {
    if (text !== "–")
      values.push(el("div", {}, el("div", { class: "label" }, title), ...(content.length ? content : [text])));
  };
  const mountain = dash(snow.mountain_cm, " cm");
  add(t("Mountain"), mountain, el("b", {}, mountain));
  add(t("Valley"), dash(snow.valley_cm, " cm"));
  add(
    t("Fresh"),
    dash(snow.fresh_cm, " cm"),
    snow.fresh_cm ? el("span", { class: "fresh" }, `+${snow.fresh_cm} cm`) : `${snow.fresh_cm} cm`,
  );
  const liftCount = pair(lifts?.open, lifts?.total);
  add(t("Lifts"), liftCount, liftCount, ...meter(lifts?.open, lifts?.total, active));
  const counts = pair(slopes?.open, slopes?.total);
  const km = pair(slopes?.open_km, slopes?.total_km, " km");
  if (counts === "–") add(t("Slopes"), km);
  else
    add(
      t("Slopes"),
      counts,
      counts,
      ...meter(slopes.open, slopes.total, active),
      ...(km === "–" ? [] : [el("div", { class: "sub" }, km)]),
    );
  if (avalanche?.danger_level)
    add(
      t("Avalanche danger"),
      "",
      el(
        "div",
        { class: "danger" },
        el("span", { class: `badge lvl${avalanche.danger_level}` }, String(avalanche.danger_level)),
        el("span", { class: "sub" }, dangerName(avalanche.danger)),
      ),
    );

  const label = STATUS[status].label;
  const content = el(
    "div",
    { class: "popup" },
    el(
      "div",
      { class: "head" },
      el("a", { class: "name", href: resortPage(r) }, r.name),
      el("span", { class: "status-pill", style: `--c:${color(status)}` }, capitalized(label)),
    ),
    el("div", { class: "where" }, [r.region, countryName(r.country)].filter(Boolean).join(" · ")),
  );
  if (values.length) content.append(el("div", { class: "values" }, ...values));
  content.append(fnuggCredit(r));
  // fetched_at: an index published before checked_at was added.
  const checked = r.checked_at ?? r.fetched_at;
  const time = viennaTime(checked, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  const actions = el(
    "div",
    { class: "actions" },
    el("a", { class: "action primary", href: resortPage(r) }, t("Details")),
  );
  if (in3d) {
    const cube = el("span", { class: "cube", "aria-hidden": "true" });
    cube.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>';
    actions.append(el("a", { class: "action", href: `3d.html?r=${skiKey(r)}` }, cube, t("3D map")));
  }
  content.append(el("div", { class: "foot" }, t("Checked {time}", { time })), actions);
  return content;
}

// The ski tiles are optional (loadSki() is null without them): the map then shows the markers
// at the resorts' locations, without areas, pistes or lifts.
function show(map, [index, ski]) {
  document.getElementById("updated").textContent = updatedText(index);
  const resorts = index.resorts.filter((r) => skiPoint(r, ski));
  const byKey = new Map(resorts.map((r) => [skiKey(r), r]));
  addPistes(map, ski, { names: new Map(index.resorts.map((r) => [skiKey(r), r.name])), tips: false });

  // The areas, in their resort's status colour: filled when zoomed out, only an outline where
  // the pistes show (filled faintly when hovered), so they stay visible. Clickable at every zoom.
  const areas = resorts
    .map((r) => ski?.resorts.get(skiKey(r)))
    .filter(Boolean)
    .map((f, i) => {
      const r = byKey.get(f.properties.id);
      return { ...f, id: i, properties: { key: f.properties.id, status: statusKey(r), color: color(statusKey(r)) } };
    });
  map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: areas } });
  const before = firstLabel(map);
  map.addLayer(
    {
      id: "areas-fill",
      type: "fill",
      source: "areas",
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": [
          "step",
          ["zoom"],
          ["case", ["boolean", ["feature-state", "hover"], false], 0.45, 0.25],
          ski ? SKI_MIN_ZOOM : 24,
          ["case", ["boolean", ["feature-state", "hover"], false], 0.12, 0],
        ],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: "areas-line",
      type: "line",
      source: "areas",
      paint: {
        "line-color": cssColor("--boundary"),
        "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.5],
        // Dashed: a boundary, not one more piste.
        "line-dasharray": [3, 2],
      },
    },
    before,
  );
  let hovered = null;
  const tip = hoverTip(map, ["areas-fill"], (f) => el("b", {}, byKey.get(f.properties.key).name));
  map.on("mousemove", "areas-fill", (e) => {
    if (hovered !== null) map.setFeatureState({ source: "areas", id: hovered }, { hover: false });
    hovered = e.features[0].id;
    map.setFeatureState({ source: "areas", id: hovered }, { hover: true });
  });
  map.on("mouseleave", "areas-fill", () => {
    if (hovered !== null) map.setFeatureState({ source: "areas", id: hovered }, { hover: false });
    hovered = null;
  });
  const openPopup = (r, at) => {
    // A narrow map has no room beside the marker: centre it, with the popup above.
    if (map.getContainer().clientWidth < 500) map.jumpTo({ center: at, offset: [0, 120] });
    return new maplibregl.Popup({ maxWidth: "296px", offset: 14 })
      .setLngLat(at)
      .setDOMContent(popup(r, statusKey(r), Boolean(ski?.resorts.has(skiKey(r)))))
      .addTo(map);
  };
  map.on("click", "areas-fill", (e) => {
    tip.remove();
    openPopup(byKey.get(e.features[0].properties.key), e.lngLat);
  });

  const markers = [];
  for (const r of resorts) {
    const status = statusKey(r);
    const element = el("div", { class: "pin", title: r.name, style: `background:${color(status)}` });
    element.style.zIndex = status === "open" ? OPEN_ON_TOP : 0;
    element.addEventListener("mouseenter", () => (element.style.zIndex = OPEN_ON_TOP + 1));
    element.addEventListener("mouseleave", () => (element.style.zIndex = status === "open" ? OPEN_ON_TOP : 0));
    const marker = new maplibregl.Marker({ element }).setLngLat(skiPoint(r, ski)).addTo(map);
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      openPopup(r, marker.getLngLat());
    });
    markers.push({ marker, element, r, status, area: Boolean(ski?.resorts.has(skiKey(r))) });
  }
  // Shown: the markers of the statuses chosen with the chips (all when none is), except, where the
  // pistes show, those of resorts with an area.
  const shown = new Set();
  const showMarkers = () => {
    const zoomedIn = map.getZoom() >= SKI_MIN_ZOOM;
    for (const { element, status, area } of markers) {
      const visible = (!shown.size || shown.has(status)) && !(zoomedIn && area);
      element.style.display = visible ? "" : "none";
    }
  };
  // Redrawn only when the zoom crosses that line, not on every frame of a zoom.
  let wasZoomedIn = map.getZoom() >= SKI_MIN_ZOOM;
  map.on("zoom", () => {
    if (wasZoomedIn === map.getZoom() >= SKI_MIN_ZOOM) return;
    wasZoomedIn = !wasZoomedIn;
    showMarkers();
  });
  showMarkers();

  const setLabels = (choice) => {
    for (const { element, r, status } of markers) element.textContent = labelText(r, status, choice);
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
    Object.keys(METRICS).forEach((metric, i) => {
      metricButtons[i].setAttribute("aria-pressed", metric === choice.metric);
    });
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
  // map.html?r=at/soelden: the map opened there (startView), with the resort's report open.
  const focus = markers.find(({ r }) => skiKey(r) === WANTED);
  if (focus) openPopup(focus.r, focus.marker.getLngLat());

  // Statuses chosen with the chips; none chosen shows every resort.
  const filters = document.getElementById("filters");
  const showStatuses = () => {
    showMarkers();
    const filter = shown.size ? ["in", ["get", "status"], ["literal", [...shown]]] : null;
    map.setFilter("areas-fill", filter);
    map.setFilter("areas-line", filter);
  };
  for (const [status, { label }] of Object.entries(STATUS)) {
    const total = resorts.filter((r) => statusKey(r) === status).length;
    if (!total) continue;
    const chip = button("chip", "", () => {
      shown.has(status) ? shown.delete(status) : shown.add(status);
      chip.setAttribute("aria-pressed", shown.has(status));
      showStatuses();
    });
    chip.setAttribute("aria-pressed", false);
    chip.append(
      el("span", { class: "dot", style: `--c:${color(status)}` }),
      capitalized(label),
      el("span", { class: "count" }, String(total)),
    );
    filters.append(chip);
  }
}

function button(className, text, onClick) {
  const node = el("button", { type: "button", class: className }, text);
  node.addEventListener("click", onClick);
  return node;
}

// The panel starts collapsed on small screens.
const panel = document.getElementById("panel");
if (matchMedia("(max-width: 640px)").matches) panel.open = false;

// map.html?r=at/soelden (the link on a resort's page): zoomed in on that resort.
const WANTED = new URLSearchParams(location.search).get("r");

// With ?r=, the resort asked for: its area, or its point. That needs the data, so the map waits
// for it rather than drawing all resorts first and then moving.
function resortView([index, ski]) {
  const area = ski?.resorts.get(WANTED);
  if (area) return { bounds: geometryBounds(area.geometry), fitBoundsOptions: { padding: 30, maxZoom: 12 } };
  const wanted = index.resorts.find((r) => skiKey(r) === WANTED);
  return wanted && skiPoint(wanted, ski) ? { center: skiPoint(wanted, ski), zoom: 12 } : ALL_RESORTS;
}

const data = Promise.all([loadIndex(), loadSki()]);
baseMap("map", WANTED ? data.then(resortView).catch(() => ALL_RESORTS) : ALL_RESORTS).then((map) =>
  data
    .then((loaded) => show(map, loaded))
    .catch((error) => {
      document.getElementById("updated").textContent = t("Could not load the data ({message})", error);
    }),
);
