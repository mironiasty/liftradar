// resort.html?r=<country>/<id>: everything in one resort's JSON, its area on the
// map (with the resorts around it) and its history (key numbers of past runs).

const LIFT_TYPES = {
  gondola: t("Gondolas"),
  cable_car: t("Cable cars"),
  chairlift: t("Chairlifts"),
  drag_lift: t("Drag lifts"),
  carpet: t("Carpets"),
  funicular: t("Funiculars"),
  other: t("Other"),
};
// Piste colours as on slope maps; ski routes yellow.
const DIFFICULTIES = {
  easy: [t("Easy"), "#2a6fdb"],
  intermediate: [t("Intermediate"), "#d62828"],
  difficult: [t("Difficult"), "var(--fg)"],
  ski_route: [t("Ski routes"), "#f2b705"],
  other: [t("Other"), "var(--muted)"],
};
const DANGER_LEVELS = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 };
const PERIODS = { all_day: "", earlier: t("morning"), later: t("afternoon") };
// The EAWS problem names, as the bulletins publish them; unknown ones are shown as they are.
const PROBLEMS = {
  new_snow: t("new snow"),
  wind_slab: t("wind slab"),
  persistent_weak_layers: t("persistent weak layers"),
  wet_snow: t("wet snow"),
  gliding_snow: t("gliding snow"),
  favourable_situation: t("favourable situation"),
  no_distinct_avalanche_problem: t("no distinct avalanche problem"),
};
const HISTORY_DAYS = 30;

L.Control.Zoom.mergeOptions({ zoomInTitle: t("Zoom in"), zoomOutTitle: t("Zoom out") });

const page = document.getElementById("page");
const label = (text) => text.replaceAll("_", " ");
const present = (v) => v !== null && v !== undefined;

function fail(message) {
  page.replaceChildren(el("p", {}, message, " ", el("a", { href: "./" }, t("See all resorts"))));
}

// ?r=at/soelden; anything else isn't a resort path.
function requested() {
  const path = new URLSearchParams(location.search).get("r") ?? "";
  const match = path.match(/^([a-z]{2})\/([a-z0-9][a-z0-9-]*)$/);
  return match ? { country: match[1], id: match[2] } : null;
}

function meter(open, total) {
  if (!present(open) || !total) return el("div", { class: "meter" });
  return el("div", { class: "meter" }, el("span", { style: `width:${Math.min(100, (100 * open) / total)}%` }));
}

function tile(title, value, ...notes) {
  return el(
    "div",
    { class: "tile" },
    el("div", { class: "label" }, title),
    el("div", { class: "value" }, ...[value].flat()),
    ...notes.filter(Boolean).map((note) => (typeof note === "string" ? el("div", { class: "note" }, note) : note)),
  );
}

const cm = (v) => (present(v) ? [String(v), el("small", {}, " cm")] : "–");

function tiles(r) {
  const { snow, lifts, slopes, avalanche } = r;
  // Bars and shares only for open resorts: elsewhere open counts are 0 or not reported.
  const active = statusKey(r) === "open";
  const share = (open, total) =>
    active && present(open) && total ? t("{share}% open", { share: Math.round((100 * open) / total) }) : null;
  const lastSnowfall = snow.last_snowfall
    ? t("Last snowfall {date}", { date: viennaTime(snow.last_snowfall, { dateStyle: "medium" }) })
    : null;
  const danger = avalanche?.danger_level
    ? [
        el("span", { class: `badge lvl${avalanche.danger_level}` }, String(avalanche.danger_level)),
        dangerName(avalanche.danger),
      ]
    : "–";
  return el(
    "div",
    { class: "tiles" },
    tile(t("Mountain"), cm(snow.mountain_cm), snow.condition),
    tile(t("Valley"), cm(snow.valley_cm)),
    tile(
      t("Fresh snow"),
      snow.fresh_cm ? el("span", { class: "fresh" }, `+${snow.fresh_cm}`, el("small", {}, " cm")) : cm(snow.fresh_cm),
      lastSnowfall,
    ),
    tile(
      t("Lifts"),
      pair(lifts?.open, lifts?.total),
      active && lifts?.total ? meter(lifts.open, lifts.total) : null,
      share(lifts?.open, lifts?.total),
    ),
    tile(
      t("Slopes"),
      present(slopes?.open) || present(slopes?.total)
        ? pair(slopes.open, slopes.total)
        : pair(slopes?.open_km, slopes?.total_km, " km"),
      active && slopes?.total ? meter(slopes.open, slopes.total) : null,
      present(slopes?.open) || present(slopes?.total)
        ? present(slopes?.total_km)
          ? pair(slopes.open_km, slopes.total_km, " km")
          : null
        : null,
    ),
    tile(t("Avalanche danger"), danger, avalanche?.region),
  );
}

