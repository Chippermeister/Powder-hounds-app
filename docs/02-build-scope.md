# Phase 2 — Build Scope

Status: **APPROVED 2026-09-25**. Note: M0 uses oxlint (current Vite default, much faster) instead of ESLint.
Inputs: `01-data-sources.md` (approved), v1 area = western US + BC/AB (~150 resorts).

---

## What v1 is (and isn't)

**v1 is:** a full-screen map of ~150 western resorts, an animated live radar with a **snow-rate** mode,
and a tap-a-pin card showing forecast (base/summit), measured recent snowfall, season-to-date, webcam link and
official site. It installs to a phone home screen (PWA) and works well one-handed.

**v1 is not:** accounts, alerts/push, quality scoring/ML, trip planning, native store apps, East Coast or global.
Each of these is a good v2 item. Leaving them out is what makes v1 shippable.

---

## Proposed stack (each needs your 👍)

### 1. Front end: React + TypeScript + Vite, shipped as a PWA

- **Why React:** biggest ecosystem and hiring signal for a portfolio. **Why TypeScript:** our data comes from
  7+ APIs with different shapes, and types catch "summit_in vs summitIn" bugs before users do.
- **Why Vite, not Next.js:** Next.js shines with server rendering and a backend. Our app is a client-side map
  reading pre-built JSON, so Next adds concepts without adding value. Vite gives a plain static site that can be hosted anywhere for free.
- **Why PWA first:** one codebase that installs on iOS and Android today. Later, **Capacitor** wraps the _same_
  web app into App Store / Play Store binaries without a rewrite.

### 2. Map: MapLibre GL JS (not Leaflet)

- **Lesson: raster vs. vector maps.** Leaflet (what Powder Chaser uses) moves pre-drawn image tiles around with the CPU.
  MapLibre draws the map on the GPU (WebGL), so zoom and pan are smooth at 60 fps, labels stay crisp,
  and we get **3D terrain and hillshading**, which matters a lot for a mountain app. That smoothness is the "Apple feel."
- Open source (BSD), no API key, and it takes WMS radar images as a raster layer.

### 3. Basemap: OpenFreeMap + AWS open terrain tiles

- **OpenFreeMap:** free vector basemap from OpenStreetMap data, no key, no usage caps, commercial use allowed with attribution.
- **Terrain:** the AWS Open Data "Terrain Tiles" (Terrarium format) give free elevation for hillshade and 3D.
- Upgrade path: self-host Protomaps PMTiles if we ever outgrow either.

### 4. Data pipeline: TypeScript scripts run hourly by GitHub Actions

- One language across the whole repo, with shared types between the pipeline and the UI.
- An hourly Action fetches NWS / Open-Meteo / SNOTEL / NOHRSC, writes `resorts/{id}.json` + `index.json`,
  and **deploys them as static files**. No server, no database, $0.
- **Lesson:** we don't commit the generated JSON to git. Hourly data commits would bloat history.
  The Action publishes build output straight to hosting instead.
- NOHRSC values are point-sampled through its ArcGIS "identify" endpoint (JSON), so we skip parsing GRIB files.

### 5. Hosting: Cloudflare Pages (free)

- Static hosting + global CDN, and **Cloudflare Workers** available if we need a small proxy (see Risk A).
- The GitHub Pages alternative works but has no proxy option.

### 6. UI toolkit: Tailwind CSS + a small set of our own components

- Apple-style design tokens: system font (`-apple-system` / SF Pro), 8-pt spacing, translucent "glass" panels
  (`backdrop-filter`), light/dark from OS setting, a draggable **bottom sheet** on phones and a side card on desktop.
- Charts: tiny hand-rolled SVG bars for snowfall history (lighter and more "Apple" than a chart library).

### 7. Drive time: deferred to M5; v1.0 shows straight-line distance

- Browser geolocation gives the user's position. Straight-line miles cost nothing and need no API.
- For real drive times, the candidates are OpenRouteService Matrix (free key, daily quota), the Mapbox Matrix API (free monthly tier),
  or self-hosted OSRM. **Each one's commercial terms will be verified before we choose.** Decision at M5.

### 8. Quality: Vitest (unit tests), Playwright (browser smoke test), ESLint + Prettier, CI on every push.

---

## Milestones

The order follows one principle: **de-risk the scariest thing first.** The radar is both the centerpiece and
the biggest technical unknown, so it comes right after the empty map.

