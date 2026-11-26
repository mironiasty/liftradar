// resort.html?r=<country>/<id>: everything in one resort's JSON, its area on the
// map (with the resorts around it) and its history (key numbers of past runs). The page loads
// resort-lists.js, resort-map.js and resort-weather.js first, sharing their top-level names, then this
// file, which shows the resort (show(), at the end).

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
  // The region opens the list of all resorts filtered to it, the country its own page.
  const filterLink = (text, params) => el("a", { class: "where", href: `./?${new URLSearchParams(params)}` }, text);
  const where = [
    r.region ? filterLink(r.region, { country: r.country, region: r.region }) : null,
    el("a", { class: "where", href: countryPagePath(r.country) }, countryName(r.country)),
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
  const { conditions, resort_info } = r.source_details;
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
      if (known) {
        dot.title = STATUS_LABELS[statusKey(known)];
        // Named for screen readers: the colour alone doesn't say it.
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", STATUS_LABELS[statusKey(known)]);
      }
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
        el("a", { class: "group-name", href: areaPage(/** @type {string} */ (id)) }, group.name),
        others.length ? el("div", { class: "meta" }, membersTitle) : "",
        others.length ? el("ul", { class: "members" }, ...others) : "",
      ),
    ];
  });
  container.replaceWith(...cards);
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
  // Filled by weatherCard once the forecast is in.
  const weatherBox = el("section", { class: "card weather", hidden: "" });
  const main = el(
    "div",
    { class: "stack" },
    tiles(r),
    ...breakdown(r),
    weatherBox,
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
    mapItemsReady(null);
    mapBox.classList.remove("loading");
    mapBox.replaceChildren(el("p", { class: "empty" }, t("The map could not load.")));
  });
  groupCards(r, groupsBox).catch(() => groupsBox.remove());
  weatherCard(r, weatherBox).catch(() => weatherBox.remove());
  historyChart(r, historyBox, collected).catch((error) =>
    historyBox.replaceChildren(el("p", { class: "empty" }, t("No history ({message}).", error))),
  );
}

show().catch((error) => fail(t("Could not load the resort ({message}).", error)));
