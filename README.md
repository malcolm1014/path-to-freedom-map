# Path to Freedom — Florida Homelessness & Poverty Resource Map

**[malcolm1014.github.io/path-to-freedom-map](https://malcolm1014.github.io/path-to-freedom-map)**

An interactive, statewide map of homelessness and poverty resources
across all **67 Florida counties** — **1,654 entries** across 15
categories: food pantries, shelters with real overnight beds, thrift/
clothing voucher programs, pet food pantries, transportation (including
live bus routes for two counties), clinics and mental-health/substance-
abuse treatment, dedicated job/employment centers, government social-
welfare offices (Section 8, Medicaid/SNAP/TANF applications, each
district's homeless-student liaison), free public workspace (computers,
meeting rooms), shower access, legally designated public camping, and
the coalitions/hotlines that tie a region together.

Started as a single-county build (Hernando, August 2026) and grew the
same way [US Cyber Resource Map](../us-cyber-map) grew out of
[Florida Cyber Resource Map](../florida-cyber-map) — same plain-HTML/
Leaflet/no-build architecture, wider scope. Built with plain HTML/CSS/JS
and [Leaflet](https://leafletjs.com/). No build tools, no API keys, no
required backend — it runs anywhere that can serve static files,
including GitHub Pages, and works installed offline as a PWA.

## Why this exists

Directories for this population tend to be either stale PDFs passed
hand-to-hand, or generic national databases (findhelp.org, 211.org) that
don't surface the hyper-local detail that actually matters — which
specific church pantry is open *today*, whether a shelter has real beds
right now, which thrift store issues vouchers versus just sells donated
goods. This map exists to put that detail on one screen, sourced and
dated, so it can be kept current instead of forgotten in a drawer.

## Features

**Finding what you need**
- **Searchable county picker** — a keyboard-navigable combobox (not a
  plain `<select>`) covering all 67 counties, also matches a typed ZIP
  code (`FL_ZIP_COUNTY.js`, sourced from the Census Bureau's ZCTA
  relationship file).
- **Category toggles** — show/hide each of 15 categories independently:
  hub, food, shelter, clothing, medical, mentalhealth, coalition,
  transportation, pet, hotline, workspace, hygiene, camping, jobs,
  benefits.
- **Search** — live filter by resource name or city, with an actionable
  empty state naming the specific filter(s) narrowing the results.
- **Near me** — the ◎ button uses browser geolocation to sort the
  resource list by distance and drop a pulsing dot at your location.
  Location never leaves the browser.
- **Resource list** — every visible pin is also listed in the sidebar;
  click a row to fly to it and open its popup. Marker clustering keeps
  dense areas readable.
- Popups show services offered, named sub-programs with their own
  schedules, address, phone, hours, and an independent-verification
  date where one exists.

**Getting there**
- **Bus routes & live positions** (Hernando + Pasco counties, pilot) —
  an opt-in layer showing real GTFS-derived route lines, stop clusters
  with decoded weekday/Saturday/Sunday schedules, and live vehicle
  positions polled from [TriBus](../../thebus-hernando)'s backend.
  Fetched and transformed by `scripts/fetch-bus-data.js` with zero npm
  dependencies, matching this project's existing zero-dependency
  `scripts/` convention.
- **Job search** — a static deep link into
  [CareerOneStop](https://www.careeronestop.org)'s own public job
  finder, pre-filled with the selected county's seat city. No backend,
  no API token, nothing that can go down.
- **Essential supplies checklist** (collapsible) — ID, SNAP/EBT card,
  bus pass, a free Lifeline cell phone, backpack/tent/sleeping bag —
  each with buttons that jump straight to the map pin (or open the
  right outside link) that actually gets you that item.
- **Quick-reference call strip** — the county's most important numbers
  (211, DV hotline, etc.), tap-to-call on mobile.

**Safety & privacy**
- **Quick Exit** — an always-visible button (and double-press Escape)
  that instantly leaves for a neutral page, standard practice on DV/
  crisis-resource sites. Requires two presses so a single stray click
  or Escape can't accidentally exit someone mid-use.
- **Confidential shelter locations** — domestic-violence and some youth
  shelters are deliberately pinned to a generalized city-center
  coordinate rather than a real address, even when one is scraped from
  elsewhere; see any DV-shelter entry's `notes` for the pattern.
- **Clear My Data** — one tap wipes the only things this site persists
  locally (a remembered county/location choice, no accounts or
  tracking) — useful on a shared library computer that doesn't reset
  between patrons.
- Location, once granted, is only ever used client-side.

**Accessibility & reach**
- **English/Spanish toggle** — a UI-wide i18n layer (`data-i18n`
  attributes throughout `index.html`), not just a translated landing
  page.
- **Mobile Map/List tabs** — a full-screen toggle (not a squashed bottom
  sheet), with hardware/gesture back-button support that unwinds one
  level at a time (pin popup → county → statewide → exit).
- **PWA** — installable to a home screen, with an offline-capable
  service worker caching the app shell and previously-viewed map tiles.
- **Outdoor readability** — bigger touch targets and higher-contrast
  colors on mobile, since this userbase is disproportionately outdoors.
- **Per-county static pages** (`county/*.html`) — plain, pre-rendered,
  crawlable HTML with real per-county URLs and JSON-LD structured data,
  auto-regenerated by `scripts/generate-county-pages.js` (also runs in
  CI whenever `data.js` changes) so a search engine has something to
  rank for a hyperlocal query like "food pantry Brooksville FL."
- **Print view** for a paper copy of the current filtered list.

## Editing the data

All resources live in [`data.js`](data.js) — you never need to touch
`index.html` to add or fix an entry. The file's own header comment is the
full schema reference; short version:

```js
{ name:"Example Church Food Pantry", category:"food",
  county:"Hernando", st:"FL", lat:28.4600, lng:-82.5400,
  city:"Spring Hill", url:"", address:"123 Main St, Spring Hill, FL 34608",
  phone:"(352) 555-0100", when:"Tues, 9am–noon",
  services:["food"],
  notes:"Call ahead to confirm — schedules drift." },
```

- `category`: `hub` (multi-service anchor, 3+ aid types under one roof)
  · `food` · `shelter` (only where there are real overnight beds) ·
  `clothing` (thrift/voucher programs) · `medical` (free/low-cost
  clinics) · `mentalhealth` (community mental-health centers, crisis
  stabilization units, substance-abuse treatment — an org whose actual
  mission is behavioral health, distinct from the `medical` category
  and from a `mentalhealth` tag under `services`) · `coalition`
  (coordinating/advocacy agencies, CoC leads) · `transportation` ·
  `pet` (pet food pantries) · `hotline` (phone-first, no single
  visitable address) · `workspace` (free computers/meeting rooms —
  libraries; distinct from `jobs`, whose actual mission is job
  placement, e.g. CareerSource, Vocational Rehabilitation) · `hygiene`
  (shower access — gyms by cheapest membership found, plus free
  options) · `camping` (legally designated public camping only — never
  "public land that's probably fine to camp on") · `jobs` · `benefits`
  (government social-welfare offices you walk into in person — Section
  8 Housing Authority, DCF/ACCESS Florida, a school district's
  homeless-student liaison — distinct from `hotline`).
- **Get `lat`/`lng` from a real geocoder** — the [US Census Bureau
  geocoder](https://geocoding.geo.census.gov/geocoder/) primary,
  [Nominatim](https://nominatim.openstreetmap.org/) as fallback, and
  cross-check the two against each other when they disagree or a match
  looks geographically implausible (the Census geocoder has been caught
  confidently substituting a same-sounding street miles away). Never
  eyeball a coordinate for a resource someone might actually try to walk
  or ride a bus to. Exception: domestic-violence/youth-crisis shelters
  and similar confidential residential programs, where the location is
  deliberately generalized to the city center — see any DV-shelter row
  for the pattern (city-center pin + explicit note, never the real/
  scraped address even if one turns up in a search).
- `services` — cross-cutting need tags independent of category: `food`,
  `shelter`, `medical`, `clothing`, `financial`, `transportation`,
  `petfood`, `snap`, `veterans`, `seniors`, `children`, `casework`,
  `legal`, `dv`, `housing`, `energy`, `headstart`, `mentalhealth`,
  `workspace`, `showers`. Only tag what's actually confirmed offered.
- `idRequired` — plain-language string, **required on every `shelter`
  and `food` row** (optional elsewhere): what someone actually needs to
  show up with. "None published — appears low-barrier" is a legitimate
  value when no requirement could be found — never assume a photo ID is
  required just because that's the norm elsewhere; several shelters
  here explicitly do NOT require one (a deliberate low-barrier practice
  at DV shelters especially).
- `events` — named sub-programs at one address, each with its own
  schedule (`[{ title, when, topics:[] }]`). Pull only from the org's own
  published info, never invented.
- `verified: "YYYY-MM-DD"` — set when a row has been independently
  re-confirmed via the org's own site or a fresh search, not just
  carried over from an older list. Rows without it carry a call-ahead
  caveat in `notes` instead.
- `county` / `st` — kept on every row; the county picker, per-county
  static pages, and coverage tooling all key off this field.

### The supplies checklist (`SUPPLIES` in `data.js`)

A separate small array, not `RESOURCES` rows, since these are generic
items rather than places: `{ item, note, links:[{ label, matchName }
or { label, url }] }`. A `matchName` must exactly equal a `RESOURCES`
row's `name` — the UI flies to that pin when clicked. Use `url` instead
for anything with no single local pin.

### County boundaries (`FL_COUNTY_GEO.js`)

All 67 Florida county boundary polygons, simplified from US Census
Bureau 20m TIGER data via a hand-rolled Douglas-Peucker port
(`scripts/make-fl-counties.js`) — real county-line data, same standard
this project holds `lat`/`lng` geocoding to. `boundary.js` still holds
the original, more-detailed Hernando-only polygon used before the
statewide expansion.

### Bus data (`bus-data.js`, `scripts/fetch-bus-data.js`)

Hernando + Pasco counties' GTFS static feeds, fetched directly from each
transit agency's own published feed URL and transformed with a
hand-rolled ZIP reader + RFC4180 CSV parser (validated against the
reference `adm-zip`/`csv-parse` packages before being trusted). Re-run
`node scripts/fetch-bus-data.js` to refresh; expanding to another county
means adding its GTFS feed URL to the `AGENCIES` config in that script —
most Florida counties don't publish a usable public GTFS feed at all.

## Growing this map

Coverage grew Hernando-only (August 2026) → all 67 counties (statewide
expansion) → two full deepening sweeps → a metro-by-metro deep-dive pass
for the largest, thinnest counties (Duval/Jacksonville was first).
`scripts/audit.js` (duplicate/near-duplicate detection, missing fields,
out-of-bounds coordinates, stale verification dates, thin entries) is
the standing data-quality gate — run it before and after any bulk
data-adding session. `scripts/check-urls.js` sweeps for dead links.

Natural next steps: further metro deep-dives (Miami-Dade, Pinellas, and
other large counties flagged as "first pass only" in earlier sweeps),
expanding the bus layer to a county with a usable public GTFS feed, and
periodic re-verification sweeps as orgs move or close.

## Publishing on GitHub Pages

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Source: Deploy from a branch**, pick
   `main` and `/ (root)`, then save.
3. The map appears at `https://<username>.github.io/<repo>/` within a
   minute or two.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## A note on accuracy

This is not an official or affiliated resource — it's a community
reference compiled from public sources (org websites, findhelp.org,
local news coverage, official county/agency resource guides, and
targeted research passes) across multiple sessions since August 2026.
Hours, food supply, and voucher availability at volunteer-run pantries
change often. **Call ahead before a special trip.** The `verified`
field and each county's most recent commit history tell you how fresh
a given row is.

**"Verified" means cross-checked against an independent written
source, never an actual phone call** — this project has no calling
capability. A small number of entries could only be sourced once and
carry an explicit `CONFIDENCE NOTE` in their `notes` field flagging
that.

**Geocoding honesty:** when an address won't resolve precisely on
either geocoder, this map ships a documented gap note rather than an
imprecise pin — someone will actually try to walk or drive to it. A
candidate resource whose address can't be verified precisely and whose
own website looks unreliable gets dropped rather than guessed.

**If you are in immediate danger, call 911.**

## Credits

Basemap tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, Voyager style by [CARTO](https://carto.com/attributions).
Geocoding via the US Census Bureau geocoder and OpenStreetMap Nominatim.
County boundaries via the US Census Bureau's TIGER/TIGERweb data. Bus
data via Hernando County Transit's and PascoGo's own published GTFS
feeds; live positions via [TriBus](../../thebus-hernando).
