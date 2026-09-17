#!/usr/bin/env node
// Checks every RESOURCES[].url in data.js for reachability. Read-only —
// prints a report, does not modify data.js. Uses a HEAD request first
// (falls back to GET on 405/403, since some servers reject HEAD), with a
// realistic browser User-Agent (some sites block bare Node UAs), limited
// concurrency, and a redirect-follow cap.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '..', 'data.js');
const src = fs.readFileSync(dataPath, 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.__RESOURCES = RESOURCES;', sandbox, { filename: 'data.js' });
const RESOURCES = sandbox.__RESOURCES;

const CONCURRENCY = 12;
const TIMEOUT_MS = 12000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const entries = RESOURCES
  .map((r, i) => ({ i, name: r.name, county: r.county, url: r.url }))
  .filter(e => e.url && e.url.trim());

console.log(`Checking ${entries.length} URLs (concurrency ${CONCURRENCY})...\n`);

async function checkOne(entry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(entry.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA }
    });
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await fetch(entry.url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': UA }
      });
    }
    return { ...entry, status: res.status, ok: res.ok, finalUrl: res.url };
  } catch (err) {
    return { ...entry, status: null, ok: false, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < entries.length) {
      const my = idx++;
      const r = await checkOne(entries[my]);
      results.push(r);
      if (results.length % 100 === 0) console.error(`  ...${results.length}/${entries.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const failed = results.filter(r => !r.ok).sort((a, b) => a.i - b.i);
  const okCount = results.length - failed.length;

  console.log(`\n=== RESULTS: ${okCount}/${results.length} OK, ${failed.length} failed/suspect ===\n`);
  failed.forEach(r => {
    console.log(`[${r.i}] "${r.name}" (${r.county}) — ${r.url}`);
    console.log(`     status=${r.status ?? 'none'} error=${r.error ?? ''}`);
  });

  const outPath = process.env.PTF_URL_CHECK_OUT || path.join(require('os').tmpdir(), 'ptf-url-check-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nFull results written to ${outPath}`);
}

run();
