#!/usr/bin/env node
/* Fetches, parses, and merges public GTFS static feeds for the transit
   agencies this map currently covers routes/schedules for, and writes
   bus-data.js (a plain `const BUS_DATA = {...}` file, loaded the exact
   same way as data.js — no build step, no npm dependency).

   WHY: someone using this map to find a shelter/food pantry/job center
   often also needs to know how to actually GET there. Rather than
   re-discovering and re-parsing each county's GTFS feed from scratch,
   this ETL logic (transform()/mergeAgencyData()/the wire-compaction
   trick) is ADAPTED FROM the sibling `thebus-hernando` repo's TriBus
   backend (backend/src/{gtfsParse,transform,compact}.js), which already
   solved this problem for Hernando + Pasco (+ HART, not yet enabled
   here — see AGENCIES below) and is the actual source these feed URLs
   were originally verified against. This script intentionally does NOT
   depend on that repo or its live Render service at runtime — it's a
   from-scratch, dependency-free port so this repo's own "static site,
   zero npm dependencies, zero backend" architecture stays true. Only the
   WELL-TESTED transform logic was ported; TriBus's own app-specific
   features (offline query engine, live bus positions, LLM-based alias
   enrichment) are deliberately left out — this map only needs routes,
   stops, and schedules to draw a map layer + show timetables.

   No npm deps: ZIP extraction uses Node's built-in zlib (raw deflate,
   same as what a .zip's "deflate" compression method actually is) via a
   ~70-line central-directory reader; CSV parsing is a small hand-rolled
   RFC4180 parser. Both were validated byte-for-byte / row-for-row
   against the real `adm-zip`/`csv-parse` packages (the ones TriBus's
   backend actually uses) on both live feeds before being trusted here.

   Run via `node scripts/fetch-bus-data.js` from the repo root. Also run
   automatically by .github/workflows/fetch-bus-data.yml on a weekly
   schedule, since GTFS schedules change periodically and this file has
   no other freshness mechanism (unlike data.js's per-entry `verified`
   dates, this is all-or-nothing per agency). */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'bus-data.js');

// Only Hernando + Pasco are enabled here (2026-09-18 pilot, explicitly
// scoped down from TriBus's 3-agency coverage rather than shipping HART
// Tampa/Hillsborough sight-unseen — see the project memory entry this
// commit's message points to). Both feed URLs are the agencies' own
// hosted GTFS static feeds (not a third-party aggregator), the same URLs
// TriBus's backend/.env.example documents as independently verified live.
const AGENCIES = [
  { id: 'hernando', label: 'Hernando County Transit (TheBus)', county: 'Hernando',
    feedUrl: 'https://www.hernandocounty.us/media/u5visq0k/gtfs-file.zip' },
  { id: 'pasco', label: 'Pasco County Public Transportation (GoPasco)', county: 'Pasco',
    feedUrl: 'https://gopasco.rideralerts.com/InfoPoint/gtfs-zip.ashx' },
];

/* ============ ZIP reader (pure Node built-ins, no ZIP64 support —
   GTFS feeds are a few MB, nowhere near the 4GB ZIP64 threshold; this
   throws loudly rather than silently mis-reading one if that ever
   changes) ============ */
const EOCD_SIG = 0x06054b50, CDFH_SIG = 0x02014b50, LFH_SIG = 0x04034b50;

function findEOCD(buf) {
  const start = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('not a valid zip: End Of Central Directory record not found');
}

function unzip(buf) {
  const eocdOffset = findEOCD(buf);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdCount = buf.readUInt16LE(eocdOffset + 10);
  if (cdOffset === 0xffffffff || cdCount === 0xffff) throw new Error('ZIP64 archives are not supported by this minimal reader');

  const entries = new Map();
  let p = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(p) !== CDFH_SIG) throw new Error(`bad central directory entry at offset ${p}`);
    const compressionMethod = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) throw new Error(`ZIP64 entry "${name}" is not supported`);
    if (!name.endsWith('/')) entries.set(name, { compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const out = new Map();
  for (const [name, meta] of entries) {
    const lp = meta.localHeaderOffset;
    if (buf.readUInt32LE(lp) !== LFH_SIG) throw new Error(`bad local file header for "${name}" at offset ${lp}`);
    const lNameLen = buf.readUInt16LE(lp + 26);
    const lExtraLen = buf.readUInt16LE(lp + 28);
    const dataStart = lp + 30 + lNameLen + lExtraLen;
    const compressed = buf.subarray(dataStart, dataStart + meta.compressedSize);
    let data;
    if (meta.compressionMethod === 0) data = compressed;
    else if (meta.compressionMethod === 8) data = zlib.inflateRawSync(compressed);
    else throw new Error(`unsupported compression method ${meta.compressionMethod} for "${name}"`);
    if (data.length !== meta.uncompressedSize) throw new Error(`size mismatch for "${name}": expected ${meta.uncompressedSize}, got ${data.length}`);
    out.set(name, data);
  }
  return out;
}

/* ============ CSV reader (pure Node built-ins, RFC4180) ============ */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  const n = text.length;
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); if (!(row.length === 1 && row[0] === '')) rows.push(row); row = []; };
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { endField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { endRow(); i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) endRow();
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (r[idx] !== undefined ? r[idx] : '').trim(); });
    return obj;
  });
}

