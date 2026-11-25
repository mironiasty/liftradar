#!/usr/bin/env node
// Generates the translated pages from the English ones, in the build (scripts/build.mjs); the dev server
// (scripts/serve.mjs) translates each page as it's asked for, with translatePage:
//
//   node scripts/translate.mjs <dir>     writes <dir>/pl/*.html for each i18n/<language>.json
//   node scripts/translate.mjs --check   lists what's missing or unused, and fails on a broken translation
//
// i18n/<language>.json maps English to the translation, so anything missing stays English; a plural
// is an object by Intl.PluralRules category. Translated are:
// - elements with data-i18n, by their inner HTML (or the attribute's value, where the same English needs two
//   translations), which mustn't nest,
// - the aria-label, placeholder, title and alt attributes,
// - the t("...") strings of the page's scripts, put in the page as window.STRINGS.
// <div lang="en"> holds what stays English for now: above it the page says so, and it isn't indexed.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
// Imported by it too: it only uses this module's functions once both are loaded.
import { writeCountryPages } from "./countries.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The site's pages: every .html at the top of the repo (the build copies and translates the same list).
export const PAGES = readdirSync(root)
  .filter((file) => file.endsWith(".html"))
  .sort();
const ENGLISH_ONLY = "This part of the page is available in English only.";

const read = (...path) => readFileSync(join(root, ...path), "utf8");
const squeeze = (text) => text.trim().replace(/\s+/g, " ");

// The t("...") strings of an assets/*.js file.
const scriptStrings = (name) =>
  [...read("assets", name).matchAll(/\bt\(\s*("(?:[^"\\]|\\.)*")/g)].map((match) => JSON.parse(match[1]));

// Calls replace(openingTag, tagName, explicitKey, innerHtml) for each data-i18n element, for its replacement.
function replaceMarked(html, replace) {
  const opening = /<([a-z0-9]+)\b[^>]*\sdata-i18n(?:="([^"]*)")?[^>]*>/g;
  let result = "";
  let position = 0;
  for (let match = opening.exec(html); match; match = opening.exec(html)) {
    const [tag, name, key] = match;
    const nested = new RegExp(`<(/?)${name}\\b[^>]*>`, "g");
    nested.lastIndex = opening.lastIndex;
    let depth = 1;
    let end;
    while (depth) {
      end = nested.exec(html);
      if (!end) throw new Error(`No end to ${tag}`);
      if (end[0].endsWith("/>")) continue;
      depth += end[1] ? -1 : 1;
    }
    const inner = html.slice(opening.lastIndex, end.index);
    result += html.slice(position, match.index) + replace(tag, key, inner) + end[0];
    position = nested.lastIndex;
    opening.lastIndex = nested.lastIndex;
  }
  return result + html.slice(position);
}

// Each country's page address by language, {at: {en: "austria", de: "oesterreich", ...}}, from assets/countries.js,
// which the pages load too (README "Country pages").
export const countrySlugs = () => runInNewContext(`${read("assets", "countries.js")}; COUNTRY_SLUGS`);

// The languages, from i18n/<language>.json, each with its strings.
export const languages = () =>
  readdirSync(join(root, "i18n")).map((file) => ({
    language: file.replace(/\.json$/, ""),
    strings: JSON.parse(read("i18n", file)),
  }));

/**
 * Page (e.g. "about.html") in the language; seen collects the keys used and missing, for --check. source is the
 * page's HTML when it isn't the file as it is (a country page, from its template: scripts/countries.mjs).
 */
export function translatePage(page, language, strings, seen = { used: new Set(), missing: new Set() }, source = null) {
  const lookup = (key) => {
    seen.used.add(key);
    if (!(key in strings)) seen.missing.add(key);
    return strings[key];
  };
  const prefix = `/${language}/`;
  let html = replaceMarked(source ?? read(page), (tag, key, inner) => {
    const text = lookup(key || squeeze(inner));
    return tag.replace(/\sdata-i18n(="[^"]*")?/, "") + (text ?? inner);
  });
  html = html.replace(/<html lang="en">/, `<html lang="${language}">`);
  html = html.replace(/\s(aria-label|placeholder|title|alt)="([^"]+)"/g, (attribute, name, value) => {
    const text = lookup(value);
    // A " in the translation (Polish „…", say) would end the attribute.
    return text ? ` ${name}="${text.replaceAll('"', "&quot;")}"` : attribute;
  });
  // The social preview's texts (description, og:title, og:description, og:image:alt).
  html = html.replace(
    /(<meta (?:name|property)="(?:description|og:title|og:description|og:image:alt)" content=")([^"]+)"/g,
    (meta, start, value) => {
      const text = lookup(value);
      return text ? `${start}${text.replaceAll('"', "&quot;")}"` : meta;
    },
  );
  // Each language is its own page for search engines (resort.js sets the resort page's from its address).
  html = html.replace(
    /(<link rel="canonical" href="|<meta property="og:url" content=")https:\/\/liftradar\.eu\//g,
    `$&${language}/`,
  );
  // The menu's links are the same on every page version: only the current language differs.
  html = html.replace(' aria-current="true"', "");
  html = html.replace(new RegExp(`(<a [^>]*hreflang="${language}"[^>]*)>`), '$1 aria-current="true">');
  html = html.replace(/(<summary class="pill lang"[^>]*>)EN</, `$1${language.toUpperCase()}<`);
  // A link to a country's page (href="/austria") goes to its page in this language (/de/oesterreich), and a list's
  // link (class "country") says the country's name in it.
  const slugs = Object.entries(countrySlugs());
  const names = new Intl.DisplayNames([language], { type: "region" });
  html = html.replace(/(<a [^>]*href=")\/([a-z-]+)("[^>]*>)/g, (link, start, slug, end) => {
    const found = slugs.find(([, bySlug]) => bySlug.en === slug);
    return found ? `${start}/${language}/${found[1][language] ?? slug}${end}` : link;
  });
  html = html.replace(
    /(<a class="country" href="[^"]*">(?:<span [^>]*><\/span>)?)([^<]+)(<\/a>)/g,
    (link, start, name, end) => {
      const found = slugs.find(
        ([code]) => new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) === name,
      );
      return found ? `${start}${names.of(found[0].toUpperCase())}${end}` : link;
    },
  );
  // 404.html is served for any missing path, so its links are absolute.
  if (page === "404.html") html = html.replace(/<a href="\/([^"]*)"/g, `<a href="${prefix}$1"`);

  if (html.includes('<div lang="en">')) {
    const note = `<p class="muted">${lookup(ENGLISH_ONLY) ?? ENGLISH_ONLY}</p>`;
    html = html.replace('<div lang="en">', `${note}\n  <div lang="en">`);
    html = html.replace("<title", '<meta name="robots" content="noindex">\n<title');
  }

  const scripts = [...html.matchAll(/src="\/assets\/([a-z0-9-]+\.js)"/g)].map((match) => match[1]);
  if (scripts.length) {
    const used = {};
    for (const key of scripts.flatMap(scriptStrings)) {
      const text = lookup(key);
      if (text) used[key] = text;
    }
    const json = JSON.stringify(used).replaceAll("<", "\\u003c");
    html = html.replace(
      /<script src="\/assets\/common\.js/,
      (tag) => `<script>window.STRINGS = ${json};</script>\n${tag}`,
    );
  }
  return html;
}

