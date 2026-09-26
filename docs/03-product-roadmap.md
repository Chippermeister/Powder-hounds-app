# Powder Hounds: Product Vision and Roadmap

Status: **DRAFT, awaiting owner approval** (logged 2026-09-26 from the owner's feature brainstorm).
This document is the source of truth for everything after M5b. `02-build-scope.md` stays the record of how v1 was
built; its § Future: global coverage feeds the global items below.

## 1. Vision

**Mission.** The best tool for skiers and snowboarders: every important piece of mountain information, in one app,
at their fingertips.

**Principles**

1. **Sleek and futuristic.** It should look and feel a step ahead of every other snow app (motion, 3D terrain, live
   data), not like a weather-service page.
2. **Simple first, deep on demand.** Casual users get the big picture at a glance ("Where's it snowing? Is it good
   today?"). Enthusiasts can dig into the detail (station data, model comparisons, avalanche problems).
3. **One app.** Radar, forecasts, observed snow, conditions, avalanche danger and cams without leaving the app.
4. **A real business.** Free core product, a premium subscription, and partnerships with resorts.

## 2. Feature backlog

Effort: **S** = a day or two, **M** = about a week, **L** = several weeks, **XL** = a project in itself or blocked on
a partner. "Gate" = something that needs owner approval first (new service, cost, licence, or a product decision).

| ID  | Feature                                                                 | What it takes                                                                                                                                                                                                     | Effort | Gate                                  |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------- |
| F1  | **Settings page**                                                       | One panel: units (cm/in, m/ft), default map style, pin colour mode, pass filter. Saved on the device. Absorbs the M5b cm/inch toggle.                                                                             | S      | —                                     |
| F2  | **Pin colours: past 72 h or next 7 days**                               | Toggle between observed 72 h (today) and forecast 7-day total. The forecast pipeline already writes `summit7dCm` per resort.                                                                                      | S      | —                                     |
| F3  | **Filter by pass** (Epic, Ikon, Mountain Collective, Indy, independent) | No open dataset has this: hand-curate a `passes` field for our ~163 resorts from the passes' public resort lists (facts, not copied content). Re-check each season.                                               | S      | —                                     |
| F4  | **Cinematic fly-to**                                                    | On selecting a resort: a slow pan, zoom and tilt into 3D terrain. Camera work only; lifts and trails come with F11.                                                                                               | S      | —                                     |
| F5  | **Animated weather on resort cards**                                    | The card's background shows today's weather (snow falling, sun, rain, fog) from our forecast data. Lightweight CSS/canvas animation, off when the OS asks for reduced motion.                                     | M      | —                                     |
| F6  | **Daily conditions report** (replaces the static blurb)                 | Phase 1: a short plain-language summary written by our code from our own forecast + observed data ("6″ overnight, more Thursday, cold"). Phase 2: optional AI-written version. Resort-published reports need F16. | M      | Phase 2: AI service cost              |
| F7  | **Wind overlay**                                                        | Phase 1: wind speed/direction raster from a free government WMS (e.g. MSC GeoMet or NOAA), like the radar layers. Phase 2: animated wind particles (needs gridded model data through our pipeline).               | M      | Source licence check                  |
| F8  | **Avalanche forecasts**                                                 | Danger ratings from regional avalanche centres: the US centres' shared public map feed (avalanche.org) and Avalanche Canada. A map layer plus a card row linking to the full forecast.                            | M      | Terms of use per feed; safety wording |
| F9  | **Regional storm tracking**                                             | Needs definition. Suggested start: a "Storm outlook" view that groups resorts by region and ranks regions by forecast snow, with a timeline of when each storm arrives. Builds on data we have.                   | M      | Product definition                    |
| F10 | **All major resorts worldwide**                                         | Pins: OpenSkiMap is already global. Forecasts: Open-Meteo is global. Observed snow and radar are regional (see F18 and `02-build-scope.md` § Future). Curation effort grows with the resort count.                | L      | Scope (which countries first)         |
| F11 | **3D resort view: lifts, trails, footprint**                            | OpenSkiMap has lift lines, runs and ski-area outlines (ODbL). Build them into our own map tiles in the pipeline and show them when zoomed in or after F4's fly-to.                                                | L      | ODbL share-alike obligations          |
| F12 | **Predictive radar** (where storms and moisture are heading)            | Short-range "nowcast": extrapolate recent radar motion forward 1–2 h, or use a published nowcast product. Needs research into free sources before building our own.                                               | L      | Source research                       |
| F13 | **Snow quality score**                                                  | Our own algorithm (not a copy of any competitor's) from temperature, wind, new-snow density and sun/rain history. Needs research and validation against real days.                                                | L      | Method sign-off                       |
| F14 | **Snow above the ice layer**                                            | New snow since the last melt-freeze or rain event, from temperature history and observed snow. Shares groundwork with F13.                                                                                        | L      | Method sign-off                       |
| F15 | **Live webcams inside cards**                                           | Technically easy (image or video embed); legally it needs each resort's or cam provider's permission. Today we link out. Realistically part of resort partnerships (B3).                                          | XL     | Permissions / partnerships            |
| F16 | **Live lifts open/closed + resort conditions reports**                  | Scraping hundreds of resort sites is fragile and may break their terms. Realistic routes: a licensed data provider (paid) or direct resort feeds via partnerships.                                                | XL     | Paid data or partnerships             |
| F17 | **Global weather radar**                                                | No single free global radar: stitch national feeds (each licence checked) with a satellite precipitation layer where there's no radar.                                                                            | XL     | Per-feed licences                     |

## 3. Build order (easiest to hardest)

Remaining M5b work is folded in. Two items are gates rather than features: **code-splitting + Lighthouse** and the
**accessibility pass** run when a phase's UI is settled, and again at the end of each later phase.

| Step | Item                                                       | Phase                   | Notes                                                             |
| ---- | ---------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| 1    | F1 Settings page + cm/inch toggle (M5b)                    | **M5b: finish v1**      | Home for the next three items                                     |
| 2    | F2 Pin colour mode (72 h / 7-day)                          | M5b                     |                                                                   |
| 3    | F3 Pass filter                                             | M5b                     |                                                                   |
| 4    | F4 Cinematic fly-to                                        | M5b                     |                                                                   |
| 5    | Esri key hookup (owner creates key)                        | M5b                     | Satellite outside the US                                          |
| 6    | PWA install (M5b)                                          | M5b                     | Also the first step towards app-store apps (B4)                   |
| 7    | Code-splitting + Lighthouse ≥ 90, accessibility pass (M5b) | M5b                     | Closes v1                                                         |
| 8    | F5 Animated weather cards                                  | **M6: richer cards**    |                                                                   |
| 9    | F6 Daily conditions report, phase 1                        | M6                      |                                                                   |
| 10   | F7 Wind overlay, phase 1                                   | **M7: new map layers**  |                                                                   |
| 11   | F8 Avalanche forecasts                                     | M7                      |                                                                   |
| 12   | F9 Regional storm outlook                                  | M7                      | After the product definition                                      |
| 13   | F11 3D lifts, trails and footprints                        | **M8: 3D resorts**      |                                                                   |
| 14   | F10 Worldwide resorts                                      | **M9: going global**    | With F17 planning                                                 |
| 15   | F12 Predictive radar                                       | **M10: research-heavy** |                                                                   |
| 16   | F13 + F14 Snow quality and ice layer                       | M10                     |                                                                   |
| 17   | F17 Global radar                                           | M9/M10                  | Region by region                                                  |
| 18   | F15 Webcams, F16 lifts and resort reports                  | **Partner-dependent**   | Start the conversations early (B3); build when a source is signed |

## 4. Product and business track

These run alongside the build as planning documents, not code. Each gets its own proposal for owner review.

| ID  | Topic                         | First-pass thoughts                                                                                                                                                                                                                      |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Website and landing page**  | Separate from the map app: hero with the live map, "where's it snowing now" stats (biggest 24 h / 7-day totals), feature tour, app-store badges, pricing, resort partner page.                                                           |
| B2  | **Basic vs detailed views**   | Basic by default: pin colours, a one-line conditions summary, a simple "good day?" score. Detailed on tap or in settings: station tables, NWS vs model, elevation bands, avalanche problems.                                             |
| B3  | **Premium subscription**      | Candidates for premium: predictive radar, snow quality score, extended/elevation forecasts, alerts ("12″ forecast at your resorts"), wind layer, unlimited favourites. Keep free: map, radar, basic forecast, avalanche danger (safety). |
| B4  | **Native apps**               | App-store presence needs a native wrapper around the web app (e.g. Capacitor) or a native rebuild. A stack decision for later; the PWA (step 6) comes first.                                                                             |
| B5  | **Business and partnerships** | Resort partnerships: official conditions/lift feeds and cams (unlocks F15/F16), featured placement, ticket or pass referral links. Also affiliate gear/travel links and aggregate, anonymised demand data for resorts.                   |

**Avalanche information stays free.** Charging for safety data is a reputational and ethical risk; the premium tier
should add convenience and insight, not gate safety.

## 5. Commercial readiness: licence gates

Charging money changes the terms of some sources we use today. These must be resolved **before** a paid tier or ads
go live:

| Source                   | Today                                     | When we go commercial                                            |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------------- |
| Open-Meteo               | Free tier, non-commercial                 | Paid API subscription required                                   |
| OpenSkiMap / OSM (ODbL)  | Attribution                               | Share-alike applies to any resort database we derive and publish |
| Esri World Imagery       | Free tier (2 M tiles/month)               | Pay-as-you-go above the free tier; set a spending cap            |
| OpenFreeMap              | Free, commercial use OK with attribution  | No change; consider self-hosting for reliability at scale        |
| NOAA / USGS / NRCS / MSC | Public domain or open government licences | No change                                                        |
| Resort content and cams  | Links only                                | Embedding needs permission from each resort or provider          |

## 6. Open questions for the owner

1. Approve the build order in § 3, especially finishing M5b (steps 1–7) before new features?
2. F9 storm tracking: is the "storm outlook by region" starting point what you pictured?
3. F6 phase 2 and anything else AI-written: OK to add an AI service cost later?
4. Worldwide (F10): which countries or regions come first after western North America?
5. Premium: any features you already see as definitely free or definitely paid?

## Appendix: the owner's original brainstorm (wording kept, typos tidied)

> **Desired features:**
>
> - Global weather radar
> - All major ski resorts globally
> - Add a settings page
> - Filter by pass type (Epic, Ikon, independent, etc.)
> - Wind overlay
> - Avalanche forecast information from regional avy centers
> - Predictive radar tracks for storms and moisture
> - Built in live camera view within the ski resort title cards
> - Storm tracking for regions
> - Snow above the ice layer
> - Snow quality algorithm (both of the last two are examples from powderchasers.com)
> - Switch the small blurb about each mountain to a daily mountain conditions report (either pulled from resort
>   website pages or have the ai come up with another alternative)
> - When selecting a resort from the map, have it do a cinematic pan and zoom to a 3d rendition of the resort,
>   showing each lift and trail lines, and outlining the footprint of each resort among the surrounding terrain.
> - Live tracking of lifts open/closed (could be pulled from mountain reports pages)
> - For map pin colors, selection between previous 72 hour snowfall totals to show the present or the 7 day forecast
>   for predictive conditions
> - Each resort title card shows visually what kind of conditions are happening that day (if it's snowing at the
>   resort, the title card will look snowy, sunny conditions will look sunny, rainy conditions look like rain etc.;
>   have it be a theme that moves and is playing over the title cards.)
>
> Brainstorm what the website will look like for the browser version, landing page, statistics, links to the app
> stores, and other features.
>
> **Vision and direction:** I want the app to look sleek and futuristic compared to what other apps are capable of
> showing. Come up with simpler data to show for basic users that just want the big picture stuff. Also determine
> which features could be behind a premium subscription. Brainstorm a paid subscription and what that could look
> like. Let's figure out how to turn this tool into a business, i.e. partnerships with ski resorts. I want to make
> the best tool for skiers and snowboarders to access just about any important information they could want at their
> fingertips in a single app.
