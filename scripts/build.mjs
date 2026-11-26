#!/usr/bin/env node
// Builds the site as it's deployed: the pages and the data, combined into one folder (DEVELOPMENT.md "Running locally").
// pages.yml runs it before uploading the folder to Cloudflare; locally, `npm run build` (then `npm run preview`):
//
//   node scripts/build.mjs [--data <dir>] [--out <dir>]
//   node scripts/build.mjs --check      the links the build stops on, in web/ as it is (npm run check)
//
// --data: where json/, history/ and schema/ are (the data branch), with ski/ if the ski tiles are there too
//         (DEVELOPMENT.md "Ski tiles"); web/ when left out, where DEVELOPMENT.md "Running locally" links them.
// --out:  the folder to build into, emptied first; _site when left out, as wrangler.jsonc reads it.
//
// The steps that only make the site smaller or faster (the 3D engine, minifying, compacting the index) warn and
// go on when they fail, as the site works without them; the others stop the build.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PAGES } from "./translate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "web");
const { values } = parseArgs({
  options: { data: { type: "string" }, out: { type: "string" }, check: { type: "boolean" } },
});
const data = resolve(values.data ?? web);
const out = resolve(values.out ?? join(root, "_site"));

// What the site takes from the data. The site itself is all of web/, but for what DEVELOPMENT.md "Running locally"
// links or unpacks there (git-ignored): the data, the ski tiles and the 3D engine, which come in below.
const DATA_PARTS = ["json", "history", "schema"];
const LOCAL = [...DATA_PARTS, "ski", "engine", "engine.json"];

const node = (script, ...args) =>
  execFileSync(process.execPath, [join(root, "scripts", script), ...args], { stdio: "inherit" });
function optional(step, run) {
  try {
    run();
  } catch (error) {
    console.warn(`${step} failed, going on without it: ${error.message}`);
  }
}
// The pages, the translated ones (one folder down) and, for some steps, the scripts.
const files = (dir, test) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter(test)
        .map((file) => join(dir, file))
    : [];
const html = () => [
  ...files(out, (f) => f.endsWith(".html")),
  ...files(out, (f) => statSync(join(out, f)).isDirectory()).flatMap((dir) => files(dir, (f) => f.endsWith(".html"))),
];
const rewrite = (paths, change) => {
  for (const path of paths) writeFileSync(path, change(readFileSync(path, "utf8")));
};

// Cloudflare redirects about.html to /about (307), and search engines report every page reached through one: the
// links go straight to the address it serves (index.html is "/", and 404.html is never linked). Quoted names only, so
// comments and other sites' links stay. Locally, `npm run dev` serves the .html as it is in the repo.
const linked = PAGES.map((page) => page.replace(/\.html$/, "")).filter((name) => name !== "index" && name !== "404");
const pageLink = new RegExp(`(["\`](/([a-z]{2}/)?)?)(${linked.join("|")})\\.html`, "g");
// A link to an .html page that isn't one of PAGES, once theirs are rewritten.
const pageLinkLeft = (text) => /["`](\/([a-z]{2}\/)?)?[a-z0-9]+\.html/.test(text.replace(pageLink, "$1$4"));
// The pages' scripts and styles with ?v=<commit>, and a link this pattern doesn't reach (a name with "_", say).
const versioned = (text, version) => text.replace(/(assets\/[a-z0-9-]+\.(js|css))"/g, `$1?v=${version}"`);
const unversionedLeft = (text) => /assets\/[^"?]+\.(js|css)"/.test(versioned(text, "check"));

// Both stop the build below, and a deploy after every data update with it: `npm run check` finds them first, in
// the files as they are (the pages, their scripts, and the country pages' template).
if (values.check) {
  const pages = [...files(web, (f) => f.endsWith(".html")), join(root, "scripts", "country.html")];
  const sources = [...pages, ...files(join(web, "assets"), (f) => f.endsWith(".js"))];
  const problems = [
    ...sources
      .filter((path) => pageLinkLeft(readFileSync(path, "utf8")))
      .map((p) => `a link to an .html page that isn't in PAGES: ${p}`),
    ...pages
      .filter((path) => unversionedLeft(readFileSync(path, "utf8")))
      .map((p) => `an asset link ?v= wouldn't reach: ${p}`),
  ];
  for (const problem of problems) console.error(problem);
  process.exit(problems.length ? 1 : 0);
}

