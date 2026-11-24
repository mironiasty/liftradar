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
// An icon for each lift type in "Lifts by type" (drawn in design/lift-icons.html): lines in the text's colour on
// 24×24; only the funicular's car is solid, with its windows in the card's colour.
const LIFT_ICONS = {
  gondola:
    '<path d="M2 8.5 22 4.5M12 6.5V10"/><circle cx="12" cy="6.5" r="1.4" fill="currentColor" stroke="none"/>' +
    '<rect x="6.5" y="10" width="11" height="10.5" rx="3"/><rect x="8.8" y="12.3" width="6.4" height="3.4" rx="1"/>',
  cable_car:
    '<path d="M2 7 22 3M2 9.5 22 5.5M9 7.4l6-1.2M12 7v3.2"/><rect x="4.5" y="10.2" width="15" height="10.8" rx="1.6"/>' +
    '<rect x="6.6" y="12.4" width="4.6" height="3.6" rx=".6"/><rect x="12.8" y="12.4" width="4.6" height="3.6" rx=".6"/>',
  chairlift:
    '<path d="M2 8.5 22 4.5M13 6.3V10H8v8h8.5M16.5 18l1.5 3h2.5"/>' +
    '<circle cx="13" cy="6.3" r="1.4" fill="currentColor" stroke="none"/><path d="M8 16.2h8.5v1.8H8z" stroke-width="1"/>',
  drag_lift:
    '<path d="M2 6.5 22 3M14 4.4 11.5 15M2 21.5 22 18"/><circle cx="14" cy="4.4" r="1.4" fill="currentColor" stroke="none"/>' +
    '<path d="M7.5 15h8" stroke-width="2.2"/>',
  carpet:
    '<circle cx="11" cy="3.6" r="1.7" fill="currentColor" stroke="none"/><path d="M11 6.4v4.4M11 10.8l-2 3.4M11 10.8l2 3M8.3 8.6h5.4"/>' +
    '<path d="M3.5 16.4 20.5 13a1.8 1.8 0 0 1 .7 3.5L4.2 19.9a1.8 1.8 0 0 1-.7-3.5z"/>',
  funicular:
    '<path d="M2 20 22 10"/><path d="M4 16 18 9V4L4 11z" fill="currentColor"/>' +
    '<path d="M6.2 11.6l4.6-2.3v2.4l-4.6 2.3zM12.2 8.6l4.6-2.3v2.4l-4.6 2.3z" fill="var(--bg)" stroke="none"/>' +
    '<circle cx="6.5" cy="16.5" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="15.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  other:
    '<path d="M2 6.6 22 4.6M6.5 8.6h11M10.2 21 11.4 8.6M13.8 21 12.6 8.6M9 21h6"/>' +
    '<circle cx="8" cy="6.9" r="1.1"/><circle cx="16" cy="6.1" r="1.1"/>',
};
/** @param {string} type */
function liftIcon(type) {
  const icon = el("span", { class: "lift-icon", "aria-hidden": "true" });
  icon.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"' +
    ` stroke-linecap="round" stroke-linejoin="round">${LIFT_ICONS[type] ?? LIFT_ICONS.other}</svg>`;
  return icon;
}
// Piste colours as on slope maps; ski routes yellow.
const DIFFICULTIES = {
  easy: [t("Easy"), "#2a6fdb"],
  intermediate: [t("Intermediate"), "#d62828"],
  difficult: [t("Difficult"), "var(--fg)"],
  ski_route: [t("Ski routes"), "#f2b705"],
  other: [t("Other"), "var(--muted)"],
};
// A slope's own colour, where its source gives one (experimental `colour` in the details file): green for the very
// easy slopes of France, Spain and the Nordic countries, yellow and orange Swiss runs, two-colour slopes split.
const SLOPE_COLOURS = {
  green: [t("Green"), "#2e9e3f"],
  blue: [t("Blue"), "#2a6fdb"],
  red: [t("Red"), "#d62828"],
  black: [t("Black"), "var(--fg)"],
  yellow: [t("Yellow"), "#f2b705"],
  orange: [t("Orange"), "#f07c0c"],
};