const tags = (text) =>
  [...text.matchAll(/<[^>]+>/g)]
    .map((match) => match[0])
    .sort()
    .join();
const placeholders = (text) =>
  [...text.matchAll(/\{\w+\}/g)]
    .map((match) => match[0])
    .sort()
    .join();

// Every form must have the English string's placeholders and tags, or a value or link would go missing.
function brokenStrings(strings) {
  return Object.entries(strings).flatMap(([key, value]) =>
    (typeof value === "string" ? [value] : Object.values(value))
      .filter((text) => placeholders(text) !== placeholders(key) || tags(text) !== tags(key))
      .map((text) => `${key} -> ${text}`),
  );
}

// Run as a script, not imported (by build.mjs and serve.mjs).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv[2] === "--check";
  const out = process.argv[2];
  if (!out) {
    console.error("Usage: translate.mjs <output directory> | --check");
    process.exit(2);
  }

  let failed = false;
  const all = languages();
  const seen = Object.fromEntries(all.map(({ language }) => [language, { used: new Set(), missing: new Set() }]));
  for (const { language, strings } of all) {
    if (!check) mkdirSync(join(out, language), { recursive: true });
    for (const page of PAGES) {
      const html = translatePage(page, language, strings, seen[language]);
      if (!check) writeFileSync(join(out, language, page), html);
    }
  }
  if (check) {
    // The country pages' strings too, from their template and made-up resorts (countries.mjs).
    writeCountryPages(null, null, { sample: true, seen });
    for (const { language, strings } of all) {
      const broken = brokenStrings(strings);
      const unused = Object.keys(strings).filter((key) => !seen[language].used.has(key));
      for (const key of seen[language].missing) console.warn(`${language}: not translated, stays English: ${key}`);
      for (const key of unused) console.warn(`${language}: unused: ${key}`);
      for (const text of broken) console.error(`${language}: placeholders or tags differ: ${text}`);
      failed ||= broken.length > 0;
    }
  }
  process.exit(failed ? 1 : 0);
}
