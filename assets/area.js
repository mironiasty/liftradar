// area.html?g=<group>: a group of resorts from json/groups.json as one place. A linked ski area (kind "linked",
// Les 3 Vallées) is one ski area sold as one: how much of it is open, and what each resort adds. A pass or regional
// operator (kind "region", Zillertal) is resorts that share a pass: which of them is the most open today. Both: the
// key numbers across the group, its resorts on the map, its lifts and slopes, and its season so far.

// Lift types and slope difficulties, as on the resort page.
const LIFT_TYPES = {
  gondola: t("Gondolas"),
  cable_car: t("Cable cars"),
  chairlift: t("Chairlifts"),
  drag_lift: t("Drag lifts"),
  carpet: t("Carpets"),
  funicular: t("Funiculars"),
  other: t("Other"),
};
const DIFFICULTIES = {
  easy: [t("Easy"), "#2a6fdb"],
  intermediate: [t("Intermediate"), "#d62828"],
  difficult: [t("Difficult"), "var(--fg)"],
  ski_route: [t("Ski routes"), "#f2b705"],
  other: [t("Other"), "var(--muted)"],
};

const page = /** @type {HTMLElement} */ (document.getElementById("page"));
const label = (text) => text.replaceAll("_", " ");

/** @param {string} message */
function fail(message) {
  page.replaceChildren(el("p", {}, message, " ", el("a", { href: "./" }, t("See all resorts"))));
}

// ?g=sella-ronda; anything else isn't a group's id.
function requested() {
  const id = new URLSearchParams(location.search).get("g") ?? "";
  return /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null;
}

// As setResortAddress (common.js): the page's own address for search engines, once it knows the group.
/** @param {string} id */
function setAreaAddress(id) {
  const links = /** @type {NodeListOf<HTMLLinkElement>} */ (
    document.querySelectorAll('link[rel="alternate"][hreflang]')
  );
  for (const link of links) link.href += `?g=${id}`;
  const own = [...links].find((link) => link.hreflang === document.documentElement.lang);
  if (own) document.head.append(el("link", { rel: "canonical", href: own.href }));
}

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

/**
 * The group's totals: open lifts, slopes and km of its open resorts, out of all its resorts' (those that give them).
 * @param {IndexResort[]} members
 */
