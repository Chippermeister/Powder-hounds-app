# Powder Hounds: product vision and roadmap

Source: owner's feature brainstorm, 2026-09-26 (logged here; the original is a Word document, not in the repo).
Status: **draft for owner approval.** Once approved, this replaces the M5b scope in `02-build-scope.md` as the plan
of record.

## 1. Vision

> Make the best tool for skiers and snowboarders: just about any important information they could want, at their
> fingertips, in a single app.

Principles that follow from it:

- **Sleek and futuristic.** It should look ahead of what other snow apps show: 3D terrain, motion, live weather on
  the cards. Performance and battery life still come first; every animation respects the OS "reduce motion" setting.
- **Simple first, depth on demand.** Basic users see the big picture in one glance. Enthusiasts can open the full
  tables, stations and model comparisons.
- **Trustworthy.** Every number says where it came from and how old it is. Safety data (avalanche danger) is shown
  as the official centres publish it, never reworded or scored by us.
- **A business, not only a tool.** Premium features and resort partnerships should fund the data that costs money.

## 2. Feature register

Every idea from the brainstorm, plus the approved M5b items. **Size** is a rough build effort: S = under one
session, M = one session, L = two or three sessions, XL = several sessions or depends on outside parties.
**Gate** is anything needed before building: owner approval (A), a new data source or service (S), money (P), or a
partnership (Pt).

| ID  | Feature                                                             | Size | Gate | Notes                                                                                                                                         |
| --- | ------------------------------------------------------------------- | ---- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Settings page                                                       | S    | —    | Home for units, default map style, pin-colour mode, simple/pro view. Saved on the device.                                                     |
| F2  | cm/inch toggle _(M5b)_                                              | S    | —    | Data is already metric; display-only change. Lives in Settings.                                                                               |
| F3  | Pin colours: observed 72h **or** 7-day forecast                     | S    | —    | `/forecast/index.json` already has 7-day totals. Legend switches with the mode.                                                               |
| F4  | Filter by pass (Epic, Ikon, Mountain Collective, Indy, independent) | S    | —    | Hand-curated list in `data/`, refreshed each season (passes change yearly). Facts only, no pass logos without permission.                     |
| F5  | Daily conditions summary on the card                                | S    | —    | Written from our own data ("3″ new overnight, snowing, 12″ in the next 7 days"). Replaces the blurb at the top; the blurb moves lower.        |
| F6  | Map styles: Standard, Dark, 3D topo _(M5b)_                         | M    | —    | No new service: current basemap, a dark style, existing terrain with tilt.                                                                    |
| F7  | Cinematic fly-to on resort select                                   | S    | —    | Camera only: pan, zoom and tilt into 3D terrain. The lift and trail detail is F13.                                                            |
| F8  | Install as an app (PWA) _(M5b)_                                     | S    | —    | Manifest, icons, offline app shell. Radar still needs a connection.                                                                           |
| F9  | Accessibility pass _(M5b)_                                          | M    | —    | Keyboard, screen reader, contrast, reduced motion.                                                                                            |
| F10 | Speed: code-splitting, Lighthouse ≥ 90 _(M5b)_                      | M    | —    | Then keep a Lighthouse check in CI so later features can't quietly slow the app.                                                              |
| F11 | Map styles: Satellite, 2D topo _(M5b)_                              | M    | A, S | Imagery and contour sources need licence checks (most free imagery is non-commercial).                                                        |
| F12 | Avalanche danger from regional centres                              | M    | A, S | US centres (avalanche.org) and Avalanche Canada publish danger ratings. Shown as published, with a link to the full forecast. Terms to check. |
| F13 | 3D resort view: lifts, trails, resort outline                       | L    | A    | OpenSkiMap (already our resort source, ODbL) has lifts, runs and ski-area outlines. Completes the "cinematic" idea with F7.                   |
| F14 | Weather-themed animated cards (snow, sun, rain)                     | M    | —    | Needs current conditions per resort (Open-Meteo weather code, already our provider). Subtle, looping, off under reduced motion.               |
| F15 | Simple vs Pro view                                                  | M    | —    | Simple: a one-line verdict + three numbers. Pro: today's full tables. Toggle in Settings.                                                     |
| F16 | Wind overlay                                                        | L    | A    | Animated wind from a weather model. NOAA models are public domain but need processing into map tiles in our pipeline.                         |
| F17 | Storm tracking by region                                            | L    | —    | Group forecast snow into "storms" per region: start, end, total, which resorts win. Later: alerts.                                            |
| F18 | Snow quality score                                                  | L    | A    | Our own method (snow density from SNOTEL, temperature, wind). Inspired by powderchasers.com; must not copy their method or wording.           |
| F19 | Snow since the last crust ("snow above the ice layer")              | L    | A    | Detect the last rain or melt-freeze event from station history, then total the snow since. Same caveats as F18; not an avalanche tool.        |
| F20 | Future radar / predicted storm tracks                               | XL   | A    | First step: forecast model precipitation (NOAA HRRR, public domain) animated as "future radar". True nowcasting is research-grade.            |
| F21 | All major ski resorts worldwide                                     | L    | A    | OpenSkiMap and Open-Meteo are already global; observed snow and curation are not. Starts with a regions list.                                 |
| F22 | Live webcams inside the card                                        | XL   | Pt   | Cams are owned by resorts or camera vendors; embedding needs permission. Today's card links out.                                              |
| F23 | Live lift status (open/closed)                                      | XL   | Pt   | Resort sites differ and often forbid scraping. Realistic path: resort partnerships or a licensed data feed.                                   |
| F24 | Official daily conditions report from the resort                    | XL   | Pt   | Same problem as F23. F5 (our own summary) covers the need until partnerships exist.                                                           |
| F25 | Global weather radar                                                | XL   | P, S | No single free global radar with commercial rights. Paid providers exist; decide after revenue.                                               |
| W1  | Marketing website: landing page, stats, app store links             | M    | —    | See § 4. The map itself moves to its own page.                                                                                                |
| W2  | App store versions (iOS, Android)                                   | L    | A, P | Wrap the PWA with Capacitor. Needs developer accounts (Apple has a yearly fee).                                                               |
| B1  | Commercial licence audit                                            | S    | —    | **Must happen before any revenue.** See § 6.                                                                                                  |
| B2  | Accounts and payments                                               | XL   | A, P | The app is a static site today; subscriptions need sign-in, a payments provider and a small backend. A stack change, so owner approval first. |

