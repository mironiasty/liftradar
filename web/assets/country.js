// /austria, /de/oesterreich… (scripts/countries.mjs builds the pages): one country at a glance, from json/index.json. How much of it is open today, a resort
// of the day, its records (the biggest, highest and steepest areas), its regions with their resorts, its linked ski
// areas and passes (json/groups.json), its resorts on a map, and its season so far (json/stats.json). The highest
// lift and the vertical drop come from the ski tiles' elevations (ski/v1/elevations.json), and are left out
// without them.

const page = /** @type {HTMLElement} */ (document.getElementById("page"));
const number = new Intl.NumberFormat(LANG, { maximumFractionDigits: 0 });

/** @param {string} message */
function fail(message) {
  page.replaceChildren(el("p", {}, message, " ", el("a", { href: "./" }, t("See all resorts"))));
}

// The page's country, which scripts/countries.mjs puts on its <main> (DEVELOPMENT.md "Country pages").
const requested = () => document.querySelector("main").dataset.country ?? null;

/** @param {number | null | undefined} open @param {number | null | undefined} total */
function meter(open, total) {
  if (!present(open) || !total) return el("div", { class: "meter", "aria-hidden": "true" });
  return el(
    "div",
    { class: "meter", "aria-hidden": "true" },
    el("span", { style: `width:${Math.min(100, (100 * open) / total)}%` }),
  );
}

/** @param {string} title @param {any} value @param {...(string | HTMLElement | null)} notes */
function tile(title, value, ...notes) {
  return el(
    "div",
    { class: "tile" },
    el("div", { class: "label" }, title),
    el("div", { class: "value" }, ...[value].flat()),
    ...notes.filter(Boolean).map((note) => (typeof note === "string" ? el("div", { class: "note" }, note) : note)),
  );
}

const isOpen = (/** @type {IndexResort} */ r) => statusKey(r) === "open";

// A number kept on the line of what follows it ("293 km", "69 lifts"): no "km" or "m" alone on the next line.
const glued = (/** @type {string} */ text) => text.replace(/(\d) /g, "$1\u00a0");

// Open lifts, slopes and km of the open resorts, out of all the resorts' (those that give them), as the area page.
/** @param {IndexResort[]} resorts */
function totals(resorts) {
  const sum = (/** @type {(r: IndexResort) => number | null | undefined} */ value, onlyOpen = false) =>
    resorts
      .filter((r) => !onlyOpen || isOpen(r))
      .map(value)
      .reduce((/** @type {number} */ a, b) => a + (b ?? 0), 0);
  return {
    open: resorts.filter(isOpen).length,
    liftsOpen: sum((r) => r.lifts?.open, true),
    lifts: sum((r) => r.lifts?.total),
    kmOpen: sum((r) => r.slopes?.open_km, true),
    km: sum((r) => r.slopes?.total_km),
  };
}

// The resort with the highest value, and the value; only among the open ones when `onlyOpen` (a closed resort's
// snow is often last season's).
/**
 * @param {IndexResort[]} resorts
 * @param {(r: IndexResort) => number | null | undefined} value
 * @returns {{ v: number, r: IndexResort } | null}
 */
function highest(resorts, value, onlyOpen = false) {
  let best = /** @type {{ v: number, r: IndexResort } | null} */ (null);
  for (const r of resorts) {
    const v = value(r);
    if ((!onlyOpen || isOpen(r)) && present(v) && v > 0 && (!best || v > best.v)) best = { v, r };
  }
  return best;
}

const resortLink = (/** @type {IndexResort} */ r) => el("a", { href: resortPage(r) }, r.name);

// When the data was read, as the pill over the home page's table: clicked, it says when we read the reports.
/** @param {Index} index */
function updatedPill(index) {
  const clock = el("span", { class: "clock", "aria-hidden": "true" });
  clock.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"' +
    ' stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const menu = el(
    "details",
    { class: "updated-menu" },
    el("summary", { class: "updated" }, clock, el("span", {}, updatedText(index))),
    el("div", {}, t("We read the reports twice a day, at about 08:40 and 13:40 CET.")),
  );
  closeOnOutside(/** @type {HTMLDetailsElement} */ (menu));
  return menu;
}

