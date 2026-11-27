// The resort page's "What changed": the season so far as events, worked out from the resort's history file
// (history/<country>/<id>.json, the key numbers of every run). Shown by resort.js, which loads after this file.
//
// It compares each day's last run with the day before, then keeps what a reader cares about and folds the rest:
// - opening, and closing (a closure of one day between open days is minor: weather, wind),
// - the most lifts or slopes open so far this season (against every earlier open day),
// - a change in how many lifts or slopes the resort lists,
// - fresh snow of TIMELINE_SNOW_CM or more, once (sources repeat the same value for days).
// The other changes of open lifts and slopes are minor: consecutive minor days become one row with their range.
// Days without a report (no_report, or no status) are skipped: they say nothing about the resort.

const TIMELINE_SNOW_CM = 10;
// Rows shown before "Show all".
const TIMELINE_ROWS = 8;

/**
 * One day: its date in Vienna and its last run with a report.
 * @typedef {{ day: string, status: string, lifts_open: number|null, lifts_total: number|null,
 *   slopes_open: number|null, slopes_total: number|null, slopes_open_km: number|null, fresh: number, detail?: string }} TimelineDay
 */
/**
 * @typedef {{ day: string, until?: string, kind: "open"|"closed"|"high"|"snow"|"list"|"minor",
 *   title: string, detail: string }} TimelineEvent
 */

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
    days.set(day, {
      day,
      // Open without a lift running (a source's slip, or a slope open for walkers) isn't an opening.
      status: status === "open" && runs.lifts_open[i] === 0 ? "closed" : status,
      lifts_open: runs.lifts_open[i],
      lifts_total: runs.lifts_total[i],
      slopes_open: runs.slopes_open[i],
      slopes_total: runs.slopes_total[i],
      slopes_open_km: runs.slopes_open_km[i],
      fresh: 0,
    });
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
/** @param {TimelineDay} d */
const openNumbers = (d) => openLine(d, d.lifts_open, d.slopes_open);

