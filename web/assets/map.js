// map.html: every resort with a location as a marker, coloured by status;
// the number on a marker is the value chosen in the options panel (open lifts
// by default). A click shows the report. The panel's filters (status, country and region, size)
// choose which resorts show, apart from what the markers show; they're kept in the address.
// Resorts with a ski area in the ski tiles (assets/ski.js) also show it, and the pistes and lifts
// appear when zoomed in (before that, the lifts joining an area's parts show as lines in its colour);
// from there, the area takes the marker's place: hovering it names the
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
    label: t("Slope length (km)"),
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

/** @param {IndexResort} r */
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
/** @param {IndexResort} r */
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
      ...meter(slopes?.open, slopes?.total, active),
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
      el("span", { class: "status-pill status-badge", "data-status": status }, capitalized(label)),
    ),
    el("div", { class: "where" }, [r.region, countryName(r.country)].filter(Boolean).join(" · ")),
  );
  if (values.length) content.append(el("div", { class: "values" }, ...values));
  content.append(fnuggCredit(r));
  const time = viennaTime(r.checked_at, { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
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
  const resorts = index.resorts.filter((r) => skiPoint(r, ski));
  const byKey = new Map(resorts.map((r) => [skiKey(r), r]));
  // The legend of the lifts' and pistes' statuses: once a resort in view has them, where the pistes show.
  const legend = document.getElementById("ski-legend");
  let withStates = false;
  const showLegend = () => (legend.hidden = !(withStates && map.getZoom() >= SKI_MIN_ZOOM));
  addPistes(map, ski, {
    names: new Map(index.resorts.map((r) => [skiKey(r), r.name])),
    tips: false,
    onStates: () => {
      withStates = true;
      showLegend();
    },
  });

  // The areas and the lifts joining their parts (a cable car across a valley, outside the outline), in
  // their resort's status colour, as assets/ski-style.json draws them: filled when zoomed out, only an
  // outline where the pistes show (filled faintly when hovered), so they stay visible. Clickable at every zoom.
  const areas = resorts
    .map((r) => ski?.resorts.get(skiKey(r)))
    .filter(Boolean)
    .map((f) => ({ ...f, properties: { key: f.properties.id, status: statusKey(byKey.get(f.properties.id)) } }));
  const links = areas
    .filter((f) => ski.resorts.get(f.properties.key).properties.links)
    .map((f) => ({
      type: "Feature",
      properties: f.properties,
      geometry: { type: "MultiLineString", coordinates: ski.resorts.get(f.properties.key).properties.links },
    }));
  if (ski) {
    map.getSource("ski-areas").setData({ type: "FeatureCollection", features: areas });
    map.getSource("ski-links").setData({ type: "FeatureCollection", features: links });
  }
  // Hovering an area or its links highlights both (the style's "picked").
  const layers = ski ? ["ski-areas-fill", "ski-areas-links"] : [];
  let picked = "";
  const pick = (key) => {
    if (key === picked) return;
    picked = key;
    map.setGlobalStateProperty("picked", key);
  };
  for (const layer of layers) {
    map.on("mousemove", layer, (e) => pick(e.features[0].properties.key));
    map.on("mouseleave", layer, () => pick(""));
  }
  const tip = hoverTip(map, layers, (f) => el("b", {}, byKey.get(f.properties.key).name));
  // One report open at a time: a click on a pin doesn't reach the map (it would close it), so a new one
  // closes the last itself.
  /** @type {import("maplibre-gl").Popup | null} */
  let opened = null;
  const openPopup = (r, at) => {
    opened?.remove();
    // A narrow map has no room beside the marker: centre it, with the popup above.
    if (map.getContainer().clientWidth < 500) map.jumpTo({ center: at, offset: [0, 120] });
    opened = new maplibregl.Popup({ maxWidth: "296px", offset: 14 })
      .setLngLat(at)
      .setDOMContent(popup(r, statusKey(r), Boolean(ski?.resorts.has(skiKey(r)))))
      .addTo(map);
  };
  for (const layer of layers) {
    map.on("click", layer, (e) => {
      tip.remove();
      openPopup(byKey.get(e.features[0].properties.key), e.lngLat);
    });
  }

  /** @type {Marker[]} */
  const markers = [];
  for (const r of resorts) {
    const status = statusKey(r);
    const element = el("div", { class: "pin status-badge", title: r.name, "data-status": status });
    element.style.zIndex = status === "open" ? OPEN_ON_TOP : 0;
    element.addEventListener("mouseenter", () => (element.style.zIndex = OPEN_ON_TOP + 1));
    element.addEventListener("mouseleave", () => (element.style.zIndex = status === "open" ? OPEN_ON_TOP : 0));
    const marker = new maplibregl.Marker({ element }).setLngLat(skiPoint(r, ski)).addTo(map);
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      openPopup(r, marker.getLngLat());
    });
    markers.push({ marker, element, r, status, area: Boolean(ski?.resorts.has(skiKey(r))), passes: true });
  }
  // Shown: the markers of the resorts that pass the filters, except, where the pistes show, those of
  // resorts with an area.
  const showMarkers = () => {
    const zoomedIn = map.getZoom() >= SKI_MIN_ZOOM;
    for (const { element, area, passes } of markers) {
      element.style.display = passes && !(zoomedIn && area) ? "" : "none";
    }
  };
  // Redrawn only when the zoom crosses that line, not on every frame of a zoom.
  let wasZoomedIn = map.getZoom() >= SKI_MIN_ZOOM;
  map.on("zoom", () => {
    if (wasZoomedIn === map.getZoom() >= SKI_MIN_ZOOM) return;
    wasZoomedIn = !wasZoomedIn;
    showMarkers();
    showLegend();
  });

  const setLabels = (choice) => {
    for (const { element, r, status } of markers) element.textContent = labelText(r, status, choice);
  };
  let choice = { metric: "lifts", mode: "open" };
  try {
    const saved = JSON.parse(localStorage.getItem(LABEL_KEY) ?? "null");
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

  // The filters, from the address; a country or region asked for there is where the map opens
  // (unless ?r= asks for a resort).
  const filter = readFilter();
  const applyFilter = (fit = false) => {
    const active = filterActive(filter);
    for (const m of markers) m.passes = passes(filter, m);
    showMarkers();
    if (ski) {
      const keys = markers.filter((m) => m.passes && m.area).map((m) => skiKey(m.r));
      const areaFilter = active ? ["in", ["get", "key"], ["literal", keys]] : null;
      for (const layer of ["ski-areas-fill", "ski-areas-line", "ski-areas-links"]) map.setFilter(layer, areaFilter);
    }
    if (fit)
      fitTo(
        map,
        markers.filter((m) => m.passes),
      );
    writeFilter(filter);
    controls.update();
  };
  const controls = filterPanel(markers, filter, applyFilter);
  applyFilter(false);
  if (!WANTED && (filter.countries.size || filter.regions.size))
    fitTo(
      map,
      markers.filter((m) => m.passes),
      0,
    );

  // map.html?r=at/soelden: the map opened there (startView), with the resort's report open.
  const focus = markers.find(({ r }) => skiKey(r) === WANTED);
  if (focus) openPopup(focus.r, focus.marker.getLngLat());
}