## 3. Roadmap, easiest to hardest

Each milestone is one working session, as before. Gated items start with a short research note and wait for approval;
building continues on ungated work in the meantime.

| Milestone | Theme                     | Contents                                                | Why here                                                                                                    |
| --------- | ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **M6**    | Settings and quick wins   | F1, F2, F3, F4, F5                                      | All small, no new services, visible on day one. Settings gives later features a home.                       |
| **M7**    | Map styles and 3D arrival | F6, F7; research for F11                                | Builds on the terrain we already load. Research runs alongside, so F11 is ready once approved.              |
| **M8**    | v1.0 release quality      | F8, F9, F10 (+ F11 if approved)                         | Makes the base installable, accessible and fast, with a CI speed check that protects every later milestone. |
| —         | **Phase 3 reporting**     | README, architecture diagram, demo GIF, lessons learned | Natural v1.0 point for the portfolio write-up.                                                              |
| **M9**    | Safety: avalanche danger  | F12                                                     | High value, moderate effort; terms check first.                                                             |
| **M10**   | Living cards              | F14, F15                                                | The "futuristic" look plus the simple view for basic users.                                                 |
| **M11**   | Resort 3D explorer        | F13                                                     | Completes the cinematic fly-to with lifts, trails and outlines.                                             |
| **M12**   | Storm tracking            | F17                                                     | Uses forecast data we already have; groundwork for alerts.                                                  |
| **M13**   | Wind overlay              | F16                                                     | First gridded-model pipeline; reused by M15.                                                                |
| **M14**   | Snow quality and crust    | F18, F19                                                | Needs our own method, tested against past seasons before it ships.                                          |
| **M15**   | Future radar              | F20                                                     | Builds on M13's model pipeline.                                                                             |
| **M16**   | Going global              | F21                                                     | Big data and curation effort; radar coverage stays regional (F25).                                          |
| Business  | In parallel, owner-led    | B1 → W1 → B2 → W2 → partnerships (F22, F23, F24) → F25  | Not code-first: licences, accounts, money and people. B1 comes before any charging.                         |