// The regions the resorts are in, by name (resorts without one under "Other").
/** @param {IndexResort[]} resorts @returns {[string, IndexResort[]][]} */
function byRegion(resorts) {
  /** @type {Map<string, IndexResort[]>} */
  const regions = new Map();
  for (const r of resorts) {
    const name = r.region ?? "";
    regions.set(name, [...(regions.get(name) ?? []), r]);
  }
  return [...regions];
}

/** @param {string} code @param {IndexResort[]} resorts @param {Index} index */
function header(code, resorts, index) {
  const flag = el("span", { class: "flag big", "data-country": code, "aria-hidden": "true" });
  const regions = byRegion(resorts).filter(([name]) => name).length;
  return el(
    "header",
    { class: "resort-head" },
    backLink(),
    el("h1", {}, flag, countryName(code)),
    // The same sentence as the page's description (countries.mjs).
    el(
      "p",
      { class: "intro" },
      t(
        "{country}: {n} ski resorts, {open} of them open today. Open lifts and slopes, the records and every resort, region by region, updated twice a day.",
        { country: countryName(code), n: resorts.length, open: resorts.filter(isOpen).length },
      ),
    ),
    el(
      "div",
      { class: "facts" },
      el("span", {}, t("{n} resorts", { n: resorts.length })),
      regions ? el("span", {}, t("{n} regions", { n: regions })) : "",
      updatedPill(index),
    ),
  );
}

// How much is open: resorts and km of slopes, larger, then lifts and the regions with a resort open.
/** @param {IndexResort[]} resorts */
function tiles(resorts) {
  const s = totals(resorts);
  const share = (/** @type {number} */ open, /** @type {number} */ total) =>
    total ? t("{share}% open", { share: Math.round((100 * open) / total) }) : null;
  const regions = byRegion(resorts).filter(([name]) => name);
  const regionsOpen = regions.filter(([, members]) => members.some(isOpen)).length;
  return el(
    "div",
    { class: "summary" },
    el(
      "div",
      { class: "tiles key" },
      tile(
        t("Resorts open"),
        pair(s.open, resorts.length),
        meter(s.open, resorts.length),
        share(s.open, resorts.length),
      ),
      s.km
        ? tile(
            t("Slopes"),
            [pair(Math.round(s.kmOpen), Math.round(s.km)), el("small", {}, "\u00a0km")],
            meter(s.kmOpen, s.km),
            share(s.kmOpen, s.km),
          )
        : tile(t("Lifts"), pair(s.liftsOpen, s.lifts), meter(s.liftsOpen, s.lifts), share(s.liftsOpen, s.lifts)),
    ),
    el(
      "div",
      { class: "tiles" },
      s.km ? tile(t("Lifts"), pair(s.liftsOpen, s.lifts), meter(s.liftsOpen, s.lifts)) : "",
      regions.length > 1
        ? tile(t("Regions with a resort open"), pair(regionsOpen, regions.length), meter(regionsOpen, regions.length))
        : "",
    ),
  );
}

// The ski tiles' lowest and highest lift station of each resort, "<country>/<id>" to [bottom, top] in metres; an
// empty map without the tiles.
/** @returns {Promise<Map<string, [number, number]>>} */
async function loadElevations() {
  try {
    const meta = await (await fetch("/ski/v1/meta.json", { cache: "no-cache" })).json();
    const data = await (await fetch(`/ski/v1/${meta.elevations}?b=${meta.build}`)).json();
    /** @type {Record<string, { bottom: number[], top: number[] }>} */
    const resorts = data.resorts;
    return new Map(Object.entries(resorts).map(([key, { bottom, top }]) => [key, [bottom[2], top[2]]]));
  } catch {
    return new Map();
  }
}

