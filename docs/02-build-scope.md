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
| **M5** | Polish + drive time | Bottom sheet, dark mode, PWA install, drive-time provider, accessibility pass, Lighthouse ≥ 90                                                      |
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