// Why numbers are missing, from the README's "Status".
function statusNote(r) {
  // status_from: this run couldn't read the status, kept from that run's (for 2 days, then no report).
  const since = r.status_from && viennaTime(r.status_from);
  if (since && new Date(r.fetched_at) - new Date(r.status_from) > 2 * 864e5)
    return t(
      "No report: the resort's report couldn't be read since {since}; only the area's size (lifts, slopes, km) is kept.",
      { since },
    );
  const kept = since
    ? t("Status, lifts and slopes as read {since}: the latest report couldn't be read.", { since })
    : "";
  if (r.status === "closed")
    return [t("Closed: no snow depths are shown, since closed resorts' reports often still carry last season's."), kept]
      .join(" ")
      .trim();
  if (statusKey(r) === "no_report")
    return [
      t(
        "No report for 14 days: only the area's size (lifts, slopes, km) is kept; the 0 open lifts means not reported.",
      ),
      kept,
    ]
      .join(" ")
      .trim();
  return kept || null;
}

function header(r) {
  const status = statusKey(r);
  const meta = [r.region, countryName(r.country)].filter(Boolean).join(" · ");
  const { checked, changed, days, stale } = reportTimes(r);
  const times = [
    t("Checked {time}", { time: viennaTime(checked) }),
    changed && t("resort's last change {time}", { time: viennaTime(changed) }),
  ]
    .filter(Boolean)
    .join(" · ");
  const unchanged =
    stale && !r.status_from
      ? ` ${t("The resort hasn't changed its report for {n} days: check its own page.", { n: days })}`
      : "";
  const note = statusNote(r);
  return el(
    "header",
    { class: "resort-head" },
    backLink(),
    el("h1", {}, r.name),
    el(
      "div",
      { class: "facts" },
      el(
        "span",
        { class: "status" },
        el("span", { class: "dot", style: `--c:${STATUS_COLORS[status]}` }),
        STATUS_LABELS[status],
      ),
      el("span", {}, meta),
    ),
    fnuggCredit(r),
    el("p", { class: stale ? "meta stale" : "meta" }, times + unchanged),
    note ? el("p", { class: "meta" }, note) : "",
  );
}

// Back to the list of all resorts, with the filters and order it had in this tab.
function backLink() {
  let list = "";
  try {
    list = sessionStorage.getItem(LIST_KEY) ?? "";
  } catch {}
  const link = el("a", { class: "pill back", href: `./${list}` });
  link.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
    ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>' +
    t("All resorts");
  return link;
}

function stations(list) {
  if (!list.length) return null;
  const rows = list.map((s) =>
    el(
      "tr",
      {},
      el("td", {}, s.name),
      el("td", { class: "num" }, dash(s.elevation_m, " m")),
      el("td", { class: "num" }, dash(s.depth_cm, " cm")),
      el("td", { class: "num" }, dash(s.fresh_cm, " cm")),
      el("td", { class: "num" }, dash(s.temperature_c, " °C")),
      el("td", {}, dash(s.condition)),
    ),
  );
  return el(
    "section",
    { class: "card" },
    el("h2", {}, t("Measuring points")),
    el(
      "div",
      { class: "scroll" },
      el(
        "table",
        {},
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            ...[t("Station"), t("Elevation"), t("Depth"), t("Fresh"), t("Temp."), t("Condition")].map((h, i) =>
              el("th", { class: i && i < 5 ? "num" : "" }, h),
            ),
          ),
        ),
        el("tbody", {}, ...rows),
      ),
    ),
  );
}

