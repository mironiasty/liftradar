// The resort page's "Change history": the season so far as events, worked out from the resort's history file
// (history/<country>/<id>.json, the key numbers of every run). Shown by resort.js, which loads after this file.
//
// It compares each day with the day before, a row per day that changed. A day is its run with the most open (lifts,
// then slopes): the other run of the day is ignored, so a morning not yet updated doesn't count as a closing.
// The rows a reader cares about stand out:
// - opening, and closing (a closure of one day between open days is minor: weather, wind),
// - the most lifts or slopes open so far this season (against every earlier open day),
// - a change in how many lifts or slopes the resort lists,
// - fresh snow of TIMELINE_SNOW_CM or more, once (sources repeat the same value for days).
// The other changes of open lifts and slopes are minor, shown quieter.
// Days without a report (no_report, or no status) are skipped: they say nothing about the resort.

const TIMELINE_SNOW_CM = 10;
// Rows shown before "Show all".
const TIMELINE_ROWS = 8;

/**
 * One day: its date in Vienna and its run with a report that has the most open.
 * @typedef {{ day: string, status: string, lifts_open: number|null, lifts_total: number|null,
 *   slopes_open: number|null, slopes_total: number|null, slopes_open_km: number|null, fresh: number }} TimelineDay
 */
/**
 * A row. `title` is the event in words: the summary's latest event, and the row's tooltip. The row shows it short:
 * `label` as text, or the `change` of open lifts and slopes, a `list` change or `snow` with icons; then the open
 * numbers of `state`, with what reached the season's most in `best` in bold.
 * @typedef {{ day: string, kind: "open"|"closed"|"high"|"snow"|"list"|"minor", title: string, label?: string,
 *   change?: TimelineChange, state?: TimelineDay, best?: { lifts: boolean, slopes: boolean },
 *   list?: { what: "lifts"|"slopes", from: number, to: number }, snow?: number }} TimelineEvent
 */
/** @typedef {{ lifts: number, slopes: number }} TimelineChange */

// How open a run is, to pick a day's run: open before closed, then lifts, then slopes.
/** @param {TimelineDay} d */
const timelineOpenness = (d) =>
  (d.status === "open" ? 1e8 : 0) + ((d.lifts_open ?? -1) + 1) * 1e4 + ((d.slopes_open ?? -1) + 1);

/** @param {ResortHistory["runs"]} runs @returns {TimelineDay[]} */
function timelineDays(runs) {
  /** @type {Map<string, TimelineDay>} */
  const days = new Map();
  /** @type {Map<string, number>} */
  const fresh = new Map();
  runs.time.forEach((time, i) => {
    const day = new Date(time).toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
    fresh.set(day, Math.max(fresh.get(day) ?? 0, runs.fresh_cm[i] ?? 0));
    const status = runs.status[i];
    if (status !== "open" && status !== "closed") return;
    /** @type {TimelineDay} */
    const run = {
      day,
      // Open without a lift running (a source's slip, or a slope open for walkers) isn't an opening.
      status: status === "open" && runs.lifts_open[i] === 0 ? "closed" : status,
      lifts_open: runs.lifts_open[i],
      lifts_total: runs.lifts_total[i],
      slopes_open: runs.slopes_open[i],
      slopes_total: runs.slopes_total[i],
      slopes_open_km: runs.slopes_open_km[i],
      fresh: 0,
    };
    const kept = days.get(day);
    // The day's run with the most open; on a tie the later one, its lists the newer.
    if (!kept || timelineOpenness(run) >= timelineOpenness(kept)) days.set(day, run);
  });
  // Snow can fall on a day without a report; it's kept on the next day with one.
  let carried = 0;
  const list = [];
  for (const [day, cm] of [...fresh].sort(([a], [b]) => a.localeCompare(b))) {
    carried = Math.max(carried, cm);
    const d = days.get(day);
    if (d) {
      d.fresh = carried;
      carried = 0;
      list.push(d);
    }
  }
  return list;
}

// Counts in words. English has no dictionary, so one and many are separate strings; a translation of the
// "{n} …" ones can be an object of plural forms (Polish: 2 wyciągi, 5 wyciągów).
/** @param {number|string} n */
const liftCount = (n) => (n === 1 ? t("1 lift") : t("{n} lifts|count", { n }));
/** @param {number|string} n */
const slopeCount = (n) => (n === 1 ? t("1 slope") : t("{n} slopes|count", { n }));
// What was opened or closed ("Opened 1 slope"): a separate singular, as some languages say it differently there.
/** @param {number} n */
const slopesActed = (n) => (n === 1 ? t("1 slope|acted on") : t("{n} slopes|count", { n }));
/** @param {string[]} parts */
const both = (parts) => (parts.length === 2 ? t("{a} and {b}", { a: parts[0], b: parts[1] }) : parts[0]);

