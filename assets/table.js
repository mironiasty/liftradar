// index.html: one row per resort from json/index.json, with a name search and
// sortable columns. Rows start sorted by name.

const tbody = document.querySelector("tbody");
const search = document.getElementById("search");
const count = document.getElementById("count");
let rows = [];
const values = new Map();
let key = "name", ascending = true;

function sortValues(r) {
  const lifts = r.lifts || {}, slopes = r.slopes || {}, snow = r.snow;
  return {
    name: fold(r.name),
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
  let shown = 0;
  for (const tr of rows) {
    tr.hidden = !values.get(tr).name.includes(query);
    if (!tr.hidden) shown++;
  }
  count.textContent = query ? `${shown} of ${rows.length} resorts` : `${rows.length} resorts`;
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
    // Same column flips the order; a new one starts A-Z for names, highest first for numbers.
    ascending = button.dataset.key === key ? !ascending : button.dataset.key === "name";
    key = button.dataset.key;
    sort();
  });
}
search.addEventListener("input", filter);

loadIndex()
  .then((index) => {
    document.getElementById("updated").textContent = updatedText(index);
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
