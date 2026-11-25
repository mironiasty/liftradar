#!/usr/bin/env node
// Builds each country's page from scripts/country.html, at its own address in each language (README "Country pages"):
// /austria, /de/oesterreich, /fr/autriche… (assets/countries.js). Each page comes with its title, description,
// language alternates and what search engines read without running scripts (the country's resorts, region by
// region), from json/index.json; assets/country.js then draws the page from the data.
//
//   node scripts/countries.mjs <site directory>            from <dir>/json/index.json, in the build (build.mjs)
//   node scripts/countries.mjs <directory> --sample        from made-up resorts, for npm run check (English in en/)
//
// The dev server (serve.mjs) builds a page as it's asked for, with countryPageFor.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countrySlugs, languages, translatePage } from "./translate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://liftradar.eu";
const TEMPLATE = "scripts/country.html";

const escaped = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const prefix = (language) => (language === "en" ? "" : `/${language}`);

// As t() in assets/common.js: the translation, its plural form chosen by {n}, with its {names} filled in.
function translator(language, strings, seen) {
  return (text, values = {}) => {
    seen?.used.add(text);
    if (language !== "en" && !(text in strings)) seen?.missing.add(text);
    const found = (language === "en" ? null : strings[text]) ?? text.split("|")[0];
    const chosen =
      typeof found === "string" ? found : (found[new Intl.PluralRules(language).select(values.n)] ?? found.other);
    return chosen.replace(/\{(\w+)\}/g, (_, name) => values[name]);
  };
}

// Every country page: its country, language and address (without .html), for the sitemap and the dev server.
export function countryPaths() {
  const all = ["en", ...languages().map((l) => l.language)];
  return Object.entries(countrySlugs()).flatMap(([code, slugs]) =>
    all.map((language) => ({ code, language, path: `${prefix(language)}/${slugs[language]}` })),
  );
}

// The middle value of those known (the upper of the two middle ones), or null, as country.js has it.
function median(values) {
  const known = values.filter((v) => v !== null && v !== undefined && v > 0).sort((a, b) => a - b);
  return known.length ? known[Math.floor(known.length / 2)] : null;
}

// The resort with the highest value, and the value, or null.
function highest(resorts, value) {
  let best = null;
  for (const r of resorts) {
    const v = value(r);
    if (v !== null && v !== undefined && v > 0 && (!best || v > best.v)) best = { v, r };
  }
  return best;
}

/**
 * The page in the language for the country's resorts (those of the index in it). elevations: the ski tiles'
 * elevations.json resorts, for the highest lift and the vertical drop; codes: the countries with a page, for the
 * list of the others.
 * @param {string} code @param {string} language @param {Record<string, any>} strings @param {any[]} resorts
 */