/* ============ GTFS fetch + parse ============ */
async function fetchGtfs(agency) {
  console.log(`[fetch-bus-data] [${agency.id}] downloading ${agency.feedUrl}`);
  const res = await fetch(agency.feedUrl);
  if (!res.ok) throw new Error(`GTFS download failed for ${agency.id}: HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`[fetch-bus-data] [${agency.id}] downloaded ${buf.length} bytes, unzipping`);
  return unzip(buf);
}

function parseAllGtfs(files) {
  const read = (name) => {
    const buf = files.get(name);
    if (!buf) return [];
    return parseCsv(buf.toString('utf8'));
  };
  return {
    agency: read('agency.txt'),
    routes: read('routes.txt'),
    trips: read('trips.txt'),
    stops: read('stops.txt'),
    stopTimes: read('stop_times.txt'),
    calendar: read('calendar.txt'),
    calendarDates: read('calendar_dates.txt'),
    frequencies: read('frequencies.txt'),
    shapes: read('shapes.txt'),
  };
}

/** GTFS "HH:MM:SS" -> minutes past midnight. Hours >= 24 (past-midnight trips) are preserved as-is. */
function gtfsTimeToMinutes(hhmmss) {
  if (!hhmmss) return null;
  const [h, m, s] = hhmmss.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m + (s ? s / 60 : 0);
}

/* ============ shape simplification (Douglas-Peucker, same technique/
   tolerance as this project's regions.js and TriBus's transform.js) ============ */
const SHAPE_SIMPLIFY_TOLERANCE_METERS = 8;

function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const ct = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + ct * dx), p.y - (a.y + ct * dy));
}
function douglasPeucker(pts, eps) {
  if (pts.length < 3) return pts;
  let maxDist = 0, index = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[end]);
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist > eps) {
    const left = douglasPeucker(pts.slice(0, index + 1), eps);
    const right = douglasPeucker(pts.slice(index), eps);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[end]];
}
function simplifyShapePoints(latLonPoints, toleranceMeters) {
  if (latLonPoints.length < 3) return latLonPoints;
  const avgLat = latLonPoints.reduce((sum, p) => sum + p[0], 0) / latLonPoints.length;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((avgLat * Math.PI) / 180);
  const pts = latLonPoints.map(([lat, lon]) => ({ lat, lon, x: lon * metersPerDegLon, y: lat * metersPerDegLat }));
  return douglasPeucker(pts, toleranceMeters).map((p) => [p.lat, p.lon]);
}

/* ============ transform: flatten relational GTFS tables into a
   stop-keyed + route-keyed structure, namespaced per agency so several
   agencies can merge with zero id collisions ============ */
function transform({ agency, routes, trips, stops, stopTimes, calendar, calendarDates, frequencies, shapes }, agencyMeta) {
  const ns = (id) => `${agencyMeta.id}:${id}`;
  const agencyTimezone = (agency[0] && agency[0].agency_timezone) || 'America/New_York';

  if (frequencies && frequencies.length > 0) {
    throw new Error(`[${agencyMeta.id}] frequencies.txt has ${frequencies.length} row(s) -- headway-based trips are not supported by this transform`);
  }

  const services = {};
  for (const c of calendar) {
    services[ns(c.service_id)] = {
      monday: c.monday === '1', tuesday: c.tuesday === '1', wednesday: c.wednesday === '1',
      thursday: c.thursday === '1', friday: c.friday === '1', saturday: c.saturday === '1', sunday: c.sunday === '1',
      startDate: c.start_date, endDate: c.end_date, addedDates: [], removedDates: [],
    };
  }
  for (const cd of calendarDates) {
    const key = ns(cd.service_id);
    if (!services[key]) {
      services[key] = { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false, startDate: null, endDate: null, addedDates: [], removedDates: [] };
    }
    if (cd.exception_type === '1') services[key].addedDates.push(cd.date);
    else if (cd.exception_type === '2') services[key].removedDates.push(cd.date);
  }

  const rawShapePointsById = new Map();
  for (const pt of shapes) {
    if (!rawShapePointsById.has(pt.shape_id)) rawShapePointsById.set(pt.shape_id, []);
    rawShapePointsById.get(pt.shape_id).push({ seq: Number(pt.shape_pt_sequence), point: [Number(pt.shape_pt_lat), Number(pt.shape_pt_lon)] });
  }
  const shapePointsById = new Map();
  for (const [shapeId, pts] of rawShapePointsById) {
    pts.sort((a, b) => a.seq - b.seq);
    shapePointsById.set(shapeId, simplifyShapePoints(pts.map((p) => p.point), SHAPE_SIMPLIFY_TOLERANCE_METERS));
  }

  const routeById = {};
  for (const r of routes) {
    routeById[ns(r.route_id)] = {
      id: ns(r.route_id), shortName: r.route_short_name || '', longName: r.route_long_name || '',
      color: r.route_color ? `#${r.route_color}` : null, textColor: r.route_text_color ? `#${r.route_text_color}` : null,
      stopIds: [], shapePoints: [], agencyId: agencyMeta.id, agencyLabel: agencyMeta.label,
    };
  }

  const tripInfo = {};
  for (const t of trips) {
    tripInfo[ns(t.trip_id)] = { routeId: ns(t.route_id), serviceId: ns(t.service_id), headsign: t.trip_headsign || '', shapeId: t.shape_id || null };
  }

  const stopById = {};
  for (const s of stops) {
    stopById[ns(s.stop_id)] = {
      id: ns(s.stop_id), name: s.stop_name || s.stop_id,
      lat: s.stop_lat ? Number(s.stop_lat) : null, lon: s.stop_lon ? Number(s.stop_lon) : null,
      routesById: {}, agencyId: agencyMeta.id, agencyLabel: agencyMeta.label,
    };
  }

  const stopTimesByTrip = new Map();
  for (const st of stopTimes) {
    const tripKey = ns(st.trip_id);
    if (!stopTimesByTrip.has(tripKey)) stopTimesByTrip.set(tripKey, []);
    stopTimesByTrip.get(tripKey).push(st);
  }

  const seenRouteStops = new Map();
  for (const [tripId, rows] of stopTimesByTrip) {
    const trip = tripInfo[tripId];
    if (!trip) continue;
    const route = routeById[trip.routeId];
    if (!route) continue;

    rows.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));

    if (!trip.headsign) {
      const lastStopId = ns(rows[rows.length - 1].stop_id);
      trip.headsign = stopById[lastStopId] ? stopById[lastStopId].name : '';
    }
    if (route.shapePoints.length === 0 && trip.shapeId && shapePointsById.has(trip.shapeId)) {
      route.shapePoints = shapePointsById.get(trip.shapeId);
    }

    if (!seenRouteStops.has(route.id)) seenRouteStops.set(route.id, new Set());
    const seenSet = seenRouteStops.get(route.id);

    for (const st of rows) {
      const stopId = ns(st.stop_id);
      const stop = stopById[stopId];
      if (!stop) continue;
      if (!seenSet.has(stopId)) { seenSet.add(stopId); route.stopIds.push(stopId); }

      // A stop_time row places a stop on a route regardless of whether
      // THIS row has a usable time (GTFS leaves arrival/departure blank
      // for non-timepoint stops meant to be interpolated) -- record the
      // stop-route relationship unconditionally, only a displayable
      // arrival time requires a valid `minutes` below.
      if (!stop.routesById[route.id]) {
        stop.routesById[route.id] = { routeId: route.id, shortName: route.shortName, longName: route.longName, color: route.color, arrivals: [], agencyId: agencyMeta.id, agencyLabel: agencyMeta.label };
      }
      const minutes = gtfsTimeToMinutes(st.arrival_time || st.departure_time);
      if (minutes === null) continue;
      stop.routesById[route.id].arrivals.push({ tripId, serviceId: trip.serviceId, headsign: trip.headsign, minutes });
    }
  }

  const stopsOut = {};
  for (const stop of Object.values(stopById)) {
    const routesArr = Object.values(stop.routesById);
    for (const r of routesArr) r.arrivals.sort((a, b) => a.minutes - b.minutes);
    stopsOut[stop.id] = { id: stop.id, name: stop.name, lat: stop.lat, lon: stop.lon, routes: routesArr, agencyId: stop.agencyId, agencyLabel: stop.agencyLabel };
  }
  const routesOut = {};
  for (const r of Object.values(routeById)) routesOut[r.id] = r;

  return { agencyTimezone, services, routes: routesOut, stops: stopsOut };
}

