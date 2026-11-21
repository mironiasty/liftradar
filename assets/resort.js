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
// One lift's type, in the list of every lift and slope.
const LIFT_TYPE = {
  gondola: t("Gondola"),
  cable_car: t("Cable car"),
  chairlift: t("Chairlift"),
  drag_lift: t("Drag lift"),
  carpet: t("Magic carpet"),
  funicular: t("Funicular"),
  other: t("Other"),
};
// A lift's or slope's status, in that list: its name and colour, in the order they're listed.
const ITEM_STATUS = {
  open: [t("open"), "var(--open)"],
  preparation: [t("in preparation"), "var(--none)"],
  closed: [t("closed"), "var(--closed)"],
  unknown: [t("unknown"), "var(--none)"],
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

/** @param {Resort} r */
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
  // First what's open, the reason most people come; then the snow and the avalanche danger.
  return el(
    "div",
    { class: "summary" },
    el(
      "div",
      { class: "tiles key" },
      tile(
        t("Lifts"),
        pair(lifts?.open, lifts?.total),
        active && lifts?.total ? meter(lifts.open, lifts.total) : null,
        share(lifts?.open, lifts?.total),
      ),
      tile(
        t("Slopes"),
        present(slopes?.open) || present(slopes?.total)
          ? pair(slopes?.open, slopes?.total)
          : pair(slopes?.open_km, slopes?.total_km, " km"),
        active && slopes?.total ? meter(slopes.open, slopes.total) : null,
        present(slopes?.open) || present(slopes?.total)
          ? present(slopes?.total_km)
            ? pair(slopes?.open_km, slopes?.total_km, " km")
            : null
          : null,
      ),
    ),
    el(
      "div",
      { class: "tiles" },
      tile(t("Mountain"), cm(snow.mountain_cm), snow.condition),
      tile(t("Valley"), cm(snow.valley_cm)),
      tile(
        t("Fresh snow"),
        snow.fresh_cm ? el("span", { class: "fresh" }, `+${snow.fresh_cm}`, el("small", {}, " cm")) : cm(snow.fresh_cm),
        lastSnowfall,
      ),
      tile(t("Avalanche danger"), danger, avalanche?.region),
    ),
  );
}