function totals(members) {
  const sum = (/** @type {(r: IndexResort) => number | null | undefined} */ value, onlyOpen = false) => {
    const values = members
      .filter((r) => !onlyOpen || statusKey(r) === "open")
      .map(value)
      .filter(present);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  return {
    open: members.filter((r) => statusKey(r) === "open").length,
    liftsOpen: sum((r) => r.lifts?.open, true) ?? 0,
    lifts: sum((r) => r.lifts?.total),
    slopesOpen: sum((r) => r.slopes?.open, true) ?? 0,
    slopes: sum((r) => r.slopes?.total),
    kmOpen: sum((r) => r.slopes?.open_km, true) ?? 0,
    km: sum((r) => r.slopes?.total_km),
  };
}

// The highest value among the open resorts, and whose it is (closed resorts' snow is often last season's).
/** @param {IndexResort[]} members @param {(r: IndexResort) => number | null | undefined} value */
function highest(members, value) {
  let best = /** @type {{ v: number, r: IndexResort } | null} */ (null);
  for (const r of members) {
    const v = value(r);
    if (statusKey(r) === "open" && present(v) && v > 0 && (!best || v > best.v)) best = { v, r };
  }
  return best;
}

/** @param {Groups["groups"][string]} group @param {IndexResort[]} members */
function tiles(group, members) {
  const s = totals(members);
  const share = (open, total) =>
    s.open && total ? t("{share}% open", { share: Math.round((100 * open) / total) }) : null;
  const snow = highest(members, (r) => r.snow.mountain_cm);
  const fresh = highest(members, (r) => r.snow.fresh_cm);
  const danger = members.reduce((most, r) => Math.max(most, r.avalanche?.danger_level ?? 0), 0);
  const dangerOf = members.find((r) => r.avalanche?.danger_level === danger)?.avalanche;
  // A linked area leads with its km, as it sells itself; a pass with how many of its resorts are open.
  const slopes = tile(
    t("Slopes"),
    s.km ? [pair(s.kmOpen, s.km), el("small", {}, " km")] : pair(s.slopesOpen, s.slopes),
    s.open ? meter(s.km ? s.kmOpen : s.slopesOpen, s.km ?? s.slopes) : null,
    share(s.km ? s.kmOpen : s.slopesOpen, s.km ?? s.slopes),
  );
  const lifts = tile(
    t("Lifts"),
    pair(s.liftsOpen, s.lifts),
    s.open ? meter(s.liftsOpen, s.lifts) : null,
    share(s.liftsOpen, s.lifts),
  );
  const resorts = tile(t("Resorts open"), pair(s.open, members.length));
  return el(
    "div",
    { class: "summary" },
    el("div", { class: "tiles key" }, ...(group.kind === "linked" ? [slopes, lifts] : [resorts, slopes])),
    el(
      "div",
      { class: "tiles" },
      group.kind === "linked" ? resorts : lifts,
      tile(t("Mountain"), snow ? [String(snow.v), el("small", {}, " cm")] : "–", snow?.r.name ?? null),
      tile(
        t("Fresh snow"),
        fresh ? el("span", { class: "fresh" }, `+${fresh.v}`, el("small", {}, " cm")) : "–",
        fresh?.r.name ?? null,
      ),
      tile(
        t("Avalanche danger"),
        danger && dangerOf?.danger
          ? [
              el("span", { class: `badge lvl${danger}` }, String(danger)),
              el(
                "span",
                { class: "danger", style: `--chars:${dangerName(dangerOf.danger).length}` },
                dangerName(dangerOf.danger),
              ),
            ]
          : "–",
        danger ? t("highest in the area") : null,
      ),
    ),
  );
}

// The regions and countries the group's resorts are in, each to the list of all resorts filtered to it.
/** @param {IndexResort[]} members */
function places(members) {
  const filterLink = (text, params) => el("a", { class: "where", href: `./?${new URLSearchParams(params)}` }, text);
  const countries = [...new Set(members.map((r) => r.country))];
  const regions = [...new Map(members.filter((r) => r.region).map((r) => [`${r.country}/${r.region}`, r])).values()];
  return [
    ...regions.map((r) =>
      filterLink(/** @type {string} */ (r.region), { country: r.country, region: /** @type {string} */ (r.region) }),
    ),
    ...countries.map((c) => filterLink(countryName(c), { country: c })),
  ].flatMap((link, i) => (i ? [" · ", link] : [link]));
}

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

/** @param {Groups["groups"][string]} group @param {IndexResort[]} members @param {Index} index */
function header(group, members, index) {
  const kind = group.kind === "linked" ? t("Linked ski area") : t("Ski region");
  return el(
    "header",
    { class: "resort-head" },
    backLink(),
    el("h1", {}, group.name),
    el(
      "div",
      { class: "facts" },
      el("span", { class: "kind" }, kind),
      el("span", {}, t("{n} resorts", { n: group.members.length })),
      el("span", {}, ...places(members)),
      updatedPill(index),
    ),
    el(
      "p",
      { class: "meta" },
      group.kind === "linked"
        ? t("One ski area: its resorts are linked by lifts and runs, and sold as one.")
        : t("Resorts that share a ski pass or an operator, but aren't linked by lifts."),
    ),
  );
}

// The line under a resort's name: its status, then its lifts and slopes, open of all while it's open.
/** @param {IndexResort} r */
function memberLine(r) {
  const status = statusKey(r);
  const open = status === "open";
  const { lifts, slopes } = r;
  const parts = [capitalized(STATUS_LABELS[status])];
  if (lifts?.total) parts.push(t("{n} lifts", { n: open ? pair(lifts.open, lifts.total) : lifts.total }));
  if (slopes?.total_km) {
    parts.push(open ? pair(slopes.open_km, slopes.total_km, " km") : t("{km} km of slopes", { km: slopes.total_km }));
  } else if (slopes?.total) {
    parts.push(t("{n} slopes", { n: open ? pair(slopes.open, slopes.total) : slopes.total }));
  }
  return parts.join(" · ");
}

// A resort's lifts and slopes in the list, each over a bar of how much of it is open (empty unless the resort is):
// two columns that line up from one resort to the next.
/** @param {IndexResort} r */
function memberStats(r) {
  const open = statusKey(r) === "open";
  const { lifts, slopes } = r;
  /** @param {string} text @param {number | null | undefined} part @param {number | null | undefined} whole */
  const stat = (text, part, whole) =>
    el("div", { class: "stat" }, el("span", { class: "n" }, text), meter(open ? part : 0, whole));
  const liftsText = lifts?.total ? t("{n} lifts", { n: open ? pair(lifts.open, lifts.total) : lifts.total }) : "–";
  const slopesText = slopes?.total_km
    ? open
      ? pair(slopes.open_km, slopes.total_km, " km")
      : t("{km} km of slopes", { km: slopes.total_km })
    : slopes?.total
      ? t("{n} slopes", { n: open ? pair(slopes.open, slopes.total) : slopes.total })
      : "–";
  return [
    stat(liftsText, lifts?.open, lifts?.total),
    slopes?.total_km
      ? stat(slopesText, slopes.open_km, slopes.total_km)
      : stat(slopesText, slopes?.open, slopes?.total),
  ];
}

// The resorts, the open ones first and the most open slopes first (as the resort page's group cards and the apps).
// A linked area first shows a bar of the whole area, a part for each resort as wide as its slopes, filled as far as
// they are open.
/** @param {Groups["groups"][string]} group @param {Map<string, IndexResort>} resorts */
function memberCard(group, resorts) {
  const ordered = orderedMembers(group.members, resorts);
  const main = mainCountry(group.members, ordered[0]?.split("/")[0] ?? "");
  const size = (/** @type {IndexResort} */ r) => r.slopes?.total_km ?? r.lifts?.total ?? 0;
  const known = ordered.map((key) => resorts.get(key)).filter((r) => r !== undefined);
  const bar =
    group.kind === "linked" && known.every((r) => size(r) > 0)
      ? el(
          "div",
          {
            class: "area-bar",
            role: "img",
            // What the bar shows, in words: each resort's line, as in the list under it.
            "aria-label": `${t("Open slopes by resort")}: ${known.map((r) => `${r.name}, ${memberLine(r)}`).join("; ")}`,
          },
          ...known.map((r) => {
            const open = statusKey(r) === "open" ? (r.slopes?.total_km ? r.slopes.open_km : r.lifts?.open) : 0;
            const part = el(
              "span",
              { style: `flex:${size(r)}`, title: `${r.name}: ${memberLine(r)}` },
              el("i", { style: `width:${Math.min(100, (100 * (open ?? 0)) / size(r))}%` }),
            );
            return part;
          }),
        )
      : "";
  const items = ordered.map((key) => {
    const [country, id] = key.split("/");
    const r = resorts.get(key);
    const status = r ? statusKey(r) : "no_report";
    const flag =
      country === main
        ? ""
        : el("span", { class: "flag", "data-country": country, title: countryName(country), role: "img" });
    if (flag) flag.setAttribute("aria-label", countryName(country));
    return el(
      "li",
      {},
      el("span", {
        class: "dot",
        style: `--c:${STATUS_COLORS[status]}`,
        title: STATUS_LABELS[status],
        role: "img",
        "aria-label": STATUS_LABELS[status],
      }),
      el(
        "div",
        { class: "who" },
        el("div", { class: "name" }, el("a", { href: resortPage({ country, id }) }, r?.name ?? id), flag),
        el("div", { class: "meta" }, capitalized(STATUS_LABELS[status])),
      ),
      ...(r ? memberStats(r) : []),
    );
  });
  return el(
    "section",
    { class: "card group-members" },
    el("h2", {}, group.kind === "linked" ? t("Resorts in the area") : t("Where to ski today")),
    bar,
    // A pass's resorts are a ranking, the most open first.
    el(group.kind === "region" ? "ol" : "ul", { class: "members" }, ...items),
  );
}

// Lifts by type and slopes by difficulty across the group, from the reports that give them.
/** @param {Map<string, Resort>} reports */
function breakdown(reports) {
  /**
   * @param {(r: Resort) => Record<string, { open?: number | null, total?: number | null }> | null | undefined} of
   * @returns {Map<string, { open: number, total: number }>}
   */
  const add = (of) => {
    const sums = new Map();
    for (const r of reports.values()) {
      const counts = of(r);
      if (!counts) continue;
      const open = statusKey(r) === "open";
      for (const [key, c] of Object.entries(counts)) {
        const s = sums.get(key) ?? { open: 0, total: 0 };
        s.open += open ? (c.open ?? 0) : 0;
        s.total += c.total ?? 0;
        sums.set(key, s);
      }
    }
    return sums;
  };
  const parts = [];
  const lifts = add((r) => r.lifts_by_type);
  if (lifts.size) {
    const rows = [...lifts]
      .sort((a, b) => b[1].total - a[1].total)
      .flatMap(([type, c]) => [
        el("span", {}, LIFT_TYPES[type] ?? label(type)),
        el("span", { class: "n" }, pair(c.open, c.total)),
        meter(c.open, c.total),
      ]);
    parts.push(el("div", {}, el("h2", {}, t("Lifts by type")), el("div", { class: "bars" }, ...rows)));
  }
  const slopes = add((r) => r.slopes_by_difficulty);
  if (slopes.size) {
    const order = Object.keys(DIFFICULTIES);
    const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length);
    const rows = [...slopes]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .flatMap(([difficulty, c]) => {
        const [name, colour] = DIFFICULTIES[difficulty] ?? [label(difficulty), "var(--muted)"];
        return [
          el("span", {}, el("span", { class: "diff", style: `--c:${colour}` }), name),
          el("span", { class: "n" }, pair(c.open, c.total)),
          meter(c.open, c.total),
        ];
      });
    parts.push(el("div", {}, el("h2", {}, t("Slopes by difficulty")), el("div", { class: "bars" }, ...rows)));
  }
  return parts.length ? el("section", { class: "card breakdown" }, ...parts) : null;
}

