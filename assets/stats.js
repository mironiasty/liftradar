// stats.html (prototype): totals per day for the country and region the filters choose, from
// json/stats.json (daily totals per region, published by liftradar-fetcher), and the latest open
// lifts per resort from json/index.json.
//
// A day is each resort's last run of that day. Lifts, slopes and km count open resorts only,
// as the table's meters do; a few closed resorts still report an old lift count.

const METRICS = [
  { key: "open", title: "Open resorts" },
  { key: "lifts", title: "Open lifts" },
  { key: "slopes", title: "Open slopes" },
  { key: "km", title: "Open slopes", unit: " km" },
  { key: "tracked", title: "Resorts tracked" },
];
const STATS_URL = "json/stats.json";
const TOP_BARS = 8;

const countryGroup = document.getElementById("country");
const regionSelect = document.getElementById("region");
const charts = document.getElementById("charts");
const count = document.getElementById("count");
const barsCard = el("section", { class: "card" });
const tableBody = document.querySelector("#daily tbody");

const saved = new URLSearchParams(location.search);
let resorts = [];
let stats;
let country = "";
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const shortDay = (day) => new Date(`${day}T12:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const svgEl = (tag, attributes = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};

async function loadStats() {
  const response = await fetch(STATS_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${STATS_URL}: HTTP ${response.status}`);
  return response.json();
}

// The days any resort in the chosen country and region was tracked, with their totals.
function totals(region) {
  const rows = stats.regions.filter((r) => (!country || r.country === country) && (!region || r.region === region));
  const sum = (key, i) => rows.reduce((total, row) => total + row[key][i], 0);
  return stats.days.map((day, i) => ({
    day,
    tracked: sum("tracked", i),
    open: sum("open", i),
    lifts: sum("lifts_open", i),
    slopes: sum("slopes_open", i),
    km: sum("slopes_open_km", i),
  })).filter((d) => d.tracked);
}

// A round axis top and step, about three gridlines; counts never step below 1.
function axis(max) {
  const rough = Math.max(max, 1) / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].find((m) => m * power >= rough) * power);
  return { step, top: Math.ceil(Math.max(max, 1) / step) * step };
}

function lineChart(host, days, metric) {
  const width = host.clientWidth, height = 150;
  const margin = { top: 8, right: 10, bottom: 22, left: 36 };
  const plotWidth = width - margin.left - margin.right, plotHeight = height - margin.top - margin.bottom;
  const values = days.map((d) => d[metric.key]);
  const { step, top } = axis(Math.max(...values));
  const x = (i) => margin.left + (days.length > 1 ? (i * plotWidth) / (days.length - 1) : plotWidth / 2);
  const y = (v) => margin.top + plotHeight - (v / top) * plotHeight;

  const svg = svgEl("svg", { width, height, role: "img", tabindex: 0,
    "aria-label": `${metric.title}${metric.unit ?? ""} per day, ${shortDay(days[0].day)} to ${shortDay(days.at(-1).day)}, latest ${number.format(values.at(-1))}` });
  for (let v = 0; v <= top; v += step) {
    svg.append(svgEl("line", { class: "grid", x1: margin.left, x2: width - margin.right, y1: y(v), y2: y(v) }));
    const label = svgEl("text", { class: "tick", x: margin.left - 6, y: y(v) + 4, "text-anchor": "end" });
    label.textContent = number.format(v);
    svg.append(label);
  }
  // Every nth day, counted back from the latest so that one always has its date.
  const every = Math.ceil(days.length / Math.max(1, Math.floor(plotWidth / 52)));
  days.forEach((d, i) => {
    if ((days.length - 1 - i) % every) return;
    const label = svgEl("text", { class: "tick", x: x(i), y: height - 6, "text-anchor": i === days.length - 1 && days.length > 1 ? "end" : "middle" });
    label.textContent = shortDay(d.day);
    svg.append(label);
  });
  if (days.length > 1) {
    const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    svg.append(svgEl("path", { class: "wash", d: `${line}L${x(days.length - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z` }));
    svg.append(svgEl("path", { class: "line", d: line }));
  }
  const hair = svgEl("line", { class: "hair", y1: margin.top, y2: margin.top + plotHeight, visibility: "hidden" });
  const dot = svgEl("circle", { class: "end", r: 4, cx: x(days.length - 1), cy: y(values.at(-1)) });
  svg.append(hair, dot);

  const tip = el("div", { class: "tip", hidden: "" });
  host.replaceChildren(svg, tip);
  let shownAt = days.length - 1;
  const show = (i) => {
    shownAt = i;
    hair.setAttribute("x1", x(i));
    hair.setAttribute("x2", x(i));
    hair.setAttribute("visibility", "visible");
    dot.setAttribute("cx", x(i));
    dot.setAttribute("cy", y(values[i]));
    const lines = [el("b", {}, `${number.format(values[i])}${metric.unit ?? ""}`), el("span", {}, shortDay(days[i].day))];
    if (metric.key !== "tracked") lines.push(el("span", {}, `${days[i].tracked} resorts tracked`));
    tip.replaceChildren(...lines);
    tip.hidden = false;
    // Beside the crosshair, on whichever side has room.
    const left = x(i) + 10 + tip.offsetWidth > width ? x(i) - 10 - tip.offsetWidth : x(i) + 10;
    tip.style.left = `${Math.max(0, left)}px`;
  };
  const hide = () => {
    tip.hidden = true;
    hair.setAttribute("visibility", "hidden");
    dot.setAttribute("cx", x(days.length - 1));
    dot.setAttribute("cy", y(values.at(-1)));
  };
  svg.addEventListener("pointermove", (event) => {
    const position = event.clientX - svg.getBoundingClientRect().left;
    const nearest = days.length > 1 ? Math.round(((position - margin.left) / plotWidth) * (days.length - 1)) : 0;
    show(Math.min(days.length - 1, Math.max(0, nearest)));
  });
  svg.addEventListener("pointerleave", hide);
  svg.addEventListener("focus", () => show(shownAt));
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", (event) => {
    const change = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!change) return;
    event.preventDefault();
    show(Math.min(days.length - 1, Math.max(0, shownAt + change)));
  });
}