/**
 * @typedef {{ marker: import("maplibre-gl").Marker, element: HTMLElement, r: IndexResort, status: string,
 *   area: boolean, passes: boolean }} Marker
 * @typedef {{ status: Set<string>, countries: Set<string>, regions: Set<string>,
 *   sizes: Record<string, [number, number]> }} MapFilter
 */

// The sizes the map can be filtered by, all of the whole area (whether a resort is open is the status's
// filter). The sliders go by these steps rather than evenly: most resorts are small (half have 7 lifts or
// fewer, the largest 85), so even steps would leave them all in the slider's first quarter. A slider's
// last place is "no upper limit".
const SIZES = {
  lifts: { label: t("Lifts"), value: (r) => r.lifts?.total, steps: [0, 3, 5, 10, 15, 20, 30, 40, 60] },
  slopes: { label: t("Slopes"), value: (r) => r.slopes?.total, steps: [0, 5, 10, 15, 20, 30, 50, 80, 120] },
  km: { label: t("Slope length (km)"), value: (r) => r.slopes?.total_km, steps: [0, 5, 10, 20, 40, 60, 100, 150, 200] },
};
/** @returns {[number, number]} */
const anySize = (key) => [0, SIZES[key].steps.length];
const sizeActive = (filter, key) => filter.sizes[key][0] > 0 || filter.sizes[key][1] < SIZES[key].steps.length;
const regionKey = (r) => `${r.country}:${r.region ?? ""}`;

