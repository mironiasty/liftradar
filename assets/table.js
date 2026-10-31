// index.html: one row per resort from json/index.json, with a name search,
// country, region and status filters, and sortable columns. Rows start sorted by name.

const tbody = document.querySelector("tbody");
const search = document.getElementById("search");
const searchClear = document.getElementById("search-clear");
const countryGroup = document.getElementById("country");
const regionSelect = document.getElementById("region");
const statusGroup = document.getElementById("status");
const count = document.getElementById("count");
const empty = document.getElementById("empty");
let rows = [];
const values = new Map();
let key = "name",
  ascending = true;
let country = "";
// Statuses chosen with the chips; none chosen shows every resort.
const shownStatuses = new Set();
// Each status chip's count element, by status.
const statusCounts = new Map();
// The filters and order are kept in the address (?q=&country=&region=&status=open,closed&sort=-lifts_open),
// so going back to the list keeps them; resort.js's "All resorts" link reuses the last one (LIST_KEY).
const saved = new URLSearchParams(location.search);

// Same colours as the map.
const STATUS = {
  open: { label: capitalized(STATUS_LABELS.open), color: "var(--open)" },
  closed: { label: capitalized(STATUS_LABELS.closed), color: "var(--closed)" },
  no_report: { label: capitalized(STATUS_LABELS.no_report), color: "var(--none)" },
};
const statusOf = statusKey;

function sortValues(r) {
  const lifts = r.lifts || {},
    slopes = r.slopes || {},
    snow = r.snow;
  return {
    name: fold(r.name),
    // Sorts by country, then region; also what the filters compare.
    region: fold(`${countryName(r.country)} ${r.region ?? ""}`),
    country: r.country,
    regionName: r.region ?? null,
    status: statusOf(r),
    mountain: snow.mountain_cm,
    valley: snow.valley_cm,
    fresh: snow.fresh_cm,
    lifts_open: lifts.open ?? null,
    lifts_total: lifts.total ?? null,
    slopes_open: slopes.open ?? null,
    slopes_total: slopes.total ?? null,
    km_open: slopes.open_km ?? null,
    km_total: slopes.total_km ?? null,
    avalanche: r.avalanche?.danger_level ?? null,
  };
}

function nameCell(r) {
  const status = statusOf(r);
  const { label, color } = STATUS[status];
  // The phone layout shows the status as a pill after the name instead of the dot and the line below.
  const text = el(
    "div",
    {},
    el("a", { class: "name", href: resortPage(r) }, r.name),
    " ",
    el("span", { class: "status-pill", style: `--c:${color}` }, label),
  );
  if (status !== "open") text.append(el("div", { class: "sub-line status-line" }, label));
  return el(
    "td",
    {},
    el("div", { class: "resort" }, el("span", { class: "dot", style: `--c:${color}`, title: label }), text),
  );
}

// "open/total" with a bar for the open share, for open resorts: elsewhere open
// counts are 0 or not reported.
function meter(open, total, active) {
  const cell = el("div", {}, pair(open, total));
  if (active && open !== null && open !== undefined && total) {
    const bar = el("span", { style: `width:${Math.min(100, (100 * open) / total)}%` });
    cell.append(
      el("div", { class: "meter", title: t("{share}% open", { share: Math.round((100 * open) / total) }) }, bar),
    );
  }
  return cell;
}

function slopesCell(slopes, active) {
  const km = pair(slopes?.open_km, slopes?.total_km, " km");
  const counts = pair(slopes?.open, slopes?.total);
  const cell = value(t("Slopes"), counts === "–" ? km : counts, meter(slopes?.open, slopes?.total, active));
  if (km !== "–") cell.append(el("div", { class: "sub-line" }, km));
  return cell;
}

function avalancheCell(bulletin) {
  if (!bulletin || bulletin.danger_level === null)
    return el("td", { class: "c-value nil", "data-label": t("Avalanche danger") }, "–");
  return el(
    "td",
    { class: "c-value", "data-label": t("Avalanche danger") },
    el(
      "span",
      { class: "danger" },
      el("span", { class: `badge lvl${bulletin.danger_level}` }, String(bulletin.danger_level)),
      el("span", { class: "danger-text" }, dangerName(bulletin.danger)),
    ),
  );
}

// A number cell; labelled for the phone layout, which also leaves out empty ones ("–").
function value(label, text, content = text) {
  return el("td", { class: `num c-value${text === "–" ? " nil" : ""}`, "data-label": label }, content);
}