// "24 of 31 lifts", or "24 lifts" without a total; `open` may be a range ("23–24").
/** @param {number|string|null} open @param {number|null} total @param {"lifts"|"slopes"} what */
function openOf(open, total, what) {
  if (open === null) return null;
  if (total === null) return what === "lifts" ? liftCount(open) : slopeCount(open);
  return what === "lifts"
    ? t("{open} of {total} lifts", { open, total })
    : t("{open} of {total} slopes", { open, total });
}

// "24 of 31 lifts and 22 of 58 slopes open (94 km)", and which of them is the season's most with `best`.
/** @param {Pick<TimelineDay, "lifts_total"|"slopes_total"|"slopes_open_km">} d @param {number|string|null} lifts
 * @param {number|string|null} slopes @param {{ lifts: boolean, slopes: boolean }} [best] */
function openLine(d, lifts, slopes, best) {
  const parts = [openOf(lifts, d.lifts_total, "lifts"), openOf(slopes, d.slopes_total, "slopes")].filter(
    (p) => p !== null,
  );
  if (!parts.length) return "";
  const list =
    both(/** @type {string[]} */ (parts)) + (d.slopes_open_km ? ` (${d.slopes_open_km.toLocaleString(LANG)} km)` : "");
  if (best?.lifts && best.slopes) return t("{list} open, the most this season", { list });
  if (best?.lifts) return t("{list} open, the most lifts this season", { list });
  if (best?.slopes) return t("{list} open, the most slopes this season", { list });
  return t("{list} open", { list });
}

// How many more (or fewer) lifts and slopes are open than the day before. With `only`, just those that grew.
/** @param {TimelineDay} d @param {TimelineDay} prev @param {{ lifts: boolean, slopes: boolean }} [only]
 * @returns {TimelineChange} */
function timelineChange(d, prev, only) {
  const delta = (/** @type {"lifts"|"slopes"} */ what) => {
    const now = d[`${what}_open`];
    const before = prev[`${what}_open`];
    return now === null || before === null || (only && !only[what]) ? 0 : now - before;
  };
  return { lifts: delta("lifts"), slopes: delta("slopes") };
}

// "Opened 2 lifts and 1 slope", "Closed 1 lift", "Opened 3 slopes, closed 1 lift", or null without a change.
/** @param {TimelineChange} change */
function changeTitle({ lifts, slopes }) {
  const phrase = (/** @type {(n: number) => boolean} */ keep) =>
    [keep(lifts) && liftCount(Math.abs(lifts)), keep(slopes) && slopesActed(Math.abs(slopes))].filter(
      (p) => typeof p === "string",
    );
  const opened = phrase((n) => n > 0);
  const closed = phrase((n) => n < 0);
  if (opened.length && closed.length)
    return t("Opened {opened}, closed {closed}", { opened: both(opened), closed: both(closed) });
  if (opened.length) return t("Opened {what}", { what: both(opened) });
  if (closed.length) return t("Closed {what}", { what: both(closed) });
  return null;
}

