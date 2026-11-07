// 3d.html?r=<country>/<id>: the resort in 3D, as a diorama: a box around it cut out of Mapterhorn's
// terrain and floating on the page's background, with its own pistes draped on it, and the lifts as simple models drawn by three.js
// in the map's own WebGL context, so the terrain hides what's behind it: pylons, stations, the
// cable on two tracks, and cabins, chairs or bars moving along it. A prototype.

import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.187.0/three.module.min.js";

const params = new URLSearchParams(location.search);
const KEY = params.get("r");
const DEM = "mapterhorn";

// Per lift type: pylon height and the longest span (m), the clearance the cable keeps over the
// ground, the gap between the two tracks, the carrier with its usual seats, spacing (m) and speed
// (m/s) when the data has no capacity or ride time, how far it hangs below the cable, and the
// station [width, height, length].
const GONDOLA = {
  pylon: 20,
  every: 350,
  clearance: 8,
  gauge: 6,
  carrier: "cabin",
  seats: 8,
  spacing: 60,
  speed: 5,
  hang: 3.6,
  station: [14, 10, 22],
};
const DRAG = {
  pylon: 7,
  every: 150,
  clearance: 5.5,
  gauge: 1.6,
  carrier: "bar",
  seats: 2,
  spacing: 14,
  speed: 2.8,
  hang: 4.5,
  station: [5, 3.5, 6],
};
const KINDS = {
  gondola: GONDOLA,
  mixed_lift: GONDOLA,
  cable_car: {
    pylon: 40,
    every: 1500,
    clearance: 15,
    gauge: 10,
    carrier: "tram",
    carriers: 1,
    seats: 80,
    speed: 9,
    hang: 5,
    station: [18, 15, 24],
  },
  chair_lift: {
    pylon: 12,
    every: 250,
    clearance: 5,
    gauge: 5.5,
    carrier: "chair",
    seats: 4,
    spacing: 18,
    speed: 3,
    hang: 2.6,
    station: [12, 7, 16],
  },
  "t-bar": DRAG,
  "j-bar": DRAG,
  platter: DRAG,
  drag_lift: DRAG,
  rope_tow: { pylon: 2.5, every: 80, clearance: 1, gauge: 0.8, carrier: null, station: [3, 2, 3] },
};
// Lifts on the ground stay lines on the map: funiculars, railways and magic carpets.
const AERIAL = Object.keys(KINDS);
// The ground is read every PROFILE_STEP metres along a lift; the cable sags by SAG of its span.
const PROFILE_STEP = 10;
const SAG = 0.015;

const OWN = darkMode() ? 0xe0503f : 0xd0342c;
const STEEL = darkMode() ? 0xb8bec6 : 0x7d838b;
const GLASS = 0x2c3846;
const CONCRETE = darkMode() ? 0x9a958c : 0xd4cfc4;
const CABLE = darkMode() ? 0xe6e6e6 : 0x2a2a2a;

const info = document.getElementById("info");
const showInfo = (...content) => info.replaceChildren(...content);

