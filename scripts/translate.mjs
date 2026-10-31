#!/usr/bin/env node
// Generates the translated pages from the English ones, on deploy (pages.yml) or to try them locally:
//
//   node scripts/translate.mjs _site     writes _site/pl/*.html for each i18n/<language>.json
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["index", "map", "resort", "stats", "about", "sources", "404"].map((name) => `${name}.html`);
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

function translatePage(page, language, strings, seen) {
  const lookup = (key) => {
    seen.used.add(key);
    if (!(key in strings)) seen.missing.add(key);
    return strings[key];
  };
  const prefix = `/${language}/`;
  let html = replaceMarked(read(page), (tag, key, inner) => {
    const text = lookup(key || squeeze(inner));
    return tag.replace(/\sdata-i18n(="[^"]*")?/, "") + (text ?? inner);
  });
  html = html.replace(/<html lang="en">/, `<html lang="${language}">`);
  html = html.replace(/\s(aria-label|placeholder|title|alt)="([^"]+)"/g, (attribute, name, value) => {
    const text = lookup(value);
    return text ? ` ${name}="${text}"` : attribute;
  });
  html = html.replace(/<link rel="canonical" href="https:\/\/liftradar\.eu\/">/, (link) =>
    link.replace('eu/"', `eu${prefix}"`),
  );
  // The menu's links are the same on every page version: only the current language differs.
  html = html.replace(' aria-current="true"', "");
  html = html.replace(new RegExp(`(<a [^>]*hreflang="${language}"[^>]*)>`), '$1 aria-current="true">');
  html = html.replace(/(<summary class="pill lang"[^>]*>)EN</, `$1${language.toUpperCase()}<`);
  // 404.html is served for any missing path, so its links are absolute.
  if (page === "404.html") html = html.replace(/<a href="\/([^"]*)"/g, `<a href="${prefix}$1"`);

  if (html.includes('<div lang="en">')) {
    const note = `<p class="muted">${lookup(ENGLISH_ONLY) ?? ENGLISH_ONLY}</p>`;
    html = html.replace('<div lang="en">', `${note}\n  <div lang="en">`);
    html = html.replace("<title", '<meta name="robots" content="noindex">\n<title');
  }

  const scripts = [...html.matchAll(/src="\/assets\/([a-z]+\.js)"/g)].map((match) => match[1]);
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

const check = process.argv[2] === "--check";
const out = process.argv[2];
if (!out) {
  console.error("Usage: translate.mjs <output directory> | --check");
  process.exit(2);
}

let failed = false;
for (const file of readdirSync(join(root, "i18n"))) {
  const language = file.replace(/\.json$/, "");
  const strings = JSON.parse(read("i18n", file));
  const seen = { used: new Set(), missing: new Set() };
  if (!check) mkdirSync(join(out, language), { recursive: true });
  for (const page of PAGES) {
    const html = translatePage(page, language, strings, seen);
    if (!check) writeFileSync(join(out, language, page), html);
  }
  if (check) {
    const broken = brokenStrings(strings);
    const unused = Object.keys(strings).filter((key) => !seen.used.has(key));
    for (const key of seen.missing) console.warn(`${language}: not translated, stays English: ${key}`);
    for (const key of unused) console.warn(`${language}: unused: ${key}`);
    for (const text of broken) console.error(`${language}: placeholders or tags differ: ${text}`);
    failed ||= broken.length > 0;
  }
}
process.exit(failed ? 1 : 0);