// The season so far: open lifts and km across the group, a point a day, from the members' history files. Each resort
// counts by its day's last run, or its last before that (a run missed); its open lifts and km only while open.
// The season starts on 1 September (glaciers open in the autumn), and ends with the day of the latest run.
/** @param {Groups["groups"][string]} group @param {HTMLElement} container @param {string} until the latest run */
async function seasonCharts(group, container, until) {
  const histories = (
    await Promise.all(
      group.members.map(async (key) => {
        const [country, id] = key.split("/");
        const response = await fetch(historyPath({ country, id }), { cache: "no-cache" });
        return response.ok ? /** @type {ResortHistory} */ (await response.json()).runs : null;
      }),
    )
  ).filter((runs) => runs !== null);
  const day = (/** @type {string | Date} */ time) =>
    new Date(time).toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
  const now = new Date(until);
  const start = new Date(Date.UTC(now.getUTCMonth() < 8 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(), 8, 1, 12));
  /** @type {string[]} */
  const days = [];
  for (let d = start; d <= now; d = new Date(d.getTime() + 864e5)) days.push(day(d));
  // Per resort, its values by day (the day's last run).
  const byDay = histories.map((runs) => {
    /** @type {Map<string, { lifts: number, km: number | null }>} */
    const values = new Map();
    runs.time.forEach((time, i) => {
      const open = runs.status[i] === "open";
      values.set(day(time), {
        lifts: open ? (runs.lifts_open[i] ?? 0) : 0,
        km: open ? (runs.slopes_open_km[i] ?? null) : 0,
      });
    });
    return values;
  });
  /** @type {{ t: Date, v: number | null }[]} */
  const lifts = [];
  /** @type {{ t: Date, v: number | null }[]} */
  const km = [];
  /** @type {({ lifts: number, km: number | null } | undefined)[]} */
  const last = byDay.map(() => undefined);
  for (const d of days) {
    for (const [i, values] of byDay.entries()) last[i] = values.get(d) ?? last[i];
    const known = last.filter((v) => v !== undefined);
    const time = new Date(`${d}T12:00:00Z`);
    lifts.push({ t: time, v: known.length ? known.reduce((n, v) => n + v.lifts, 0) : null });
    const kms = known.map((v) => v.km);
    km.push({ t: time, v: known.length && kms.every(present) ? kms.reduce((n, v) => n + (v ?? 0), 0) : null });
  }
  // From the first day any resort has a run.
  const first = lifts.findIndex((p) => present(p.v));
  if (first < 0) return container.replaceChildren(el("p", { class: "empty" }, t("Not enough runs yet.")));
  container.replaceChildren(
    chart(t("Open lifts"), "", "var(--open)", lifts.slice(first)),
    chart(t("Open slopes (km)"), "km", "var(--open)", km.slice(first)),
  );
}

