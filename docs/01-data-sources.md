# Phase 1 — Data Sourcing Decisions

Status: **DRAFT, awaiting approval**. Researched 2026-09-25.

The rule used to pick every source below: **free today, and with a clear path to commercial use later.**
US federal data (NOAA/NWS/NRCS) is public domain, so it passes both tests. Anything else gets its
license written down next to it so we never build the product on data we can't ship.

---

## TL;DR

| Need | Primary (v1) | Secondary / later | License |
|---|---|---|---|
| Radar tiles (live) | NOAA **MRMS** reflectivity via nowCOAST WMS (time-enabled) | IEM NEXRAD XYZ tiles (prototyping only) | Public domain |
| Radar: *snow vs rain* | Environment Canada **MSC GeoMet `RADAR_1KM_RSNO`** | — | Open Government Licence – Canada (commercial OK, attribution) |
| Forecast (US) | **NWS `api.weather.gov`** gridpoints (`snowfallAmount`) | — | Public domain |
| Forecast (per-elevation, global) | **Open-Meteo** (`elevation=` param, multi-model) | Paid plan ($29/mo) or self-host when commercial | Free tier **non-commercial only**; data CC BY 4.0 |
| Historical snow (mountain obs) | **NRCS SNOTEL** (AWDB REST API) | — | Public domain |
| Historical snowfall (gridded) | **NOHRSC** National Gridded Snowfall Analysis (24/48/72h + season) | — | Public domain |
| Long-term normals ("vs. average") | **GHCN-Daily** via RCC-ACIS / NCEI | Open-Meteo ERA5 archive (coarse) | Public domain |
| Resort list + coordinates | **OpenSkiMap** (openskidata.org) | Hand-curated overrides | ODbL (share-alike on the *database*) |
| Webcam + official site links | Hand-curated JSON | — | Our own data |

**Rejected:** RainViewer. Since Jan 1 2026 its free API is limited to personal/educational use, max zoom 7,
2 hours of history, one color scheme, and no nowcast. We can't build a product on that.

---

## 1. Radar — the centerpiece

### Lesson: radar has two limits you need to design around
1. **Radar only shows the present and the past.** A radar frame shows where precipitation is right now.
   "Incoming storm" means *animating the last 1–3 hours* so the eye sees motion and direction. Actually
   predicting arrival is a forecast problem (§2), not a radar problem.
2. **Mountains block radar beams.** WSR-88D beams travel in straight lines and the earth curves away,
   so in the interior West the beam often passes *over* low snow clouds or is blocked by ridges. Radar will
   under-show snow at many resorts. That's why we pair it with forecast and observation data instead of
   presenting it as the whole truth. This is worth saying in the UI too ("radar coverage is limited here").

### Primary: NOAA MRMS via nowCOAST
- MRMS (Multi-Radar/Multi-Sensor) merges every WSR-88D into one quality-controlled mosaic at 1 km,
  updated about every 4 minutes, covering CONUS, Alaska, Hawaii and Puerto Rico.
- It's served as a **time-enabled OGC WMS 1.3.0**. We request one image per timestamp with `TIME=`
  and animate them. MapLibre GL can use a WMS as a raster source through a `{bbox-epsg-3857}` URL template.
- Endpoints:
  - WMS: `https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows?service=WMS&request=GetCapabilities`
  - ArcGIS REST: `https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer`
  - Alternative: `https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer`

### The differentiator: a snow-rate layer
- Environment Canada's **`RADAR_1KM_RSNO`** layer renders precipitation as **snow rate in cm/h**.
  Its mosaic covers North America and **includes US radars**, updates every 6 minutes, and keeps 3 hours of history.
- For powder chasers, "is it snow or rain, and how hard?" matters more than raw reflectivity (dBZ).
  As far as I found, neither competitor shows this on a map.
- WMS: `https://geo.weather.gc.ca/geomet?service=WMS&version=1.3.0&request=GetCapabilities&layer=RADAR_1KM_RSNO`
- License: Open Government Licence – Canada allows commercial use with attribution.

### Prototyping only: Iowa Environmental Mesonet (IEM)
- Simple XYZ tiles (`/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png`, plus `-m05m`, `-m10m`
  offsets for animation). It's the easiest way to get pixels on screen on day one.
- It's a university service. Don't point production traffic at it.

---

## 2. Forecast

### NWS `api.weather.gov` (US)
- `/points/{lat},{lon}` returns a forecast office and grid cell. `/gridpoints/{office}/{x},{y}` then returns the raw
  2.5 km numeric grid with `snowfallAmount`, `quantitativePrecipitation`, `temperature`,
  `windGust`, `probabilityOfPrecipitation` and more, about 7 days out.
- Requires a unique `User-Agent` header (app name + contact). There's no API key, but it's rate-limited, so we cache.
- This is human-forecaster-adjusted NDFD data, often better than raw models for US mountains.

### Open-Meteo (per-elevation, global)
- **The key feature is the `elevation=` parameter.** It downscales the forecast to a given altitude, so we can
  request base / mid / summit for the same lat/lon. That's how "per-elevation forecasts" work.
- Multiple models (GFS, ECMWF, ICON, GEM/HRDPS) let us show model agreement, a good confidence signal.
- **License caveat:** the free API is *non-commercial* (≤10k calls/day). Commercial use costs $29/mo (Standard) or more.
  It's also open source (AGPL), so self-hosting is an option. Fine for the portfolio phase. Revisit before monetizing.

---

## 3. Historical & current snowfall