Items F22–F25 are the hardest because they depend on partners or money, not on code. Partnerships (§ 5) are the
path that unlocks them.

## 4. Website (browser version)

- **Landing page:** a live hero map (radar playing), one sentence on what the app does, app store badges once W2
  exists, and a button into the full map.
- **"Where's the snow" stats:** most snow in the last 72h, biggest storm coming, deepest base. The same data as the
  pins, ranked. Shareable, and good for search engines.
- **Pricing page** (once B2 exists), **data sources and credits** page (licence credits live here as well as on the
  map), **about**.
- **Later:** storm write-ups (a blog) generated from F17, resort pages with a stable URL each.

## 5. Business model (brainstorm)

**Free tier, the reason people download:** map, live radar, pin colours, 7-day forecast, observed snow, search,
pass filter, daily summary, map styles, and **avalanche danger, which stays free because it is safety information**.

**Premium subscription, for people who chase storms:**

| Premium feature                                   | From          |
| ------------------------------------------------- | ------------- |
| Future radar and storm tracks                     | F20, F17      |
| Snow quality score and snow since the last crust  | F18, F19      |
| Custom alerts ("tell me when Alta forecasts 12″") | F17 + B2      |
| Wind overlay                                      | F16           |
| 3D resort explorer                                | F13           |
| Season history and resort comparisons             | existing data |

Pricing: benchmark against existing snow-forecast apps before choosing (a research task, not guessed here). A
monthly and a cheaper yearly plan is the usual shape.

**Resort partnerships:**

- Resorts supply official conditions, lift status and webcam feeds (F22–F24); in return they get a verified badge
  and richer placement. Clearly labelled, never paid rankings in snow totals.
- Embeddable forecast widget for resort websites (B2B), built from our existing pipeline.
- Affiliate links for lift tickets, lodging and rentals, clearly labelled.
- Later: gear-brand sponsorship, data licensing.

## 6. Risks and commitments before charging money

| Area          | Issue                                                                                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-Meteo    | Our locked decision uses the free **non-commercial** tier "until pre-revenue". A subscription needs their paid commercial plan.                                                                                                    |
| Other sources | NOAA, NWS, NRCS (SNOTEL) and NOHRSC are US public domain. Check ECCC GeoMet, OpenFreeMap and terrain tiles for commercial terms. OpenSkiMap (ODbL) allows commercial use, with attribution and share-alike on the resort database. |
| Scraping      | Lift status, conditions reports and webcams from resort sites risk breaking site terms. Partnerships first.                                                                                                                        |
| Safety        | Avalanche data shown exactly as published, with a link and a "not a substitute for the full forecast" line. Snow quality and crust (F18, F19) are skiing aids, not avalanche tools.                                                |
| Competitors   | Powderchasers-style features are ideas only; their methods and text are not copied. The PolyForm rule for github.com/wdvr/snow still stands.                                                                                       |
| Architecture  | Accounts, payments and alerts need a backend (B2). That is a stack change and needs owner approval.                                                                                                                                |

## 7. Decisions for the owner

1. Approve this order (§ 3), or move items.
2. Approve the free and premium split in § 5 (especially: avalanche danger stays free).
3. When M7 research is ready: choose the satellite and topo sources (F11).
4. Before any charging: run B1 and approve the Open-Meteo commercial plan.