function card(days, metric) {
  const latest = days.at(-1), previous = days.at(-2);
  const change = previous ? latest[metric.key] - previous[metric.key] : null;
  const delta = change === null ? "" : `${change > 0 ? "+" : change < 0 ? "−" : "±"}${number.format(Math.abs(change))} since ${shortDay(previous.day)}`;
  const plot = el("div", { class: "plot" });
  const node = el("section", { class: "card" },
    el("h2", {}, `${metric.title}${metric.unit ? " (km)" : ""}`),
    el("p", { class: "figure" }, number.format(latest[metric.key]), el("small", {}, delta)),
    plot);
  return { node, draw: () => lineChart(plot, days, metric) };
}

// Open lifts now, largest first: per country, per region inside a country, per resort inside a region.
function bars(scope, latestDay, region) {
  const [noun, group] = region ? ["resort", (r) => r.name]
    : country ? ["region", (r) => r.region ?? "No region"] : ["country", (r) => countryName(r.country)];
  const sums = new Map();
  for (const r of scope) {
    if (r.status === "open") sums.set(group(r), (sums.get(group(r)) ?? 0) + (r.lifts?.open ?? 0));
  }
  const ranked = [...sums].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = ranked.slice(0, TOP_BARS);
  if (ranked.length > TOP_BARS) shown.push([`${ranked.length - TOP_BARS} more`, ranked.slice(TOP_BARS).reduce((sum, [, n]) => sum + n, 0)]);
  const top = Math.max(1, ...shown.map(([, n]) => n));
  const rows = shown.map(([name, n]) => el("div", { class: "bar-row" },
    el("span", { class: "bar-name", title: name }, name),
    el("span", { class: "bar-track" }, el("span", { class: "bar", style: `width:${(100 * n) / top}%` })),
    el("span", { class: "bar-value" }, String(n))));
  barsCard.replaceChildren(el("h2", {}, `Open lifts by ${noun}, ${shortDay(latestDay)}`),
    ...(rows.length ? rows : [el("p", { class: "muted" }, "Nothing is open here.")]));
}

function table(days) {
  tableBody.replaceChildren(...[...days].reverse().map((d) => el("tr", {},
    el("th", { scope: "row" }, shortDay(d.day)),
    ...["tracked", "open", "lifts", "slopes", "km"].map((key) => el("td", {}, number.format(d[key]))))));
}

function render() {
  const region = regionSelect.value;
  const scope = resorts.filter((r) => (!country || r.country === country) && (!region || r.region === region));
  const days = totals(region);
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (region) params.set("region", region);
  history.replaceState(null, "", location.pathname + (params.size ? `?${params}` : ""));
  count.textContent = `${scope.length} resorts`;
  if (!days.length) {
    charts.replaceChildren();
    tableBody.replaceChildren();
    return;
  }
  bars(scope, days.at(-1).day, region);
  table(days);
  // Drawn once every card is in place: a chart's width depends on how many share the row.
  const cards = METRICS.map((metric) => card(days, metric));
  charts.replaceChildren(...cards.map(({ node }) => node), barsCard);
  for (const { draw } of cards) draw();
}

function fillRegions(chosen = "") {
  const names = [...new Set(resorts.filter((r) => r.region && r.country === country).map((r) => r.region))]
    .sort((a, b) => a.localeCompare(b));
  regionSelect.replaceChildren(el("option", { value: "" }, "All regions"), ...names.map((name) => el("option", { value: name }, name)));
  regionSelect.value = names.includes(chosen) ? chosen : "";
  regionSelect.hidden = !country;
}

function fillFilters() {
  const countries = [...new Set(resorts.map((r) => r.country))].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const choices = [["", "All"], ...countries.map((code) => [code, countryName(code)])];
  const choose = (code, region) => {
    country = code;
    choices.forEach(([c], i) => countryGroup.children[i].setAttribute("aria-pressed", c === country));
    fillRegions(region);
    render();
  };
  for (const [code, label] of choices) {
    const node = el("button", { type: "button" }, label);
    node.addEventListener("click", () => choose(code));
    countryGroup.append(node);
  }
  regionSelect.addEventListener("change", render);
  choose(countries.includes(saved.get("country")) ? saved.get("country") : "", saved.get("region") ?? "");
}

loadIndex()
  .then(async (index) => {
    document.getElementById("updated").textContent = updatedText(index);
    resorts = index.resorts;
    stats = await loadStats();
    fillFilters();
    // Redraws when the page's width changes, not when redrawing changes its height.
    let width = charts.clientWidth;
    new ResizeObserver(() => {
      if (charts.clientWidth === width) return;
      width = charts.clientWidth;
      render();
    }).observe(charts);
  })
  .catch((error) => {
    document.getElementById("updated").textContent = `Could not load the data (${error.message})`;
  });