/** @param {TimelineDay[]} days @returns {TimelineEvent[]} oldest first */
function timelineEvents(days) {
  /** @type {TimelineEvent[]} */
  const events = [];
  // Kept apart and merged by date at the end, so snow comes after the day's other events.
  /** @type {TimelineEvent[]} */
  const snow = [];
  const add = (/** @type {TimelineEvent} */ event) => events.push(event);
  // A change of open lifts and slopes; null without one.
  /** @param {TimelineEvent["kind"]} kind @param {TimelineDay} d @param {TimelineChange} change
   * @param {{ lifts: boolean, slopes: boolean }} [best] */
  const changed = (kind, d, change, best) => {
    const title = changeTitle(change);
    if (!title) return false;
    add({ day: d.day, kind, title, change, state: d, best });
    return true;
  };
  // A row in words, with the open numbers when it's open.
  /** @param {TimelineEvent["kind"]} kind @param {TimelineDay} d @param {string} label */
  const said = (kind, d, label) =>
    add({ day: d.day, kind, title: label, label, state: d.status === "open" ? d : undefined });

  let maxLifts = -1;
  let maxSlopes = -1;
  let lastSnow = 0;
  days.forEach((d, i) => {
    const prev = days[i - 1];
    const next = days[i + 1];
    // The resort's lists.
    if (prev) {
      if (prev.lifts_total !== null && d.lifts_total !== null && prev.lifts_total !== d.lifts_total) {
        const values = { from: prev.lifts_total, to: d.lifts_total };
        const title =
          d.lifts_total > prev.lifts_total
            ? t("The lift list grew from {from} to {to}", values)
            : t("The lift list shrank from {from} to {to}", values);
        add({ day: d.day, kind: "list", title, list: { what: "lifts", ...values } });
      }
      if (prev.slopes_total !== null && d.slopes_total !== null && prev.slopes_total !== d.slopes_total) {
        const values = { from: prev.slopes_total, to: d.slopes_total };
        const title =
          d.slopes_total > prev.slopes_total
            ? t("The slope list grew from {from} to {to}", values)
            : t("The slope list shrank from {from} to {to}", values);
        add({ day: d.day, kind: "list", title, list: { what: "slopes", ...values } });
      }
    }
    if (d.status === "open") {
      const liftsHigh = maxLifts >= 0 && d.lifts_open !== null && d.lifts_open > maxLifts;
      const slopesHigh = maxSlopes >= 0 && d.slopes_open !== null && d.slopes_open > maxSlopes;
      const best = { lifts: liftsHigh, slopes: slopesHigh };
      if (!prev) {
        said("open", d, t("Already open when we started tracking it"));
      } else if (prev.status !== "open") {
        // Reopening after one closed day is a small change, unless it's a new high.
        if (days[i - 2]?.status === "open" && !liftsHigh && !slopesHigh) said("minor", d, t("Open again"));
        else
          said(
            liftsHigh || slopesHigh ? "high" : "open",
            d,
            maxLifts < 0 ? t("Opened for the season") : t("Open again"),
          );
      } else if (!(liftsHigh || slopesHigh) || !changed("high", d, timelineChange(d, prev), best)) {
        changed("minor", d, timelineChange(d, prev));
      }
      maxLifts = Math.max(maxLifts, d.lifts_open ?? 0);
      maxSlopes = Math.max(maxSlopes, d.slopes_open ?? 0);
    } else if (prev?.status === "open") {
      // One closed day between open days: minor. The last day can't tell yet, so it counts as closed.
      if (next?.status === "open") said("minor", d, t("Closed for a day"));
      else said("closed", d, t("Closed|resort"));
    }
    // Fresh snow, once per value: sources keep the last snowfall for days.
    if (d.fresh >= TIMELINE_SNOW_CM && d.fresh !== lastSnow) {
      snow.push({ day: d.day, kind: "snow", title: t("{n} cm of fresh snow", { n: d.fresh }), snow: d.fresh });
    }
    lastSnow = d.fresh;
  });
  // Stable: on the same day, snow comes after the day's other events (above them, newest first).
  return [...events, ...snow].sort((a, b) => a.day.localeCompare(b.day));
}

