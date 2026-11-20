// The MCP server's tools (worker/mcp.js) on a few made-up resorts, as an MCP client calls them: npm run check
// runs it (node --test). The Worker reads the data through env.ASSETS; here that serves FILES below.

import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "./mcp.js";

const DAY = 864e5;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const resort = (country, id, name, region, status, lat, lon, snow, lifts) => ({
  country,
  id,
  name,
  region,
  status,
  location: { lat, lon },
  checked_at: iso(now),
  snow: { mountain_cm: snow, valley_cm: null, fresh_cm: null },
  lifts: { open: lifts, total: 20 },
  slopes: { open: lifts, total: 30, open_km: lifts * 2, total_km: 60 },
  avalanche: null,
});

const FILES = {
  "/json/index.json": {
    generated_at: iso(now),
    resorts: [
      resort("at", "soelden", "Sölden", "Tirol", "open", 46.97, 11.0, 120, 12),
      resort("at", "hintertux", "Hintertuxer Gletscher", "Tirol", "open", 47.06, 11.66, 65, 16),
      resort("pl", "kotelnica", "Kotelnica Białczańska", "Małopolska", "closed", 49.4, 20.1, null, 0),
      resort("fr", "tignes", "Tignes", null, "no_report", 45.47, 6.9, null, null),
    ],
  },
  "/json/at/soelden.json": { id: "soelden", country: "at", name: "Sölden" },
  "/history/at/soelden.json": {
    name: "Sölden",
    runs: {
      time: [iso(now - 10 * DAY), iso(now - 2 * DAY), iso(now)],
      status: ["closed", "open", "open"],
      lifts_open: [0, 8, 12],
      lifts_total: [20, 20, 20],
      slopes_open: [0, 8, 12],
      slopes_total: [30, 30, 30],
      slopes_open_km: [0, 16, 24],
      mountain_cm: [null, 100, 120],
      valley_cm: [null, null, null],
      fresh_cm: [null, null, null],
    },
  },
  "/json/stats.json": {
    generated_at: iso(now),
    days: ["2026-11-18", "2026-11-19", "2026-11-20"],
    regions: [
      {
        country: "at",
        region: "Tirol",
        tracked: [2, 2, 2],
        open: [1, 2, 2],
        lifts_open: [8, 20, 28],
        slopes_open: [8, 20, 28],
        slopes_open_km: [16, 40, 56],
      },
      {
        country: "pl",
        region: "Małopolska",
        tracked: [1, 1, 1],
        open: [0, 0, 0],
        lifts_open: [0, 0, 0],
        slopes_open: [0, 0, 0],
        slopes_open_km: [0, 0, 0],
      },
    ],
  },
};

const env = {
  ASSETS: {
    /** @param {Request | URL} url */
    fetch: async (url) => {
      const path = new URL(url instanceof Request ? url.url : url).pathname;
      return path in FILES ? Response.json(FILES[path]) : new Response("Not found", { status: 404 });
    },
  },
};

/** A tool's result, as a client gets it: its text parsed, and whether it's an error. */
async function call(name, args = {}) {
  const response = await worker.fetch(
    new Request("https://liftradar.eu/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  const { result } = await response.json();
  const text = result.content[0].text;
  return { error: Boolean(result.isError), text, data: result.isError ? null : JSON.parse(text) };
}
const ids = ({ data }) => data.resorts.map((r) => r.id);

test("search_resorts: names without case or accents, and regions", async () => {
  assert.deepEqual(ids(await call("search_resorts", { name: "SOLDEN" })), ["soelden"]);
  assert.deepEqual(ids(await call("search_resorts", { name: "bialczanska" })), ["kotelnica"]);
  assert.deepEqual(ids(await call("search_resorts", { name: "tirol", sort: "name" })), ["hintertux", "soelden"]);
  assert.equal((await call("search_resorts", { name: "nowhere" })).data.matches, 0);
});

test("search_resorts: filters, the default order by snow (unknown last), and limit", async () => {
  const all = await call("search_resorts");
  assert.equal(all.data.matches, 4);
  assert.deepEqual(ids(all).slice(0, 2), ["soelden", "hintertux"]);
  assert.deepEqual(ids(await call("search_resorts", { status: "open", min_lifts_open: 13 })), ["hintertux"]);
  assert.deepEqual(ids(await call("search_resorts", { country: "pl" })), ["kotelnica"]);
  const one = await call("search_resorts", { limit: 1 });
  assert.equal(one.data.matches, 4);
  assert.equal(one.data.shown, 1);
});

test("search_resorts: near a point, closest first, within the radius", async () => {
  // Innsbruck: Hintertux about 30 km, Sölden about 45 km, Tignes and Kotelnica far.
  const { data } = await call("search_resorts", { near: { lat: 47.27, lon: 11.39, radius_km: 80 } });
  assert.deepEqual(
    data.resorts.map((r) => r.id),
    ["hintertux", "soelden"],
  );
  assert.ok(data.resorts[0].distance_km < data.resorts[1].distance_km);
  assert.ok(data.resorts.every((r) => r.distance_km <= 80));
});

test("get_resort: the report with its page, or an error naming the way to find one", async () => {
  const found = await call("get_resort", { country: "at", id: "soelden" });
  assert.equal(found.data.name, "Sölden");
  assert.equal(found.data.page, "https://liftradar.eu/resort?r=at/soelden");
  const missing = await call("get_resort", { country: "at", id: "nowhere" });
  assert.ok(missing.error);
  assert.match(missing.text, /search_resorts/);
});

test("get_resort_history: only the runs of the last days", async () => {
  const { data } = await call("get_resort_history", { country: "at", id: "soelden", days: 3 });
  assert.deepEqual(
    data.runs.map((run) => run.lifts_open),
    [8, 12],
  );
  assert.ok((await call("get_resort_history", { country: "at", id: "nowhere" })).error);
});

test("get_stats: the last days, by country and region (any case)", async () => {
  const { data } = await call("get_stats", { region: "TIROL", days: 2 });
  assert.deepEqual(data.days, ["2026-11-19", "2026-11-20"]);
  assert.deepEqual(
    data.regions.map((r) => [r.region, r.lifts_open]),
    [["Tirol", [20, 28]]],
  );
  assert.deepEqual(
    (await call("get_stats", { country: "pl" })).data.regions.map((r) => r.region),
    ["Małopolska"],
  );
});

test("bad input is refused, not read", async () => {
  assert.ok((await call("get_resort", { country: "../json", id: "index" })).error);
});

test("a browser opening /mcp gets the docs; other addresses are the files", async () => {
  const page = await worker.fetch(new Request("https://liftradar.eu/mcp", { headers: { Accept: "text/html" } }), env);
  assert.equal(page.status, 302);
  assert.equal(page.headers.get("Location"), "https://liftradar.eu/api#mcp");
  const file = await worker.fetch(new Request("https://liftradar.eu/json/index.json"), env);
  assert.equal((await file.json()).resorts.length, 4);
});