export function countryPage(code, language, strings, resorts, { seen = null, elevations = {}, codes = [] } = {}) {
  const t = translator(language, strings, seen);
  const allSlugs = countrySlugs();
  const slugs = allSlugs[code];
  const all = ["en", ...languages().map((l) => l.language)];
  const url = (l) => `${SITE}${prefix(l)}/${slugs[l]}`;
  const names = new Intl.DisplayNames([language], { type: "region" });
  const country = names.of(code.toUpperCase());
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
  const open = resorts.filter((r) => r.status === "open").length;
  const title = `${t("{country}: ski resorts, open lifts and snow", { country })} – LiftRadar`;
  // The same sentence as under the page's heading (country.js).
  const intro = t(
    "{country}: {n} ski resorts, {open} of them open today. Open lifts and slopes, the records and every resort, region by region, updated twice a day.",
    { country, n: resorts.length, open },
  );
  // Where the page is, for search results: the site, then the country.
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "LiftRadar", item: `${SITE}${prefix(language)}/` },
      { "@type": "ListItem", position: 2, name: country, item: url(language) },
    ],
  };
  const head = [
    `<title>${escaped(title)}</title>`,
    `<meta name="description" content="${escaped(intro)}">`,
    `<meta property="og:title" content="${escaped(title)}">`,
    `<meta property="og:description" content="${escaped(intro)}">`,
    `<meta property="og:url" content="${url(language)}">`,
    `<link rel="canonical" href="${url(language)}">`,
    // Before lang.js, which sends a visitor to their language's version by them.
    ...all.map((l) => `<link rel="alternate" hreflang="${l}" href="${url(l)}">`),
    `<link rel="alternate" hreflang="x-default" href="${url("en")}">`,
    `<script type="application/ld+json">${JSON.stringify(breadcrumbs).replaceAll("<", "\\u003c")}</script>`,
  ].join("\n");

  // What the page shows before its script has drawn it (and what search engines read without running it): the
  // heading, the sentence, the records, the country in numbers, and the resorts by region.
  const link = (r) => `<a href="resort.html?r=${code}/${r.id}">${escaped(r.name)}</a>`;
  const height = (r, i) => elevations[`${code}/${r.id}`]?.[i]?.[2];
  const records = [
    [
      t("Biggest ski area"),
      highest(resorts, (r) => r.slopes?.total_km),
      (v) => t("{km} km of slopes", { km: number.format(v) }),
    ],
    [t("Most lifts"), highest(resorts, (r) => r.lifts?.total), (v) => t("{n} lifts", { n: v })],
    [t("Highest lift"), highest(resorts, (r) => height(r, "top")), (v) => `${number.format(v)} m`],
    [
      t("Biggest vertical drop"),
      highest(resorts, (r) => {
        const [bottom, top] = [height(r, "bottom"), height(r, "top")];
        return bottom !== undefined && top !== undefined ? top - bottom : null;
      }),
      (v) => `${number.format(v)} m`,
    ],
  ].filter(([, best]) => best);
  const km = resorts.reduce((sum, r) => sum + (r.slopes?.total_km ?? 0), 0);
  const lifts = resorts.reduce((sum, r) => sum + (r.lifts?.total ?? 0), 0);
  const typicalKm = median(resorts.map((r) => r.slopes?.total_km));
  const typicalLifts = median(resorts.map((r) => r.lifts?.total));
  const numbers = [
    [t("Slopes in all"), km ? `${number.format(km)} km` : null],
    [t("Lifts in all"), lifts ? number.format(lifts) : null],
    [
      t("Typical resort"),
      [
        typicalKm ? t("{km} km of slopes", { km: number.format(typicalKm) }) : null,
        typicalLifts ? t("{n} lifts", { n: typicalLifts }) : null,
      ]
        .filter(Boolean)
        .join(", ") || null,
    ],
  ].filter(([, value]) => value);

  /** @type {Map<string, any[]>} */
  const regions = new Map();
  for (const r of [...resorts].sort((a, b) => a.name.localeCompare(b.name, language))) {
    const name = r.region ?? "";
    regions.set(name, [...(regions.get(name) ?? []), r]);
  }
  const ordered = [...regions].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], language));
  const content = [
    '<header class="resort-head">',
    `  <h1><span class="flag big" data-country="${code}" aria-hidden="true"></span>${escaped(country)}</h1>`,
    `  <p class="intro">${escaped(intro)}</p>`,
    "</header>",
    ...(records.length
      ? [
          '<section class="card records">',
          `  <h2>${escaped(t("Records"))}</h2>`,
          "  <ul>",
          ...records.map(
            ([label, { v, r }, format]) =>
              `    <li><span class="label">${escaped(label)}</span> <span class="value">${escaped(format(v))}</span> <span class="who">${link(r)}</span></li>`,
          ),
          "  </ul>",
          "</section>",
        ]
      : []),
    ...(numbers.length
      ? [
          '<section class="card records">',
          `  <h2>${escaped(t("In numbers"))}</h2>`,
          "  <ul>",
          ...numbers.map(
            ([label, value]) =>
              `    <li><span class="label">${escaped(label)}</span> <span class="value">${escaped(value)}</span></li>`,
          ),
          "  </ul>",
          `  <p class="meta">${escaped(t("Based on the {n} resorts we monitor here; typical is the median.", { n: resorts.length }))}</p>`,
          "</section>",
        ]
      : []),
    '<section class="card regions">',
    `  <h2>${escaped(t("Regions and resorts"))}</h2>`,
    ...ordered.flatMap(([name, members]) => [
      `  <h3>${escaped(name || t("Other"))}</h3>`,
      '  <ul class="members">',
      ...members.map((r) => `    <li>${link(r)}</li>`),
      "  </ul>",
    ]),
    "</section>",
  ].join("\n");

  // The other countries' pages, under the page: a flag and the name each, in this language.
  const others = codes
    .filter((c) => c !== code && allSlugs[c])
    .map((c) => ({ c, name: names.of(c.toUpperCase()) }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
  const countries = others.length
    ? [
        `<nav class="countries" aria-label="${escaped(t("Countries"))}">`,
        `    <h2>${escaped(t("Ski resorts by country"))}</h2>`,
        "    <ul>",
        ...others.map(
          ({ c, name }) =>
            `      <li><a class="country" href="${prefix(language)}/${allSlugs[c][language]}"><span class="flag" data-country="${c}" aria-hidden="true"></span>${escaped(name)}</a></li>`,
        ),
        "    </ul>",
        "  </nav>",
      ].join("\n")
    : "";

  let html = readFileSync(join(root, TEMPLATE), "utf8").replace(/^<!--[^\n]*-->\n/, "");
  if (language !== "en") html = translatePage(TEMPLATE, language, strings, seen ?? undefined, html);
  // The language menu after the translation, which would send its English link to this language's page.
  for (const l of all) html = html.replace(`href="%${l}%"`, `href="${prefix(l)}/${slugs[l]}"`);
  return html
    .replaceAll("%CODE%", code)
    .replace("<!--HEAD-->", head)
    .replace("<!--PAGE-->", content)
    .replace("<!--COUNTRIES-->", countries);
}

// The page at an address (/austria, /de/oesterreich, with or without .html) from the index, or null.
/** @param {string} path @param {{ resorts: any[] }} index @param {Record<string, any>} elevations */
export function countryPageFor(path, index, elevations = {}) {
  const found = countryPaths().find((p) => p.path === path.replace(/\.html$/, ""));
  if (!found) return null;
  const resorts = index.resorts.filter((r) => r.country === found.code);
  if (!resorts.length) return null;
  const strings = languages().find((l) => l.language === found.language)?.strings ?? {};
  const codes = [...new Set(index.resorts.map((r) => r.country))];
  return countryPage(found.code, found.language, strings, resorts, { elevations, codes });
}

// A made-up resort in each country, for npm run check: the pages' HTML and their strings, without the data.
const sample = (code) => [
  {
    country: code,
    id: "sample",
    name: "Sample",
    region: "Region",
    status: "open",
    lifts: { open: 1, total: 2 },
    slopes: { total_km: 12 },
  },
  { country: code, id: "other", name: "Other", region: null, status: "closed", lifts: null, slopes: null },
];
const SAMPLE_HEIGHTS = { bottom: [0, 0, 1000], top: [0, 0, 2100] };

// The ski tiles' elevations.json resorts under a site or data folder, or none without the tiles.
export function readElevations(dir) {
  try {
    const meta = JSON.parse(readFileSync(join(dir, "ski", "v1", "meta.json"), "utf8"));
    return JSON.parse(readFileSync(join(dir, "ski", "v1", meta.elevations), "utf8")).resorts;
  } catch {
    return {};
  }
}

// Every page, for the build or the check; seen collects the strings used, by language, as translate.mjs does.
export function writeCountryPages(out, index, { sample: made = false, seen = {}, elevations = {} } = {}) {
  const codes = Object.keys(countrySlugs());
  const shown = made ? codes : [...new Set((index?.resorts ?? []).map((r) => r.country))];
  if (index) {
    const missing = [...new Set(index.resorts.map((r) => r.country))].filter((c) => !codes.includes(c));
    for (const code of missing) console.warn(`No page for ${code}: add its addresses to assets/countries.js`);
  }
  let written = 0;
  for (const { language, strings } of [{ language: "en", strings: {} }, ...languages()]) {
    for (const code of codes) {
      const resorts = made ? sample(code) : (index?.resorts ?? []).filter((r) => r.country === code);
      if (!resorts.length) continue;
      const heights = made ? Object.fromEntries(codes.map((c) => [`${c}/sample`, SAMPLE_HEIGHTS])) : elevations;
      const html = countryPage(code, language, strings, resorts, {
        seen: seen[language],
        elevations: heights,
        codes: shown,
      });
      if (!out) continue;
      // The check validates pages one folder down: English goes in en/.
      const dir = language === "en" ? (made ? join(out, "en") : out) : join(out, language);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${countrySlugs()[code][language]}.html`), html);
      written++;
    }
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  const made = process.argv[3] === "--sample";
  if (!out) {
    console.error("Usage: countries.mjs <site directory> [--sample]");
    process.exit(2);
  }
  const index = made ? null : JSON.parse(readFileSync(join(out, "json", "index.json"), "utf8"));
  const written = writeCountryPages(out, index, { sample: made, elevations: made ? {} : readElevations(out) });
  console.log(`Country pages: ${written}`);
}