function breakdown(r) {
  const parts = [];
  if (r.lifts_by_type) {
    const rows = Object.entries(r.lifts_by_type).flatMap(([type, c]) => [
      el("span", {}, LIFT_TYPES[type] ?? label(type)),
      el("span", { class: "n" }, pair(c.open, c.total)),
      meter(c.open, c.total),
    ]);
    parts.push(el("div", {}, el("h2", {}, t("Lifts by type")), el("div", { class: "bars" }, ...rows)));
  }
  if (r.slopes_by_difficulty) {
    const rows = Object.entries(r.slopes_by_difficulty).flatMap(([difficulty, c]) => {
      const [name, colour] = DIFFICULTIES[difficulty] ?? [label(difficulty), "var(--muted)"];
      const km =
        present(c.open_km) || present(c.total_km) ? el("div", { class: "km" }, pair(c.open_km, c.total_km, " km")) : "";
      return [
        el("span", {}, el("span", { class: "diff", style: `--c:${colour}` }), name, km),
        el("span", { class: "n" }, pair(c.open, c.total)),
        meter(c.open, c.total),
      ];
    });
    parts.push(el("div", {}, el("h2", {}, t("Slopes by difficulty")), el("div", { class: "bars" }, ...rows)));
  }
  return parts.length ? el("section", { class: "card breakdown" }, ...parts) : null;
}

function elevation(rating) {
  const { lower_bound: lower, upper_bound: upper } = rating;
  const bound = (b) => (b === "treeline" ? t("the treeline") : `${b} m`);
  if (present(lower) && present(upper)) return `${bound(lower)} – ${bound(upper)}`;
  if (lower === "treeline") return t("above the treeline");
  if (upper === "treeline") return t("below the treeline");
  if (present(lower)) return t("above {m} m", { m: lower });
  if (present(upper)) return t("below {m} m", { m: upper });
  return t("all elevations");
}

function avalanche(bulletin) {
  if (!bulletin) return null;
  const ratings = bulletin.ratings.map((rating) => {
    const level = DANGER_LEVELS[rating.level];
    const period = PERIODS[rating.period] ? `, ${PERIODS[rating.period]}` : "";
    return el(
      "div",
      {},
      level ? el("span", { class: `badge lvl${level}` }, String(level)) : el("span", { class: "badge" }, "–"),
      `${dangerName(rating.level)}: ${elevation(rating)}${period}`,
    );
  });
  const problems = bulletin.problems.length
    ? el(
        "p",
        { class: "meta" },
        t("Problems: {list}", { list: bulletin.problems.map((p) => PROBLEMS[p] ?? label(p)).join(", ") }),
      )
    : "";
  return el(
    "section",
    { class: "card" },
    el("h2", {}, t("Avalanche bulletin")),
    el("div", {}, el("strong", {}, bulletin.region), el("span", { class: "meta" }, ` (${bulletin.region_id})`)),
    el("div", { class: "ratings" }, ...ratings),
    problems,
    el(
      "p",
      { class: "meta" },
      t("Valid {from} – {until}", { from: viennaTime(bulletin.valid_from), until: viennaTime(bulletin.valid_until) }),
    ),
  );
}

function data(r) {
  const url = new URL(resortPath(r), location.href).href;
  const input = el("input", { type: "text", readonly: "", value: url, "aria-label": t("JSON URL") });
  input.addEventListener("focus", () => input.select());
  const copy = el("button", { type: "button" }, t("Copy"));
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = t("Copied");
    } catch {
      input.select();
      copy.textContent = t("Press ⌘C");
    }
    setTimeout(() => (copy.textContent = t("Copy")), 2000);
  });
  const section = el(
    "section",
    { class: "card data" },
    el("h2", {}, t("Data")),
    el(
      "div",
      { class: "meta" },
      t("This resort's JSON, e.g. for the "),
      el("a", { href: "https://trmnl.com/recipes/ski-resort-snow-report-219253" }, t("TRMNL plugin")),
      t(": paste it as its Resort."),
    ),
    el("div", { class: "url" }, input, copy, el("a", { href: resortPath(r) }, t("Open|file"))),
  );
  section.append(
    el("div", { class: "meta", style: "margin-top:12px" }, t("Sources")),
    el(
      "ul",
      { class: "sources" },
      ...r.sources.map((source) => el("li", {}, el("a", { href: source, rel: "nofollow" }, source))),
    ),
  );
  return section;
}