// The group's resorts on the map: their areas' outlines and pistes, and a dot in each resort's colour, to its page.
/** @param {IndexResort[]} members @param {HTMLElement} container */
async function areaMap(members, container) {
  container.classList.add("loading");
  const loader = liftLoader();
  container.append(loader);
  const loading = loadSki();
  const view = loading.then((ski) => {
    const bounds = new maplibregl.LngLatBounds();
    for (const r of members) {
      const area = ski?.resorts.get(skiKey(r));
      if (area) bounds.extend(geometryBounds(area.geometry));
      else if (r.location) bounds.extend([r.location.lon, r.location.lat]);
    }
    return bounds.isEmpty()
      ? { center: [11.9, 47.25], zoom: 6 }
      : // Room on the right for the names, which start at the dots.
        { bounds, fitBoundsOptions: { padding: { top: 40, bottom: 40, left: 40, right: 170 }, maxZoom: 13 } };
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
  const areas = members.map((r) => ski?.resorts.get(skiKey(r))).filter((area) => area !== undefined);
  if (areas.length) {
    map.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: areas } });
    map.addLayer(
      {
        id: "areas",
        type: "line",
        source: "areas",
        paint: { "line-color": cssColor("--boundary"), "line-width": 2, "line-dasharray": [3, 2] },
      },
      firstLabel(map),
    );
  }
  const pistes = addPistes(map, ski, {
    // The group's resorts strong, their neighbours faded, as the resort page's map does with its resort.
    highlight: members.map(skiKey),
    names: new Map(members.map((r) => [skiKey(r), r.name])),
    // From the zoom the map opens at, down to 10: a large pass's whole map would be many tiles.
    minZoom: Math.max(10, Math.min(SKI_MIN_ZOOM, Math.floor(map.getZoom()))),
  });
  for (const r of members) {
    const point = skiPoint(r, ski);
    if (!point) continue;
    const status = statusKey(r);
    const marker = el(
      "a",
      {
        class: "area-marker",
        href: resortPage(r),
        title: `${r.name}: ${STATUS_LABELS[status]}`,
        style: `--c:${STATUS_COLORS[status]}`,
      },
      el("span", { class: "dot" }),
      el("span", { class: "name" }, r.name),
    );
    new maplibregl.Marker({ element: marker, anchor: "left", offset: [-7, 0] }).setLngLat(point).addTo(map);
    // MapLibre makes a marker a button named "Map marker": this one stays a link, named by its resort and status.
    marker.removeAttribute("role");
    marker.setAttribute("aria-label", `${r.name}: ${STATUS_LABELS[status]}`);
  }
  const drawn = pistes.then(() => !map.loaded() && new Promise((resolve) => map.once("idle", resolve)));
  await Promise.race([drawn, new Promise((resolve) => setTimeout(resolve, 4000))]);
  container.classList.remove("loading");
  loader.remove();
}