| #      | Milestone           | Done when                                                                                                                                           |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** | Scaffold            | Vite + React + TS app, lint/test/CI green, deploys an empty page                                                                                    |
| **M1** | Map + radar spike   | Full-screen MapLibre map with terrain, **animated MRMS radar**, snow-rate toggle, timeline scrubber. Throwaway-quality OK. Proves Risk A is solved. |
| **M2** | Resorts on the map  | ~150 resorts from OpenSkiMap + curated overrides (`data/resorts.curated.json`): pins, clustering, tap → card with blurb, webcam and site links      |
| **M3** | Forecast pipeline   | Hourly Action → per-resort JSON: NWS 7-day snowfall + Open-Meteo base/summit; card shows it                                                         |
| **M4** | Observed snow       | SNOTEL station matching + NOHRSC 24/72h/season values; history bars; optional NOHRSC 72h map layer                                                  |
| **M5** | Polish + drive time | Bottom sheet, dark mode, PWA install, drive-time provider, accessibility pass, Lighthouse ≥ 90. Plus the pre-M5 UI review decisions below           |
| —      | Phase 3: Reporting  | README write-up, architecture diagram, demo GIF, lessons learned                                                                                    |

Each milestone ends with a commit (or a few) and a check-in with you.

---

## Risks to check early

**A. CORS on radar images (highest risk, checked in M1).** ✅ **Resolved in M1: no proxy needed.**
_Lesson:_ WebGL can only draw images from another domain if that server sends an `Access-Control-Allow-Origin`
header. Leaflet doesn't care, but MapLibre does. If nowCOAST or GeoMet don't send it, we add a ~20-line
Cloudflare Worker that proxies and caches tiles. That's also good for reducing load on the NOAA servers.

**B. Exact WMS layer names/time formats** ✅ **Verified in M1** (see "M1 findings" below).

**C. Curating ~150 resorts** (blurbs, webcam URLs) is real manual work: roughly an evening or two.
Plan: I generate a draft from OpenSkiMap + each resort's site, and you review.

**D. Sandbox network access.** These hosts need allowing in the environment's network settings to develop here:
`api.weather.gov`, `nowcoast.noaa.gov`, `mapservices.weather.noaa.gov`, `geo.weather.gc.ca`,
`api.open-meteo.com`, `wcc.sc.egov.usda.gov`, `www.nohrsc.noaa.gov`, `data.rcc-acis.org`,
`openskidata.org` (plus its download host), `tiles.openfreemap.org`, `s3.amazonaws.com` (terrain tiles).

---

## Decisions needed now

1. Approve the stack (§1–8), or name what to change.
2. Approve the milestone order (radar spike before resorts).
3. Hosting: Cloudflare Pages needs a free Cloudflare account on your side, which isn't needed until the first deploy.

---

## M1 findings (verified live 2026-09-25)

| Product   | WMS endpoint                                                                                                             | Layer                            | Time dimension                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| Radar     | `nowcoast.noaa.gov/geoserver/weather_radar/conus_base_reflectivity_mosaic/ows` (per-layer: 10 KB capabilities vs 230 KB) | `conus_base_reflectivity_mosaic` | Comma list, ~4 min apart, ~8 h history, snaps to nearest               |
| Snow rate | `geo.weather.gc.ca/geomet`                                                                                               | `RADAR_1KM_RSNO`                 | Interval `start/end/PT6M`, 3 h history, **exact times only** (no snap) |

- **CORS:** both servers send `Access-Control-Allow-Origin: *` on capabilities _and_ GetMap images. No Cloudflare Worker needed.
- **Coverage:** the nowCOAST "conus" MRMS mosaic reaches into southern BC/AB. GeoMet covers all of North America.
- **Snow rate is not precipitation type.** `RSNO` converts radar returns to a snowfall rate everywhere, including where it's raining.
  It's the right "how hard is it dumping" layer for mountains, but can't tell rain from snow on its own.
- **Tiles:** 512 px WMS tiles; each frame is its own MapLibre layer, preloaded at opacity 0. Animating just swaps opacity.
- **MapLibre 6 + Vite:** the worker must be built via `?worker&url` + `setWorkerUrl()`, with `worker.format: 'es'`.
- **Bundle:** MapLibre makes the JS chunk ~1.25 MB (350 KB gzip). Code-split in M5 for Lighthouse.

---

## M2 findings (2026-09-26)

- **Source:** `tiles.openskimap.org/geojson/ski_areas.geojson` (~12,300 ski areas worldwide). `npm run resorts:fetch`
  writes `data/resorts.openskimap.json`. Region lives in `properties.places[].iso3166_2` (a list: cross-border areas have several).
- **Filter:** v1 regions, `status: operating`, downhill, ≥ 250 m vertical, ≥ 1 lift → **163 candidates**
  (BC 34, CO 26, CA 19, UT 16, MT 14, ID 12, WA 11, OR 8, WY 8, NM 8, AB 7, NV 3, AZ 2).