/** @param {string} day YYYY-MM-DD */
const timelineDate = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(LANG === "en" ? "en-GB" : DATE_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

// Small icons in the text's colour: a gondola (as in "Lifts by type"), a slope with its flag, a snowflake.
const TIMELINE_ICONS = {
  lifts: LIFT_ICONS.gondola,
  slopes:
    '<path d="M2.5 20.5h19L2.5 7.5z" fill="currentColor" fill-opacity=".25"/><path d="M8 11.3V2.5l6.5 2.7L8 7.8"/>',
  snow: '<path d="M12 12L12 2.5M12 5.8L9.7 3.5M12 5.8L14.3 3.5M12 12L3.8 7.3M6.6 8.9L3.5 9.7M6.6 8.9L5.8 5.8M12 12L3.8 16.8M6.6 15.1L5.8 18.2M6.6 15.1L3.5 14.3M12 12L12 21.5M12 18.2L14.3 20.5M12 18.2L9.7 20.5M12 12L20.2 16.8M17.4 15.1L20.5 14.3M17.4 15.1L18.2 18.2M12 12L20.2 7.2M17.4 8.9L18.2 5.8M17.4 8.9L20.5 9.7"/>',
};
/** @param {keyof typeof TIMELINE_ICONS} name */
function timelineIcon(name) {
  const icon = el("span", { class: "tl-icon", "aria-hidden": "true" });
  icon.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ` stroke-linecap="round" stroke-linejoin="round">${TIMELINE_ICONS[name]}</svg>`;
  return icon;
}

// "+2 [lift] −1 [slope]"
/** @param {TimelineChange} change */
function changeChips(change) {
  return /** @type {const} */ (["lifts", "slopes"])
    .filter((what) => change[what])
    .map((what) => {
      const n = change[what];
      return el(
        "span",
        { class: n > 0 ? "tl-chip tl-up" : "tl-chip tl-down" },
        `${n > 0 ? "+" : "−"}${Math.abs(n)}`,
        timelineIcon(what),
      );
    });
}

// "[lift] 12/23 · [slope] 8/33 · 9.3 km", what reached the season's most in bold.
/** @param {TimelineDay} d @param {{ lifts: boolean, slopes: boolean }} [best] */
function stateChips(d, best) {
  const parts = [];
  for (const what of /** @type {const} */ (["lifts", "slopes"])) {
    const open = d[`${what}_open`];
    if (open === null) continue;
    const total = d[`${what}_total`];
    const number = total === null ? `${open}` : `${open}/${total}`;
    parts.push(el("span", { class: "tl-chip" }, timelineIcon(what), best?.[what] ? el("b", {}, number) : number));
  }
  if (d.slopes_open_km) parts.push(el("span", { class: "tl-km" }, `${d.slopes_open_km.toLocaleString(LANG)} km`));
  return parts;
}

/** @param {TimelineEvent} e */
function timelineRow(e) {
  /** @type {(Node|string)[]} */
  let main = [];
  if (e.label) main = [el("span", { class: "tl-label" }, e.label)];
  else if (e.change) main = changeChips(e.change);
  else if (e.list)
    main = [el("span", { class: "tl-chip" }, timelineIcon(e.list.what), `${e.list.from} → ${e.list.to}`)];
  else if (e.snow) main = [el("span", { class: "tl-chip" }, timelineIcon("snow"), `${e.snow} cm`)];
  const state = e.state ? stateChips(e.state, e.best) : [];
  // The row in words: its tooltip, and what screen readers read (the chips are icons).
  const s = e.state;
  const numbers = s && openLine(s, s.lifts_open, s.slopes_open, e.best);
  const words = numbers ? `${e.title}: ${numbers}` : e.title;
  return el(
    "li",
    { class: `tl-${e.kind}`, title: words },
    el("time", { datetime: e.day }, timelineDate(e.day)),
    el("span", { class: "tl-main", "aria-hidden": "true" }, ...main),
    state.length ? el("span", { class: "tl-state", "aria-hidden": "true" }, ...state) : "",
    el("span", { class: "tl-words" }, words),
  );
}

// Fills the card with the season's events, newest first, folded under its heading; hides it when there are none.
/** @param {ResortHistory["runs"]} runs @param {HTMLElement} card */
// biome-ignore lint/correctness/noUnusedVariables: resort.js uses it
function timelineCard(runs, card) {
  const events = timelineEvents(timelineDays(runs)).reverse();
  if (!events.length) return card.remove();
  const list = el("ol", { class: "timeline" }, ...events.slice(0, TIMELINE_ROWS).map(timelineRow));
  const rest = events.slice(TIMELINE_ROWS);
  const more = rest.length
    ? el("button", { class: "tl-more", type: "button" }, t("Show all ({n})", { n: events.length }))
    : "";
  if (more) {
    more.addEventListener("click", () => {
      list.append(...rest.map(timelineRow));
      more.remove();
    });
  }
  // Closed by default: a heading to click, with the latest event beside it.
  const chevron = el("span", { class: "tl-chevron", "aria-hidden": "true" });
  chevron.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"' +
    ' stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  card.replaceChildren(
    el(
      "details",
      { class: "tl-box" },
      el(
        "summary",
        {},
        el("h2", {}, t("Change history")),
        el("span", { class: "meta tl-latest" }, `${timelineDate(events[0].day)}: ${events[0].title}`),
        chevron,
      ),
      list,
      more,
      el(
        "p",
        { class: "meta", style: "margin:10px 0 0" },
        t("Each day against the day before, from our reads twice a day: of the day's two, the one with more open."),
      ),
    ),
  );
  card.hidden = false;
}