// A resort's status and how much of its lifts and slopes is open (without its snow, as memberSummary has it).
/** @param {IndexResort} r */
function openLine(r) {
  const open = isOpen(r);
  const { lifts, slopes } = r;
  const parts = [capitalized(STATUS_LABELS[statusKey(r)])];
  if (lifts?.total) parts.push(t("{n} lifts", { n: open ? pair(lifts.open, lifts.total) : lifts.total }));
  if (slopes?.total_km) {
    parts.push(open ? pair(slopes.open_km, slopes.total_km, " km") : t("{km} km of slopes", { km: slopes.total_km }));
  }
  return glued(parts.join(" · "));
}

// FNV-1a: the same day and country always pick the same resort, anywhere.
/** @param {string} text */
function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619);
  return h >>> 0;
}

// The resort of the day: one of the open resorts, picked by the day's date (in Vienna, as the reports are read) and
// the country, so that everyone sees the same one, and another tomorrow. Before any resort opens, one of them all.
/**
 * @param {string} code
 * @param {IndexResort[]} resorts
 * @param {Map<string, [number, number]>} elevations
 */
function resortOfTheDay(code, resorts, elevations) {
  const open = resorts.filter(isOpen);
  const pool = (open.length ? open : resorts).map(resortKey).sort();
  if (!pool.length) return null;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const key = pool[hash(`${day}/${code}`) % pool.length];
  const r = /** @type {IndexResort} */ (resorts.find((x) => resortKey(x) === key));
  const heights = elevations.get(key);
  const facts = [
    r.slopes?.total_km ? [t("Slopes"), `${number.format(r.slopes.total_km)}\u00a0km`] : null,
    r.lifts?.total ? [t("Lifts"), String(r.lifts.total)] : null,
    heights ? [t("Top|elevation"), `${number.format(heights[1])}\u00a0m`] : null,
    heights ? [t("Vertical drop"), `${number.format(heights[1] - heights[0])}\u00a0m`] : null,
  ].filter((fact) => fact !== null);
  const status = statusKey(r);
  return el(
    "section",
    { class: "card of-the-day" },
    el("h2", {}, t("Resort of the day")),
    el(
      "div",
      { class: "pick" },
      el("span", { class: "dot", style: `--c:${STATUS_COLORS[status]}`, "aria-hidden": "true" }),
      el(
        "div",
        {},
        el("a", { class: "pick-name", href: resortPage(r) }, r.name),
        el("div", { class: "meta" }, r.region ?? ""),
        el("div", { class: "meta numbers" }, openLine(r)),
      ),
    ),
    facts.length
      ? el(
          "dl",
          { class: "pick-facts" },
          ...facts.map(([title, value]) => el("div", {}, el("dt", {}, title), el("dd", {}, value))),
        )
      : "",
    heights ? el("a", { class: "more", href: `3d.html?r=${key}` }, t("See it in 3D →")) : "",
  );
}

// The country's records: the biggest ski area, the most lifts, the highest lift and the biggest vertical drop.
/** @param {IndexResort[]} resorts @param {Map<string, [number, number]>} elevations */
function records(resorts, elevations) {
  const height = (/** @type {IndexResort} */ r, /** @type {number} */ i) => elevations.get(resortKey(r))?.[i];
  const km = highest(resorts, (r) => r.slopes?.total_km);
  const lifts = highest(resorts, (r) => r.lifts?.total);
  const top = highest(resorts, (r) => height(r, 1));
  const drop = highest(resorts, (r) => {
    const [bottom, high] = [height(r, 0), height(r, 1)];
    return present(bottom) && present(high) ? high - bottom : null;
  });
  /** @type {[string, { v: number, r: IndexResort } | null, (v: number) => string][]} */
  const rows = [
    [t("Biggest ski area"), km, (v) => t("{km} km of slopes", { km: number.format(v) })],
    [t("Most lifts"), lifts, (v) => t("{n} lifts", { n: v })],
    [t("Highest lift"), top, (v) => `${number.format(v)} m`],
    [t("Biggest vertical drop"), drop, (v) => `${number.format(v)} m`],
  ];
  const items = rows
    .filter(([, best]) => best)
    .map(([title, best, format]) => {
      const { v, r } = /** @type {{ v: number, r: IndexResort }} */ (best);
      return el(
        "li",
        {},
        el("span", { class: "label" }, title),
        el("span", { class: "value" }, glued(format(v))),
        el("span", { class: "who" }, resortLink(r), r.region ? el("span", { class: "meta" }, ` · ${r.region}`) : ""),
      );
    });
  if (!items.length) return null;
  return el("section", { class: "card records" }, el("h2", {}, t("Records")), el("ul", {}, ...items));
}

