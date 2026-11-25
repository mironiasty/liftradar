#!/usr/bin/env node
// Serves the site from the repo as it is, unbuilt, for working on it (README "Running locally"): `npm run dev`.
//
//   node scripts/serve.mjs [--data <dir>] [--port 8000]
//
// --data: where json/, history/, schema/ and ski/ are (the data branch); this folder when left out, where README
//         "Running locally" links them.
// Each request reads the files again, so an edit shows on reload. /de/, /fr/, /it/ and /pl/ are translated as they're
// asked for, from i18n/, and the country pages built (scripts/countries.mjs). As on Cloudflare, /about serves about.html, and a missing file 404.html. Only this computer
// can reach it. The 3D engine is unpacked first when it isn't here yet.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { countryPageFor, countryPaths } from "./countries.mjs";
import { languages, PAGES, translatePage } from "./translate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: { data: { type: "string" }, port: { type: "string", default: "8000" } } });
const data = resolve(values.data ?? root);
const DATA_PARTS = ["json", "history", "schema", "ski"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".pbf": "application/x-protobuf",
  ".bin": "application/octet-stream",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

for (const part of DATA_PARTS.slice(0, 3)) {
  if (!existsSync(join(data, part))) console.warn(`No ${part}/ in ${data}: the pages will find no data (see --data)`);
}
const { tag } = JSON.parse(readFileSync(join(root, "engine.json"), "utf8"));
if (!existsSync(join(root, "engine", tag))) {
  try {
    execFileSync(process.execPath, [join(root, "scripts", "engine.mjs")], { stdio: "inherit" });
  } catch {
    console.warn("No 3D engine: 3d.html shows the diorama it falls back to");
  }
}

// A file under base for the address's path, or null (missing, a folder, or outside base).
function file(base, path) {
  const full = normalize(join(base, path));
  if (full !== base && !full.startsWith(base + sep)) return null;
  return existsSync(full) && statSync(full).isFile() ? full : null;
}

// The body and type for an address, or null.
function find(path) {
  const top = path.split("/")[1];
  if (DATA_PARTS.includes(top)) {
    const found = file(data, path);
    return found && { body: readFileSync(found), type: TYPES[extname(found)] };
  }
  // A country's page (/austria, /de/oesterreich), built from the data's index as the build does.
  if (countryPaths().some((p) => p.path === path.replace(/\.html$/, ""))) {
    const index = JSON.parse(readFileSync(join(data, "json", "index.json"), "utf8"));
    const html = countryPageFor(path, index);
    return html && { body: html, type: TYPES[".html"] };
  }
  const language = languages().find((l) => l.language === top);
  const rest = language ? path.slice(top.length + 1) : path;
  let page = rest === "/" ? "index.html" : rest.slice(1);
  if (!page.includes("/") && !page.endsWith(".html") && PAGES.includes(`${page}.html`)) page += ".html";
  if (PAGES.includes(page)) {
    const html = language ? translatePage(page, language.language, language.strings) : readFileSync(join(root, page));
    return { body: html, type: TYPES[".html"] };
  }
  if (language) return null;
  const found = file(root, path);
  return found && { body: readFileSync(found), type: TYPES[extname(found)] ?? "application/octet-stream" };
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  let status = 200;
  let found;
  try {
    found = find(path);
    if (!found) {
      status = 404;
      const language = path.split("/")[1];
      found = find(languages().some((l) => l.language === language) ? `/${language}/404.html` : "/404.html");
    }
  } catch (error) {
    status = 500;
    found = { body: String(error.stack), type: TYPES[".txt"] };
  }
  response.writeHead(status, { "Content-Type": found.type, "Cache-Control": "no-store" });
  response.end(found.body);
  console.log(`${status} ${request.method} ${request.url}`);
}).listen(Number(values.port), "127.0.0.1", () => console.log(`http://localhost:${values.port}`));
