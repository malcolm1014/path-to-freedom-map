#!/usr/bin/env node
// Data-quality audit for data.js — duplicates, stale verification dates,
// thin entries, missing fields, out-of-bounds coordinates, near-duplicate
// addresses. Read-only: prints findings, does not modify data.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'data.js');
const src = fs.readFileSync(dataPath, 'utf8');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.__RESOURCES = RESOURCES; this.__SUPPLIES = SUPPLIES; this.__QUICK_REF = QUICK_REF;', sandbox, { filename: 'data.js' });

const RESOURCES = sandbox.__RESOURCES;
if (!Array.isArray(RESOURCES)) {
  console.error('Could not load RESOURCES from data.js');
  process.exit(1);
}

console.log(`Loaded ${RESOURCES.length} entries.\n`);

// ---- FL rough bounding box ----
const FL_BOUNDS = { latMin: 24.3, latMax: 31.1, lngMin: -87.7, lngMax: -79.8 };

function normName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|of|the|and|a)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normAddr(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const REQUIRED_FIELDS = ['name', 'category', 'county', 'st', 'lat', 'lng', 'address', 'verified'];

let missingFieldCount = 0;
let outOfBoundsCount = 0;
let staleCount = 0;
let thinCount = 0;

const STALE_CUTOFF = '2026-02-18'; // ~6 months before current date 2026-08-18

console.log('=== MISSING REQUIRED FIELDS ===');
RESOURCES.forEach((r, i) => {
  const missing = REQUIRED_FIELDS.filter(f => r[f] === undefined || r[f] === null || r[f] === '');
  if (missing.length) {
    missingFieldCount++;
    console.log(`  [${i}] "${r.name}" (${r.county}) missing: ${missing.join(', ')}`);
  }
});
if (!missingFieldCount) console.log('  none');

console.log('\n=== OUT-OF-BOUNDS COORDINATES ===');
RESOURCES.forEach((r, i) => {
  if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return;
  if (r.lat < FL_BOUNDS.latMin || r.lat > FL_BOUNDS.latMax ||
      r.lng < FL_BOUNDS.lngMin || r.lng > FL_BOUNDS.lngMax) {
    outOfBoundsCount++;
    console.log(`  [${i}] "${r.name}" (${r.county}) lat=${r.lat} lng=${r.lng}`);
  }
});
if (!outOfBoundsCount) console.log('  none');

console.log(`\n=== STALE VERIFICATION (verified < ${STALE_CUTOFF}) ===`);
RESOURCES.forEach((r, i) => {
  if (r.verified && r.verified < STALE_CUTOFF) {
    staleCount++;
    console.log(`  [${i}] "${r.name}" (${r.county}) verified=${r.verified}`);
  }
});
if (!staleCount) console.log('  none');

console.log('\n=== THIN ENTRIES (no phone AND no url) ===');
RESOURCES.forEach((r, i) => {
  if (!r.phone && !r.url) {
    thinCount++;
    console.log(`  [${i}] "${r.name}" (${r.county}) category=${r.category}`);
  }
});
if (!thinCount) console.log('  none');

console.log('\n=== EXACT DUPLICATE NAMES (same name, same county) ===');
const nameKey = new Map();
RESOURCES.forEach((r, i) => {
  const key = `${normName(r.name)}|${r.county}`;
  if (!nameKey.has(key)) nameKey.set(key, []);
  nameKey.get(key).push(i);
});
let dupNameCount = 0;
for (const [key, idxs] of nameKey) {
  if (idxs.length > 1) {
    dupNameCount++;
    console.log(`  ${idxs.map(i => `[${i}] "${RESOURCES[i].name}"`).join(' == ')}`);
  }
}
if (!dupNameCount) console.log('  none');

console.log('\n=== NEAR-DUPLICATE NAMES (fuzzy match, same county) ===');
let fuzzyNameCount = 0;
const byCounty = new Map();
RESOURCES.forEach((r, i) => {
  if (!byCounty.has(r.county)) byCounty.set(r.county, []);
  byCounty.get(r.county).push(i);
});
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
for (const [county, idxs] of byCounty) {
  for (let a = 0; a < idxs.length; a++) {
    for (let b = a + 1; b < idxs.length; b++) {
      const i1 = idxs[a], i2 = idxs[b];
      const n1 = normName(RESOURCES[i1].name), n2 = normName(RESOURCES[i2].name);
      if (!n1 || !n2 || n1 === n2) continue; // exact dups already caught above
      const dist = levenshtein(n1, n2);
      const maxLen = Math.max(n1.length, n2.length);
      if (dist <= 3 && maxLen > 6) {
        fuzzyNameCount++;
        console.log(`  [${i1}] "${RESOURCES[i1].name}" ~= [${i2}] "${RESOURCES[i2].name}" (dist=${dist})`);
      }
    }
  }
}
if (!fuzzyNameCount) console.log('  none');

console.log('\n=== NEAR-DUPLICATE ADDRESSES (same normalized address, different entries) ===');
const addrKey = new Map();
RESOURCES.forEach((r, i) => {
  const key = normAddr(r.address);
  if (!key) return;
  if (!addrKey.has(key)) addrKey.set(key, []);
  addrKey.get(key).push(i);
});
let dupAddrCount = 0;
for (const [key, idxs] of addrKey) {
  if (idxs.length > 1) {
    const names = new Set(idxs.map(i => normName(RESOURCES[i].name)));
    if (names.size > 1) {
      dupAddrCount++;
      console.log(`  ${idxs.map(i => `[${i}] "${RESOURCES[i].name}"`).join(' + ')} @ "${RESOURCES[idxs[0]].address}"`);
    }
  }
}
if (!dupAddrCount) console.log('  none');

console.log('\n=== NEARBY ENTRIES, DIFFERENT NAMES, SAME CATEGORY (within 0.03 mi — likely same building) ===');
let nearbyCount = 0;
for (let i = 0; i < RESOURCES.length; i++) {
  for (let j = i + 1; j < RESOURCES.length; j++) {
    const r1 = RESOURCES[i], r2 = RESOURCES[j];
    if (r1.county !== r2.county || r1.category !== r2.category) continue;
    if (typeof r1.lat !== 'number' || typeof r2.lat !== 'number') continue;
    const d = haversineMiles(r1.lat, r1.lng, r2.lat, r2.lng);
    if (d < 0.03 && normName(r1.name) !== normName(r2.name)) {
      nearbyCount++;
      console.log(`  [${i}] "${r1.name}" <-> [${j}] "${r2.name}" (${(d * 5280).toFixed(0)} ft apart, both ${r1.category})`);
    }
  }
}
if (!nearbyCount) console.log('  none');

console.log('\n=== SUMMARY ===');
console.log(`  entries: ${RESOURCES.length}`);
console.log(`  missing fields: ${missingFieldCount}`);
console.log(`  out-of-bounds coords: ${outOfBoundsCount}`);
console.log(`  stale (verified < ${STALE_CUTOFF}): ${staleCount}`);
console.log(`  thin (no phone/url): ${thinCount}`);
console.log(`  exact duplicate names: ${dupNameCount}`);
console.log(`  fuzzy duplicate names: ${fuzzyNameCount}`);
console.log(`  duplicate addresses (diff names): ${dupAddrCount}`);
console.log(`  nearby same-category entries: ${nearbyCount}`);