/**
 * The slope's swatch and its title: its own colour when the source gives one, else its difficulty's.
 * @param {ResortDetails["slopes"][number]} s
 */
function slopeSwatch(s) {
  const [difficulty, fallback] = DIFFICULTIES[s.difficulty] ?? [label(s.difficulty), "var(--muted)"];
  const parts = (s.colour ?? "").split("_").map((c) => SLOPE_COLOURS[c]);
  if (!s.colour || parts.some((p) => !p)) return { colour: fallback, title: difficulty };
  const names = parts.map(([name]) => name).join(" / ");
  const colour = parts.length === 1 ? parts[0][1] : `linear-gradient(135deg, ${parts[0][1]} 50%, ${parts[1][1]} 50%)`;
  return { colour, title: `${difficulty}: ${names}` };
}
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
        // Sized by its length (resort.html), to stay on the badge's line in a narrow tile.
        el(
          "span",
          { class: "danger", style: `--chars:${dangerName(avalanche.danger).length}` },
          dangerName(avalanche.danger),
        ),
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
  // When the report was read: a chip at the end of the status row; clicked, it shows when the resort last changed
  // its report too. Wide screens say "Checked …" in full, narrow ones just the time.
  const clock = el("span", { class: "clock", "aria-hidden": "true" });
  clock.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"' +
    ' stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const checkedText = t("Checked {time}", { time: viennaTime(checked) });
  const changedText = changed && t("resort's last change {time}", { time: viennaTime(changed) });
  const short = viennaTime(checked, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const when = el(
    "details",
    { class: stale ? "when stale" : "when" },
    el(
      "summary",
      { class: "checked" },
      clock,
      el("span", { class: "long" }, checkedText),
      el("span", { class: "short" }, short),
    ),
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
            { class: "status status-badge", "data-status": status },
            el("span", { class: "dot" }),
            STATUS_LABELS[status],
          ),
          el("span", {}, ...where),
          when,
        ),
        fnuggCredit(r),
      ),
    ),
    unchanged ? el("p", { class: "meta stale" }, unchanged) : "",
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

// The source's length, or else the one measured on the map (OpenStreetMap, by the weekly ski tiles), with "≈".
// The map's is only a fallback: the km come from the source's, and resorts' slopes run longer than their maps'.
const MAP_NOTE = () => t("≈ length on the OpenStreetMap map, where the resort gives none");
/** @param {{ length_m: number | null, map_length_m?: number | null }} item */
function itemLength(item) {
  if (item.length_m || !item.map_length_m) return el("td", { class: "num" }, dash(item.length_m, " m"));
  return el("td", { class: "num", title: MAP_NOTE() }, `≈ ${item.map_length_m} m`);
}

/** @param {{ length_m: number | null, map_length_m?: number | null }[]} items @param {HTMLElement} table */
function withMapNote(items, table) {
  if (!items.some((i) => !i.length_m && i.map_length_m)) return table;
  return el("div", {}, table, el("p", { class: "meta", style: "margin:8px 0 0" }, MAP_NOTE()));
}