// Resort map: only this resort's area (or point); "Map of all resorts" shows the others.
function resortMap(r, container) {
  const map = L.map(container, { zoomSnap: 0.5, scrollWheelZoom: false });
  L.tileLayer("https://tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  }).addTo(map);
  L.tileLayer("https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png", {
    minZoom: 10,
    maxZoom: 17,
    attribution: '<a href="https://www.opensnowmap.org">OpenSnowMap</a>',
  }).addTo(map);
  if (r.location) map.setView([r.location.lat, r.location.lon], 12);
  else map.setView([47.25, 11.9], 7);
  map.once("focus", () => map.scrollWheelZoom.enable());

  const css = getComputedStyle(document.documentElement);
  const colour = (status) => css.getPropertyValue(STATUS_COLORS[status].slice(4, -1)).trim();
  const pin = (status) =>
    L.divIcon({
      className: "",
      html: el("div", { class: "pin", style: `background:${colour(status)}` }),
      iconSize: null,
      iconAnchor: [0, 0],
    });

  fetch(AREAS_URL)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((areas) => {
      const status = statusKey(r);
      const area = areas?.features.find((f) => f.properties.id === r.id);
      if (area) {
        const accent = css.getPropertyValue("--accent").trim();
        const layer = L.geoJSON(area, { style: { color: accent, weight: 3, fillOpacity: 0.12 } }).addTo(map);
        map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 13 });
      }
      if (r.location)
        L.marker([r.location.lat, r.location.lon], { icon: pin(status), title: r.name, zIndexOffset: 1000 }).addTo(map);
    });
}