/** @param {MapFilter} filter */
function filterActive(filter) {
  return (
    filter.status.size > 0 ||
    filter.countries.size > 0 ||
    filter.regions.size > 0 ||
    Object.keys(SIZES).some((key) => sizeActive(filter, key))
  );
}

// Whether a resort passes the filters, leaving one of them out ("status", "place", a size's key or "sizes"): the
// counts beside each choice are of the resorts the other filters leave.
/**
 * @param {MapFilter} filter
 * @param {Marker} m
 * @param {string} [except]
 */
function passes(filter, { r, status }, except = "") {
  if (except !== "status" && filter.status.size && !filter.status.has(status)) return false;
  if (
    except !== "place" &&
    (filter.countries.size || filter.regions.size) &&
    !filter.countries.has(r.country) &&
    !filter.regions.has(regionKey(r))
  )
    return false;
  for (const [key, { value, steps }] of Object.entries(SIZES)) {
    if (except === "sizes" || key === except || !sizeActive(filter, key)) continue;
    const v = value(r);
    const [low, high] = filter.sizes[key];
    // A resort without the value can't be said to be in the range.
    if (v === null || v === undefined || v < steps[low] || (high < steps.length && v > steps[high])) return false;
  }
  return true;
}

// "any", "10+", "≤ 40" or "10–40".
function sizeText(key, [low, high]) {
  const { steps } = SIZES[key];
  if (high === steps.length) return low ? `${steps[low]}+` : t("any");
  return low ? `${steps[low]}–${steps[high]}` : `≤ ${steps[high]}`;
}

// The filters in the address, so a filtered map can be linked to: map.html?status=open&country=at,ch
// &region=it:Lombardia&lifts=10-40 (sizes as from-to, either end left out when open).
/** @returns {MapFilter} */
function readFilter() {
  const params = new URLSearchParams(location.search);
  const list = (name) => (params.get(name) ?? "").split(",").filter(Boolean);
  /** @type {MapFilter} */
  const filter = {
    status: new Set(list("status").filter((s) => STATUS[s])),
    // Country codes only: anything else (?country=aut) would stop the page in countryName().
    countries: new Set(list("country").filter((c) => /^[a-z]{2}$/.test(c))),
    regions: new Set(params.getAll("region")),
    sizes: {},
  };
  for (const [key, { steps }] of Object.entries(SIZES)) {
    const [from, to] = (params.get(key) ?? "-").split("-");
    const low = from ? steps.indexOf(Number(from)) : 0;
    const high = to ? steps.indexOf(Number(to)) : steps.length;
    filter.sizes[key] = low >= 0 && high > low ? [low, high] : anySize(key);
  }
  return filter;
}