function row(r) {
  const { mountain_cm: mountain, valley_cm: valley, fresh_cm: fresh } = r.snow;
  const active = statusOf(r) === "open";
  const tr = el(
    "tr",
    { class: active ? "" : "inactive" },
    nameCell(r),
    el("td", { class: "c-region" }, r.region ?? "–", el("div", { class: "sub-line" }, countryName(r.country))),
    value(t("Mountain"), dash(mountain, " cm"), el("span", { class: mountain ? "big" : "" }, dash(mountain, " cm"))),
    value(t("Valley"), dash(valley, " cm")),
    value(t("Fresh"), dash(fresh, " cm"), fresh ? el("span", { class: "fresh" }, `+${fresh} cm`) : dash(fresh, " cm")),
    value(t("Lifts"), pair(r.lifts?.open, r.lifts?.total), meter(r.lifts?.open, r.lifts?.total, active)),
    slopesCell(r.slopes, active),
    avalancheCell(r.avalanche),
  );
  // The whole row opens the resort's page; the name is the link for keyboards and new tabs.
  tr.addEventListener("click", (event) => {
    if (!event.target.closest("a") && !getSelection().toString()) location.href = resortPage(r);
  });
  return tr;
}

function filter() {
  const query = fold(search.value.trim());
  const region = regionSelect.value;
  let shown = 0;
  // A chip counts the resorts the other filters leave, whichever statuses are chosen.
  const totals = {};
  for (const tr of rows) {
    const v = values.get(tr);
    const matches =
      v.name.includes(query) && (!country || v.country === country) && (!region || v.regionName === region);
    if (matches) totals[v.status] = (totals[v.status] ?? 0) + 1;
    tr.hidden = !matches || (shownStatuses.size > 0 && !shownStatuses.has(v.status));
    if (!tr.hidden) shown++;
  }
  for (const [status, node] of statusCounts) node.textContent = String(totals[status] ?? 0);
  searchClear.hidden = !search.value;
  const filtered = query || country || region || shownStatuses.size;
  const n = rows.length;
  count.textContent = filtered ? t("{shown} of {n} resorts", { shown, n }) : t("{n} resorts", { n });
  empty.hidden = shown > 0;
  saveState();
}

function saveState() {
  const params = new URLSearchParams();
  if (search.value.trim()) params.set("q", search.value.trim());
  if (country) params.set("country", country);
  if (regionSelect.value) params.set("region", regionSelect.value);
  if (shownStatuses.size) params.set("status", [...shownStatuses].join(","));
  if (key !== "name" || !ascending) params.set("sort", (ascending ? "" : "-") + key);
  const query = params.toString() ? `?${params}` : "";
  history.replaceState(null, "", location.pathname + query + location.hash);
  try {
    sessionStorage.setItem(LIST_KEY, query);
  } catch {}
}

function option(value, label) {
  return el("option", { value }, label);
}

function button(className, text, onClick) {
  const node = el("button", { type: "button", class: className }, text);
  node.addEventListener("click", onClick);
  return node;
}

// The region list only offers regions of the chosen country, and is hidden until one is chosen.
function fillRegions(resorts, chosen = regionSelect.value) {
  const names = [...new Set(resorts.filter((r) => r.region && r.country === country).map((r) => r.region))].sort(
    (a, b) => a.localeCompare(b),
  );
  regionSelect.replaceChildren(option("", t("All regions")), ...names.map((name) => option(name, name)));
  regionSelect.value = names.includes(chosen) ? chosen : "";
  regionSelect.hidden = !country;
}

function fillFilters(resorts) {
  const countries = [...new Set(resorts.map((r) => r.country))].sort((a, b) =>
    countryName(a).localeCompare(countryName(b), LANG),
  );
  const choices = [["", t("All")], ...countries.map((code) => [code, countryName(code)])];
  const countryButtons = choices.map(([code, label]) => button("", label, () => chooseCountry(code)));
  countryGroup.append(...countryButtons);
  const chooseCountry = (code, region) => {
    country = code;
    choices.forEach(([c], i) => {
      countryButtons[i].setAttribute("aria-pressed", c === country);
    });
    fillRegions(resorts, region);
    filter();
  };
  const savedStatuses = (saved.get("status") ?? "").split(",");
  regionSelect.addEventListener("change", filter);

  for (const [status, { label, color }] of Object.entries(STATUS)) {
    if (!resorts.some((r) => statusOf(r) === status)) continue;
    const chip = button("chip", "", () => {
      shownStatuses.has(status) ? shownStatuses.delete(status) : shownStatuses.add(status);
      chip.setAttribute("aria-pressed", shownStatuses.has(status));
      filter();
    });
    if (savedStatuses.includes(status)) shownStatuses.add(status);
    chip.setAttribute("aria-pressed", shownStatuses.has(status));
    const total = el("span", { class: "count" });
    statusCounts.set(status, total);
    chip.append(el("span", { class: "dot", style: `--c:${color}` }), label, total);
    statusGroup.append(chip);
  }

  document.getElementById("reset").addEventListener("click", () => {
    search.value = "";
    regionSelect.value = "";
    shownStatuses.clear();
    for (const chip of statusGroup.children) chip.setAttribute("aria-pressed", false);
    chooseCountry("");
  });
  search.value = saved.get("q") ?? "";
  chooseCountry(countries.includes(saved.get("country")) ? saved.get("country") : "", saved.get("region") ?? "");
}