// Why numbers are missing, from the README's "Status".
/** @param {Resort} r */
function statusNote(r) {
  // status_from: this run couldn't read the status, kept from that run's (for 2 days, then no report).
  const since = r.status_from && viennaTime(r.status_from);
  if (r.status_from && Date.parse(r.fetched_at) - Date.parse(r.status_from) > 2 * 864e5)
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

/** @param {Resort} r */
function header(r) {
  const status = statusKey(r);
  // The region and country open the list of all resorts filtered to them.
  const filterLink = (text, params) => el("a", { class: "where", href: `./?${new URLSearchParams(params)}` }, text);
  const where = [
    r.region ? filterLink(r.region, { country: r.country, region: r.region }) : null,
    filterLink(countryName(r.country), { country: r.country }),
  ]
    .filter((link) => link !== null)
    .flatMap((link, i) => (i ? [" · ", link] : [link]));
  const { checked, changed, days, stale } = reportTimes(r);
  // When the report was read and last changed, opposite the name (under it on narrow screens).
  const clock = el("span", { class: "clock", "aria-hidden": "true" });
  clock.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"' +
    ' stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const checkedText = t("Checked {time}", { time: viennaTime(checked) });
  const changedText = changed && t("resort's last change {time}", { time: viennaTime(changed) });
  const times = el(
    "div",
    { class: stale ? "times stale" : "times" },
    el("span", { class: "checked" }, clock, checkedText),
    changedText ? el("span", { class: "changed" }, changedText) : "",
  );
  // Narrow screens: just the time, next to the status; tapped, it shows both lines.
  const short = viennaTime(checked, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const when = el(
    "details",
    { class: stale ? "when stale" : "when" },
    el("summary", { class: "checked" }, clock.cloneNode(true), short),
    el("div", {}, el("span", {}, checkedText), changedText ? el("span", { class: "changed" }, changedText) : ""),
  );
  closeOnOutside(when);
  const unchanged =
    stale && !r.status_from
      ? t("The resort hasn't changed its report for {n} days: check its own page.", { n: days })
      : "";
  const note = statusNote(r);
  return el(
    "header",
    { class: "resort-head" },
    backLink(),
    el(
      "div",
      { class: "head-row" },
      el(
        "div",
        { class: "head-main" },
        el("div", { class: "title" }, el("h1", {}, r.name), favoriteButton(r)),
        el(
          "div",
          { class: "facts" },
          el(
            "span",
            { class: "status" },
            el("span", { class: "dot", style: `--c:${STATUS_COLORS[status]}` }),
            STATUS_LABELS[status],
          ),
          el("span", {}, ...where),
          when,
        ),
        fnuggCredit(r),
      ),
      times,
    ),
    unchanged ? el("p", { class: "meta stale" }, unchanged) : "",
    note ? el("p", { class: "meta" }, note) : "",
  );
}

// A <details> popover closes on a click elsewhere and on Escape, like the language menu.
/** @param {HTMLDetailsElement} details */
function closeOnOutside(details) {
  document.addEventListener("click", (event) => {
    if (details.open && !details.contains(/** @type {Node} */ (event.target))) details.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !details.open) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  });
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

/** @param {Station[]} list */
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

// Every lift or slope with its status, open ones first, from the experimental `details` file.
/** @param {string[]} heads @param {HTMLElement[]} rows */
function itemTable(heads, rows) {
  return el(
    "div",
    { class: "scroll" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el("tr", {}, ...heads.map((h, i) => el("th", { class: i === heads.length - 1 ? "num" : "" }, h))),
      ),
      el("tbody", {}, ...rows),
    ),
  );
}

/** @template {{ status: string }} T @param {T[]} list */
function byStatus(list) {
  const order = Object.keys(ITEM_STATUS);
  return list.toSorted((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

/** @param {string} status */
function itemState(status) {
  const [name, colour] = ITEM_STATUS[status] ?? ITEM_STATUS.unknown;
  return el("td", { class: "state", style: `--c:${colour}` }, name);
}

/** @param {ResortDetails} d */
function liftList(d) {
  const rows = byStatus(d.lifts).map((l) =>
    el(
      "tr",
      {},
      itemState(l.status),
      el("td", {}, l.name),
      el("td", {}, LIFT_TYPE[l.type] ?? label(l.type)),
      el("td", { class: "num" }, dash(l.length_m, " m")),
    ),
  );
  return itemTable([t("Status"), t("Name"), t("Type"), t("Length")], rows);
}

/** @param {ResortDetails} d */
function slopeList(d) {
  const rows = byStatus(d.slopes).map((s) => {
    const [difficulty, colour] = DIFFICULTIES[s.difficulty] ?? [label(s.difficulty), "var(--muted)"];
    return el(
      "tr",
      {},
      itemState(s.status),
      el("td", {}, el("span", { class: "diff", style: `--c:${colour}`, title: difficulty }), s.name),
      el("td", { class: "num" }, dash(s.length_m, " m")),
    );
  });
  return itemTable([t("Status"), t("Name"), t("Length")], rows);
}

// The lifts by type and slopes by difficulty, then, for a resort with a `details` file, a card for each list that
// its "Details" button opens. The file is read on the first click, once for both; without it, the counts stand.
/** @param {Resort} r @returns {HTMLElement[]} */
function breakdown(r) {
  const parts = [];
  /** @type {HTMLElement[]} */
  const panels = [];
  /** @type {Promise<ResortDetails> | undefined} */
  let details;
  const load = () =>
    (details ??= fetch(`/${r.details}`, { cache: "no-cache" }).then((response) => {
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    }));
  /** @type {HTMLElement[]} */
  const buttons = [];
  // A pill at the bottom of its column that opens its list in a card of its own, closing the other one.
  /** @param {string} id @param {string} text @param {string} title @param {(d: ResortDetails) => HTMLElement} list */
  const more = (id, text, title, list) => {
    if (!r.details) return [];
    const panel = el("section", { class: "card", id, hidden: "" }, el("h2", {}, title));
    const button = el("button", { type: "button", class: "pill more", "aria-expanded": "false", "aria-controls": id });
    button.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"' +
      ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    button.append(text);
    panels.push(panel);
    buttons.push(button);
    let filled = false;
    button.addEventListener("click", () => {
      const open = panel.hidden;
      for (const [i, other] of panels.entries()) {
        other.hidden = !(open && other === panel);
        buttons[i].setAttribute("aria-expanded", String(open && other === panel));
      }
      if (!open || filled) return;
      filled = true;
      const loader = liftLoader({ small: true });
      panel.append(loader);
      load()
        .then((d) => loader.replaceWith(list(d)))
        .catch(() => loader.replaceWith(el("p", { class: "empty" }, t("The list could not load."))));
    });
    return [el("div", { class: "more-cell" }, button)];
  };
  if (r.lifts_by_type) {
    const rows = Object.entries(r.lifts_by_type).flatMap(([type, c]) => [
      el("span", {}, LIFT_TYPES[type] ?? label(type)),
      el("span", { class: "n" }, pair(c.open, c.total)),
      meter(c.open, c.total),
    ]);
    parts.push(
      el(
        "div",
        {},
        el("h2", {}, t("Lifts by type")),
        el("div", { class: "bars" }, ...rows),
        ...more("all-lifts", t("All lifts"), t("Lifts"), liftList),
      ),
    );
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
    parts.push(
      el(
        "div",
        {},
        el("h2", {}, t("Slopes by difficulty")),
        el("div", { class: "bars" }, ...rows),
        ...more("all-slopes", t("All slopes"), t("Slopes"), slopeList),
      ),
    );
  }
  return parts.length ? [el("section", { class: "card breakdown" }, ...parts), ...panels] : [];
}

/** @param {DangerRating} rating */
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

/** @param {Avalanche | null | undefined} bulletin */
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

/** @param {Resort} r */
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
  return section;
}

/** @param {Resort} r */
function sources(r) {
  const { conditions, resort_info } = sourceDetails(r);
  /** @type {[string, SourceRef[]][]} */
  const groups = [
    [t("Current conditions"), conditions],
    [t("Resort information"), resort_info],
  ];
  const parts = groups
    .filter(([, refs]) => refs.length)
    .flatMap(([title, refs], i) => [
      el("div", i ? { class: "meta", style: "margin-top:12px" } : { class: "meta" }, title),
      el("ul", { class: "sources" }, ...refs.map((ref) => sourceItem(ref))),
    ]);
  return parts.length ? el("section", { class: "card data" }, el("h2", {}, t("Sources")), ...parts) : null;
}

// The groups the resort is in, from its linked_area and ski_region: a card for each, under the map, with the
// group's name and the other members, by name and status from the index, each to its own page.
/** @param {Resort} r @param {HTMLElement} container */
async function groupCards(r, container) {
  if (!r.linked_area && !r.ski_region) return;
  const [groups, index] = await Promise.all([loadGroups(), loadIndex().catch(() => null)]);
  /** @type {Map<string, IndexResort>} */
  const resorts = new Map((index?.resorts ?? []).map((x) => [resortKey(x), x]));
  /** @type {[string | undefined, string, string][]} */
  const wanted = [
    [r.linked_area, t("Linked ski area"), t("Linked resorts")],
    [r.ski_region, t("Ski region"), t("Other resorts in the region")],
  ];
  const cards = wanted.flatMap(([id, title, membersTitle]) => {
    const group = id ? groups[id] : undefined;
    if (!group) return [];
    const others = group.members
      .filter((key) => key !== resortKey(r))
      .map((key) => {
        const [country, resortId] = key.split("/");
        const known = resorts.get(key);
        const dot = el("span", { class: "dot", style: `--c:${STATUS_COLORS[known ? statusKey(known) : "no_report"]}` });
        if (known) dot.title = STATUS_LABELS[statusKey(known)];
        return el(
          "li",
          {},
          dot,
          el("a", { href: resortPage({ country, id: resortId }) }, known?.name ?? resortId),
          country === r.country ? "" : el("span", { class: "meta" }, countryName(country)),
        );
      });
    return [
      el(
        "section",
        { class: "card group" },
        el("h2", {}, title),
        el("strong", { class: "group-name" }, group.name),
        others.length ? el("div", { class: "meta" }, membersTitle) : "",
        others.length ? el("ul", { class: "members" }, ...others) : "",
      ),
    ];
  });
  container.replaceWith(...cards);
}

// Resort map: only this resort's area (or point), with its pistes and lifts strong and the
// neighbours' faded; "Map of all resorts" shows the other resorts. The wheel zooms it only
// once it has been clicked, so the page scrolls past it. Shown once it has drawn the base map, the
// relief and the pistes (or after a few seconds), rather than each as it comes.
/** @param {Resort} r */
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
  await Promise.race([drawn, new Promise((resolve) => setTimeout(resolve, 4000))]);
  container.classList.remove("loading");
  loader.remove();
}

// History: the latest HISTORY_DAYS of runs, from the resort's history file (one list per value, an entry per run).
/** @param {Resort} r */
async function historyChart(r, container) {
  const response = await fetch(historyPath(r), { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const runs = /** @type {ResortHistory} */ (await response.json()).runs;
  const since = Date.now() - HISTORY_DAYS * 864e5;
  const recent = runs.time.map((time, i) => ({ t: new Date(time), i })).filter((run) => run.t.getTime() >= since);
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
  return [1, 2, 5, 10].map((m) => m * power).find((m) => m >= v) ?? 10 * power;
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
  page.replaceChildren(liftLoader());
  const response = await fetch(resortPath(wanted), { cache: "no-cache" });
  if (response.status === 404) return fail(t("There's no such resort."));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  /** @type {Resort} */
  const r = await response.json();
  document.title = `${r.name} – LiftRadar`;
  setResortAddress(r);

  const mapBox = el("div", { id: "map", role: "region", "aria-label": t("Map of {name}", { name: r.name }) });
  const historyBox = el("div", { class: "charts" }, liftLoader({ small: true }));
  // Replaced by the cards of the resort's groups once json/groups.json is in; nothing without groups.
  const groupsBox = el("div", { hidden: "" });
  const main = el(
    "div",
    { class: "stack" },
    tiles(r),
    ...breakdown(r),
    ...[stations(r.snow.stations), avalanche(r.avalanche)].filter(Boolean),
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
        groupsBox,
        ...(r.website
          ? [
              el(
                "section",
                { class: "card" },
                el("h2", {}, t("Official website")),
                el("a", { class: "external", href: r.website, rel: "noopener" }, r.website),
              ),
            ]
          : []),
        ...[sources(r)].filter((card) => card !== null),
        data(r),
      ),
    ),
  );
  resortMap(r, mapBox).catch(() => {
    mapBox.classList.remove("loading");
    mapBox.replaceChildren(el("p", { class: "empty" }, t("The map could not load.")));
  });
  groupCards(r, groupsBox).catch(() => groupsBox.remove());
  historyChart(r, historyBox).catch((error) =>
    historyBox.replaceChildren(el("p", { class: "empty" }, t("No history ({message}).", error))),
  );
}

show().catch((error) => fail(t("Could not load the resort ({message}).", error)));
