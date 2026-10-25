// index.html: one row per resort from json/index.json, with a name search,
// country and region filters, and sortable columns. Rows start sorted by name.

const tbody = document.querySelector("tbody");
const search = document.getElementById("search");
const countrySelect = document.getElementById("country");
const regionSelect = document.getElementById("region");
const count = document.getElementById("count");
let rows = [];
const values = new Map();
let key = "name", ascending = true;

function sortValues(r) {
  const lifts = r.lifts || {}, slopes = r.slopes || {}, snow = r.snow;
  return {
    name: fold(r.name),
    // Sorts by country, then region; also what the filters compare.
    region: fold(`${countryName(r.country)} ${r.region ?? ""}`),
    country: r.country,
    regionName: r.region ?? null,
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
  const cell = el("td", {}, r.name);
  if (STATUS_LABELS[r.status] && r.status !== "open") cell.append(el("div", { class: "muted" }, STATUS_LABELS[r.status]));
  if (r.errors.length) cell.append(el("div", { class: "err" }, r.errors.join("; ")));
  return cell;
}

function slopesCell(slopes) {
  const cell = el("td", { class: "num" }, pair(slopes?.open, slopes?.total));
  if (slopes && (slopes.open_km !== null || slopes.total_km !== null)) {
    cell.append(el("div", { class: "muted" }, pair(slopes.open_km, slopes.total_km, " km")));
  }
  return cell;
}

function avalancheCell(bulletin) {
  if (!bulletin || bulletin.danger_level === null) return el("td", { class: "num" }, "–");
  return el("td", { class: "num" }, String(bulletin.danger_level),
    el("div", { class: "muted" }, bulletin.danger.replace("_", " ")));
}

function row(r) {
  const path = resortPath(r);
  // Short link text: full file paths (up to ~60 chars) would push the column out of view.
  const link = el("a", { href: path, title: path }, "JSON");
  return el("tr", {},
    nameCell(r),
    el("td", {}, r.region ?? "–", el("div", { class: "muted" }, countryName(r.country))),
    el("td", { class: "num" }, dash(r.snow.mountain_cm, " cm")),
    el("td", { class: "num" }, dash(r.snow.valley_cm, " cm")),
    el("td", { class: "num" }, dash(r.snow.fresh_cm, " cm")),
    el("td", { class: "num" }, pair(r.lifts?.open, r.lifts?.total)),
    slopesCell(r.slopes),
    avalancheCell(r.avalanche),
    el("td", { class: "num" }, link),
  );
}

function filter() {
  const query = fold(search.value.trim());
  const country = countrySelect.value, region = regionSelect.value;
  let shown = 0;
  for (const tr of rows) {
    const v = values.get(tr);
    tr.hidden = !v.name.includes(query) || (country && v.country !== country) || (region && v.regionName !== region);
    if (!tr.hidden) shown++;
  }
  const filtered = query || country || region;
  count.textContent = filtered ? `${shown} of ${rows.length} resorts` : `${rows.length} resorts`;
}

function option(value, label) {
  return el("option", { value }, label);
}

// The region list only offers regions of the chosen country (all of them when none is).
function fillRegions(resorts) {
  const country = countrySelect.value;
  const chosen = regionSelect.value;
  const names = [...new Set(resorts.filter((r) => r.region && (!country || r.country === country)).map((r) => r.region))]
    .sort((a, b) => a.localeCompare(b));
  regionSelect.replaceChildren(option("", "All regions"), ...names.map((name) => option(name, name)));
  regionSelect.value = names.includes(chosen) ? chosen : "";
}

function fillFilters(resorts) {
  const countries = [...new Set(resorts.map((r) => r.country))].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  countrySelect.append(...countries.map((code) => option(code, countryName(code))));
  fillRegions(resorts);
  countrySelect.addEventListener("change", () => {
    fillRegions(resorts);
    filter();
  });
  regionSelect.addEventListener("change", filter);
}

function sort() {
  const byName = (a, b) => values.get(a).name.localeCompare(values.get(b).name);
  rows.sort((a, b) => {
    const x = values.get(a)[key], y = values.get(b)[key];
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

loadIndex()
  .then((index) => {
    document.getElementById("updated").textContent = updatedText(index);
    fillFilters(index.resorts);
    rows = index.resorts.map((r) => {
      const tr = row(r);
      values.set(tr, sortValues(r));
      return tr;
    });
    sort();
    filter();
  })
  .catch((error) => {
    document.getElementById("updated").textContent = `Could not load the data (${error.message})`;
  });
