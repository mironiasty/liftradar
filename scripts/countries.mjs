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

// The page in the language for the country's resorts (those of the index in it).
/** @param {string} code @param {string} language @param {Record<string, any>} strings @param {any[]} resorts */
export function countryPage(code, language, strings, resorts, seen = null) {
  const t = translator(language, strings, seen);
  const slugs = countrySlugs()[code];
  const all = ["en", ...languages().map((l) => l.language)];
  const url = (l) => `${SITE}${prefix(l)}/${slugs[l]}`;
  const country = new Intl.DisplayNames([language], { type: "region" }).of(code.toUpperCase());
  const open = resorts.filter((r) => r.status === "open").length;
  const title = `${t("{country}: ski resorts, open lifts and snow", { country })} – LiftRadar`;
  // The same sentence as under the page's heading (country.js).
  const intro = t(
    "{country}: {n} ski resorts, {open} of them open today. Open lifts and slopes, snow depth and avalanche danger, region by region, updated twice a day.",
    { country, n: resorts.length, open },
  );
  const head = [
    `<title>${escaped(title)}</title>`,
    `<meta name="description" content="${escaped(intro)}">`,
    `<meta property="og:title" content="${escaped(title)}">`,
    `<meta property="og:description" content="${escaped(intro)}">`,
    `<meta property="og:url" content="${url(language)}">`,
    `<link rel="canonical" href="${url(language)}">`,
    // Before lang.js, which sends a visitor to their language's version by them.
    ...all.map((l) => `<link rel="alternate" hreflang="${l}" href="${url(l)}">`),
  ].join("\n");

  // What the page shows before its script has drawn it: the heading, the sentence, and the resorts by region.
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
    '<section class="card regions">',
    `  <h2>${escaped(t("Regions and resorts"))}</h2>`,
    ...ordered.flatMap(([name, members]) => [
      `  <h3>${escaped(name || t("Other"))}</h3>`,
      '  <ul class="members">',
      ...members.map((r) => `    <li><a href="resort.html?r=${code}/${r.id}">${escaped(r.name)}</a></li>`),
      "  </ul>",
    ]),
    "</section>",
  ].join("\n");

  let html = readFileSync(join(root, TEMPLATE), "utf8").replace(/^<!--[^\n]*-->\n/, "");
  if (language !== "en") html = translatePage(TEMPLATE, language, strings, seen ?? undefined, html);
  // The language menu after the translation, which would send its English link to this language's page.
  for (const l of all) html = html.replace(`href="%${l}%"`, `href="${prefix(l)}/${slugs[l]}"`);
  return html.replace("%CODE%", code).replace("<!--HEAD-->", head).replace("<!--PAGE-->", content);
}

// The page at an address (/austria, /de/oesterreich, with or without .html) from the index, or null.
/** @param {string} path @param {{ resorts: any[] }} index */
export function countryPageFor(path, index) {
  const found = countryPaths().find((p) => p.path === path.replace(/\.html$/, ""));
  if (!found) return null;
  const resorts = index.resorts.filter((r) => r.country === found.code);
  if (!resorts.length) return null;
  const strings = languages().find((l) => l.language === found.language)?.strings ?? {};
  return countryPage(found.code, found.language, strings, resorts);
}

// A made-up resort in each country, for npm run check: the pages' HTML and their strings, without the data.
const sample = (code) => [
  { country: code, id: "sample", name: "Sample", region: "Region", status: "open" },
  { country: code, id: "other", name: "Other", region: null, status: "closed" },
];

// Every page, for the build or the check; seen collects the strings used, by language, as translate.mjs does.
export function writeCountryPages(out, index, { sample: made = false, seen = {} } = {}) {
  const codes = Object.keys(countrySlugs());
  if (index) {
    const missing = [...new Set(index.resorts.map((r) => r.country))].filter((c) => !codes.includes(c));
    for (const code of missing) console.warn(`No page for ${code}: add its addresses to assets/countries.js`);
  }
  let written = 0;
  for (const { language, strings } of [{ language: "en", strings: {} }, ...languages()]) {
    for (const code of codes) {
      const resorts = made ? sample(code) : (index?.resorts ?? []).filter((r) => r.country === code);
      if (!resorts.length) continue;
      const html = countryPage(code, language, strings, resorts, seen[language]);
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
  const written = writeCountryPages(out, index, { sample: made });
  console.log(`Country pages: ${written}`);
}