// The tiles' lifts within bounds, each once.
async function liftsIn(ski, bounds) {
  const [x0, y0] = tileOf([bounds.getWest(), bounds.getNorth()]);
  const [x1, y1] = tileOf([bounds.getEast(), bounds.getSouth()]);
  const tiles = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push(`${x}/${y}`);
  const loaded = await Promise.all(
    tiles.map((path) =>
      fetch(`${SKI_URL}/10/${path}.json?b=${ski.build}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ),
  );
  const lifts = new Map();
  for (const tile of loaded) {
    for (const lift of tile?.lifts ?? []) {
      const inside = lift.c.some(([lon, lat]) => bounds.contains([lon, lat]));
      if (inside && KINDS[lift.type]) lifts.set(lift.osm ?? JSON.stringify(lift.c[0]), lift);
    }
  }
  return [...lifts.values()];
}

// Metres east and north of a point, flat: fine across a ski area.
function metresFrom([lon0, lat0]) {
  const k = Math.cos((lat0 * Math.PI) / 180) * 111_320;
  return ([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * 111_320];
}

// The camera: over the area, looking the way its lifts go up, tilted.
function startView(corners, lifts, center) {
  const toM = metresFrom(center);
  let east = 0;
  let north = 0;
  for (const lift of lifts) {
    const [a, b] = bottomFirst(lift.c);
    const [ax, ay] = toM(a);
    const [bx, by] = toM(b);
    east += bx - ax;
    north += by - ay;
  }
  const bearing = lifts.length ? (Math.atan2(east, north) * 180) / Math.PI : 0;
  // The diorama's extent across and along the view: all of it in the frame, with room around.
  const points = corners;
  const rad = (bearing * Math.PI) / 180;
  let across = 600;
  let along = 600;
  if (points.length) {
    const xs = [];
    const ys = [];
    for (const p of points) {
      const [x, y] = toM(p);
      xs.push(x * Math.cos(rad) - y * Math.sin(rad));
      ys.push(x * Math.sin(rad) + y * Math.cos(rad));
    }
    across = Math.max(...xs) - Math.min(...xs);
    along = Math.max(...ys) - Math.min(...ys);
  }
  const box = document.getElementById("map").getBoundingClientRect();
  const metresPerPixelAtZ0 = (40_075_016 * Math.cos((center[1] * Math.PI) / 180)) / 512;
  const zoom = Math.min(
    Math.log2((box.width * 0.75 * metresPerPixelAtZ0) / across),
    Math.log2((box.height * 0.75 * metresPerPixelAtZ0) / (along * 0.7)),
  );
  return { center, zoom: Math.min(15.5, zoom), bearing, pitch: 55, maxPitch: 80 };
}

// Elevation tiles read as they are: no colour conversion, which would change the heights.
const DECODE = { colorSpaceConversion: "none", premultiplyAlpha: "none" };

// The diorama: the resort's box as it is, and everything outside it a flat base `base` metres
// high, so the box's edges drop as walls. The elevation tiles go through this protocol on the
// way to the map: tiles wholly outside are made flat without fetching them.
function registerDiorama(box, base) {
  const [west, south, east, north] = box;
  const value = base + 32768;
  const flat = [Math.floor(value / 256), Math.floor(value) % 256, Math.floor((value % 1) * 256)];
  const latOf = (row, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
  maplibregl.addProtocol("diorama", async (params, abort) => {
    const [z, x, y] = params.url.slice("diorama://".length).split("/").map(Number);
    const n = 2 ** z;
    const { tiles, tileSize } = DEMS[DEM];
    const tileWest = (x / n) * 360 - 180;
    const tileEast = ((x + 1) / n) * 360 - 180;
    const tileNorth = latOf(y, n);
    const tileSouth = latOf(y + 1, n);
    const canvas = new OffscreenCanvas(tileSize, tileSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const outside = tileEast < west || tileWest > east || tileNorth < south || tileSouth > north;
    let pixels;
    if (outside) {
      pixels = context.createImageData(tileSize, tileSize);
    } else {
      const url = tiles[0].replace("{z}", z).replace("{x}", x).replace("{y}", y);
      const response = await fetch(url, { signal: abort.signal });
      const image = await createImageBitmap(await response.blob(), DECODE);
      context.drawImage(image, 0, 0, tileSize, tileSize);
      pixels = context.getImageData(0, 0, tileSize, tileSize);
    }
    const data = pixels.data;
    for (let row = 0; row < tileSize; row++) {
      const lat = latOf(y + (row + 0.5) / tileSize, n);
      const inLat = lat >= south && lat <= north;
      for (let col = 0; col < tileSize; col++) {
        const lon = ((x + (col + 0.5) / tileSize) / n) * 360 - 180;
        if (inLat && lon >= west && lon <= east) continue;
        const i = (row * tileSize + col) * 4;
        data[i] = flat[0];
        data[i + 1] = flat[1];
        data[i + 2] = flat[2];
        data[i + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const png = await canvas.convertToBlob({ type: "image/png" });
    return { data: await png.arrayBuffer() };
  });
  DEMS.diorama = { ...DEMS[DEM], tiles: ["diorama://{z}/{x}/{y}"] };
}

// The ground's elevation along the lifts: the DEM tiles they cross, at zoom 13 (a few metres a
// pixel), decoded here rather than asked of the map, whose terrain depends on what it shows.
const DEM_ZOOM = 13;
async function groundAlong(lifts) {
  const { tiles, tileSize } = DEMS[DEM];
  const n = 2 ** DEM_ZOOM;
  const pixel = ([lon, lat]) => {
    const rad = (lat * Math.PI) / 180;
    return [((lon + 180) / 360) * n, ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n];
  };
  const wanted = new Set();
  for (const lift of lifts) {
    for (let i = 1; i < lift.c.length; i++) {
      const a = lift.c[i - 1];
      const b = lift.c[i];
      for (let k = 0; k <= 20; k++) {
        const [x, y] = pixel([a[0] + ((b[0] - a[0]) * k) / 20, a[1] + ((b[1] - a[1]) * k) / 20]);
        wanted.add(`${Math.floor(x)}/${Math.floor(y)}`);
      }
    }
  }
  const decoded = new Map();
  await Promise.all(
    [...wanted].map(async (key) => {
      const [x, y] = key.split("/");
      try {
        const url = tiles[0].replace("{z}", DEM_ZOOM).replace("{x}", x).replace("{y}", y);
        const image = await createImageBitmap(await (await fetch(url)).blob(), DECODE);
        const canvas = new OffscreenCanvas(tileSize, tileSize);
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, tileSize, tileSize);
        decoded.set(key, context.getImageData(0, 0, tileSize, tileSize).data);
      } catch {}
    }),
  );
  // Terrarium: R * 256 + G + B / 256 - 32768 metres; null outside the tiles read.
  return (lonLat) => {
    const [x, y] = pixel(lonLat);
    const data = decoded.get(`${Math.floor(x)}/${Math.floor(y)}`);
    if (!data) return null;
    // Bilinear, between the four pixels around the point (within the tile).
    const fx = Math.min(tileSize - 1.001, Math.max(0, (x % 1) * tileSize - 0.5));
    const fy = Math.min(tileSize - 1.001, Math.max(0, (y % 1) * tileSize - 0.5));
    const px = Math.floor(fx);
    const py = Math.floor(fy);
    const at = (cx, cy) => {
      const i = (cy * tileSize + cx) * 4;
      return data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
    };
    const tx = fx - px;
    const ty = fy - py;
    const top = at(px, py) * (1 - tx) + at(px + 1, py) * tx;
    const bottom = at(px, py + 1) * (1 - tx) + at(px + 1, py + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

// A lift's line from its bottom station, by the elevations OpenSkiData gives.
function bottomFirst(coords) {
  const a = coords[0][2];
  const b = coords[coords.length - 1][2];
  return a !== undefined && b !== undefined && a > b ? [...coords].reverse() : coords;
}

// A polyline with cumulative lengths, and the point and heading at any distance along it.
function path(points) {
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + points[i].distanceTo(points[i - 1]));
  const length = at[at.length - 1];
  return {
    points,
    length,
    sample(distance, position) {
      const d = Math.min(Math.max(distance, 0), length);
      let lo = 0;
      let hi = at.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (at[mid] <= d) lo = mid;
        else hi = mid;
      }
      const span = at[hi] - at[lo] || 1;
      position.lerpVectors(points[lo], points[hi], (d - at[lo]) / span);
      return Math.atan2(points[hi].x - points[lo].x, points[hi].z - points[lo].z);
    },
  };
}

// The models of the lifts, in metres around origin (x east, y up, z south).
function buildLifts(lifts, origin, elevation) {
  const o = maplibregl.MercatorCoordinate.fromLngLat(origin, 0);
  const s = o.meterInMercatorCoordinateUnits();
  const local = ([lon, lat], alt) => {
    const m = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
    return new THREE.Vector3((m.x - o.x) / s, alt, (m.y - o.y) / s);
  };
  const pylons = [];
  const stations = [];
  const cables = [];
  const carriers = [];
  for (const lift of lifts) {
    const kind = KINDS[lift.type];
    const coords = bottomFirst(lift.c);
    const plan = coords.map((c) => local(c, 0));
    const lengths = [0];
    for (let i = 1; i < plan.length; i++) lengths.push(lengths[i - 1] + plan[i].distanceTo(plan[i - 1]));
    const total = lengths[lengths.length - 1];
    if (total < 20) continue;
    // The point along the line at a distance, in plan and on the map.
    const along = (d) => {
      let i = 1;
      while (i < lengths.length - 1 && lengths[i] < d) i++;
      const t = Math.min(1, Math.max(0, (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)));
      const a = coords[i - 1];
      const b = coords[i];
      const ele = a[2] !== undefined && b[2] !== undefined ? a[2] + (b[2] - a[2]) * t : undefined;
      return { lonLat: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ele, segment: i };
    };
    // The ground every PROFILE_STEP metres.
    const steps = Math.ceil(total / PROFILE_STEP);
    const profile = [];
    for (let k = 0; k <= steps; k++) {
      const d = (k * total) / steps;
      const { lonLat, ele } = along(d);
      profile.push({ d, ground: elevation(lonLat) ?? ele ?? 0 });
    }
    const groundAt = (d) => profile[Math.round((d / total) * steps)].ground;
    // Supports: the stations, the bends, then pylons where the cable would come too close to the
    // ground, or a span would be too long.
    const support = (d, kindOf) => {
      const g = groundAt(d);
      const height = kindOf === "station" ? kind.station[1] * 0.8 : kind.pylon;
      return { d, ground: g, top: g + height, kind: kindOf };
    };
    const supports = [support(0, "station"), support(total, "station")];
    for (let i = 1; i < plan.length - 1; i++) {
      const before = plan[i]
        .clone()
        .sub(plan[i - 1])
        .normalize();
      const after = plan[i + 1].clone().sub(plan[i]).normalize();
      if (before.dot(after) < Math.cos((4 * Math.PI) / 180)) supports.push(support(lengths[i], "pylon"));
    }
    supports.sort((a, b) => a.d - b.d);
    const cableAt = (a, b, d) => {
      const t = (d - a.d) / (b.d - a.d);
      return a.top + (b.top - a.top) * t - (b.d - a.d) * SAG * 4 * t * (1 - t);
    };
    for (let round = 0; round < 80; round++) {
      let worst = null;
      for (let i = 0; i < supports.length - 1 && !worst; i++) {
        const a = supports[i];
        const b = supports[i + 1];
        let lowest = { clearance: Infinity };
        for (const p of profile) {
          if (p.d <= a.d + PROFILE_STEP || p.d >= b.d - PROFILE_STEP) continue;
          const clearance = cableAt(a, b, p.d) - p.ground;
          if (clearance < lowest.clearance) lowest = { clearance, d: p.d };
        }
        if (lowest.clearance < kind.clearance) worst = lowest.d;
        else if (b.d - a.d > kind.every) worst = (a.d + b.d) / 2;
      }
      if (worst === null) break;
      supports.push(support(worst, "pylon"));
      supports.sort((a, b) => a.d - b.d);
    }
    // Each support's direction (the bends' halfway) and its side, for the two tracks.
    const directionAt = (d) => {
      const { segment } = along(d);
      return plan[segment]
        .clone()
        .sub(plan[segment - 1])
        .setY(0)
        .normalize();
    };
    for (const p of supports) {
      const here = along(p.d).lonLat;
      const direction =
        p.kind === "pylon" && p.d > 1 && p.d < total - 1
          ? directionAt(p.d - 1)
              .add(directionAt(p.d + 1))
              .normalize()
          : directionAt(Math.min(Math.max(p.d, 1), total - 1));
      p.heading = Math.atan2(direction.x, direction.z);
      p.side = new THREE.Vector3(direction.z, 0, -direction.x).multiplyScalar(kind.gauge / 2);
      p.base = local(here, p.ground);
      p.head = local(here, p.top);
      if (p.kind === "station") stations.push({ position: p.base, heading: p.heading, kind, top: p.d > 0 });
      else pylons.push({ position: p.base, height: p.top - p.ground, heading: p.heading, kind });
    }
    // Two tracks, sagging between supports: up on the right, down on the left.
    const track = (sign) => {
      const points = [];
      for (let i = 0; i < supports.length - 1; i++) {
        const a = supports[i];
        const b = supports[i + 1];
        const from = a.head.clone().addScaledVector(a.side, sign);
        const to = b.head.clone().addScaledVector(b.side, sign);
        const parts = Math.max(4, Math.ceil((b.d - a.d) / 25));
        for (let k = 0; k < parts; k++) {
          const t = k / parts;
          const p = from.clone().lerp(to, t);
          p.y -= (b.d - a.d) * SAG * 4 * t * (1 - t);
          points.push(p);
        }
      }
      const last = supports[supports.length - 1];
      points.push(last.head.clone().addScaledVector(last.side, sign));
      return points;
    };
    const up = track(1);
    const down = track(-1).reverse();
    cables.push(up, down);
    if (kind.carrier) {
      const loop = path([...up, ...down]);
      // Speed from the ride time, spacing from the capacity: as the lift runs, when the data has them.
      const speed = lift.duration ? Math.min(12, Math.max(1, total / lift.duration)) : kind.speed;
      const seats = lift.occupancy ?? kind.seats ?? 1;
      const spacing = lift.capacity ? Math.min(400, Math.max(8, (speed * 3600 * seats) / lift.capacity)) : kind.spacing;
      const count = kind.carriers ? kind.carriers * 2 : Math.max(2, Math.floor(loop.length / spacing));
      for (let i = 0; i < count; i++) {
        carriers.push({ loop, offset: (i * loop.length) / count, speed, model: carrierModel(kind, seats, lift) });
      }
    }
  }
  return { pylons, stations, cables, carriers };
}

// Parts of a model in one geometry: [geometry, colour] pairs, coloured per vertex.
function merge(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const color = new THREE.Color();
  for (const [geometry, hex] of parts) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    positions.push(...flat.attributes.position.array);
    normals.push(...flat.attributes.normal.array);
    color.setHex(hex);
    for (let i = 0; i < flat.attributes.position.count; i++) colors.push(color.r, color.g, color.b);
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return merged;
}
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const tube = (top, bottom, h, x = 0, y = 0, z = 0) =>
  new THREE.CylinderGeometry(top, bottom, h, 10).translate(x, y + h / 2, z);
// A horizontal wheel (a bullwheel, a sheave) of radius r at y.
const wheel = (r, y, x = 0, z = 0) => new THREE.CylinderGeometry(r, r, 0.35, 24).translate(x, y, z);

// The carriers, hanging from the cable at their origin (the grip), facing +z, the way they go.
const models = new Map();
function carrierModel(kind, seats, lift) {
  const key = `${kind.carrier}:${seats}:${kind.hang}:${lift.bubble ? 1 : 0}`;
  if (models.has(key)) return key;
  const h = kind.hang;
  let parts;
  if (kind.carrier === "cabin") {
    // A gondola cabin sized by its seats: body, a band of windows, a roof, the hanger.
    const w = 1.5 + 0.09 * seats;
    const body = 2.1 + 0.02 * seats;
    const top = -h;
    parts = [
      [box(0.5, 0.35, 0.8, 0, -0.2, 0), STEEL],
      [box(0.12, h - 0.4, 0.12, 0, -h / 2 - 0.2, -0.25), STEEL],
      [box(0.12, h - 0.4, 0.12, 0, -h / 2 - 0.2, 0.25), STEEL],
      [box(w * 0.8, 0.22, w * 0.8, 0, top - 0.1, 0), STEEL],
      [box(w, body * 0.45, w, 0, top - 0.2 - body * 0.225, 0), GLASS],
      [box(w, body * 0.55, w, 0, top - 0.2 - body * 0.45 - body * 0.275, 0), OWN],
      [box(w * 0.92, 0.12, w * 0.92, 0, top - 0.2 - body - 0.06, 0), STEEL],
    ];
  } else if (kind.carrier === "tram") {
    // A cable car: the carriage on the track ropes, a long hanger, a big cabin.
    const length = Math.min(12, 4 + seats * 0.06);
    parts = [
      [box(1.2, 0.8, 4.5, 0, -0.3, 0), STEEL],
      [box(0.35, h, 0.35, 0, -h / 2 - 0.5, 0), STEEL],
      [box(3.2, 0.3, length * 0.7, 0, -h - 0.5, 0), STEEL],
      [box(3.4, 1.3, length, 0, -h - 1.3, 0), GLASS],
      [box(3.4, 1.7, length, 0, -h - 2.8, 0), OWN],
    ];
  } else if (kind.carrier === "chair") {
    // A chair as wide as its seats: hanger, seat, back, armrests and the safety bar.
    const w = 0.15 + 0.6 * seats;
    const y = -h;
    parts = [
      [box(0.3, 0.3, 0.5, 0, -0.15, 0), STEEL],
      [box(0.1, h - 0.3, 0.1, 0, -h / 2 - 0.15, -0.35), STEEL],
      [box(w, 0.08, 0.08, 0, y + 0.85, -0.35), STEEL],
      [box(w, 0.12, 0.6, 0, y, 0), OWN],
      [box(w, 0.7, 0.1, 0, y + 0.4, -0.32), OWN],
      [box(0.06, 0.3, 0.55, -w / 2, y + 0.2, 0), STEEL],
      [box(0.06, 0.3, 0.55, w / 2, y + 0.2, 0), STEEL],
      [box(w, 0.05, 0.05, 0, y + 0.95, 0.45), STEEL],
      [box(0.05, 0.6, 0.05, -w / 2, y + 0.65, 0.45), STEEL],
      [box(0.05, 0.6, 0.05, w / 2, y + 0.65, 0.45), STEEL],
    ];
    if (lift.bubble) parts.push([box(w + 0.1, 0.9, 0.5, 0, y + 1.2, 0.3), GLASS]);
  } else if (lift.type === "platter") {
    parts = [
      [box(0.25, 0.5, 0.25, 0, -0.25, 0), STEEL],
      [box(0.04, h, 0.04, 0, -h / 2 - 0.5, 0), STEEL],
      [new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16).translate(0, -h - 0.5, 0), OWN],
    ];
  } else {
    parts = [
      [box(0.25, 0.5, 0.25, 0, -0.25, 0), STEEL],
      [box(0.04, h, 0.04, 0, -h / 2 - 0.5, 0), STEEL],
      [box(lift.type === "j-bar" ? 0.55 : 1.1, 0.07, 0.07, lift.type === "j-bar" ? 0.27 : 0, -h - 0.5, 0), OWN],
    ];
  }
  models.set(key, merge(parts));
  return key;
}

// A pylon's head, at its top: the cross arm, and a train of sheaves under each track.
function pylonHead(kind) {
  const g = kind.gauge;
  const train = Math.min(4, 1.2 + kind.pylon / 12);
  return merge([
    [box(g + 1.2, 0.45, 0.45, 0, 0.35, 0), STEEL],
    [box(0.35, 0.35, train, -g / 2, -0.1, 0), STEEL],
    [box(0.35, 0.35, train, g / 2, -0.1, 0), STEEL],
    [box(0.6, 0.1, 0.6, 0, 0.62, 0), STEEL],
  ]);
}

// A station: a base, four posts, a roof in the resort's colour, and the bullwheel under it,
// at the cable's height (0.8 of the station's).
function stationModel(kind) {
  const [w, h, l] = kind.station;
  const posts = [-1, 1].flatMap((x) =>
    [-1, 1].map((z) => [box(0.4, h * 0.45, 0.4, (x * w) / 2.4, h * 0.775, (z * l) / 2.4), STEEL]),
  );
  return merge([
    [box(w, h * 0.55, l, 0, h * 0.275, 0), CONCRETE],
    ...posts,
    [box(w + 0.8, 0.45, l + 0.8, 0, h + 0.2, 0), OWN],
    [wheel(kind.gauge / 2, h * 0.8), STEEL],
  ]);
}

// three.js in MapLibre's WebGL context, sharing its depth with the terrain.
function liftLayer(map, lifts, origin, elevation) {
  let scene;
  let camera;
  let renderer;
  let moving = [];
  let transform;
  const animate = { on: true };
  const material = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
  const layer = {
    id: "lifts-3d",
    type: "custom",
    renderingMode: "3d",
    animate,
    onAdd(_, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      // Light from the north-west, as the hillshading.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.9));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(-1, 1.6, -1);
      scene.add(sun);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      const o = maplibregl.MercatorCoordinate.fromLngLat(origin, 0);
      const s = o.meterInMercatorCoordinateUnits();
      transform = new THREE.Matrix4()
        .makeTranslation(o.x, o.y, o.z)
        .scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      const model = buildLifts(lifts, origin, elevation);
      const q = new THREE.Quaternion();
      const yAxis = new THREE.Vector3(0, 1, 0);
      const one = new THREE.Vector3(1, 1, 1);
      // One instanced mesh per geometry, placed by place(item) => Matrix4.
      const instanced = (geometry, items, place) => {
        const mesh = new THREE.InstancedMesh(geometry, material(), items.length);
        items.forEach((item, i) => {
          mesh.setMatrixAt(i, place(item));
        });
        scene.add(mesh);
      };
      const byKind = (items) => {
        const groups = new Map();
        for (const item of items) {
          if (!groups.has(item.kind)) groups.set(item.kind, []);
          groups.get(item.kind).push(item);
        }
        return groups;
      };
      const shaftGeometry = merge([[tube(0.32, 0.55, 1), STEEL]]);
      const footing = merge([[box(1.8, 0.5, 1.8, 0, 0.2, 0), CONCRETE]]);
      for (const [kind, pylons] of byKind(model.pylons)) {
        instanced(shaftGeometry, pylons, (p) =>
          new THREE.Matrix4().compose(
            p.position,
            q.setFromAxisAngle(yAxis, p.heading),
            new THREE.Vector3(kind.pylon > 6 ? 1 : 0.4, p.height, kind.pylon > 6 ? 1 : 0.4),
          ),
        );
        instanced(footing, pylons, (p) =>
          new THREE.Matrix4().compose(p.position, q.setFromAxisAngle(yAxis, p.heading), one),
        );
        instanced(pylonHead(kind), pylons, (p) =>
          new THREE.Matrix4().compose(
            p.position.clone().setY(p.position.y + p.height),
            q.setFromAxisAngle(yAxis, p.heading),
            one,
          ),
        );
      }
      for (const [kind, stations] of byKind(model.stations)) {
        instanced(stationModel(kind), stations, (p) =>
          new THREE.Matrix4().compose(p.position, q.setFromAxisAngle(yAxis, p.heading), one),
        );
      }
      const segments = [];
      for (const line of model.cables) {
        for (let i = 1; i < line.length; i++) segments.push(line[i - 1], line[i]);
      }
      scene.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(segments),
          new THREE.LineBasicMaterial({ color: CABLE }),
        ),
      );
      // Carriers: one instanced mesh per model, moved every frame.
      const groups = new Map();
      for (const c of model.carriers) {
        if (!groups.has(c.model)) groups.set(c.model, []);
        groups.get(c.model).push(c);
      }
      for (const [key, carriers] of groups) {
        const mesh = new THREE.InstancedMesh(models.get(key), material(), carriers.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);
        moving.push({ mesh, carriers });
      }
      this.place(0);
    },
    place(seconds) {
      const position = new THREE.Vector3();
      const matrix = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const yAxis = new THREE.Vector3(0, 1, 0);
      const one = new THREE.Vector3(1, 1, 1);
      for (const { mesh, carriers } of moving) {
        carriers.forEach((c, i) => {
          const d = (c.offset + seconds * c.speed) % c.loop.length;
          const heading = c.loop.sample(d, position);
          mesh.setMatrixAt(i, matrix.compose(position, q.setFromAxisAngle(yAxis, heading), one));
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    render(_, args) {
      if (animate.on) this.place(performance.now() / 1000);
      camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(transform);
      renderer.resetState();
      renderer.render(scene, camera);
      if (animate.on) map.triggerRepaint();
    },
    onRemove() {
      moving = [];
      renderer?.dispose();
    },
  };
  return layer;
}

// Turning a model, as model viewers do (three.js's OrbitControls, <model-viewer>, Sketchfab), in
// place of the map's gestures: drag to orbit around the middle of the view (sideways turns it,
// up and down tilts it), right-drag or Shift-drag to move it, the wheel or a pinch to zoom.
// On a touch screen one finger orbits and two move, zoom and twist it. Double-click and the
// keyboard stay the map's.
function orbitControls(map) {
  map.dragPan.disable();
  map.dragRotate.disable();
  map.touchZoomRotate.disable();
  map.touchPitch.disable();
  const target = map.getCanvasContainer();
  target.style.cursor = "grab";
  target.style.touchAction = "none";
  target.addEventListener("contextmenu", (e) => e.preventDefault());
  const pointers = new Map();
  let gesture = null;
  // Moving keeps the ground under the pointer under it, as grabbing it would; not by screen
  // pixels, which near the horizon of a tilted view are kilometres.
  const box = () => target.getBoundingClientRect();
  const grab = (fromX, fromY, toX, toY) => {
    const { left, top } = box();
    const from = map.unproject([fromX - left, fromY - top]);
    const to = map.unproject([toX - left, toY - top]);
    if (!from || !to) return;
    const center = map.getCenter();
    map.jumpTo({ center: [center.lng + from.lng - to.lng, center.lat + from.lat - to.lat] });
  };
  const centroid = () => {
    const all = [...pointers.values()];
    return [all.reduce((a, p) => a + p.x, 0) / all.length, all.reduce((a, p) => a + p.y, 0) / all.length];
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return { distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const start = (e) => {
    const touches = [...pointers.values()].filter((p) => p.touch).length;
    if (touches >= 2) {
      const [x, y] = centroid();
      gesture = { kind: "touch", x, y, ...spread(), zoom: map.getZoom(), bearing: map.getBearing() };
    } else {
      const move = e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey || e.metaKey;
      gesture = { kind: move ? "pan" : "orbit", x: e.clientX, y: e.clientY };
    }
    target.style.cursor = "grabbing";
  };
  target.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".maplibregl-ctrl, .maplibregl-popup")) return;
    target.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" });
    map.stop();
    start(e);
  });
  target.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { ...pointers.get(e.pointerId), x: e.clientX, y: e.clientY });
    if (gesture.kind === "orbit") {
      const dx = e.clientX - gesture.x;
      const dy = e.clientY - gesture.y;
      map.jumpTo({
        bearing: map.getBearing() - dx * 0.35,
        pitch: Math.min(map.getMaxPitch(), Math.max(0, map.getPitch() - dy * 0.3)),
      });
    } else if (gesture.kind === "pan") {
      grab(gesture.x, gesture.y, e.clientX, e.clientY);
    } else {
      const [x, y] = centroid();
      const { distance, angle } = spread();
      grab(gesture.x, gesture.y, x, y);
      map.jumpTo({
        zoom: gesture.zoom + Math.log2(distance / gesture.distance),
        bearing: gesture.bearing - ((angle - gesture.angle) * 180) / Math.PI,
      });
      gesture.x = x;
      gesture.y = y;
      return;
    }
    gesture.x = e.clientX;
    gesture.y = e.clientY;
  });
  const end = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    gesture = null;
    target.style.cursor = "grab";
    // A finger lifted from two: the other carries on orbiting from where it is.
    const rest = [...pointers.values()][0];
    if (rest) gesture = { kind: "orbit", x: rest.x, y: rest.y };
  };
  target.addEventListener("pointerup", end);
  target.addEventListener("pointercancel", end);
}

async function show() {
  if (!KEY) {
    showInfo(el("p", {}, t("Open a resort from the map, then its 3D map.")), el("a", { href: "map.html" }, t("Map")));
    return;
  }
  const [index, ski] = await Promise.all([loadIndex(), loadSki()]);
  const r = index.resorts.find((x) => skiKey(x) === KEY);
  if (!r || !ski) throw new Error(KEY);
  const area = ski.resorts.get(KEY);
  const center = skiPoint(r, ski);
  const bounds = area ? geometryBounds(area.geometry) : new maplibregl.LngLatBounds(center, center);
  // A margin for the lifts that leave the outline, and the neighbours around it.
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const margin = new maplibregl.LngLatBounds([sw.lng - 0.03, sw.lat - 0.02], [ne.lng + 0.03, ne.lat + 0.02]);
  const lifts = await liftsIn(ski, margin);
  const own = lifts.filter((l) => l.lr === KEY);

  document.getElementById("updated").textContent = updatedText(index);
  document.getElementById("title").textContent = r.name;
  document.title = `${r.name} – ${t("3D map")} – LiftRadar`;
  const animate = el("input", { type: "checkbox", checked: "" });
  const reset = el("button", { type: "button", class: "reset" }, t("Back to the start view"));
  const status = statusKey(r);
  showInfo(
    el(
      "div",
      {},
      el(
        "span",
        { class: "status-pill", style: `--c:${cssColor(STATUS_COLORS[status].slice(4, -1))}` },
        STATUS_LABELS[status],
      ),
      " ",
      el("span", { class: "where" }, [r.region, countryName(r.country)].filter(Boolean).join(" · ")),
    ),
    el("p", {}, t("Lifts"), ": ", pair(r.lifts?.open, r.lifts?.total)),
    el(
      "p",
      { class: "hint" },
      t(
        "Drag to turn the model; right-drag or Shift-drag to move it; scroll or pinch to zoom. On a phone: one finger turns it, two move and zoom it.",
      ),
    ),
    el("label", {}, animate, t("Moving lifts")),
    reset,
    el(
      "div",
      { class: "links" },
      el("a", { href: resortPage(r) }, t("Resort page")),
      el("a", { href: resortOnMap(r) }, t("Map of all resorts")),
    ),
  );

  // Centred on the area (or the lifts), not on the resort's point at its bottom station.
  const extent = new maplibregl.LngLatBounds();
  if (area) extent.extend(bounds);
  for (const lift of own.length ? own : lifts) for (const c of lift.c) extent.extend([c[0], c[1]]);
  if (extent.isEmpty()) extent.extend(center);
  const middle = extent.getCenter().toArray();
  // The diorama's box: the area with a margin, its base well under the lowest station.
  const padLon = Math.max(0.008, (extent.getEast() - extent.getWest()) * 0.12);
  const padLat = Math.max(0.006, (extent.getNorth() - extent.getSouth()) * 0.12);
  const box = [
    extent.getWest() - padLon,
    extent.getSouth() - padLat,
    extent.getEast() + padLon,
    extent.getNorth() + padLat,
  ];
  const inBox = ([lon, lat]) => lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
  // Only this resort's lifts and pistes: the neighbours' would stand on the edge, or in the air.
  const shown = lifts.filter((lift) => lift.lr === KEY && lift.c.every(inBox));
  const lowest = Math.min(...shown.flatMap((lift) => lift.c.map((c) => c[2] ?? Infinity)));
  registerDiorama(box, Math.max(0, (Number.isFinite(lowest) ? lowest : 1000) - 400));
  const elevation = groundAlong(shown);
  const corners = [
    [box[0], box[1]],
    [box[2], box[1]],
    [box[2], box[3]],
    [box[0], box[3]],
  ];
  const view = startView(corners, own.length ? own : shown, middle);
  const map = await baseMap("map", { ...view, hash: "view" }, { dem: "diorama" });
  orbitControls(map);
  map.addControl(new maplibregl.NavigationControl({ showZoom: false, visualizePitch: true }), "top-left");
  reset.addEventListener("click", () => map.flyTo({ ...view, duration: 1200 }));
  map.addSource("terrain", { type: "raster-dem", encoding: "terrarium", ...DEMS.diorama });
  map.setTerrain({ source: "terrain", exaggeration: 1 });
  const dark = darkMode();
  // Sky, base and the walls the cut leaves all in the page's background, so the box floats on it.
  const background = cssColor("--bg");
  map.setSky({
    "sky-color": background,
    "horizon-color": background,
    "fog-color": background,
    "sky-horizon-blend": 0,
    "horizon-fog-blend": 0,
    "fog-ground-blend": 1,
  });
  // The visible box is a little inside the cut, so the terrain's slope down to the base (one
  // cell of its mesh) is in the background colour too.
  const insetLat = 150 / 111_320;
  const insetLon = insetLat / Math.cos((middle[1] * Math.PI) / 180);
  const ring = [
    [box[0] + insetLon, box[1] + insetLat],
    [box[2] - insetLon, box[1] + insetLat],
    [box[2] - insetLon, box[3] - insetLat],
    [box[0] + insetLon, box[3] - insetLat],
    [box[0] + insetLon, box[1] + insetLat],
  ];
  const world = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  map.addSource("outside", {
    type: "geojson",
    data: { type: "Feature", geometry: { type: "Polygon", coordinates: [world, [...ring].reverse()] } },
  });
  map.addLayer(
    { id: "outside", type: "fill", source: "outside", paint: { "fill-color": background } },
    firstLabel(map),
  );
  const within = ["within", { type: "Polygon", coordinates: [ring] }];
  for (const layer of map.getStyle().layers) {
    if (layer.type === "symbol" && layer.source === "openmaptiles" && layer.id !== "peaks") {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
  map.setFilter("peaks", within);
  map.addLayer({
    id: "places",
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "place",
    filter: ["all", ["in", ["get", "class"], ["literal", ["city", "town", "village", "hamlet"]]], within],
    layout: {
      "text-field": ["coalesce", ["get", LANG === "en" ? "name_en" : `name:${LANG}`], ["get", "name"]],
      "text-font": MAP_FONT,
      "text-size": 12,
    },
    paint: {
      "text-color": dark ? "#ddd" : "#333",
      "text-halo-color": dark ? "#2e3850" : "#fff",
      "text-halo-width": 1.2,
    },
  });
  if (area) {
    map.addSource("area", { type: "geojson", data: area });
    map.addLayer(
      {
        id: "area",
        type: "line",
        source: "area",
        paint: { "line-color": cssColor("--boundary"), "line-width": 2, "line-dasharray": [3, 2] },
      },
      firstLabel(map),
    );
  }
  addPistes(map, ski, { highlight: KEY, names: new Map([[KEY, r.name]]) });
  // The lifts the models draw aren't also lines on the ground; nothing outside the box.
  const ground = ["!", ["in", ["get", "type"], ["literal", AERIAL]]];
  for (const id of ["ski-runs", "ski-runs-dashed", "ski-lifts", "ski-lifts-dashed", "ski-stations", "ski-lift-names"]) {
    const filter = map.getFilter(id);
    const lift = id.startsWith("ski-lift") || id === "ski-stations";
    const mine = ["all", ["==", ["get", "lr"], KEY], within];
    const extra = lift && id !== "ski-lift-names" ? ["all", ground, mine] : mine;
    map.setFilter(id, filter ? ["all", filter, extra] : extra);
  }
  // Pistes drawn as areas: "within" only takes points and lines, so by resort alone.
  map.setFilter("ski-run-areas", ["all", map.getFilter("ski-run-areas"), ["==", ["get", "lr"], KEY]]);
  const layer = liftLayer(map, shown, middle, await elevation);
  map.addLayer(layer, firstLabel(map));
  animate.addEventListener("change", () => {
    layer.animate.on = animate.checked;
    map.triggerRepaint();
  });
}

show().catch((error) => showInfo(el("p", {}, t("The map could not load."), ` (${error.message})`)));