function mergeAgencyData(agencyResults) {
  const merged = { generatedAt: new Date().toISOString(), agencyTimezone: 'America/New_York', agencies: {}, services: {}, routes: {}, stops: {} };
  for (const { id, label, county, timezone, data } of agencyResults) {
    merged.agencies[id] = { label, county, timezone, stopCount: Object.keys(data.stops).length, routeCount: Object.keys(data.routes).length };
    Object.assign(merged.services, data.services);
    Object.assign(merged.routes, data.routes);
    Object.assign(merged.stops, data.stops);
  }
  return merged;
}

/* ============ wire compaction: intern arrival tripId/serviceId/headsign
   strings into one shared pool, store each arrival as a compact 4-element
   array instead of a 4-key object -- same trick as TriBus's compact.js,
   ported because it meaningfully shrinks this file too (arrivals are the
   overwhelming majority of the payload here as well). ============ */
function compactForWire(data) {
  const pool = [];
  const poolIndexByString = new Map();
  function intern(str) {
    const key = str || '';
    const existing = poolIndexByString.get(key);
    if (existing !== undefined) return existing;
    const idx = pool.length;
    pool.push(key);
    poolIndexByString.set(key, idx);
    return idx;
  }
  const stops = {};
  for (const [stopId, stop] of Object.entries(data.stops)) {
    stops[stopId] = { ...stop, routes: stop.routes.map((r) => ({ ...r, arrivals: r.arrivals.map((a) => [intern(a.tripId), intern(a.serviceId), intern(a.headsign), a.minutes]) })) };
  }
  return { ...data, stops, stringPool: pool };
}