// History: the latest HISTORY_DAYS of runs, from the resort's history file (one list per value, an entry per run).
async function history(r, container) {
  const response = await fetch(historyPath(r), { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const runs = (await response.json()).runs;
  const since = Date.now() - HISTORY_DAYS * 864e5;
  const recent = runs.time.map((time, i) => ({ t: new Date(time), i })).filter((run) => run.t >= since);
  const series = (key) => recent.map(({ t, i }) => ({ t, v: runs[key][i] }));
  container.replaceChildren(
    chart(t("Snow on the mountain"), "cm", "var(--accent)", series("mountain_cm")),
    chart(t("Fresh snow"), "cm", "var(--accent)", series("fresh_cm")),
    chart(t("Open lifts"), "", "var(--open)", series("lifts_open")),
    chart(t("Open slopes"), "", "var(--open)", series("slopes_open")),
  );
}

// Nice upper bound for the y axis: 1, 2 or 5 times a power of ten.
function niceMax(v) {
  if (v <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * power).find((m) => m >= v);
}

// A step line (values hold until the next run), redrawn when its box resizes.
function chart(title, unit, colour, points) {
  const box = el("div", { class: "chart" }, el("h3", {}, title));
  const known = points.filter((p) => present(p.v));
  if (known.length < 2) {
    box.append(el("p", { class: "empty" }, t("Not enough runs yet.")));
    return box;
  }
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const tip = el("div", { class: "tip", hidden: "" });
  box.append(svg, tip);
  const node = (tag, attributes) => {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attributes)) n.setAttribute(k, v);
    return n;
  };
  const format = (v) => `${Math.round(v * 10) / 10}${unit ? ` ${unit}` : ""}`;
  const H = 150,
    top = 10,
    bottom = 20,
    left = 34,
    right = 10;

  const draw = () => {
    const W = box.clientWidth;
    if (!W) return;
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const t0 = points[0].t.getTime(),
      t1 = Math.max(points.at(-1).t.getTime(), t0 + 1);
    const max = niceMax(Math.max(...known.map((p) => p.v)));
    const x = (t) => left + ((t.getTime() - t0) / (t1 - t0)) * (W - left - right);
    const y = (v) => top + (1 - v / max) * (H - top - bottom);
    for (const v of [0, max / 2, max]) {
      svg.append(node("line", { class: "grid", x1: left, x2: W - right, y1: y(v), y2: y(v) }));
      const text = node("text", { class: "axis", x: left - 6, y: y(v) + 3, "text-anchor": "end" });
      text.textContent = String(v);
      svg.append(text);
    }
    for (const [t, anchor] of [
      [points[0].t, "start"],
      [points.at(-1).t, "end"],
    ]) {
      const text = node("text", { class: "axis", x: x(t), y: H - 4, "text-anchor": anchor });
      text.textContent = t.toLocaleDateString(DATE_LOCALE, {
        timeZone: "Europe/Vienna",
        day: "numeric",
        month: "short",
      });
      svg.append(text);
    }
    let d = "",
      previous = null;
    for (const p of points) {
      if (!present(p.v)) {
        previous = null;
        continue;
      }
      d += previous ? ` H${x(p.t)} V${y(p.v)}` : ` M${x(p.t)} ${y(p.v)}`;
      previous = p;
    }
    svg.append(node("path", { d, fill: "none", stroke: colour, "stroke-width": 2, "stroke-linejoin": "round" }));
    const last = known.at(-1);
    svg.append(
      node("circle", { cx: x(last.t), cy: y(last.v), r: 4, fill: colour, stroke: "var(--bg)", "stroke-width": 2 }),
    );

    // Hover: the value in force at the pointer (the latest run before it).
    const cursor = node("line", {
      x1: 0,
      x2: 0,
      y1: top,
      y2: H - bottom,
      stroke: "var(--muted)",
      "stroke-dasharray": "2 3",
      visibility: "hidden",
    });
    const dot = node("circle", { r: 4, fill: colour, stroke: "var(--bg)", "stroke-width": 2, visibility: "hidden" });
    const hit = node("rect", { x: left, y: 0, width: W - left - right, height: H, fill: "transparent" });
    svg.append(cursor, dot, hit);
    const hide = () => {
      cursor.setAttribute("visibility", "hidden");
      dot.setAttribute("visibility", "hidden");
      tip.hidden = true;
    };
    hit.addEventListener("pointermove", (event) => {
      const px = event.clientX - svg.getBoundingClientRect().left;
      const p = [...points].reverse().find((q) => x(q.t) <= px + 1) ?? points[0];
      if (!present(p.v)) return hide();
      for (const [n, k, v] of [
        [cursor, "x1", x(p.t)],
        [cursor, "x2", x(p.t)],
        [dot, "cx", x(p.t)],
        [dot, "cy", y(p.v)],
      ])
        n.setAttribute(k, v);
      cursor.setAttribute("visibility", "visible");
      dot.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.textContent = `${format(p.v)} · ${viennaTime(p.t.toISOString(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
      tip.style.left = `${x(p.t)}px`;
      tip.style.top = `${y(p.v) + box.querySelector("h3").offsetHeight - 6}px`;
    });
    hit.addEventListener("pointerleave", hide);
  };
  new ResizeObserver(draw).observe(box);
  return box;
}

async function show() {
  const wanted = requested();
  if (!wanted) return fail(t("No resort given."));
  const response = await fetch(resortPath(wanted), { cache: "no-cache" });
  if (response.status === 404) return fail(t("There's no such resort."));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const r = await response.json();
  document.title = `${r.name} – LiftRadar`;

  const mapBox = el("div", { id: "map", role: "region", "aria-label": t("Map of {name}", { name: r.name }) });
  const historyBox = el("div", { class: "charts" }, el("p", { class: "empty" }, t("Loading…")));
  const main = el(
    "div",
    { class: "stack" },
    tiles(r),
    ...[stations(r.snow.stations), breakdown(r), avalanche(r.avalanche)].filter(Boolean),
    el(
      "section",
      { class: "card" },
      el("h2", {}, t("Last {n} days", { n: HISTORY_DAYS })),
      historyBox,
      el("p", { class: "meta", style: "margin:10px 0 0" }, t("Collected since 24 October 2026.")),
    ),
  );
  page.replaceChildren(
    header(r),
    el(
      "div",
      { class: "layout" },
      main,
      el(
        "aside",
        { class: "side" },
        el(
          "div",
          { class: "map-box" },
          mapBox,
          el("a", { class: "map-link", href: resortOnMap(r) }, t("Map of all resorts →")),
        ),
        ...(r.website
          ? [
              el(
                "section",
                { class: "card" },
                el("h2", {}, t("Official website")),
                el("a", { href: r.website, rel: "noopener", style: "word-break:break-all" }, r.website),
              ),
            ]
          : []),
        data(r),
      ),
    ),
  );
  resortMap(r, mapBox);
  history(r, historyBox).catch((error) =>
    historyBox.replaceChildren(el("p", { class: "empty" }, t("No history ({message}).", error))),
  );
}

show().catch((error) => fail(t("Could not load the resort ({message}).", error)));