// The middle value of those known (the upper of the two middle ones), or null.
/** @param {(number | null | undefined)[]} values */
function median(values) {
  const known = /** @type {number[]} */ (values.filter((v) => present(v) && v > 0)).sort((a, b) => a - b);
  return known.length ? known[Math.floor(known.length / 2)] : null;
}

// The country in numbers, from the resorts we follow: their slopes and lifts in all, the typical resort (the
// median), its top station, and how many reach about that height or have under 10 km of slopes.
/** @param {IndexResort[]} resorts @param {Map<string, [number, number]>} elevations */
function numbers(resorts, elevations) {
  const s = totals(resorts);
  const km = median(resorts.map((r) => r.slopes?.total_km));
  const lifts = median(resorts.map((r) => r.lifts?.total));
  const tops = resorts.map((r) => elevations.get(resortKey(r))?.[1]);
  const top = median(tops);
  // The height counted against: the typical top station to the nearest 500 m, so that about half the resorts
  // reach it, in Finland (500 m) as in Switzerland (2,500 m).
  const reach = Math.max(500, Math.round((top ?? 0) / 500) * 500);
  const sized = resorts.filter((r) => r.slopes?.total_km);
  /** @type {[string, string | null, string | null][]} */
  const rows = [
    [t("Slopes in all"), s.km ? `${number.format(s.km)} km` : null, null],
    [t("Lifts in all"), s.lifts ? number.format(s.lifts) : null, null],
    [
      t("Typical resort"),
      km ? t("{km} km of slopes", { km: number.format(km) }) : null,
      lifts ? t("{n} lifts", { n: lifts }) : null,
    ],
    [t("Typical top station"), top ? `${number.format(top)} m` : null, null],
    [
      t("Resorts reaching {m} m", { m: number.format(reach) }),
      top ? String(tops.filter((v) => present(v) && v >= reach).length) : null,
      top ? t("of {n}", { n: tops.filter(present).length }) : null,
    ],
    [
      t("Resorts under 10 km of slopes"),
      sized.length ? String(sized.filter((r) => (r.slopes?.total_km ?? 0) < 10).length) : null,
      sized.length ? t("of {n}", { n: sized.length }) : null,
    ],
  ];
  const items = rows
    .filter(([, value]) => value)
    .map(([title, value, note]) =>
      el(
        "li",
        {},
        el("span", { class: "label" }, glued(title)),
        el("span", { class: "value" }, glued(value ?? "")),
        note ? el("span", { class: "who" }, glued(note)) : "",
      ),
    );
  if (!items.length) return null;
  return el(
    "section",
    { class: "card records" },
    el("h2", {}, t("In numbers")),
    el("ul", {}, ...items),
    el(
      "p",
      { class: "meta" },
      t("Based on the {n} resorts we monitor here; typical is the median.", { n: resorts.length }),
    ),
  );
}