/** Refuses to trust a dataset that looks like a broken/truncated feed pull rather than a real update. */
function isSuspiciouslySmaller(previous, next) {
  if (!previous) return false;
  const prevStops = Object.keys(previous.stops || {}).length;
  const prevRoutes = Object.keys(previous.routes || {}).length;
  const nextStops = Object.keys(next.stops).length;
  const nextRoutes = Object.keys(next.routes).length;
  if (prevStops === 0 || prevRoutes === 0) return false;
  return nextStops < prevStops * 0.5 || nextRoutes < prevRoutes * 0.5;
}

function readPreviousBusData() {
  if (!fs.existsSync(OUT_PATH)) return null;
  try {
    const src = fs.readFileSync(OUT_PATH, 'utf8');
    const match = src.match(/^const BUS_DATA = (\{[\s\S]*\});\s*$/);
    if (!match) return null;
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function main() {
  const previous = readPreviousBusData();
  const results = [];
  for (const agency of AGENCIES) {
    const files = await fetchGtfs(agency);
    const tables = parseAllGtfs(files);
    const data = transform(tables, agency);
    results.push({ id: agency.id, label: agency.label, county: agency.county, timezone: data.agencyTimezone, data });
    console.log(`[fetch-bus-data] [${agency.id}] parsed ${Object.keys(data.routes).length} routes, ${Object.keys(data.stops).length} stops`);
  }

  const merged = mergeAgencyData(results);
  if (isSuspiciouslySmaller(previous, merged)) {
    const prevStops = Object.keys(previous.stops).length, prevRoutes = Object.keys(previous.routes).length;
    const nextStops = Object.keys(merged.stops).length, nextRoutes = Object.keys(merged.routes).length;
    throw new Error(`refusing to overwrite bus-data.js: new pull has ${nextRoutes} routes/${nextStops} stops vs previous ${prevRoutes} routes/${prevStops} stops (>50% drop) -- looks like a broken feed, not a real schedule change`);
  }

  const compact = compactForWire(merged);
  const json = JSON.stringify(compact);
  const out = `// AUTO-GENERATED by scripts/fetch-bus-data.js -- do not hand-edit.\n// Bus route/stop/schedule data for counties this map covers transit for.\n// Regenerate with: node scripts/fetch-bus-data.js\nconst BUS_DATA = ${json};\n`;
  fs.writeFileSync(OUT_PATH, out);

  const totalRoutes = Object.keys(merged.routes).length;
  const totalStops = Object.keys(merged.stops).length;
  console.log(`[fetch-bus-data] wrote ${OUT_PATH} (${(out.length / 1024).toFixed(0)}KB) -- ${AGENCIES.length} agencies, ${totalRoutes} routes, ${totalStops} stops total`);
}

main().catch((err) => {
  console.error('[fetch-bus-data] FAILED:', err);
  process.exitCode = 1;
});