// "Opened 2 lifts and 1 slope", "Closed 1 lift", "Opened 3 slopes, closed 1 lift": the change since the day
// before, or null when the open lifts and slopes stayed the same. With `only`, just those that grew.
/** @param {TimelineDay} d @param {TimelineDay} prev @param {{ lifts: boolean, slopes: boolean }} [only] */
function changeTitle(d, prev, only) {
  const delta = (/** @type {"lifts"|"slopes"} */ what) => {
    const now = d[`${what}_open`];
    const before = prev[`${what}_open`];
    return now === null || before === null || (only && !only[what]) ? 0 : now - before;
  };
  const lifts = delta("lifts");
  const slopes = delta("slopes");
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
  // Kept apart, so a snowfall doesn't split a run of minor days in two; merged by date at the end.
  /** @type {TimelineEvent[]} */
  const snow = [];
  /** @type {(TimelineDay & { title: string })[]} the minor days not yet folded into a row */
  let minor = [];
  const flushMinor = () => {
    if (!minor.length) return;
    const first = minor[0];
    const last = minor[minor.length - 1];
    if (minor.length === 1) {
      events.push({ day: first.day, kind: "minor", title: first.title, detail: first.detail ?? "" });
    } else {
      const open = minor.filter((d) => d.status === "open");
      const closed = minor.length - open.length;
      const range = (/** @type {"lifts_open"|"slopes_open"} */ key) => {
        const values = open.map((d) => d[key]).filter((v) => v !== null);
        if (!values.length) return null;
        const low = Math.min(...values);
        const high = Math.max(...values);
        return low === high ? low : `${low}–${high}`;
      };
      const parts = [
        openLine({ ...last, slopes_open_km: null }, range("lifts_open"), range("slopes_open")),
        closed === 1 ? t("closed for 1 day") : closed ? t("closed for {n} days", { n: closed }) : "",
      ];
      events.push({
        day: first.day,
        until: last.day,
        kind: "minor",
        title: t("Small changes from day to day"),
        detail: parts.filter(Boolean).join(" · "),
      });
    }
    minor = [];
  };
  const add = (/** @type {TimelineEvent} */ event) => {
    flushMinor();
    events.push(event);
  };

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
        add({ day: d.day, kind: "list", title, detail: "" });
      }
      if (prev.slopes_total !== null && d.slopes_total !== null && prev.slopes_total !== d.slopes_total) {
        const values = { from: prev.slopes_total, to: d.slopes_total };
        const title =
          d.slopes_total > prev.slopes_total
            ? t("The slope list grew from {from} to {to}", values)
            : t("The slope list shrank from {from} to {to}", values);
        add({ day: d.day, kind: "list", title, detail: "" });
      }
    }
    if (d.status === "open") {
      const liftsHigh = maxLifts >= 0 && d.lifts_open !== null && d.lifts_open > maxLifts;
      const slopesHigh = maxSlopes >= 0 && d.slopes_open !== null && d.slopes_open > maxSlopes;
      if (!prev) {
        add({ day: d.day, kind: "open", title: t("Already open when we started tracking it"), detail: openNumbers(d) });
      } else if (prev.status !== "open") {
        // Reopening after one closed day is part of the small changes, unless it's a new high.
        if (days[i - 2]?.status === "open" && !liftsHigh && !slopesHigh) {
          minor.push({ ...d, title: t("Open again"), detail: openNumbers(d) });
        } else {
          const title = maxLifts < 0 ? t("Opened for the season") : t("Open again");
          add({ day: d.day, kind: "open", title, detail: openNumbers(d) });
        }
      } else if (liftsHigh || slopesHigh) {
        // The title names only what grew to a new high.
        const title = changeTitle(d, prev, { lifts: liftsHigh, slopes: slopesHigh }) ?? t("Open again");
        add({
          day: d.day,
          kind: "high",
          title,
          detail: openLine(d, d.lifts_open, d.slopes_open, { lifts: liftsHigh, slopes: slopesHigh }),
        });
      } else {
        const title = changeTitle(d, prev);
        if (title) minor.push({ ...d, title, detail: openNumbers(d) });
      }
      maxLifts = Math.max(maxLifts, d.lifts_open ?? 0);
      maxSlopes = Math.max(maxSlopes, d.slopes_open ?? 0);
    } else if (prev?.status === "open") {
      // One closed day between open days: minor. The last day can't tell yet, so it counts as closed.
      if (next?.status === "open") minor.push({ ...d, title: t("Closed for a day"), detail: "" });
      else add({ day: d.day, kind: "closed", title: t("Closed|resort"), detail: "" });
    }
    // Fresh snow, once per value: sources keep the last snowfall for days.
    if (d.fresh >= TIMELINE_SNOW_CM && d.fresh !== lastSnow) {
      snow.push({ day: d.day, kind: "snow", title: t("{n} cm of fresh snow", { n: d.fresh }), detail: "" });
    }
    lastSnow = d.fresh;
  });
  flushMinor();
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

/** @param {TimelineEvent} e */
function timelineRow(e) {
  const date = e.until ? `${timelineDate(e.day)} – ${timelineDate(e.until)}` : timelineDate(e.day);
  return el(
    "li",
    { class: `tl-${e.kind}` },
    el("time", { datetime: e.day }, date),
    el("div", {}, el("strong", {}, e.title), e.detail ? el("span", { class: "meta" }, e.detail) : ""),
  );
}

// Fills the card with the season's events, newest first; hides it when there are none.
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
  card.replaceChildren(
    el("h2", {}, t("What changed")),
    list,
    more,
    el(
      "p",
      { class: "meta", style: "margin:10px 0 0" },
      t("Each day's last report against the day before, from our reads twice a day."),
    ),
  );
  card.hidden = false;
}
