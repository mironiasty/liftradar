#!/usr/bin/env node
// Writes <site>/sitemap.xml on deploy (pages.yml), after the translated pages, from the site as it goes out:
//
//   node scripts/sitemap.mjs _site
//
// Every page in every language, at the address Cloudflare serves (without .html): the pages themselves,
// each resort's page, and its 3D map when the ski tiles have its area (as the pages link to it). A page
// version with noindex (a translation still partly in English) is left out. robots.txt points here.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://liftradar.eu";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// index.html is the home page, "/"; the resort and 3D pages are listed per resort.
const PAGES = ["index", "map", "stats", "about", "api", "sources"];

const out = process.argv[2];
if (!out) {
  console.error("Usage: sitemap.mjs <site directory>");
  process.exit(2);
}
const readJson = (...path) => JSON.parse(readFileSync(join(out, ...path), "utf8"));
const languages = ["en", ...readdirSync(join(root, "i18n")).map((file) => file.replace(/\.json$/, ""))];
const prefix = (language) => (language === "en" ? "" : `/${language}`);

/** @type {Index} */
const index = readJson("json", "index.json");
const keys = index.resorts.map((r) => `${r.country}/${r.id}`);
// The ski tiles may be missing (pages.yml goes on without them): then there are no 3D maps to list.
let areas = new Set();
if (existsSync(join(out, "ski", "v1", "meta.json"))) {
  const meta = readJson("ski", "v1", "meta.json");
  areas = new Set(readJson("ski", "v1", meta.resorts).features.map((f) => f.properties.id));
}

const urls = [];
for (const language of languages) {
  for (const page of PAGES) {
    const html = readFileSync(join(out, prefix(language), `${page}.html`), "utf8");
    if (html.includes('<meta name="robots" content="noindex">')) continue;
    urls.push(`${SITE}${prefix(language)}/${page === "index" ? "" : page}`);
  }
  for (const key of keys) urls.push(`${SITE}${prefix(language)}/resort?r=${key}`);
  for (const key of keys.filter((k) => areas.has(k))) urls.push(`${SITE}${prefix(language)}/3d?r=${key}`);
}

const entries = urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n");
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
);
console.log(`sitemap.xml: ${urls.length} addresses (${areas.size ? "with" : "without"} 3D maps)`);
