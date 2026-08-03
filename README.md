# Path to Freedom — Hernando County Resource Map

An interactive map of homelessness and poverty resources across Hernando
County, FL — food pantries, shelters with real overnight beds, thrift/
clothing voucher programs, pet food pantries, transportation, medical
clinics, and the coordinating agencies (211, Mid Florida Homeless
Coalition, People Helping People, Hernando Community Coalition) that tie
them together. 51 entries, researched August 2026.

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

- **Category toggles** — show/hide each of 8 categories independently via
  pill chips: shelter, food, multi-service hubs, clothing, transportation,
  pet food, coordinating agencies, hotlines.
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
  `clothing` · `medical` · `coalition` · `transportation` · `pet` ·
  `hotline` (phone-first, no single visitable address)
- **Get `lat`/`lng` from a real geocoder** — the [US Census Bureau
  geocoder](https://geocoding.geo.census.gov/geocoder/) or
  [Nominatim](https://nominatim.openstreetmap.org/) — never eyeball a
  coordinate for a resource someone might actually try to walk or ride a
  bus to. Exception: domestic-violence shelters, where the location is
  deliberately kept confidential — see the Dawn Center row for the pattern
  (city-center pin + explicit note, never the real address).
- `services` — cross-cutting need tags independent of category (same idea
  as the cyber map's `topics`): `food`, `shelter`, `medical`, `clothing`,
  `financial`, `transportation`, `petfood`, `snap`, `veterans`, `seniors`,
  `children`, `casework`, `legal`, `dv`, `housing`, `energy`, `headstart`.
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
reference compiled from public sources (org websites, findhelp.org,
2600 news coverage, and PHP's own countywide pantry sheet) as of August
2026. Hours, food supply, and voucher availability at volunteer-run
pantries change often. **Call ahead before a special trip.** If you find
something stale or wrong, that's expected for a map this size — the data
sweep date and any `verified` field on each entry tell you how fresh a
given row is.

**If you are in immediate danger, call 911.**

## Credits

Basemap tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, dark theme by [CARTO](https://carto.com/attributions).
Geocoding via the US Census Bureau geocoder and OpenStreetMap Nominatim.
