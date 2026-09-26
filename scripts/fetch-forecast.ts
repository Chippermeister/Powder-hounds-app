// Forecast pipeline: fetches NWS + Open-Meteo for every resort and writes static JSON:
//   public/forecast/{id}.json  (card detail)   public/forecast/index.json  (7-day summary)
// Vite copies public/ into dist/, so run this before `vite build`.
//
// Run: npm run forecast
// In Workers Builds (WORKERS_CI=1) it runs automatically before each build (see package.json "prebuild"),
// so every deploy ships fresh data; .github/workflows/forecast.yml redeploys hourly.
//
// NWS /points lookups never change, so they're cached in data/nws-grid.json (commit it after adding resorts).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mergeResorts, type CuratedFile, type Resort } from '../src/resorts/merge.ts'
import type { ResortCandidate } from '../src/resorts/openskimap.ts'
import { dailySnow, localDate, type NwsGridRef, type NwsValue } from '../src/forecast/nws.ts'
import {
  openMeteoUrl,
  toElevationForecast,
  type OpenMeteoLocation,
} from '../src/forecast/openMeteo.ts'
import {
  sumSnow,
  type ForecastIndex,
  type NwsForecast,
  type ResortForecast,
} from '../src/forecast/types.ts'

if (process.argv.includes('--if-workers-ci') && !process.env.WORKERS_CI) {
  console.log('forecast: skipped (not in Workers Builds)')
  process.exit(0)
}

// NWS asks for an identifying User-Agent with a way to reach us.
const USER_AGENT = 'PowderHounds/0.1 (+https://powder-hounds-app.luckyohara.workers.dev)'
const NWS = 'https://api.weather.gov'
const OUT_DIR = new URL('../public/forecast/', import.meta.url)
const GRID_CACHE = new URL('../data/nws-grid.json', import.meta.url)
/** Resorts per Open-Meteo request (2 points each: base + summit). Keeps URLs short. */
const OPEN_METEO_BATCH = 40
const NWS_CONCURRENCY = 4

const readJson = async <T>(url: URL): Promise<T> => JSON.parse(await readFile(url, 'utf8')) as T

class HttpError extends Error {
  status: number
  constructor(status: number, url: string) {
    super(`${url}: HTTP ${status}`)
    this.status = status
  }
}

/** GET JSON with a timeout and 3 tries. NWS gridpoints return the odd 500; retrying fixes most. */
async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json, application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new HttpError(res.status, url)
      return (await res.json()) as T
    } catch (err) {
      const permanent = err instanceof HttpError && err.status >= 400 && err.status < 500
      if (permanent || attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return out
}

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  )

// --- Resorts ---------------------------------------------------------------------------------

const candidates = await readJson<{ resorts: ResortCandidate[] }>(
  new URL('../data/resorts.openskimap.json', import.meta.url),
)
const curated = await readJson<CuratedFile>(
  new URL('../data/resorts.curated.json', import.meta.url),
)
const resorts = mergeResorts(candidates.resorts, curated)
const isUS = (r: Resort) => r.region.startsWith('US-')

// --- NWS grid lookups (cached) ---------------------------------------------------------------

type GridCache = Record<string, NwsGridRef & { lat: number; lon: number }>
const gridCache: GridCache = await readJson<GridCache>(GRID_CACHE).catch(() => ({}))
const needLookup = resorts.filter(
  (r) => isUS(r) && (gridCache[r.id]?.lat !== r.lat || gridCache[r.id]?.lon !== r.lon),
)
await mapLimit(needLookup, NWS_CONCURRENCY, async (r) => {
  try {
    const { properties: p } = await getJson<{
      properties: { gridId: string; gridX: number; gridY: number; timeZone: string }
    }>(`${NWS}/points/${r.lat},${r.lon}`)
    gridCache[r.id] = {
      lat: r.lat,
      lon: r.lon,
      office: p.gridId,
      x: p.gridX,
      y: p.gridY,
      timeZone: p.timeZone,
    }
  } catch (err) {
    console.warn(`nws points ${r.id}: ${(err as Error).message}`)
  }
})
if (needLookup.length) {
  const sorted = Object.fromEntries(
    Object.entries(gridCache).sort(([a], [b]) => a.localeCompare(b)),
  )
  await writeFile(GRID_CACHE, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`nws: looked up ${needLookup.length} grid points → data/nws-grid.json`)
}

// --- Open-Meteo base + summit ----------------------------------------------------------------

const openMeteo = new Map<string, Pick<ResortForecast, 'base' | 'summit' | 'timeZone'>>()
for (const batch of chunk(resorts, OPEN_METEO_BATCH)) {
  const points = batch.flatMap((r) => [
    { lat: r.lat, lon: r.lon, elevationM: r.baseM },
    { lat: r.lat, lon: r.lon, elevationM: r.topM },
  ])
  try {
    const locations = await getJson<OpenMeteoLocation[]>(openMeteoUrl(points))
    batch.forEach((r, i) => {
      const [base, summit] = [locations[2 * i], locations[2 * i + 1]]
      openMeteo.set(r.id, {
        timeZone: base.timezone,
        base: toElevationForecast(base, r.baseM),
        summit: toElevationForecast(summit, r.topM),
      })
    })
  } catch (err) {
    console.warn(`open-meteo batch (${batch[0].id}…): ${(err as Error).message}`)
  }
}

// --- NWS gridpoint snowfall ------------------------------------------------------------------

interface Gridpoint {
  properties: {
    updateTime: string
    elevation: { value: number }
    snowfallAmount: { values: NwsValue[] }
  }
}

const now = Date.now()
const nws = new Map<string, NwsForecast>()
await mapLimit(resorts.filter(isUS), NWS_CONCURRENCY, async (r) => {
  const grid = gridCache[r.id]
  if (!grid) return
  try {
    const { properties: p } = await getJson<Gridpoint>(
      `${NWS}/gridpoints/${grid.office}/${grid.x},${grid.y}`,
    )
    nws.set(r.id, {
      office: grid.office,
      updatedAt: p.updateTime,
      gridElevationM: Math.round(p.elevation.value),
      days: dailySnow(p.snowfallAmount.values, grid.timeZone, localDate(now, grid.timeZone)),
    })
  } catch (err) {
    console.warn(`nws gridpoint ${r.id}: ${(err as Error).message}`)
  }
})

// --- Write -----------------------------------------------------------------------------------

const generatedAt = new Date(now).toISOString()
const index: ForecastIndex = { generatedAt, resorts: {} }
await mkdir(OUT_DIR, { recursive: true })
for (const r of resorts) {
  const om = openMeteo.get(r.id)
  const forecast: ResortForecast = {
    id: r.id,
    generatedAt,
    timeZone: om?.timeZone ?? gridCache[r.id]?.timeZone ?? 'UTC',
    base: om?.base ?? null,
    summit: om?.summit ?? null,
    nws: nws.get(r.id) ?? null,
  }
  index.resorts[r.id] = {
    summit7dCm: forecast.summit ? sumSnow(forecast.summit.days) : null,
    nws7dCm: forecast.nws ? sumSnow(forecast.nws.days) : null,
  }
  await writeFile(new URL(`${r.id}.json`, OUT_DIR), JSON.stringify(forecast))
}
await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index))

const usCount = resorts.filter(isUS).length
console.log(
  `forecast: ${resorts.length} resorts, open-meteo ${openMeteo.size}/${resorts.length}, nws ${nws.size}/${usCount}`,
)
// Fail only if a whole source is down, so one flaky resort doesn't block a deploy.
if (openMeteo.size === 0 && nws.size === 0) process.exit(1)