// Each region with its resorts: the regions with the most open resorts first, then the biggest; folded, each shows
// how many are open, and opened, its resorts as a ski area's page lists them (the most open first).
/** @param {string} code @param {IndexResort[]} resorts */
function regionsCard(code, resorts) {
  const regions = byRegion(resorts)
    .map(([name, members]) => ({ name, members, s: totals(members) }))
    .sort((a, b) => b.s.open - a.s.open || b.s.km - a.s.km || a.name.localeCompare(b.name, LANG));
  const single = regions.length === 1;
  const items = regions.map(({ name, members, s }) => {
    const byKey = new Map(members.map((r) => [resortKey(r), r]));
    const ordered = orderedMembers([...byKey.keys()], byKey).map((key) => /** @type {IndexResort} */ (byKey.get(key)));
    const list = el(
      "ul",
      { class: "members" },
      ...ordered.map((r) =>
        el(
          "li",
          {},
          el("span", {
            class: "dot",
            style: `--c:${STATUS_COLORS[statusKey(r)]}`,
            role: "img",
            "aria-label": STATUS_LABELS[statusKey(r)],
          }),
          el("div", {}, el("div", { class: "name" }, resortLink(r)), memberSummary(r)),
        ),
      ),
    );
    const tableLink = name
      ? el(
          "a",
          { class: "more", href: `./?${new URLSearchParams({ country: code, region: name })}` },
          t("In the table"),
        )
      : "";
    return el(
      "details",
      single ? { class: "region", open: "" } : { class: "region" },
      el(
        "summary",
        {},
        el("span", { class: "region-name" }, name || t("Other")),
        el("span", { class: "n" }, t("{open} of {n} open", { open: s.open, n: members.length })),
        el("span", { class: "km" }, s.km ? `${number.format(s.km)}\u00a0km` : ""),
        meter(s.open, members.length),
      ),
      list,
      tableLink,
    );
  });
  return el("section", { class: "card regions" }, el("h2", {}, t("Regions and resorts")), ...items);
}

// The linked ski areas and passes with resorts in the country, those with the most of them here first.
/** @param {string} code @param {Groups["groups"]} groups */
function groupsCard(code, groups) {
  const here = Object.entries(groups)
    .map(([id, g]) => ({ id, g, n: g.members.filter((key) => key.startsWith(`${code}/`)).length }))
    .filter(({ n }) => n)
    .sort((a, b) => b.n - a.n || b.g.members.length - a.g.members.length || a.g.name.localeCompare(b.g.name, LANG));
  if (!here.length) return null;
  return el(
    "section",
    { class: "card groups" },
    el("h2", {}, t("Linked ski areas and passes")),
    el(
      "ul",
      { class: "members" },
      ...here.map(({ id, g }) =>
        el(
          "li",
          {},
          el(
            "div",
            {},
            el("div", { class: "name" }, el("a", { href: areaPage(id) }, g.name)),
            el(
              "div",
              { class: "meta numbers" },
              `${g.kind === "linked" ? t("Linked ski area") : t("Ski region")} · ${t("{n} resorts", { n: g.members.length })}`,
            ),
          ),
        ),
      ),
    ),
  );
}

// The resorts on a map: a dot each in its status's colour, as big as its slopes, to its page.
/** @param {IndexResort[]} resorts @param {HTMLElement} container */
async function countryMap(resorts, container) {
  container.classList.add("loading");
  const loader = liftLoader();
  container.append(loader);
  const placed = resorts.filter((r) => r.location);
  const bounds = new maplibregl.LngLatBounds();
  for (const r of placed) if (r.location) bounds.extend([r.location.lon, r.location.lat]);
  const map = await baseMap(
    container,
    bounds.isEmpty()
      ? { center: [11.9, 47.25], zoom: 5, scrollZoom: false }
      : { bounds, fitBoundsOptions: { padding: 30, maxZoom: 10 }, scrollZoom: false },
    { controls: "top-right" },
  );
  map.once("click", () => map.scrollZoom.enable());
  // The open ones drawn last, over the closed.
  const order = { open: 2, closed: 1, no_report: 0 };
  map.addSource("resorts", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: placed
        .sort((a, b) => order[statusKey(a)] - order[statusKey(b)])
        .map((r) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [r.location?.lon ?? 0, r.location?.lat ?? 0] },
          properties: { key: resortKey(r), status: statusKey(r), km: r.slopes?.total_km ?? 0 },
        })),
    },
  });
  map.addLayer({
    id: "resorts",
    type: "circle",
    source: "resorts",
    paint: {
      "circle-color": [
        "match",
        ["get", "status"],
        "open",
        cssColor("--open"),
        "closed",
        cssColor("--closed"),
        cssColor("--none"),
      ],
      "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "km"]], 0, 4, 5, 6, 20, 14],
      "circle-stroke-color": cssColor("--bg"),
      "circle-stroke-width": 1.5,
    },
  });
  const byKey = new Map(resorts.map((r) => [resortKey(r), r]));
  const of = (/** @type {any} */ feature) => byKey.get(feature.properties.key);
  hoverTip(map, ["resorts"], (feature) => {
    const r = of(feature);
    return r ? el("div", {}, el("strong", {}, r.name), memberSummary(r)) : el("div");
  });
  map.on("click", "resorts", (e) => {
    const r = e.features?.[0] && of(e.features[0]);
    if (r) location.href = resortPage(r);
  });
  container.classList.remove("loading");
  loader.remove();
}