// The other groups that share resorts with this one: the pass a linked area is part of (Sella Ronda in Dolomiti
// Superski), or the linked areas inside a pass.
/** @param {string} id @param {Groups["groups"]} groups */
function relatedCard(id, groups) {
  const own = new Set(groups[id].members);
  const related = Object.entries(groups)
    .filter(([other]) => other !== id)
    .map(([other, g]) => ({ other, g, shared: g.members.filter((key) => own.has(key)).length }))
    .filter(({ shared }) => shared)
    .sort((a, b) => b.shared - a.shared);
  if (!related.length) return null;
  return el(
    "section",
    { class: "card group" },
    el("h2", {}, t("Related areas")),
    el(
      "ul",
      { class: "members" },
      ...related.map(({ other, g, shared }) =>
        el(
          "li",
          {},
          el(
            "div",
            {},
            el("div", { class: "name" }, el("a", { href: areaPage(other) }, g.name)),
            el(
              "div",
              { class: "meta numbers" },
              `${g.kind === "linked" ? t("Linked ski area") : t("Ski region")} · ${t("{n} of these resorts", { n: shared })}`,
            ),
          ),
        ),
      ),
    ),
  );
}

// The pages the resorts' reports were built from, as on the resort page: each page once.
/** @param {IndexResort[]} members in the order the list shows them */
function sourcesCard(members) {
  /** @type {[string, "conditions" | "resort_info"][]} */
  const kinds = [
    [t("Current conditions"), "conditions"],
    [t("Resort information"), "resort_info"],
  ];
  const parts = kinds.flatMap(([title, kind], i) => {
    /** @type {Map<string, SourceRef>} */
    const pages = new Map(members.flatMap((r) => sourceDetails(r)[kind].map((ref) => [ref.url, ref])));
    if (!pages.size) return [];
    return [
      el("div", i ? { class: "meta", style: "margin-top:12px" } : { class: "meta" }, title),
      el("ul", { class: "sources" }, ...[...pages.values()].map((ref) => sourceItem(ref))),
    ];
  });
  return parts.length ? el("section", { class: "card data" }, el("h2", {}, t("Sources")), ...parts) : null;
}