/** @template {{ status: string }} T @param {T[]} list */
function byStatus(list) {
  const order = Object.keys(ITEM_STATUS);
  return list.toSorted((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

// The status as a dot alone, its name on hover (and for screen readers); in preparation, a blinking green.
/** @param {string} status */
function itemState(status) {
  const [name, colour] = ITEM_STATUS[status] ?? ITEM_STATUS.unknown;
  return el(
    "td",
    { class: "state" },
    el("span", {
      class: status === "preparation" ? "dot preparing" : "dot",
      style: `--c:${colour}`,
      role: "img",
      "aria-label": name,
      title: name,
    }),
  );
}

/** @param {ResortDetails} d */
function liftList(d) {
  const rows = byStatus(d.lifts).map((l) =>
    el(
      "tr",
      {},
      itemState(l.status),
      el("td", {}, el("span", { class: "lift" }, liftIcon(l.type), LIFT_TYPE[l.type] ?? label(l.type))),
      el("td", {}, l.name),
      itemLength(l),
    ),
  );
  return withMapNote(d.lifts, itemTable([t("Status"), t("Type"), t("Name"), t("Length")], rows));
}

// Slopes open first (then in preparation, closed, unknown), and within each the easiest first: by difficulty,
// then by the slope's own colour (green before blue), then by name.
const DIFFICULTY_ORDER = Object.keys(DIFFICULTIES);
const COLOUR_ORDER = ["green", "blue", "yellow", "orange", "red", "black"];
/** @param {ResortDetails["slopes"][number]} s */
const colourRank = (s) => {
  const i = COLOUR_ORDER.indexOf((s.colour ?? "").split("_")[0]);
  return i === -1 ? COLOUR_ORDER.length : i;
};
/** @param {ResortDetails["slopes"]} slopes */
function sortedSlopes(slopes) {
  const status = Object.keys(ITEM_STATUS);
  /** @param {string} key @param {string[]} order */
  const rank = (key, order) => (order.includes(key) ? order.indexOf(key) : order.length);
  return slopes.toSorted(
    (a, b) =>
      rank(a.status, status) - rank(b.status, status) ||
      rank(a.difficulty, DIFFICULTY_ORDER) - rank(b.difficulty, DIFFICULTY_ORDER) ||
      colourRank(a) - colourRank(b) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

/** @param {ResortDetails} d */
function slopeList(d) {
  const rows = sortedSlopes(d.slopes).map((s) => {
    const { colour, title } = slopeSwatch(s);
    return el(
      "tr",
      {},
      itemState(s.status),
      el("td", {}, el("span", { class: "diff", style: `--c:${colour}`, title }), s.name),
      itemLength(s),
    );
  });
  return withMapNote(d.slopes, itemTable([t("Status"), t("Name"), t("Length")], rows));
}

// The counts of some slopes from the details file, as in the resort's slopes_by_difficulty; km only when every one
// of them has its length.
/** @param {DetailsSlope[]} slopes @returns {SlopeCounts} */
function colourCount(slopes) {
  const open = slopes.filter((s) => s.status === "open");
  /** @param {DetailsSlope[]} list */
  const km = (list) => Math.round(list.reduce((sum, s) => sum + (s.length_m ?? 0), 0) / 100) / 10;
  const lengths = slopes.every((s) => s.length_m);
  return {
    open: open.length,
    total: slopes.length,
    open_km: lengths ? km(open) : null,
    total_km: lengths ? Math.ceil(km(slopes)) : null,
  };
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
  // A pill at the bottom of the card, under its column, that opens its list in a card of its own, closing the other.
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
    return [];
  };
  if (r.lifts_by_type) {
    const rows = Object.entries(r.lifts_by_type).flatMap(([type, c]) => [
      el("span", { class: "lift" }, liftIcon(type), LIFT_TYPES[type] ?? label(type)),
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
    /** @param {string} name @param {string} colour @param {SlopeCounts} c */
    const slopeRow = (name, colour, c) => {
      const km =
        present(c.open_km) || present(c.total_km) ? el("div", { class: "km" }, pair(c.open_km, c.total_km, " km")) : "";
      return [
        el("span", {}, el("span", { class: "diff", style: `--c:${colour}` }), name, km),
        el("span", { class: "n" }, pair(c.open, c.total)),
        meter(c.open, c.total),
      ];
    };
    /** @type {Record<string, HTMLElement[]>} */
    const byDifficulty = {};
    const rows = Object.entries(r.slopes_by_difficulty).flatMap(([difficulty, c]) => {
      const [name, colour] = DIFFICULTIES[difficulty] ?? [label(difficulty), "var(--muted)"];
      byDifficulty[difficulty] = slopeRow(name, colour, c);
      return byDifficulty[difficulty];
    });
    // Where the source marks the very easy slopes green (France, Spain, Andorra, the Nordic countries), the easy
    // ones split into green and blue, counted from the details file: only when its counts match the resort's.
    const easy = r.slopes_by_difficulty.easy;
    if (easy && byDifficulty.easy && r.details) {
      load()
        .then((d) => {
          const listed = d.slopes.filter((s) => s.difficulty === "easy" && s.status !== "unknown");
          const green = listed.filter((s) => s.colour === "green");
          const blue = listed.filter((s) => s.colour !== "green");
          if (!green.length || listed.length !== easy.total) return;
          if (listed.filter((s) => s.status === "open").length !== easy.open) return;
          const [first, ...others] = byDifficulty.easy;
          first.replaceWith(
            ...slopeRow(t("Very easy"), SLOPE_COLOURS.green[1], colourCount(green)),
            ...slopeRow(DIFFICULTIES.easy[0], SLOPE_COLOURS.blue[1], colourCount(blue)),
          );
          for (const e of others) e.remove();
        })
        .catch(() => {});
    }
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
  if (!parts.length) return [];
  const row = buttons.length ? [el("div", { class: "more-row", style: `--n:${parts.length}` }, ...buttons)] : [];
  return [el("section", { class: "card breakdown" }, ...parts, ...row), ...panels];
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
      el(
        "a",
        { class: "external", href: "https://trmnl.com/recipes/ski-resort-snow-report-219253", rel: "noopener" },
        t("TRMNL plugin"),
      ),
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

// The line under a group member's name, as the apps' lists have it: open, how many lifts and km of slopes are open,
// the snow on the mountain and the fresh snow; closed or without a report, that and how many it has.
/** @param {IndexResort} r */
function memberSummary(r) {
  const status = statusKey(r);
  const open = status === "open";
  const { lifts, slopes, snow } = r;
  const parts = open ? [] : [capitalized(STATUS_LABELS[status])];
  if (lifts?.total) parts.push(t("{n} lifts", { n: open ? pair(lifts.open, lifts.total) : lifts.total }));
  if (slopes?.total_km) {
    parts.push(open ? pair(slopes.open_km, slopes.total_km, " km") : t("{km} km of slopes", { km: slopes.total_km }));
  } else if (slopes?.total) {
    parts.push(t("{n} slopes", { n: open ? pair(slopes.open, slopes.total) : slopes.total }));
  }
  if (open && snow.mountain_cm !== null && snow.mountain_cm !== undefined) parts.push(`${snow.mountain_cm} cm`);
  // Not "summary": the page's key numbers have that class, a grid that would put the fresh snow on a line of its own.
  const line = el("div", { class: "meta numbers" }, parts.join(" · ") || capitalized(STATUS_LABELS[status]));
  if (snow.fresh_cm) line.append(" ", el("span", { class: "fresh" }, `+${snow.fresh_cm}`));
  return line;
}

// The country most of a group's members are in, the one a member from elsewhere is flagged against (Champéry and
// Morgins in Les Portes du Soleil). Where countries are level, `own`'s (the resort whose page it is) if it is one
// of them, else the first member's. The apps do the same (ResortGroup's mainCountry).
/** @param {string[]} members @param {string} own */
function mainCountry(members, own) {
  const countries = members.map((key) => key.split("/")[0]);
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const c of countries) counts.set(c, (counts.get(c) ?? 0) + 1);
  const most = Math.max(0, ...counts.values());
  if (counts.get(own) === most) return own;
  return countries.find((c) => counts.get(c) === most) ?? own;
}

// A group's members (keys) in the order its card shows them, as the list starts: the open ones first, the most open
// slopes first (then open km, open lifts); then the closed ones and those without a report, the biggest first (km of
// slopes, then lifts); last the ones the index doesn't have. Level, as the group lists them. The apps do the same
// (ResortGroup's ordered).
/** @param {string[]} keys @param {Map<string, IndexResort>} resorts */
function orderedMembers(keys, resorts) {
  /** @param {number | null | undefined} v */
  const n = (v) => -(v ?? -1);
  /** @param {string} key @returns {number[]} */
  const rank = (key) => {
    const r = resorts.get(key);
    if (!r) return [2];
    return statusKey(r) === "open"
      ? [0, n(r.slopes?.open), n(r.slopes?.open_km), n(r.lifts?.open)]
      : [1, n(r.slopes?.total_km), n(r.lifts?.total)];
  };
  const ranks = new Map(keys.map((key) => [key, rank(key)]));
  return [...keys].sort((a, b) => {
    const x = ranks.get(a) ?? [],
      y = ranks.get(b) ?? [];
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
    return x.length - y.length;
  });
}

// The groups the resort is in, from its linked_area and ski_region: a card for each, under the map, with the
// group's name and the other members, by name, status and the line of numbers from the index, each to its own
// page, with its flag when it is in another country than most of the group; the open ones first.
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
    const main = mainCountry(group.members, r.country);
    const others = orderedMembers(
      group.members.filter((key) => key !== resortKey(r)),
      resorts,
    ).map((key) => {
      const [country, resortId] = key.split("/");
      const known = resorts.get(key);
      const dot = el("span", { class: "dot", style: `--c:${STATUS_COLORS[known ? statusKey(known) : "no_report"]}` });
      if (known) dot.title = STATUS_LABELS[statusKey(known)];
      const flag =
        country === main
          ? ""
          : el("span", { class: "flag", "data-country": country, title: countryName(country), role: "img" });
      if (flag) flag.setAttribute("aria-label", countryName(country));
      return el(
        "li",
        {},
        dot,
        el(
          "div",
          {},
          el(
            "div",
            { class: "name" },
            el("a", { href: resortPage({ country, id: resortId }) }, known?.name ?? resortId),
            flag,
          ),
          known ? memberSummary(known) : "",
        ),
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
// `collected` says since when: the history starts with the resort's first run (it keeps a year).
/** @param {Resort} r @param {HTMLElement} container @param {HTMLElement} collected */
async function historyChart(r, container, collected) {
  const response = await fetch(historyPath(r), { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const runs = /** @type {ResortHistory} */ (await response.json()).runs;
  if (runs.time.length) {
    // A month's name, so English reads "24 October 2026" rather than the Austrian "24. Oktober 2026".
    const date = new Date(runs.time[0]).toLocaleDateString(LANG === "en" ? "en-GB" : DATE_LOCALE, {
      timeZone: "Europe/Vienna",
      dateStyle: "long",
    });
    collected.textContent = t("Collected since {date}.", { date });
    collected.hidden = false;
  }
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
  const collected = el("p", { class: "meta", style: "margin:10px 0 0", hidden: "" });
  // Replaced by the cards of the resort's groups once json/groups.json is in; nothing without groups.
  const groupsBox = el("div", { hidden: "" });
  const main = el(
    "div",
    { class: "stack" },
    tiles(r),
    ...breakdown(r),
    ...[stations(r.snow.stations), avalanche(r.avalanche)].filter(Boolean),
    el("section", { class: "card" }, el("h2", {}, t("Last {n} days", { n: HISTORY_DAYS })), historyBox, collected),
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
  historyChart(r, historyBox, collected).catch((error) =>
    historyBox.replaceChildren(el("p", { class: "empty" }, t("No history ({message}).", error))),
  );
}

show().catch((error) => fail(t("Could not load the resort ({message}).", error)));
