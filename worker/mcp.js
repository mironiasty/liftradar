// The MCP server at https://liftradar.eu/mcp (README "MCP"), for AI assistants: a few tools over the same JSON
// files the site and the API serve. The rest of the site stays static: wrangler.jsonc sends only /mcp here
// (assets.run_worker_first), and the tools read the files from the assets (env.ASSETS), so they always match
// the site's data. Stateless: every request gets a new server, with no sessions to keep.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { z } from "zod";

/** @typedef {{ ASSETS: { fetch: (request: Request | URL) => Promise<Response> } }} Env */
/** @typedef {import("../types/index").SnowConditionsForAllResorts} Index */
/** @typedef {import("../types/index").IndexResort} IndexResort */
/** @typedef {import("../types/history").PastRunsOfOneResortForGraphs} ResortHistory */
/** @typedef {import("../types/stats").DailyTotalsPerCountryAndRegion} Stats */

const INSTRUCTIONS = `LiftRadar: the status of ski resorts across Europe, from the resorts' own reports, updated twice a day \
(about 08:40 and 13:40 Vienna time). null means the source doesn't publish the value; status is open, closed or \
no_report. Times are ISO 8601 with the Vienna offset. LiftRadar is not an official source: reports can be late or \
wrong, so tell users to check the resort's own website before they go. What the values mean: \
https://liftradar.eu/about.html. Start with search_resorts: its country and id address a resort in the other tools.`;

// Browser-based clients (the MCP Inspector, web apps) call from other origins, as with the JSON files.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

// Links to the resorts' pages, the same from liftradar.liftradar.workers.dev or wrangler dev.
const SITE = "https://liftradar.eu";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const country = z
  .string()
  .regex(/^[a-z]{2}$/)
  .describe("ISO country code in lower case, e.g. at, ch, fr");
const resortId = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .describe("The resort's id from search_resorts, e.g. hintertux");

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/mcp") return env.ASSETS.fetch(request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    // Someone opening the address in a browser: the docs.
    if (request.method === "GET" && request.headers.get("Accept")?.includes("text/html")) {
      return Response.redirect(new URL("/api#mcp", url).href, 302);
    }
    const server = createServer(env, url.origin);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

/**
 * @param {Env} env
 * @param {string} origin
 */
