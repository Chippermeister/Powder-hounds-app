# Powder Hounds

Storm tracking for powder chasers: a map of western ski resorts with a live radar overlay
(including a snow-rate layer), forecasts by elevation, and measured snowfall.

Status: early build (M0 scaffold). See `docs/` for data-source decisions and the build plan.

## Develop

```bash
npm install
npm run dev     # local dev server
npm run check   # lint, typecheck, format check, tests, build (same as CI)
```

Stack: React + TypeScript + Vite, Tailwind CSS, Vitest, oxlint, Prettier.
