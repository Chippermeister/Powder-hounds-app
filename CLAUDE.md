# Powder Hounds

Storm-tracking web app for powder chasers. Map of ski resorts + live radar (with snow-rate layer) + per-resort forecast/observed snow.
Owner is learning: explain reasoning briefly, but keep it short unless asked to go deeper.

## Status

- Phase 1 data sourcing: DONE → `docs/01-data-sources.md` (approved)
- Phase 2 build scope: APPROVED → `docs/02-build-scope.md`
- M0 scaffold: DONE (Vite + React + TS, Tailwind v4, Vitest, oxlint, Prettier, CI). Run `npm run check` before committing.
- M1 map + radar spike: DONE. CORS OK on both radar servers (no proxy); findings in `docs/02-build-scope.md` § M1 findings.
- Deploy: LIVE at https://powder-hounds-app.luckyohara.workers.dev (Cloudflare Workers static assets, `wrangler.jsonc`).
  Auto-deploys on push to the default branch `claude/ski-storm-tracker-app-q5iist` (there is no `main`). Merge work via PR.
- M2 resorts on the map: DONE (163 resorts, clustering, card). 20 curated so far; findings in `docs/02-build-scope.md` § M2.
- M3 forecast pipeline: DONE (NWS + Open-Meteo base/summit → static JSON, card table). Hourly deploy needs
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets. Findings in `docs/02-build-scope.md` § M3.
- Next step: M4 observed snow (and more resort curation in batches)

## Locked decisions (don't re-research)

- v1 area: western US + BC/AB, ~150 resorts
- Radar: NOAA MRMS via nowCOAST WMS; snow rate via MSC GeoMet `RADAR_1KM_RSNO`. RainViewer rejected (non-commercial since 2026).
- Forecast: NWS api.weather.gov gridpoints + Open-Meteo (`elevation=`; free non-commercial tier until pre-revenue)
- Observed/history: SNOTEL (NRCS AWDB), NOHRSC gridded snowfall, GHCN via ACIS
- Resorts: OpenSkiMap (ODbL) + hand-curated overrides
- Competitor code (github.com/wdvr/snow) is PolyForm Noncommercial: never copy code or data from it.

## Working rules

- Stop for owner approval before risky or hard-to-reverse decisions (stack changes, new paid services, deletions).
- One milestone per session. Read only the files the task needs; docs/ is the source of truth.
- Commit after each meaningful step with a conventional message (`feat:`, `fix:`, `docs:`, `chore:`).
- Use quiet flags for tools (e.g. `npm test -- --silent`, `tail` long logs) to keep output small.
- No subagents unless asked.