async function show() {
  const id = requested();
  if (!id) return fail(t("No ski area given."));
  page.replaceChildren(liftLoader());
  const [groups, index] = await Promise.all([loadGroups(), loadIndex()]);
  const group = groups[id];
  if (!group) return fail(t("There's no such ski area."));
  document.title = `${group.name} – LiftRadar`;
  setAreaAddress(id);
  /** @type {Map<string, IndexResort>} */
  const resorts = new Map(
    index.resorts.filter((r) => group.members.includes(resortKey(r))).map((r) => [resortKey(r), r]),
  );
  const members = [...resorts.values()];
  // The members' own reports: their lifts by type and slopes by difficulty. A missing one is left out.
  /** @type {Map<string, Resort>} */
  const reports = new Map(
    (
      await Promise.all(
        members.map(async (r) => {
          const response = await fetch(resortPath(r), { cache: "no-cache" });
          return response.ok ? /** @type {[string, Resort]} */ ([resortKey(r), await response.json()]) : null;
        }),
      )
    ).filter((entry) => entry !== null),
  );

  const mapBox = el("div", { id: "map", role: "region", "aria-label": t("Map of {name}", { name: group.name }) });
  const chartsBox = el("div", { class: "charts" }, liftLoader({ small: true }));
  page.replaceChildren(
    header(group, members, index),
    el(
      "div",
      { class: "layout" },
      el(
        "div",
        { class: "stack" },
        tiles(group, members),
        memberCard(group, resorts),
        ...[breakdown(reports)].filter((card) => card !== null),
        el("section", { class: "card" }, el("h2", {}, t("This season")), chartsBox),
      ),
      el(
        "aside",
        { class: "side" },
        el(
          "div",
          { class: "map-box" },
          mapBox,
          el("a", { class: "map-link", href: "map.html" }, t("Map of all resorts →")),
        ),
        ...[relatedCard(id, groups)].filter((card) => card !== null),
        ...(group.website
          ? [
              el(
                "section",
                { class: "card" },
                el("h2", {}, t("Official website")),
                el("a", { class: "external", href: group.website, rel: "noopener" }, group.website),
              ),
            ]
          : []),
        ...[sourcesCard(orderedMembers(group.members, resorts).flatMap((key) => resorts.get(key) ?? []))].filter(
          (card) => card !== null,
        ),
      ),
    ),
  );
  areaMap(members, mapBox).catch(() => {
    mapBox.classList.remove("loading");
    mapBox.replaceChildren(el("p", { class: "empty" }, t("The map could not load.")));
  });
  seasonCharts(group, chartsBox, index.generated_at).catch((error) =>
    chartsBox.replaceChildren(el("p", { class: "empty" }, t("No history ({message}).", error))),
  );
}

show().catch((error) => fail(t("Could not load the ski area ({message}).", error)));
