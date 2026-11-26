// The resort page's weather card (resort.html, with resort.js): Open-Meteo's forecast.

// Weather: Open-Meteo's forecast (json/<country>/<id>.weather.json, experimental), at the resort's top or bottom.
// WMO weather codes, as Open-Meteo gives them, grouped into what an icon can tell apart.
const WEATHER_KINDS = [
  [[0], "clear", t("Clear|weather")],
  [[1, 2], "partly", t("Partly cloudy")],
  [[3], "cloudy", t("Overcast")],
  [[45, 48], "fog", t("Fog")],
  [[51, 53, 55, 56, 57], "drizzle", t("Drizzle")],
  [[61, 63, 65, 66, 67, 80, 81, 82], "rain", t("Rain")],
  [[71, 73, 75, 77, 85, 86], "snow", t("Snow")],
  [[95, 96, 99], "storm", t("Thunderstorm")],
];
const WEATHER_ICONS = {
  clear:
    '<circle cx="12" cy="12" r="4.2" class="sun"/><path class="sun" d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  partly:
    '<circle cx="9" cy="8.5" r="3.4" class="sun"/><path class="sun" d="M9 2v1.6M2.5 8.5h1.6M4.4 3.9l1.1 1.1M13.6 3.9l-1.1 1.1"/>' +
    '<path d="M8 20.5h9.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8 20.5z" class="cloud"/>',
  cloudy: '<path d="M7 19h10.5a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.7 1.4A3.3 3.3 0 0 0 7 19z" class="cloud"/>',
  fog: '<path d="M7 13.5h10.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7 13.5z" class="cloud"/><path d="M4 17h16M6 20.5h12"/>',
  drizzle:
    '<path d="M7 14h10.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7 14z" class="cloud"/><path class="drop" d="M9 17.5v1M13 17.5v1M17 17.5v1"/>',
  rain: '<path d="M7 13h10.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7 13z" class="cloud"/><path class="drop" d="M8.5 16l-1 3.5M12.5 16l-1 3.5M16.5 16l-1 3.5"/>',
  snow:
    '<path d="M7 13h10.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7 13z" class="cloud"/>' +
    '<g class="flake"><path d="M8.5 15.5v5M6.3 16.7l4.4 2.6M6.3 19.3l4.4-2.6"/><path d="M15.5 15.5v5M13.3 16.7l4.4 2.6M13.3 19.3l4.4-2.6"/></g>',
  storm:
    '<path d="M7 13h10.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.2A3 3 0 0 0 7 13z" class="cloud"/><path class="bolt" d="M12.5 13.5 10 17.5h3l-2 4"/>',
};
/** @param {number | null} code */
function weatherKind(code) {
  const found = WEATHER_KINDS.find(([codes]) => /** @type {number[]} */ (codes).includes(code ?? -1));
  return found ? { key: /** @type {string} */ (found[1]), name: /** @type {string} */ (found[2]) } : null;
}
/** @param {number | null} code @param {number} [size] */
function weatherIcon(code, size = 32) {
  const kind = weatherKind(code);
  const icon = el("span", { class: "weather-icon", role: "img", "aria-label": kind?.name ?? "–" });
  if (kind) icon.title = kind.name;
  icon.innerHTML =
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"` +
    ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind ? WEATHER_ICONS[kind.key] : ""}</svg>`;
  return icon;
}
const degrees = (v) => (present(v) ? `${Math.round(v)}°` : "–");
// A day of the forecast by its own date: noon UTC, so no time zone moves it to the day before.
/** @param {string} date @param {Intl.DateTimeFormatOptions} options */
const forecastDate = (date, options) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(LANG === "en" ? "en-GB" : DATE_LOCALE, {
    timeZone: "UTC",
    ...options,
  });
const POINT_NAMES = { top: () => t("Top"), bottom: () => t("Bottom"), resort: () => t("Resort") };

/** @param {WeatherPoint} point */
function forecastDays(point) {
  const today = point.now?.time.slice(0, 10);
  // The days' snowfall on one scale, so a bar shows how much more one day brings than another.
  const most = Math.max(1, ...point.days.map((d) => d.snowfall_cm ?? 0));
  return el(
    "div",
    { class: "days" },
    ...point.days.map((d) => {
      const snow = d.snowfall_cm ?? 0;
      return el(
        "div",
        { class: "day" },
        el(
          "div",
          { class: "weekday" },
          d.date === today ? t("Today") : capitalized(forecastDate(d.date, { weekday: "short" })),
        ),
        el("div", { class: "date meta" }, forecastDate(d.date, { day: "numeric", month: "numeric" })),
        weatherIcon(d.weather_code),
        el(
          "div",
          { class: "temps" },
          el("b", {}, degrees(d.temperature_max_c)),
          " ",
          el("span", {}, degrees(d.temperature_min_c)),
        ),
        el(
          "div",
          { class: `snowfall${snow >= 0.5 ? " some" : ""}`, title: t("Snowfall") },
          el("span", { class: "bar", style: `height:${snow >= 0.5 ? Math.max(8, (100 * snow) / most) : 0}%` }),
          el("span", { class: "amount" }, snow >= 0.5 ? `${Math.round(snow)} cm` : "–"),
        ),
        el(
          "div",
          { class: "gusts meta", title: t("Strongest gusts") },
          d.wind_gusts_max_kmh !== null ? `${Math.round(d.wind_gusts_max_kmh)} km/h` : "–",
        ),
      );
    }),
  );
}

/** @param {WeatherPoint} point */
function forecastNow(point) {
  const now = point.now;
  // The days' amounts as shown, added up: a day under half a centimetre shows none.
  const week = point.days.reduce(
    (sum, d) => sum + ((d.snowfall_cm ?? 0) >= 0.5 ? Math.round(d.snowfall_cm ?? 0) : 0),
    0,
  );
  return el(
    "div",
    { class: "now" },
    weatherIcon(now?.weather_code ?? null, 48),
    el(
      "div",
      {},
      el("div", { class: "now-temp" }, degrees(now?.temperature_c)),
      el(
        "div",
        { class: "meta" },
        [
          weatherKind(now?.weather_code ?? null)?.name,
          now && now.wind_kmh !== null ? t("wind {speed} km/h", { speed: Math.round(now.wind_kmh) }) : null,
          now ? t("at {time}", { time: now.time.slice(11, 16) }) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
    el(
      "div",
      { class: "week" },
      el("div", { class: "label" }, t("Snow in 7 days")),
      el(
        "div",
        { class: `week-snow${week >= 0.5 ? " fresh" : ""}` },
        week >= 0.5 ? `${Math.round(week)}` : "0",
        el("small", {}, " cm"),
      ),
    ),
  );
}

// The card, filled once the file is in; removed when the resort has none (no location, or no forecast for a day).
/** @param {Resort} r @param {HTMLElement} card */
// biome-ignore lint/correctness/noUnusedVariables: resort.js uses it
async function weatherCard(r, card) {
  const response = await fetch(weatherPath(r), { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  /** @type {ResortWeather} */
  const w = await response.json();
  // The top first: that's where the skiing is.
  const points = [...w.points].sort((a, b) => b.elevation_m - a.elevation_m);
  const body = el("div", { class: "forecast" });
  const choose = (point) => body.replaceChildren(forecastNow(point), forecastDays(point));
  const tabs =
    points.length > 1
      ? el(
          "div",
          { class: "points", role: "tablist", "aria-label": t("Elevation") },
          ...points.map((point, i) => {
            const button = el(
              "button",
              { type: "button", role: "tab", "aria-selected": String(i === 0) },
              POINT_NAMES[point.name](),
              el("small", {}, ` ${point.elevation_m} m`),
            );
            button.addEventListener("click", () => {
              for (const other of button.parentElement.children)
                other.setAttribute("aria-selected", String(other === button));
              choose(point);
            });
            return button;
          }),
        )
      : el("span", { class: "meta" }, `${points[0].elevation_m} m`);
  choose(points[0]);
  card.replaceChildren(
    el("div", { class: "card-head" }, el("h2", {}, t("Weather forecast")), tabs),
    body,
    el(
      "p",
      { class: "meta credit" },
      t("A model forecast for the resort, not its own report. Updated {time}.", {
        time: viennaTime(w.fetched_at, { dateStyle: "short", timeStyle: "short" }),
      }),
      " ",
      el("a", { href: "https://open-meteo.com/", rel: "noopener" }, t("Weather data by Open-Meteo.com")),
    ),
  );
  card.hidden = false;
}
