// The resort page's lists (resort.html, with resort.js): lifts by type and slopes by difficulty, the stations,
// and every lift and slope from the experimental details file.

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
 * @param {DetailsSlope} s
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

/** @param {Station[]} list */
// biome-ignore lint/correctness/noUnusedVariables: resort.js uses it
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
/** @param {string[]} heads @param {HTMLElement[]} rows @param {number} numbers how many of the last columns hold numbers */
function itemTable(heads, rows, numbers = 1) {
  return el(
    "div",
    { class: "scroll" },
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el("tr", {}, ...heads.map((h, i) => el("th", { class: i >= heads.length - numbers ? "num" : "" }, h))),
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

const BOTH_NOTE = () => t("≈ length and height difference on the OpenStreetMap map, where the resort gives none");
const HEIGHT_NOTE = () => t("≈ height difference on the OpenStreetMap map, where the resort gives none");
// The table, with a note under it when some of its lengths or heights are from the map.
/**
 * @param {{ length_m: number | null, map_length_m?: number | null }[]} items @param {HTMLElement} table
 * @param {boolean} heightsFromMap
 */
function withMapNote(items, table, heightsFromMap = false) {
  const lengthsFromMap = items.some((i) => !i.length_m && i.map_length_m);
  const note =
    lengthsFromMap && heightsFromMap ? BOTH_NOTE() : lengthsFromMap ? MAP_NOTE() : heightsFromMap ? HEIGHT_NOTE() : "";
  if (!note) return table;
  return el("div", {}, table, el("p", { class: "meta", style: "margin:8px 0 0" }, note));
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

// The number the resort's map gives a lift or slope ("7a", "C30"), before its name, unless the name starts with it
// ("35 - Rot").
/** @param {{ name: string, ref?: string | null }} item */
function itemRef(item) {
  const ref = item.ref?.trim();
  if (!ref) return [];
  const start = item.name
    .trim()
    .toLowerCase()
    .match(/^[a-z]{0,2}\d{1,3}[a-z]?\b/)?.[0];
  return start === ref.toLowerCase() ? [] : [el("span", { class: "ref" }, ref)];
}

// A lift's or slope's name, after what goes before it; once the resort map has drawn it, a button that shows
// it there.
/** @param {ResortDetails} d @param {{ id: string, name: string, ref?: string | null }} item @param {(HTMLElement | string)[]} before */
function itemName(d, item, ...before) {
  before = [...before, ...itemRef(item)];
  const cell = el("td", {}, ...before, item.name);
  const key = `${d.country}/${d.id}/${item.id}`;
  mapItems.then((onMap) => {
    if (!onMap?.items.has(key)) return;
    const button = el("button", { type: "button", class: "on-map", "aria-pressed": "false" }, item.name);
    button.addEventListener("click", () => onMap.show(key, button));
    cell.replaceChildren(...before, button);
  });
  return cell;
}

/** @param {import("../../types/resort-details").DetailsLift} l */
const hasHeights = (l) => Boolean(l.bottom_m && l.top_m);

// How far each lift climbs: by its stations' heights where the source gives them (few do), else ≈ by its line on
// the map, as the lengths. Shown at once with the source's; once the map has drawn (if ever), again with the map's
// for the lifts the source gives none.
/** @param {ResortDetails} d */
function liftList(d) {
  const lifts = d.lifts ?? []; // null only in files with just the bottom and top, which `details` doesn't point to
  const box = el("div", {}, liftTable(d, lifts, null));
  if (!lifts.every(hasHeights))
    mapItems.then((onMap) => {
      if (onMap && lifts.some((l) => !hasHeights(l) && onMap.rise(`${d.country}/${d.id}/${l.id}`) !== null))
        box.replaceChildren(liftTable(d, lifts, onMap));
    });
  return box;
}

/**
 * @param {ResortDetails} d @param {import("../../types/resort-details").DetailsLift[]} lifts
 * @param {MapItems} onMap
 */
function liftTable(d, lifts, onMap) {
  /** @param {import("../../types/resort-details").DetailsLift} l */
  const rise = (l) => {
    if (l.bottom_m && l.top_m) return { m: Math.abs(l.top_m - l.bottom_m), map: false };
    const m = onMap?.rise(`${d.country}/${d.id}/${l.id}`);
    return m === null || m === undefined ? null : { m, map: true };
  };
  const rises = new Map(lifts.map((l) => [l, rise(l)]));
  const shown = [...rises.values()].some(Boolean);
  const rows = byStatus(lifts).map((l) => {
    const r = rises.get(l);
    return el(
      "tr",
      {},
      itemState(l.status),
      el("td", {}, el("span", { class: "lift" }, liftIcon(l.type), LIFT_TYPE[l.type] ?? label(l.type))),
      itemName(d, l),
      ...(shown
        ? [
            r?.map
              ? el("td", { class: "num", title: HEIGHT_NOTE() }, `≈ ${r.m} m`)
              : el("td", { class: "num" }, r ? `${r.m} m` : "–"),
          ]
        : []),
      itemLength(l),
    );
  });
  const heads = [t("Status"), t("Type"), t("Name"), ...(shown ? [t("Vertical")] : []), t("Length")];
  const fromMap = [...rises.values()].some((r) => r?.map);
  return withMapNote(lifts, itemTable(heads, rows, shown ? 2 : 1), fromMap);
}

// Slopes open first (then in preparation, closed, unknown), and within each the easiest first: by difficulty,
// then by the slope's own colour (green before blue), then by name.
const DIFFICULTY_ORDER = Object.keys(DIFFICULTIES);
const COLOUR_ORDER = ["green", "blue", "yellow", "orange", "red", "black"];
/** @param {DetailsSlope} s */
const colourRank = (s) => {
  const i = COLOUR_ORDER.indexOf((s.colour ?? "").split("_")[0]);
  return i === -1 ? COLOUR_ORDER.length : i;
};
/** @param {DetailsSlope[]} slopes */
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
  const slopes = d.slopes ?? [];
  const rows = sortedSlopes(slopes).map((s) => {
    const { colour, title } = slopeSwatch(s);
    return el(
      "tr",
      {},
      itemState(s.status),
      itemName(d, s, el("span", { class: "diff", style: `--c:${colour}`, title })),
      itemLength(s),
    );
  });
  return withMapNote(slopes, itemTable([t("Status"), t("Name"), t("Length")], rows));
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
// its "Details" button opens. The file is read once for both, on the first click (or for the very easy slopes, below);
// without it, the counts stand, and a failed read is tried again on the next click.
/** @param {Resort} r @returns {HTMLElement[]} */
// biome-ignore lint/correctness/noUnusedVariables: resort.js uses it
function breakdown(r) {
  const parts = [];
  /** @type {HTMLElement[]} */
  const panels = [];
  /** @type {Promise<ResortDetails> | undefined} */
  let details;
  const load = () =>
    (details ??= fetch(`/${r.details}`, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.json();
      })
      .catch((error) => {
        details = undefined;
        throw error;
      }));
  /** @type {HTMLElement[]} */
  const buttons = [];
  // A pill at the bottom of the card, under its column, that opens its list in a card of its own, closing the other.
  /**
   * @param {string} id @param {string} text @param {string} title
   * @param {(d: ResortDetails) => HTMLElement | Promise<HTMLElement>} list
   */
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
      panel.querySelector(".failed")?.remove();
      const loader = liftLoader({ small: true });
      panel.append(loader);
      load()
        .then((d) => list(d))
        .then((node) => loader.replaceWith(node))
        .catch(() => {
          filled = false;
          loader.replaceWith(el("p", { class: "empty failed" }, t("The list could not load.")));
        });
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
          const listed = (d.slopes ?? []).filter((s) => s.difficulty === "easy" && s.status !== "unknown");
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