// The season so far, from json/stats.json: the country's open resorts and open km, a point a day.
/** @param {string} code @param {HTMLElement} container */
async function seasonCharts(code, container) {
  const response = await fetch("/json/stats.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  /** @type {Stats} */
  const stats = await response.json();
  const rows = stats.regions.filter((row) => row.country === code);
  const days = stats.days.map((day, i) => ({
    t: new Date(`${day}T12:00:00Z`),
    tracked: rows.reduce((n, row) => n + row.tracked[i], 0),
    open: rows.reduce((n, row) => n + row.open[i], 0),
    km: rows.reduce((n, row) => n + row.slopes_open_km[i], 0),
  }));
  const known = days.filter((d) => d.tracked);
  if (known.length < 2) return container.replaceChildren(el("p", { class: "empty" }, t("Not enough runs yet.")));
  container.replaceChildren(
    chart(
      t("Resorts open"),
      "",
      "var(--open)",
      known.map((d) => ({ t: d.t, v: d.open })),
    ),
    chart(
      t("Open slopes (km)"),
      "km",
      "var(--open)",
      known.map((d) => ({ t: d.t, v: Math.round(d.km) })),
    ),
  );
}

async function show() {
  const code = requested();
  if (!code) return fail(t("We don't cover that country."));
  page.replaceChildren(liftLoader());
  // Without the groups, only their card is missing (as on the home page).
  const [index, groups, elevations] = await Promise.all([
    loadIndex(),
    loadGroups().catch(() => ({})),
    loadElevations(),
  ]);
  const resorts = index.resorts.filter((r) => r.country === code);
  if (!resorts.length) return fail(t("We don't cover that country."));

  const mapBox = el("div", {
    id: "map",
    role: "region",
    "aria-label": t("Map of {name}", { name: countryName(code) }),
  });
  const chartsBox = el("div", { class: "charts" }, liftLoader({ small: true }));
  page.replaceChildren(
    header(code, resorts, index),
    el(
      "div",
      { class: "layout" },
      el(
        "div",
        { class: "stack" },
        tiles(resorts),
        ...[
          resortOfTheDay(code, resorts, elevations),
          records(resorts, elevations),
          numbers(resorts, elevations),
        ].filter((card) => card !== null),
        regionsCard(code, resorts),
        el("section", { class: "card" }, el("h2", {}, t("This season")), chartsBox),
      ),
      el(
        "aside",
        { class: "side" },
        el(
          "div",
          { class: "map-box" },
          mapBox,
          el(
            "a",
            { class: "map-link", href: `map.html?${new URLSearchParams({ country: code })}` },
            t("{country} on the map →", { country: countryName(code) }),
          ),
        ),
        ...[groupsCard(code, groups)].filter((card) => card !== null),
      ),
    ),
  );
  countryMap(resorts, mapBox).catch(() => {
    mapBox.classList.remove("loading");
    mapBox.replaceChildren(el("p", { class: "empty" }, t("The map could not load.")));
  });
  seasonCharts(code, chartsBox).catch((error) =>
    chartsBox.replaceChildren(el("p", { class: "empty" }, t("No history ({message}).", error))),
  );
}

show().catch((error) => fail(t("Could not load the country ({message}).", error)));