// The phone layout has no column headers: a select offers the useful orders.
const SORTS = [
  ["name", true, t("Name A–Z")],
  ["lifts_open", false, t("Most open lifts")],
  ["slopes_open", false, t("Most open slopes")],
  ["km_open", false, t("Most open km")],
  ["mountain", false, t("Most snow")],
  ["fresh", false, t("Most fresh snow")],
  ["km_total", false, t("Biggest areas")],
  ["avalanche", false, t("Highest avalanche danger")],
];
const sortSelect = document.getElementById("sort");
sortSelect.append(...SORTS.map(([, , label], i) => option(String(i), label)));
sortSelect.addEventListener("change", () => {
  [key, ascending] = SORTS[sortSelect.value];
  sort();
});

function sort() {
  const byName = (a, b) => values.get(a).name.localeCompare(values.get(b).name);
  rows.sort((a, b) => {
    const x = values.get(a)[key],
      y = values.get(b)[key];
    if (x === y) return byName(a, b);
    if (x === null) return 1; // missing values last, whichever the direction
    if (y === null) return -1;
    const order = typeof x === "string" ? x.localeCompare(y) : x - y;
    return ascending ? order : -order;
  });
  tbody.append(...rows);
  for (const button of document.querySelectorAll("th button")) {
    button.classList.toggle("sorted", button.dataset.key === key);
    button.classList.toggle("asc", button.dataset.key === key && ascending);
  }
  const chosen = SORTS.findIndex(([k, asc]) => k === key && asc === ascending);
  if (chosen >= 0) sortSelect.value = String(chosen);
  saveState();
}

for (const button of document.querySelectorAll("th button")) {
  button.addEventListener("click", () => {
    // Same column flips the order; a new one starts A-Z for text, highest first for numbers.
    ascending = button.dataset.key === key ? !ascending : ["name", "region"].includes(button.dataset.key);
    key = button.dataset.key;
    sort();
  });
}
search.addEventListener("input", filter);
searchClear.addEventListener("click", () => {
  search.value = "";
  filter();
  search.focus();
});

// The small map in the header: country borders from assets/mini-map.svg (see scripts/mini_map.py) and every
// resort as a dot in its status colour; the tile links to map.html.
async function miniMap(resorts) {
  const response = await fetch("/assets/mini-map.svg");
  if (!response.ok) return;
  const box = document.getElementById("mini-map");
  box.innerHTML = await response.text();
  const svg = box.querySelector("svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  const { west, north, k, scale } = Object.fromEntries(
    Object.entries(svg.dataset).map(([key, value]) => [key, Number(value)]),
  );
  const countries = new Set(resorts.map((r) => r.country));
  for (const path of svg.querySelectorAll("path"))
    path.classList.toggle("covered", countries.has(path.dataset.country));
  // Open resorts last, so they are drawn on top.
  const order = { open: 2, closed: 1 };
  const located = resorts.filter((r) => r.location).sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0));
  for (const r of located) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", ((r.location.lon - west) * k * scale).toFixed(1));
    dot.setAttribute("cy", ((north - r.location.lat) * scale).toFixed(1));
    dot.setAttribute("r", "7");
    dot.style.fill = STATUS_COLORS[statusKey(r)];
    svg.append(dot);
  }
}

loadIndex()
  .then((index) => {
    document.getElementById("updated").textContent = updatedText(index);
    rows = index.resorts.map((r) => {
      const tr = row(r);
      values.set(tr, sortValues(r));
      return tr;
    });
    const savedSort = saved.get("sort") ?? "";
    if (rows.length && savedSort.replace(/^-/, "") in values.get(rows[0])) {
      key = savedSort.replace(/^-/, "");
      ascending = !savedSort.startsWith("-");
    }
    fillFilters(index.resorts);
    sort();
    filter();
    miniMap(index.resorts).catch(() => {});
  })
  .catch((error) => {
    document.getElementById("updated").textContent = t("Could not load the data ({message})", error);
  });