function createServer(env, origin) {
  const server = new McpServer(
    { name: "liftradar", title: "LiftRadar", version: "1.0.0", websiteUrl: "https://liftradar.eu" },
    { instructions: INSTRUCTIONS, jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  );

  /**
   * A data file, or null when there's none at that address.
   * @param {string} path
   */
  async function read(path) {
    const response = await env.ASSETS.fetch(new URL(path, origin));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  server.registerTool(
    "search_resorts",
    {
      title: "Search ski resorts",
      description:
        "Find ski resorts by country, status, snow depth, open lifts, name or distance from a point, with their main values: " +
        "status, snow depths, open lifts and slopes, avalanche danger. Sorted by distance when near is given, otherwise " +
        "by mountain snow depth. Returns country and id for the other tools.",
      inputSchema: {
        country: country.optional(),
        status: z.enum(["open", "closed", "no_report"]).optional().describe("open: the resort reports lifts running"),
        name: z.string().min(2).optional().describe("Part of the resort's name or region, any case"),
        min_snow_cm: z.number().min(0).optional().describe("Minimum snow depth on the mountain, in cm"),
        min_lifts_open: z.number().int().min(0).optional(),
        near: z
          .object({
            lat: z.number().min(-90).max(90),
            lon: z.number().min(-180).max(180),
            radius_km: z.number().positive().max(2000).default(100),
          })
          .optional()
          .describe("Only resorts within radius_km of this point, closest first"),
        sort: z.enum(["distance", "snow", "lifts_open", "slopes_open_km", "name"]).optional(),
        limit: z.number().int().min(1).max(200).default(25),
      },
      annotations: READ_ONLY,
    },
    async ({ country, status, name, min_snow_cm, min_lifts_open, near, sort, limit }) => {
      const index = /** @type {Index} */ (await read("/json/index.json"));
      const words = name?.toLowerCase();
      let found = index.resorts
        .filter((r) => !country || r.country === country)
        .filter((r) => !status || r.status === status)
        .filter((r) => !words || `${r.name} ${r.region ?? ""}`.toLowerCase().includes(words))
        .filter((r) => min_snow_cm === undefined || (r.snow.mountain_cm ?? -1) >= min_snow_cm)
        .filter((r) => min_lifts_open === undefined || (r.lifts?.open ?? -1) >= min_lifts_open)
        .map((r) => ({ r, km: near && r.location ? distanceKm(near, r.location) : null }))
        .filter(({ km }) => !near || (km !== null && km <= near.radius_km));
      const by = sort ?? (near ? "distance" : "snow");
      /** @type {Record<string, (a: {r: IndexResort, km: number | null}) => number | string>} */
      const keys = {
        distance: ({ km }) => km ?? Infinity,
        snow: ({ r }) => -(r.snow.mountain_cm ?? -1),
        lifts_open: ({ r }) => -(r.lifts?.open ?? -1),
        slopes_open_km: ({ r }) => -(r.slopes?.open_km ?? -1),
        name: ({ r }) => r.name,
      };
      const key = keys[by];
      found.sort((a, b) => {
        const x = key(a);
        const y = key(b);
        return typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
      });
      const matches = found.length;
      found = found.slice(0, limit);
      return json({
        generated_at: index.generated_at,
        matches,
        shown: found.length,
        resorts: found.map(({ r, km }) => ({
          country: r.country,
          id: r.id,
          name: r.name,
          region: r.region,
          status: r.status,
          ...(km !== null && { distance_km: Math.round(km * 10) / 10 }),
          snow_cm: r.snow,
          lifts: r.lifts,
          slopes: r.slopes,
          avalanche: r.avalanche,
          location: r.location,
          checked_at: r.checked_at,
          page: `${SITE}/resort?r=${r.country}/${r.id}`,
        })),
      });
    },
  );

  server.registerTool(
    "get_resort",
    {
      title: "One ski resort's report",
      description:
        "One resort's full report: status, snow depths and snow stations, lifts by type, slopes by difficulty, the " +
        "avalanche bulletin, the resort's website and the reports it was built from.",
      inputSchema: { country, id: resortId },
      annotations: READ_ONLY,
    },
    async ({ country, id }) => {
      const resort = await read(`/json/${country}/${id}.json`);
      if (!resort) return notFound(country, id);
      return json({ ...resort, page: `${SITE}/resort?r=${country}/${id}` });
    },
  );

  server.registerTool(
    "get_resort_history",
    {
      title: "One ski resort's history",
      description:
        "The key numbers of one resort over the last days, one row per run (twice a day): status, open and total " +
        "lifts and slopes, open km and snow depths. Collected since 24 October 2026.",
      inputSchema: {
        country,
        id: resortId,
        days: z.number().int().min(1).max(365).default(30).describe("How many days back"),
      },
      annotations: READ_ONLY,
    },
    async ({ country, id, days }) => {
      const history = /** @type {ResortHistory | null} */ (await read(`/history/${country}/${id}.json`));
      if (!history) return notFound(country, id);
      const runs = history.runs;
      const since = Date.now() - days * 86400000;
      const rows = runs.time
        .map((time, i) => ({
          time,
          status: runs.status[i],
          lifts_open: runs.lifts_open[i],
          lifts_total: runs.lifts_total[i],
          slopes_open: runs.slopes_open[i],
          slopes_total: runs.slopes_total[i],
          slopes_open_km: runs.slopes_open_km[i],
          mountain_cm: runs.mountain_cm[i],
          valley_cm: runs.valley_cm[i],
          fresh_cm: runs.fresh_cm[i],
        }))
        .filter((row) => Date.parse(row.time) >= since);
      return json({ country, id, name: history.name, runs: rows });
    },
  );

  server.registerTool(
    "get_stats",
    {
      title: "Daily totals per country and region",
      description:
        "Daily totals over the last days, per country and region: resorts tracked and open, and their open lifts, " +
        "slopes and km. One row per region, with one value per day in the order of days.",
      inputSchema: {
        country: country.optional(),
        region: z.string().optional().describe("Region name as in search_resorts, e.g. Tirol"),
        days: z.number().int().min(1).max(365).default(14).describe("How many days back"),
      },
      annotations: READ_ONLY,
    },
    async ({ country, region, days }) => {
      const stats = /** @type {Stats} */ (await read("/json/stats.json"));
      const from = Math.max(0, stats.days.length - days);
      const regions = stats.regions
        .filter((r) => !country || r.country === country)
        .filter((r) => !region || r.region?.toLowerCase() === region.toLowerCase())
        .map((r) => ({
          country: r.country,
          region: r.region,
          tracked: r.tracked.slice(from),
          open: r.open.slice(from),
          lifts_open: r.lifts_open.slice(from),
          slopes_open: r.slopes_open.slice(from),
          slopes_open_km: r.slopes_open_km.slice(from),
        }));
      return json({ generated_at: stats.generated_at, days: stats.days.slice(from), regions });
    },
  );

  return server;
}

/** @param {unknown} data */
function json(data) {
  return { content: [{ type: /** @type {const} */ ("text"), text: JSON.stringify(data) }] };
}

/**
 * @param {string} country
 * @param {string} id
 */
function notFound(country, id) {
  return {
    isError: true,
    content: [
      {
        type: /** @type {const} */ ("text"),
        text: `No resort ${country}/${id}. search_resorts gives each resort's country and id.`,
      },
    ],
  };
}

/**
 * Great-circle distance in km.
 * @param {{lat: number, lon: number}} a
 * @param {{lat: number, lon: number}} b
 */
function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
