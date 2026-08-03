# Path to Freedom — Hernando County Resource Map

An interactive map of homelessness and poverty resources across Hernando
County, FL — food pantries, shelters with real overnight beds, thrift/
clothing voucher programs, pet food pantries, transportation, clinics and
mental-health/veteran support, free public workspace (computers, job
search, meeting rooms), shower access (cheapest gym memberships found,
plus free options), legally designated public camping (state forest
primitive zones and developed campgrounds — not a claim that any other
public land is open to overnight stays), and the coordinating agencies
(211, Mid Florida Homeless Coalition, People Helping People, Hernando
Community Coalition, United Way) that tie them together. 77 entries,
researched August 2026 across three passes.

Built with plain HTML/CSS/JS and [Leaflet](https://leafletjs.com/). No
build tools, no API keys, no backend — it runs anywhere that can serve two
static files (`index.html`, `data.js`), including GitHub Pages.

Sibling project to [Florida Cyber Resource
Map](../florida-cyber-map) and [US Cyber Resource
Map](../us-cyber-map) — same architecture, different mission.

## Why this exists

Directories for this population tend to be either stale PDFs passed
hand-to-hand, or generic national databases (findhelp.org, 211.org) that
don't surface the hyper-local detail that actually matters — which
specific church pantry is open *today*, whether a shelter has real beds
right now, which thrift store issues vouchers versus just sells donated
goods. This map exists to put that detail on one screen, sourced and
dated, so it can be kept current instead of forgotten in a drawer.

## Features

- **Category toggles** — show/hide each of 12 categories independently via
  pill chips: shelter, food, multi-service hubs, clinics & mental health,
  clothing, showers (gyms), free computers/workspace, transportation,
  pet food, legal public camping, coordinating agencies, hotlines.
- **Search** — live filter by resource name or city.
- **Resource list** — every visible pin is also listed in the sidebar;
  click a row to fly to it and open its popup.
- **Marker clustering** — dense areas (Spring Hill, Brooksville) collapse
  into count bubbles; clusters expand fully by zoom 13.
- **Near me** — the ◎ button uses browser geolocation to sort the resource
  list by distance (with mileage shown) and drop a pulsing dot at your
  location. Click again to turn it off. Location never leaves the browser.
- **Quick-reference call strip** — the five numbers worth memorizing (211,
  Mid Florida Homeless Coalition, PHP, Dawn Center's 24hr DV hotline,
  Catholic Charities), tap-to-call on mobile.
- **Essential supplies checklist** (collapsible) — ID, SNAP/EBT card, bus
  pass, a free Lifeline cell phone, backpack/tent/sleeping bag — each
  with buttons that jump straight to the map pin (or open the right
  outside link, like the Lifeline provider or Social Security Administration)
  that actually gets you that item.
- Popups show services offered, named sub-programs with their own
  schedules (e.g. PHP's Tuesday clinic vs. its Sunday meal), address,
  phone, hours, and an independent-verification date where one exists.
- Responsive layout (map on top, sidebar below on phones).

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

- `category`: `hub` (multi-service anchor, 3+ aid types under one roof) ·
  `food` · `shelter` (only where there are real overnight beds) ·
  `clothing` · `medical` (clinics, mental health, veteran/PTSD support) ·
  `workspace` (free computers/job search/meeting rooms — libraries,
  CareerSource; also where a real local commissary/shared-use kitchen
  would go if one is ever confirmed — none found in-county as of the
  August 2026 sweep, see "A note on accuracy") · `hygiene` (shower
  access — gyms ranked by cheapest membership found, plus free options
  noted on hub entries like PHP) · `camping` (legally designated public
  camping only — a state forest primitive zone or developed campground,
  never "public land that's probably fine to camp on"; WMA land where
  overnight camping is explicitly prohibited is deliberately excluded,
  not implied as an option) · `coalition` · `transportation` · `pet` ·
  `hotline` (phone-first, no single visitable address)
- **Get `lat`/`lng` from a real geocoder** — the [US Census Bureau
  geocoder](https://geocoding.geo.census.gov/geocoder/) or
  [Nominatim](https://nominatim.openstreetmap.org/) — never eyeball a
  coordinate for a resource someone might actually try to walk or ride a
  bus to. Exception: domestic-violence/youth-crisis shelters and similar
  confidential residential programs, where the location is deliberately
  generalized to the city center — see the Dawn Center, Life Center of
  Hernando, and New Beginnings Youth Shelter rows for the pattern
  (city-center pin + explicit note, never the real/scraped address, even
  if one turns up in a search).
- `services` — cross-cutting need tags independent of category (same idea
  as the cyber map's `topics`): `food`, `shelter`, `medical`, `clothing`,
  `financial`, `transportation`, `petfood`, `snap`, `veterans`, `seniors`,
  `children`, `casework`, `legal`, `dv`, `housing`, `energy`, `headstart`,
  `mentalhealth`, `workspace`, `showers`.
- `idRequired` — plain-language string, **required on every `shelter` and
  `food` row** (optional elsewhere): what someone actually needs to show
  up with. "None published — appears low-barrier" is a legitimate value
  when no requirement could be found; several shelters here explicitly
  do NOT require photo ID (the Dawn Center, deliberately, so a
  domestic-violence survivor with no documents isn't turned away) —
  don't assume a requirement that isn't sourced. For the ~26 individual
  church pantries, this field carries a general county-wide documentation
  pattern (photo ID, Social Security card, proof of Hernando County
  residency) sourced from a directory DayStar Life Center itself compiled
  — explicitly flagged in each entry as a general pattern, not a
  confirmed per-church policy.
- `events` — named sub-programs at one address, each with its own
  schedule (`[{ title, when }]`). Pull only from the org's own published
  info, never invented.
- `verified: "YYYY-MM-DD"` — set when you've independently re-confirmed a
  row via the org's own site or a fresh search, not just carried it over
  from an older list. Rows without it carry a call-ahead caveat in notes
  instead — most of the church/pantry rows are sourced from a countywide
  sheet People Helping People compiled and dated **October 2021**; treat
  those phone numbers and times as a strong starting point, not gospel.
- `county` / `st` — kept on every row, even though today they're all
  `"Hernando"` / `"FL"`, so a future statewide or national pass (same
  growth path the cyber maps took) can filter/group by it without a
  schema change.

### The supplies checklist (`SUPPLIES` in `data.js`)

A separate small array, not `RESOURCES` rows, since these are generic
items rather than places: `{ item, note, links:[{ label, matchName }
or { label, url }] }`. A `matchName` must exactly equal a `RESOURCES`
row's `name` — the UI flies to that pin when clicked. Use `url` instead
for anything with no single local pin (a phone provider's signup page,
the Social Security Administration).

## Growing this map

The schema is built to extend the same way `us-cyber-map` grew out of
`florida-cyber-map`: add rows with a different `county`/`st`, and when a
second county's worth of data exists, introduce a region-style
drill-down UI (see `us-cyber-map/regions.js` and its `STATES.md` for the
pattern) rather than changing how any existing row is shaped.

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
reference compiled from public sources (org websites, findhelp.org, local
news coverage, a congressional office's community resource guide, and
PHP's own countywide pantry sheet) as of August 2026. Hours, food supply,
and voucher availability at volunteer-run pantries change often. **Call
ahead before a special trip.** If you find something stale or wrong,
that's expected for a map this size — the data sweep date and any
`verified` field on each entry tell you how fresh a given row is.

**"Verified" means cross-checked against an independent written source,
never an actual phone call** — this project has no calling capability.
Two entries (Salvation Army's Spring Hill line, Esther's House's
extension) could only be sourced once and carry an explicit
`CONFIDENCE NOTE` in their `notes` field flagging that; everything else
was corroborated across at least two independent sources.

**A real correction, not just a caveat:** researching ID/documentation
requirements for the shelter rows turned up that Jericho Road Ministries'
own current website describes a 5-to-25-month structured recovery
program (Joshua's House for men, Esther's House for women) — not the
walk-in, no-commitment emergency shelter model that third-party shelter
directories (which this map originally relied on for "Mondon Hill" and
"Mary's House") describe. Both framings are kept on the map rather than
one silently overwriting the other: Mary's House's ~3-day emergency
window and Mondon Hill are flagged as unconfirmed against the org's
current materials, while Joshua's/Esther's House are described the way
the org itself currently describes them. If you're triaging where to
send someone tonight, call first — don't assume either framing without
checking.

**Searched for and not found (as of the August 2026 second-pass sweep):**
a real shared-use/commissary kitchen physically located inside Hernando
County. The nearest confirmed one (UF/IFAS's East Pasco Incubator
Kitchen) is in Dade City, a different county — too far to map here as a
local resource. If a Hernando-based one opens, it belongs under the
`workspace` category alongside the libraries and CareerSource.

**If you are in immediate danger, call 911.**

## Credits

Basemap tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, dark theme by [CARTO](https://carto.com/attributions).
Geocoding via the US Census Bureau geocoder and OpenStreetMap Nominatim.