/** @param {MapFilter} filter */
function writeFilter(filter) {
  const params = new URLSearchParams(location.search);
  const set = (name, values) => (values.length ? params.set(name, values.join(",")) : params.delete(name));
  set("status", [...filter.status]);
  set("country", [...filter.countries]);
  params.delete("region");
  for (const region of filter.regions) params.append("region", region);
  for (const [key, { steps }] of Object.entries(SIZES)) {
    const [low, high] = filter.sizes[key];
    set(key, sizeActive(filter, key) ? [`${low ? steps[low] : ""}-${high < steps.length ? steps[high] : ""}`] : []);
  }
  const query = params.toString();
  history.replaceState(history.state, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

// The map moved to the resorts shown (after choosing a country or region).
/**
 * @param {import("maplibre-gl").Map} map
 * @param {Marker[]} shown
 */
function fitTo(map, shown, duration = 600) {
  if (!shown.length) return;
  const bounds = new maplibregl.LngLatBounds();
  for (const { marker } of shown) bounds.extend(marker.getLngLat());
  map.fitBounds(bounds, { padding: 50, maxZoom: 10, duration });
}

// The filter part of the options panel, and the active filters above the map, each removable on its own.
// Changing a filter calls apply (with true when the map should move to what's left); update() then
// redraws the counts and choices.
/**
 * @param {Marker[]} markers
 * @param {MapFilter} filter
 * @param {(fit?: boolean) => void} apply
 */
function filterPanel(markers, filter, apply) {
  const updates = [];
  /** @type {Map<string, Marker[]>} */
  const byCountry = new Map();
  for (const m of markers) byCountry.set(m.r.country, [...(byCountry.get(m.r.country) ?? []), m]);
  const countries = [...byCountry.keys()].sort((a, b) => countryName(a).localeCompare(countryName(b), LANG));

  // Status.
  const statusGroup = /** @type {HTMLElement} */ (document.getElementById("filters"));
  for (const [status, { label }] of Object.entries(STATUS)) {
    if (!markers.some((m) => m.status === status)) continue;
    const count = el("span", { class: "count" });
    const chip = button("chip", "", () => {
      filter.status.has(status) ? filter.status.delete(status) : filter.status.add(status);
      apply();
    });
    chip.append(el("span", { class: "dot", style: `--c:${color(status)}` }), capitalized(label), count);
    statusGroup.append(chip);
    updates.push(() => {
      chip.setAttribute("aria-pressed", String(filter.status.has(status)));
      count.textContent = String(markers.filter((m) => m.status === status && passes(filter, m, "status")).length);
    });
  }

  // Countries, each with its regions under it. A country chosen whole is in filter.countries; some of its
  // regions, in filter.regions (a country with all its regions chosen goes back to being chosen whole).
  const places = /** @type {HTMLElement} */ (document.getElementById("places"));
  const search = /** @type {HTMLInputElement} */ (document.getElementById("place-search"));
  /** @type {{ row: HTMLElement, text: string, regions: { row: HTMLElement, text: string }[], open: (on?: boolean) => void }[]} */
  const rows = [];
  for (const country of countries) {
    const regions = [...new Set(byCountry.get(country)?.map((m) => m.r.region ?? ""))].sort((a, b) =>
      a.localeCompare(b, LANG),
    );
    const regionKeys = regions.map((region) => `${country}:${region}`);
    const box = el("input", { type: "checkbox" });
    const count = el("span", { class: "count" });
    const expand = el("button", {
      type: "button",
      class: "expand",
      "aria-expanded": "false",
      "aria-label": t("Regions of {country}", { country: countryName(country) }),
    });
    const list = el("ul", { class: "regions" });
    list.hidden = true;
    /** @param {boolean} [on] */
    const open = (on = list.hidden) => {
      list.hidden = !on;
      expand.setAttribute("aria-expanded", String(on));
    };
    // Opened, the country goes to the top of the list, its regions under it in view.
    expand.addEventListener("click", () => {
      open();
      if (!list.hidden) places.scrollTo({ top: row.offsetTop - places.offsetTop, behavior: "smooth" });
    });
    box.addEventListener("change", () => {
      for (const key of regionKeys) filter.regions.delete(key);
      box.checked ? filter.countries.add(country) : filter.countries.delete(country);
      apply(true);
    });
    const regionRows = regions.map((region, i) => {
      const key = regionKeys[i];
      const regionBox = el("input", { type: "checkbox" });
      const regionCount = el("span", { class: "count" });
      regionBox.addEventListener("change", () => {
        if (filter.countries.delete(country)) for (const other of regionKeys) filter.regions.add(other);
        regionBox.checked ? filter.regions.add(key) : filter.regions.delete(key);
        if (regionKeys.every((k) => filter.regions.has(k))) {
          for (const k of regionKeys) filter.regions.delete(k);
          filter.countries.add(country);
        }
        apply(true);
      });
      const row = el("li", {}, el("label", {}, regionBox, el("span", { class: "name" }, region)), regionCount);
      list.append(row);
      updates.push(() => {
        regionBox.checked = filter.countries.has(country) || filter.regions.has(key);
        regionCount.textContent = String(
          markers.filter((m) => m.r.country === country && (m.r.region ?? "") === region && passes(filter, m, "place"))
            .length,
        );
      });
      return { row, text: fold(region) };
    });
    const row = el(
      "li",
      {},
      el(
        "div",
        { class: "place" },
        el(
          "label",
          {},
          box,
          el("span", { class: "flag", "data-country": country, "aria-hidden": "true" }),
          el("span", { class: "name" }, countryName(country)),
        ),
        count,
        expand,
      ),
      list,
    );
    places.append(row);
    rows.push({ row, text: fold(countryName(country)), regions: regionRows, open });
    updates.push(() => {
      const some = regionKeys.some((k) => filter.regions.has(k));
      box.checked = filter.countries.has(country);
      box.indeterminate = !box.checked && some;
      count.textContent = String(markers.filter((m) => m.r.country === country && passes(filter, m, "place")).length);
      if (some) open(true);
    });
  }
  // The search narrows the list: a country that matches with all its regions (closed), otherwise the
  // regions that match, under their country.
  search.addEventListener("input", () => {
    const wanted = fold(search.value.trim());
    for (const { row, text, regions, open } of rows) {
      const whole = !wanted || text.includes(wanted);
      let any = false;
      for (const region of regions) {
        const match = whole || region.text.includes(wanted);
        region.row.hidden = !match;
        any ||= match;
      }
      row.hidden = !any;
      open(Boolean(wanted) && !whole);
    }
    // Cleared, the countries with some regions chosen open again.
    if (!wanted) for (const update of updates) update();
  });

  // Sizes: a slider with two handles each.
  const sizes = /** @type {HTMLElement} */ (document.getElementById("sizes"));
  const sizeHint = /** @type {HTMLElement} */ (document.getElementById("size-hint"));
  for (const [key, { label, steps }] of Object.entries(SIZES)) {
    const output = el("output", {});
    const range = el("div", { class: "range" });
    const handle = (name) =>
      /** @type {HTMLInputElement} */ (
        el("input", { type: "range", min: "0", max: String(steps.length), step: "1", "aria-label": name })
      );
    const low = handle(t("{name}, from", { name: label }));
    const high = handle(t("{name}, up to", { name: label }));
    range.append(low, high);
    // The handles never cross: the one moved stops one step short of the other.
    /** @param {HTMLInputElement} moved */
    const read = (moved) => {
      let [from, to] = [Number(low.value), Number(high.value)];
      if (from >= to && moved === high) to = from + 1;
      else if (from >= to) from = to - 1;
      filter.sizes[key] = [Math.max(0, from), Math.min(steps.length, to)];
      apply();
    };
    low.addEventListener("input", () => read(low));
    high.addEventListener("input", () => read(high));
    sizes.append(el("div", { class: "size" }, el("div", { class: "size-head" }, el("span", {}, label), output), range));
    updates.push(() => {
      const [from, to] = filter.sizes[key];
      low.value = String(from);
      high.value = String(to);
      output.textContent = sizeText(key, [from, to]);
      output.classList.toggle("on", sizeActive(filter, key));
      range.style.setProperty("--low", `${(100 * from) / steps.length}%`);
      range.style.setProperty("--high", `${(100 * to) / steps.length}%`);
      // At the right end, the lower handle on top, so the two can be told apart.
      low.style.zIndex = from >= steps.length - 1 ? "2" : "";
    });
  }
  updates.push(() => {
    const active = Object.keys(SIZES).filter((key) => sizeActive(filter, key));
    const missing = markers.filter(
      (m) => passes(filter, m, "sizes") && active.some((key) => SIZES[key].value(m.r) == null),
    ).length;
    sizeHint.textContent = missing ? t("{n} resorts without this size hidden", { n: missing }) : "";
  });

  // The count on the filters' button, and "Clear", while a filter is on.
  const shown = /** @type {HTMLElement} */ (document.getElementById("shown"));
  const clear = /** @type {HTMLButtonElement} */ (document.getElementById("clear"));
  clear.addEventListener("click", () => {
    clearFilter(filter);
    apply();
  });
  updates.push(() => {
    const count = markers.filter((m) => m.passes).length;
    shown.textContent = t("{shown} of {total}", { shown: count, total: markers.length });
    shown.hidden = clear.hidden = !filterActive(filter);
  });

  // The active filters over the map, each with a button to remove it.
  const bar = /** @type {HTMLElement} */ (document.getElementById("active-filters"));
  const removable = (text, remove, flag = "") => {
    const chip = button("chip on", "", () => {
      remove();
      apply();
    });
    chip.setAttribute("aria-label", t("Remove filter: {name}", { name: text }));
    if (flag) chip.append(el("span", { class: "flag", "data-country": flag, "aria-hidden": "true" }));
    chip.append(text, el("span", { class: "x", "aria-hidden": "true" }, "×"));
    return chip;
  };
  updates.push(() => {
    const chips = [];
    for (const status of filter.status)
      chips.push(removable(capitalized(STATUS[status].label), () => filter.status.delete(status)));
    for (const country of filter.countries)
      chips.push(removable(countryName(country), () => filter.countries.delete(country), country));
    for (const key of filter.regions) {
      const [country, region] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
      chips.push(removable(region, () => filter.regions.delete(key), country));
    }
    for (const key of Object.keys(SIZES))
      if (sizeActive(filter, key))
        chips.push(
          removable(
            `${SIZES[key].label} ${sizeText(key, filter.sizes[key])}`,
            () => (filter.sizes[key] = anySize(key)),
          ),
        );
    bar.replaceChildren(...chips);
    bar.hidden = !chips.length;
  });

  return {
    update: () => {
      for (const update of updates) update();
    },
  };
}

/** @param {MapFilter} filter */
function clearFilter(filter) {
  filter.status.clear();
  filter.countries.clear();
  filter.regions.clear();
  for (const key of Object.keys(SIZES)) filter.sizes[key] = anySize(key);
}

function button(className, text, onClick) {
  const node = el("button", { type: "button", class: className }, text);
  node.addEventListener("click", onClick);
  return node;
}

// The filters' and the options' panels: one open at a time, the filters at first, none on small screens.
/** @type {NodeListOf<HTMLDetailsElement>} */
const panels = document.querySelectorAll(".panels details");
for (const panel of panels)
  panel.addEventListener("toggle", () => {
    if (panel.open) for (const other of panels) if (other !== panel) other.open = false;
  });
if (matchMedia("(max-width: 640px)").matches) for (const panel of panels) panel.open = false;

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

closeOnOutside(/** @type {HTMLDetailsElement} */ (document.querySelector(".updated-menu")));

const data = Promise.all([loadIndex(), loadSki()]);
// The update time as soon as the data is in, not only once the base map has loaded.
data.then(
  ([index]) => {
    document.getElementById("updated").textContent = updatedText(index);
  },
  () => {},
);
baseMap("map", WANTED ? data.then(resortView).catch(() => ALL_RESORTS) : ALL_RESORTS).then((map) =>
  data
    .then((loaded) => show(map, loaded))
    .catch((error) => {
      const updated = /** @type {HTMLElement} */ (document.getElementById("updated"));
      updated.textContent = t("Could not load the data ({message})", error);
      updated.parentElement?.classList.add("failed");
    }),
);