// The site and the data in one folder. cpSync follows the links DEVELOPMENT.md "Running locally" makes.
// The folder is emptied first: never one holding the repo or the data, and in the repo only _site.
const holds = (dir, inner) => inner === dir || inner.startsWith(dir + sep);
if (holds(out, root) || holds(out, data) || (holds(root, out) && out !== join(root, "_site"))) {
  throw new Error(`--out ${out} would empty the repo or the data: give a folder of its own`);
}
for (const part of DATA_PARTS) {
  if (!existsSync(join(data, part))) throw new Error(`No ${part}/ in ${data}: give the data branch with --data`);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of readdirSync(web)) {
  if (LOCAL.includes(file) || (file.startsWith(".") && file !== ".well-known")) continue;
  cpSync(join(web, file), join(out, file), { recursive: true });
}
for (const part of DATA_PARTS) cpSync(join(data, part), join(out, part), { recursive: true, dereference: true });
// Without the ski tiles (not built yet, or GitHub failing) the site goes out without /ski/, which apps handle.
if (existsSync(join(data, "ski"))) cpSync(join(data, "ski"), join(out, "ski"), { recursive: true, dereference: true });
else console.warn(`No ski/ in ${data}: the site goes out without the ski tiles`);

// The 3D engine (DEVELOPMENT.md "3D engine"), into /engine/<tag>/: the pinned one copied when it's unpacked here already,
// else downloaded. Without it, 3d.html shows the diorama it falls back to.
const engine = join("engine", JSON.parse(readFileSync(join(root, "engine.json"), "utf8")).tag);
if (existsSync(join(web, engine))) cpSync(join(web, engine), join(out, engine), { recursive: true });
optional("The 3D engine", () => node("engine.mjs", out));

// Before the asset links are versioned: these pages have the same links.
node("translate.mjs", out);
// Each country's page in each language, from the data's index (DEVELOPMENT.md "Country pages").
node("countries.mjs", out);
// After the translated pages, the country pages and the ski tiles: it lists them (DEVELOPMENT.md "Sitemap").
node("sitemap.mjs", out);

const scripts = files(join(out, "assets"), (f) => f.endsWith(".js"));
rewrite([...html(), ...scripts], (text) => text.replace(pageLink, "$1$4"));
const left = [...html(), ...scripts].filter((path) => pageLinkLeft(readFileSync(path, "utf8")));
if (left.length) throw new Error(`Links to .html pages left in ${left.join(", ")}: add the page to PAGES`);

// Scripts keep their top-level names (esbuild leaves them alone when not bundling): the pages share them from
// common.js. A failure here only costs a few kilobytes: the unminified files stay valid.
optional("Minifying", () => {
  const styles = files(join(out, "assets"), (f) => f.endsWith(".css"));
  const esbuild = join(root, "node_modules", ".bin", "esbuild");
  execFileSync(esbuild, [...scripts, ...styles, "--minify", `--outdir=${join(out, "assets")}`, "--allow-overwrite"], {
    stdio: "inherit",
  });
});

// The same data without its indentation; only the built copy, the data branch stays readable. Only the whitespace
// between values goes, so the values stay as the fetcher wrote them (JSON.stringify would turn 0.0 into 0).
optional("Compacting the resort index", () => {
  const index = join(out, "json", "index.json");
  const text = readFileSync(index, "utf8");
  JSON.parse(text);
  writeFileSync(index, `${text.replace(/"(?:[^"\\]|\\.)*"|\s+/g, (match) => (match[0] === '"' ? match : ""))}\n`);
});

// Without a version in the URL, a new page can run with the previous version's scripts from a cache on the way.
// _headers caches them for a year, so a link left without one would keep a file frozen: stop instead.
const version = execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
rewrite(html(), (text) => versioned(text, version));
const unversioned = html().filter((path) => unversionedLeft(readFileSync(path, "utf8")));
if (unversioned.length) throw new Error(`Asset links without ?v= in ${unversioned.join(", ")}: widen the pattern`);
console.log(`Built ${out} (assets ?v=${version})`);