- **Curation:** `data/resorts.curated.json` = `exclude` (id → reason) + `resorts` (id → optional overrides:
  `name`, `blurb`, `webcamUrl`, `website`, `lat`, `lon`). A test fails if a curated id no longer matches a candidate.
  First pass: 20 marquee resorts have blurbs; 15 have verified webcam links. Whistler, Kirkwood, Crystal and Steamboat
  sit behind bot protection (can't verify from a script); Mt. Baker has no webcam page.
- **Map:** MapLibre's built-in clustering (`cluster: true`, splits by zoom 9). Tap a cluster → zoom to where it splits;
  tap a pin → card (summit, vertical, lifts, blurb, webcam + website buttons). Screenshots: `m2-resorts.png`, `m2-card.png`.
- **Known issue for M5:** on phones the attribution line overlaps the radar panel.

## M3 findings (2026-09-26)

- **Pipeline:** `npm run forecast` (`scripts/fetch-forecast.ts`) writes `public/forecast/{id}.json` + `index.json`
  (gitignored; ~4 KB per resort). Vite copies them into `dist/`. The card fetches `/forecast/{id}.json`. A full run takes ~1 min.
- **Deploys:** Workers Builds runs it automatically before every build (`prebuild`, only when `WORKERS_CI` is set),
  so each push ships fresh data. `.github/workflows/forecast.yml` refreshes hourly (`:17`) and runs `wrangler deploy`,
  which **needs repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`** (skips the deploy until they exist).
- **Open-Meteo `snowfall` ignores `elevation=`.** It's the model cell's snow, so a base at +7 °C still "gets" 13 cm.
  Temperature _is_ downscaled, so we compute snow from hourly precipitation × rain/snow split (all snow ≤ 0 °C, all rain
  ≥ 2 °C) × snow ratio (10:1 near freezing → 15:1 when cold). Simple on purpose; tested in `openMeteo.test.ts`.
- **Open-Meteo budget:** one request per 40 resorts, but each location counts as a call: 159 × 2 = 318 per run,
  ~7.6k/day hourly against the 10k/day free cap. Adding many resorts means going 2-hourly or paying.
- **NWS:** `/points` lookups are stable, cached in `data/nws-grid.json` (commit it after adding resorts). Gridpoint
  `snowfallAmount` comes in 6 h ISO intervals (UTC); we split them by hour into local days. Grid cells are 2.5 km,
  so NWS elevation often sits well below the summit (e.g. Timberline: grid 4,843 ft vs summit 8,481 ft). The card labels each row's elevation.
- **"Today"** includes hours that have already passed, for both sources.
- Units are inches on the card for now; a cm toggle for BC/AB fits M5.

## M4 findings (2026-09-26)

- **Pipeline:** `npm run observed` (`scripts/fetch-observed.ts`) writes `public/observed/{id}.json` + `index.json`
  (gitignored; ~4 KB per resort). It's a sibling of the forecast script: same `prebuild` in Workers Builds, same hourly
  Forecast workflow (now "fetch forecast, fetch observed, build, deploy"). A full run takes ~15 s. Shared fetch/retry code
  moved to `scripts/lib.ts`.
- **SNOTEL (AWDB REST, no key):** `/stations?stationTriplets=*:*:SNTL&activeOnly=true` lists 919 stations (elevation in
  **feet**). `/data?stationTriplets=a,b,c&elements=SNWD,WTEQ&duration=HOURLY` takes many stations per call; dates are
  station-local **standard** time (`dataTimeZone`, e.g. −8). We fetch 15 days hourly, 25 stations per call.
- **Station matching:** nearest station within 30 km whose elevation is between base − 300 m and summit + 150 m.
  Cached (with up to 3 candidates) in `data/snotel-stations.json`; commit it after adding resorts, `--rematch` redoes all.
  105 of 120 US resorts match (median 4 km). Misses are mostly California (it uses CDEC, not SNOTEL): Mammoth, June,
  SoCal areas, China Peak, Dodge Ridge, Shasta; plus Whitefish, 49° North, Sandia, Kelly Canyon.
- **New snow from depth:** SNOTEL measures depth, not snowfall. We median-filter hourly depth (5 h) and add up climbs;
  a climb ends when depth drops >1″ below its peak, and climbs of ≤1″ are ignored (the sensor reads whole inches and
  jitters ±1). Checked on Snowbird-area data Jan–Mar 2026: every remaining snow day lined up with a SWE gain. It's
  settled snow, so it reads lower than a snow stake; the card says so. SNOTEL gives no season total (NOHRSC does).
- **NOHRSC snowfall is not on the ArcGIS server.** `mapservices.weather.noaa.gov/.../NOHRSC_Snow_Analysis` only has
  SNODAS depth + SWE, so there's no "identify" for snowfall. The National Snowfall Analysis v2 is published as files at
  `nohrsc.noaa.gov/snowfall_v2/data/YYYYMM/`: `sfav2_CONUS_{6,24,48,72}h_YYYYMMDDHH.tif` at 00Z/12Z, and a daily
  season file `sfav2_CONUS_{YYYY}093012_to_{YYYYMMDD}12.tif`. GeoTIFFs are a plain 0.04° lat/lon grid (−126…−66°,
  21…55°N), float32, LZW, **inches** (checked against the official PNG legend). `src/observed/geotiff.ts` reads them
  (~200 lines, no dependency) and only decodes the rows it needs. CONUS only: BC/AB resorts get nothing.
- **Call budget per run:** 1 AWDB station list (only when a resort is new/moved) + 5 AWDB data calls + 2 NOHRSC folder
  listings + 3 GeoTIFFs (~0.2–2.5 MB each). Hourly: ~120 AWDB and ~120 NOHRSC requests/day, no keys or published caps.
  Owner approved running it hourly (2026-09-26). NOHRSC only changes twice a day, so a 3-hourly run would lose nothing if we ever need to trim.
- **Season window:** NOHRSC's season starts Sep 30 12Z, so until Oct 1 the card shows last season's total, labelled
  with its dates.
- **Not done (optional):** NOHRSC 72h map layer. The ArcGIS server doesn't have it; doing it means colouring the 72h
  GeoTIFF into a PNG in the pipeline and adding it as a MapLibre image source. A candidate for the M5 UI review.

## Pre-M5 UI review (2026-09-26)

Owner reviewed every feature on the live site (desktop + phone, light + dark). Phone is the weakest part, so M5 centres on it.

### Decisions

- **Resort card → bottom sheet on phones.** Swipe up for detail; the map stays usable above it. Desktop keeps the side card.
- **Colour pins by observed 72h snow** (from `/observed/index.json`: NOHRSC 72h, SNOTEL fallback). Needs a small legend.
  Resorts with no data (BC/AB) get a neutral colour. Clusters show their snowiest member.
- **Add resort search** (name, type-ahead, jumps to the resort and opens its card). "Near me" not requested.
- **Canada observed snow: skipped for v1.** BC/AB cards keep the "No snow observations for this area yet" line.
- **Shorter fine print.** Under the forecast and observed tables, just "Updated [time ago]". The source/method notes go.
  Open-Meteo is CC BY 4.0, so its credit moves to the map attribution line (required). SNOTEL/NOHRSC are US-government
  public domain; no credit needed, but keep source names in the table rows.

### Also fix in M5 (found in the review, not contested)

- Phone: the attribution line covers the radar time slider (known since M2). Collapse it to the (i) button on small screens.
- Phone: the first view cuts off CA/CO/NM/AZ. Fit the view to all resorts on load.
- Selecting a resort should pan the map so its pin isn't hidden under the card/sheet or the radar panel.
- Card background is see-through (glass), so pins/radar show through text on phones. Make it opaque enough to read.
- Observed table headers run together on phones ("24h72h Season Depth").
- Radar: add a colour legend for both layers; show "20 min ago" style frame times; note that snow rate also paints rain.
- Dark mode: panels go dark but the basemap stays light. Needs a dark basemap style.
- cm/inch toggle (planned in M3 findings); straight-line distance on the card (v1 scope, not built yet).
- Bundle is 1.25 MB (MapLibre); code-split for the Lighthouse ≥ 90 target.
- Stale SNOTEL readings (e.g. 20 h old) only show in small print; flag them visibly once the fine print is gone.
- Bug: BC/AB forecast note mentions NWS although those cards have no NWS row (goes away with the shorter fine print).

### Still open

- NOHRSC 72h map layer (optional since M4): not discussed. Pin colours may cover the same need.

## Future: global coverage (owner goal, not yet scoped)

| Piece         | Global?                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Resorts       | ✅ OpenSkiMap is already global; widen `V1_REGIONS`. Curation effort scales with the number of resorts.                                     |
| Forecast      | ✅ Open-Meteo is global (NWS is US-only and stays a US bonus).                                                                              |
| Observed snow | ⚠️ SNOTEL/NOHRSC are US-only; other countries need per-country sources or model snow depth.                                                 |
| Radar         | ⚠️ No single free global radar. Patchwork of national/regional feeds, with a satellite/model precipitation layer as the fallback elsewhere. |

The radar code already treats each feed as a `RadarProduct`, so adding regions means adding providers, not a rewrite.
Licensing must be checked per feed before choosing (same rule as RainViewer).
