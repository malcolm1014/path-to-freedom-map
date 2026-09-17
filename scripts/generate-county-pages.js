#!/usr/bin/env node
/* Generates one static, crawlable HTML page per Florida county under
   county/<slug>.html, plus an updated sitemap.xml listing all of them.

   WHY: the main index.html is a single-page Leaflet app — its 1,600+
   resource listings only exist in the DOM after data.js loads and JS
   runs, so a search engine has no distinct URL to rank for a hyperlocal
   query like "food pantry Brooksville FL". These pages are plain,
   pre-rendered HTML (no JS required to read them) with one real URL per
   county, each linking back into the interactive map (pre-filtered via
   the ?county= URL param the main app already supports) for the full
   experience. Deliberately per-COUNTY, not per-resource (1,600 pages) —
   see the SEO research this was based on: county/city is how people
   actually search for this kind of resource, and 67 pages captures
   most of the real value for a fraction of the generated surface area.

   Run via `node scripts/generate-county-pages.js` from the repo root.
   Also run automatically by .github/workflows/generate-county-pages.yml
   whenever data.js changes. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'county');
const SITE_URL = 'https://malcolm1014.github.io/path-to-freedom-map';

// Same 67-county seat-city table as index.html's COUNTY_SEATS (kept as a
// separate copy deliberately — this is a Node build script, not something
// that can import a JS value embedded in an inline <script> tag in HTML;
// county seats are static/stable enough that duplication risk is low).
const COUNTY_SEATS = {
  "Alachua":"Gainesville","Baker":"Macclenny","Bay":"Panama City","Bradford":"Starke",
  "Brevard":"Titusville","Broward":"Fort Lauderdale","Calhoun":"Blountstown",
  "Charlotte":"Punta Gorda","Citrus":"Inverness","Clay":"Green Cove Springs",
  "Collier":"Naples","Columbia":"Lake City","DeSoto":"Arcadia","Dixie":"Cross City",
  "Duval":"Jacksonville","Escambia":"Pensacola","Flagler":"Bunnell","Franklin":"Apalachicola",
  "Gadsden":"Quincy","Gilchrist":"Trenton","Glades":"Moore Haven","Gulf":"Port St. Joe",
  "Hamilton":"Jasper","Hardee":"Wauchula","Hendry":"LaBelle","Hernando":"Brooksville",
  "Highlands":"Sebring","Hillsborough":"Tampa","Holmes":"Bonifay","Indian River":"Vero Beach",
  "Jackson":"Marianna","Jefferson":"Monticello","Lafayette":"Mayo","Lake":"Tavares",
  "Lee":"Fort Myers","Leon":"Tallahassee","Levy":"Bronson","Liberty":"Bristol",
  "Madison":"Madison","Manatee":"Bradenton","Marion":"Ocala","Martin":"Stuart",
  "Miami-Dade":"Miami","Monroe":"Key West","Nassau":"Fernandina Beach","Okaloosa":"Crestview",
  "Okeechobee":"Okeechobee","Orange":"Orlando","Osceola":"Kissimmee","Palm Beach":"West Palm Beach",
  "Pasco":"Dade City","Pinellas":"Clearwater","Polk":"Bartow","Putnam":"Palatka",
  "St. Johns":"St. Augustine","St. Lucie":"Fort Pierce","Santa Rosa":"Milton","Sarasota":"Sarasota",
  "Seminole":"Sanford","Sumter":"Bushnell","Suwannee":"Live Oak","Taylor":"Perry",
  "Union":"Lake Butler","Volusia":"Deland","Wakulla":"Crawfordville","Walton":"DeFuniak Springs",
  "Washington":"Chipley"
};

const CATEGORY_LABELS = {
  shelter:"Shelter (overnight beds)", food:"Food pantries & meals", hub:"Multi-service anchor centers",
  medical:"Clinics & health centers", mentalhealth:"Mental & behavioral health",
  clothing:"Clothing & thrift vouchers", hygiene:"Showers (gyms)", workspace:"Free computers & workspace",
  jobs:"Job centers", benefits:"Government benefits offices", transportation:"Transportation",
  pet:"Pet food pantries", camping:"Legal public camping", coalition:"Coordinating agencies",
  hotline:"Hotlines & crisis lines"
};

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function slugify(county){ return county.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-'); }

function loadResources(){
  const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.__R = RESOURCES;', sandbox, { filename: 'data.js' });
  return sandbox.__R;
}

function renderCountyPage(county, resources){
  const seat = COUNTY_SEATS[county] || county;
  const byCat = {};
  for (const r of resources){
    (byCat[r.category] = byCat[r.category] || []).push(r);
  }
  const catOrder = Object.keys(CATEGORY_LABELS).filter(c => byCat[c]);
  const sectionsHtml = catOrder.map(cat => {
    const items = byCat[cat].map(r => {
      const rows = [];
      if (r.address) rows.push(`<div>${esc(r.address)}</div>`);
      if (r.phone) rows.push(`<div>${esc(r.phone)}</div>`);
      if (r.notes) rows.push(`<div class="notes">${esc(r.notes)}</div>`);
      if (r.url) rows.push(`<div><a href="${esc(r.url)}" rel="noopener">${esc(r.url)}</a></div>`);
      return `<li class="res"><h3>${esc(r.name)}</h3>${rows.join("")}</li>`;
    }).join("\n");
    return `<section><h2>${esc(CATEGORY_LABELS[cat])}</h2><ul>${items}</ul></section>`;
  }).join("\n");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Homelessness & Poverty Resources in ${county} County, FL`,
    "numberOfItems": resources.length,
    "itemListElement": resources.map((r, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "GovernmentService",
        "name": r.name,
        "address": r.address || undefined,
        "telephone": r.phone || undefined,
        "url": r.url || undefined,
      }
    }))
  };

  const title = `Homelessness & Poverty Resources in ${county} County, FL | Path to Freedom`;
  const description = `${resources.length} free or low-barrier resources in ${county} County, Florida (near ${seat}) — food pantries, shelters, clothing, transportation, mental health, and more. Part of the statewide Path to Freedom resource map.`;
  const pageUrl = `${SITE_URL}/county/${slugify(county)}.html`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(pageUrl)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; max-width:760px; margin:0 auto; padding:24px 18px 60px;
        background:#0a0f0c; color:#EAF2EB; line-height:1.5; }
  a{ color:#4FD87A; }
  h1{ font-size:1.5rem; margin-bottom:4px; }
  .sub{ color:#93A896; font-size:.9rem; margin-bottom:18px; }
  .back{ display:inline-block; margin-bottom:20px; padding:8px 14px; border:1px solid rgba(166,190,166,.3);
         border-radius:8px; text-decoration:none; font-size:.85rem; }
  section{ margin-bottom:26px; }
  h2{ font-size:1.05rem; border-bottom:1px solid rgba(166,190,166,.2); padding-bottom:6px; }
  ul{ list-style:none; padding:0; margin:0; }
  li.res{ padding:10px 0; border-bottom:1px solid rgba(166,190,166,.12); }
  li.res h3{ font-size:.95rem; margin:0 0 3px; }
  li.res div{ font-size:.82rem; color:#c7d4c9; }
  li.res .notes{ margin-top:3px; color:#93A896; }
  footer{ margin-top:30px; font-size:.72rem; color:#93A896; }
</style>
</head>
<body>
<h1>${esc(county)} County, Florida</h1>
<p class="sub">${resources.length} homelessness &amp; poverty resources — free interactive map covers all 67 Florida counties.</p>
<a class="back" href="../index.html?county=${encodeURIComponent(county)}">◆ View ${esc(county)} County on the interactive map ↗</a>
${sectionsHtml}
<footer>Part of <a href="../index.html">Path to Freedom</a> — verify hours/services before visiting; in immediate danger, call 911. Not affiliated with any organization listed.</footer>
</body>
</html>
`;
}

function main(){
  const resources = loadResources();
  const byCounty = {};
  for (const r of resources) (byCounty[r.county] = byCounty[r.county] || []).push(r);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const counties = Object.keys(COUNTY_SEATS).sort();
  let written = 0;
  for (const county of counties){
    const list = byCounty[county] || [];
    if (!list.length) { console.log(`skip (no data yet): ${county}`); continue; }
    const html = renderCountyPage(county, list);
    fs.writeFileSync(path.join(OUT_DIR, `${slugify(county)}.html`), html);
    written++;
  }
  console.log(`Wrote ${written} county pages to ${OUT_DIR}`);

  // Regenerate sitemap.xml with the homepage + every county page.
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    ...counties.filter(c => (byCounty[c] || []).length).map(c => ({
      loc: `${SITE_URL}/county/${slugify(c)}.html`, priority: '0.8'
    }))
  ];
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
    `\n</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
  console.log(`Regenerated sitemap.xml with ${urls.length} URLs`);
}

main();