### Lesson: "snowfall" and "snow depth" are different measurements
- **Snowfall** = new snow that fell in a period (what the "24h: 14 in" number means).
- **Snow depth** = what's on the ground now (settles, melts, gets blown around).
- **SWE** (snow water equivalent) = the water content. It's the most reliable instrument reading.
Most automated stations measure *depth* and *SWE*, not snowfall. We derive "new snow" from depth increases,
which is noisy, so we smooth it and label it honestly.

### NRCS SNOTEL (primary observations, western US)
- 900+ automated high-elevation stations, often *right next to* ski areas. They report hourly
  snow depth (`SNWD`), SWE (`WTEQ`), temperature, and precipitation.
- REST: `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1` (Swagger at `/awdbRestApi/swagger-ui/index.html`), no key.
- Approach: for each resort, find the nearest 1–3 stations within a sensible elevation band.

### NOHRSC National Gridded Snowfall Analysis (gridded, all US)
- 6/24/48/72-hour and **season-to-date** snowfall grids (season resets Oct 1), updated 4×/day.
- Available as WMS/ArcGIS (`mapservices.weather.noaa.gov/raster/rest/services/snow/NOHRSC_Snow_Analysis/MapServer`)
  and as GRIB2/netCDF from `nohrsc.noaa.gov/archived_data/`.
- Doubles as a **map overlay** ("where did it snow the last 72h?") as well as a per-resort value.

### GHCN-Daily via RCC-ACIS (long-term history)
- Decades of daily observer reports with a true `SNOW` field. Use it for "this season vs. normal."
- ACIS (`data.rcc-acis.org`) is the friendliest JSON API on top of it.

---

## 4. Resort data (not asked, but blocks the build)

- **OpenSkiMap** publishes daily GeoJSON of every ski area in OpenStreetMap (coordinates, often website,
  sometimes elevations) at openskidata.org. License is **ODbL**: if we publish a *derived database*, it must
  stay ODbL. Our app code stays ours. Our curated extras (webcam URLs, blurbs) are fine if kept as a separate dataset.
- Webcam links and blurbs get **hand-curated** for the launch set. Scraping them is brittle and a legal gray area.

---

## 5. Architecture implication (important)

Browsers should **not** call these APIs directly for forecasts and history:
- NWS wants an identifying User-Agent and throttles heavy clients.
- Open-Meteo limits are per-IP/per-key. 1,000 users × 100 resorts would blow through them.
- SNOTEL/NOHRSC data needs processing (station matching, smoothing, point-sampling).

So the plan is a **scheduled ingest job** (e.g. hourly) that fetches, normalizes, and writes compact JSON per resort,
served from a CDN. The browser reads our JSON and fetches **radar tiles directly** (those are designed for it).

---

## 6. Competitive notes from this research

- **Powder Chaser**'s source is public at **github.com/wdvr/snow** (reviewed at its last commit, 2026-06-22):
  - **License: PolyForm Noncommercial 1.0.0.** We may *read* it, but must not copy code **or data**
    (including its `resorts.json` with 1,019 resorts and webcam URLs) into a project meant to become commercial.
    Treat it as a reference only. Clean-room: we build our own resort dataset from OpenSkiMap + curation.
  - **Confirmed: no radar anywhere in the codebase** (no radar/NEXRAD/MRMS/RainViewer references). The gap is real.
  - **Correction to our assumptions:** it already has a **web app** (`web/`: React + Vite + Leaflet) and a
    **native Android app in progress** (`android/`: Kotlin/Compose, not yet on Google Play). "They have no Android
    / web" is not a durable differentiator. Radar, the snow-rate layer, and observed snowfall are.
  - Data: Open-Meteo + Apple WeatherKit + **scraped** OnTheSnow and Snow-Forecast.com, merged with outlier detection.
    It uses **no NOAA observations** (no SNOTEL/NOHRSC), so its "snowfall" is model-derived. Our measured, observation-backed
    US snowfall is a second differentiator. We avoid scraping commercial sites (terms-of-service risk).
  - Worth learning from (ideas, not code): a static-JSON-per-resort serving model (matches §5), and scoring at
    three elevations.
- **Powchasers** (powchasers.com) is a *different* product. It's the one with drive-time framing.
- **ozemans/powdercast** (GitHub) is the closest open-source analogue. It uses the same stack recommended here
  (NWS + Open-Meteo multi-model + SNOTEL, Python ingest pipeline, Next.js front end), which is reassuring validation.
  **It has no LICENSE file, so it is legally "all rights reserved".** We can learn from its approach but must not copy its code.
- None of the above show a snow-rate radar layer or any radar at all.

---

## Open decisions (need approval)

1. **v1 geographic scope.** Recommendation: **western US + British Columbia/Alberta** (~150 resorts). Every source
   above has full coverage there, and it's the core powder-chasing market. East/global comes later.
2. **Accept Open-Meteo's non-commercial tier for now**, with a documented switch to paid/self-hosted before revenue.
3. **Basemap + drive-time providers.** Deferred to the build-scoping step.

## Sources
- RainViewer API transition FAQ: https://www.rainviewer.com/api/transition-faq.html
- nowCOAST MRMS service: https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer
- MSC GeoMet radar readme: https://eccc-msc.github.io/open-data/msc-data/obs_radar/readme_radar_geomet_en/
- NWS API gridpoints FAQ: https://weather-gov.github.io/api/gridpoints
- Open-Meteo terms & pricing: https://open-meteo.com/en/terms, https://open-meteo.com/en/pricing
- NRCS AWDB REST: https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html
- NOHRSC gridded snowfall: https://www.nohrsc.noaa.gov/snowfall_v2/
- OpenSkiMap data: https://openskimap.org/?about=
- powdercast: https://github.com/ozemans/powdercast
- Powder Chaser source: https://github.com/wdvr/snow
