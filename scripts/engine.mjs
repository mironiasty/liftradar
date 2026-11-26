// The 3D engine (docs/3d-engine-plan.md, step 2): TrailRider's resort viewer, released on this
// repo as viewer-<commit> (viewer.tar.gz) and pinned in engine.json by its tag and sha256. Downloads
// the pinned archive, checks it, and unpacks it into <site>/engine/<tag>/, so each version has its
// own address and can be cached for good; the pin goes to <site>/engine.json too, for the page to
// know which to load (not under /engine/, cached for good). Locally (DEVELOPMENT.md "3D engine", and npm run
// dev when it's missing) and in the build (build.mjs):
//   node scripts/engine.mjs [site]      (site: where the pages are, web/ when left out)
// An engine change reaches the site only when engine.json's pin moves.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = resolve(process.argv[2] ?? join(root, "web"));
const { tag, sha256 } = JSON.parse(readFileSync(join(root, "engine.json"), "utf8"));
const out = join(site, "engine", tag);
// Which version the page loads (web/assets/scene.js): the pin itself, at the top of the site.
writeFileSync(join(site, "engine.json"), `${JSON.stringify({ tag, sha256 }, null, 2)}\n`);
if (existsSync(join(out, "viewer.js"))) {
  console.log(`engine ${tag}: already in ${out}`);
  process.exit(0);
}

const url = `https://github.com/mironiasty/liftradar/releases/download/${tag}/viewer.tar.gz`;
const response = await fetch(url);
if (!response.ok) throw new Error(`engine ${tag}: ${url} gave ${response.status}`);
const archive = Buffer.from(await response.arrayBuffer());
const got = createHash("sha256").update(archive).digest("hex");
if (got !== sha256) throw new Error(`engine ${tag}: sha256 is ${got}, engine.json pins ${sha256}`);

const scratch = mkdtempSync(join(tmpdir(), "engine-"));
try {
  writeFileSync(join(scratch, "viewer.tar.gz"), archive);
  mkdirSync(out, { recursive: true });
  execFileSync("tar", ["-xzf", join(scratch, "viewer.tar.gz"), "-C", out]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
if (!existsSync(join(out, "viewer.js"))) throw new Error(`engine ${tag}: no viewer.js in the archive`);
console.log(`engine ${tag}: unpacked into ${out}`);
