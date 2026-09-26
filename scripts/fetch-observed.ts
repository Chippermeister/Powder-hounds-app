// Observed-snow pipeline: SNOTEL (NRCS AWDB) + NOHRSC snowfall analysis → static JSON:
//   public/observed/{id}.json  (card detail)   public/observed/index.json  (24h/72h summary)
// Sibling of fetch-forecast.ts: same triggers (npm "prebuild" in Workers Builds, hourly Forecast workflow).
//
// Run: npm run observed
//
// Station matches are cached in data/snotel-stations.json (commit it after adding resorts); they're
// redone only for resorts whose coordinates changed, or all of them with --rematch.
// Calls per run: ~5 AWDB data requests (25 stations each) + 2 NOHRSC folder listings + 3 GeoTIFFs.
import { mkdir, writeFile } from 'node:fs/promises'
import type { Resort } from '../src/resorts/merge.ts'
import { readGeoTiff, type Grid } from '../src/observed/geotiff.ts'
import { monthFolders, pickFiles } from '../src/observed/nohrsc.ts'
import {
  AWDB,
  dailyHistory,
  matchStations,
  newSnowSince,
  toReadings,
  type AwdbStation,
  type AwdbStationData,
  type StationMatch,
} from '../src/observed/snotel.ts'
import type {
  NohrscObserved,
  ObservedIndex,
  ResortObserved,
  SnotelObserved,
} from '../src/observed/types.ts'
import {
  chunk,
  getBytes,
  getJson,
  getText,
  isUS,
  loadResorts,
  mapLimit,
  readJson,
  sortedJson,
} from './lib.ts'

if (process.argv.includes('--if-workers-ci') && !process.env.WORKERS_CI) {
  console.log('observed: skipped (not in Workers Builds)')
  process.exit(0)
}

const OUT_DIR = new URL('../public/observed/', import.meta.url)
const STATION_CACHE = new URL('../data/snotel-stations.json', import.meta.url)
const AWDB_BATCH = 25
const HISTORY_DAYS = 14
const IN_CM = 2.54
const round1 = (n: number) => Math.round(n * 10) / 10

// Canadian resorts get a file too (all nulls), so the card can say there's no data yet.
const resorts = await loadResorts()
const now = Date.now()

// --- SNOTEL station matching (cached) --------------------------------------------------------

type StationCache = Record<string, { lat: number; lon: number; stations: StationMatch[] }>
const stationCache = await readJson<StationCache>(STATION_CACHE).catch((): StationCache => ({}))
const rematch = process.argv.includes('--rematch')
const needMatch = resorts.filter(
  (r) =>
    isUS(r) && (rematch || stationCache[r.id]?.lat !== r.lat || stationCache[r.id]?.lon !== r.lon),
)
if (needMatch.length) {
  try {
    const stations = await getJson<AwdbStation[]>(
      `${AWDB}/stations?stationTriplets=*:*:SNTL&activeOnly=true&returnStationElements=false`,
    )
    for (const r of needMatch)
      stationCache[r.id] = { lat: r.lat, lon: r.lon, stations: matchStations(r, stations) }
    await writeFile(STATION_CACHE, sortedJson(stationCache))
    console.log(`snotel: matched ${needMatch.length} resorts → data/snotel-stations.json`)
  } catch (err) {
    console.warn(`snotel stations: ${(err as Error).message}`)
  }
}

// --- SNOTEL data: hourly depth + SWE for the last HISTORY_DAYS (+1 so day one is complete) ----

const primary = new Map<string, StationMatch>()
for (const r of resorts) {
  const s = stationCache[r.id]?.stations[0]
  if (s) primary.set(r.id, s)
}
const triplets = [...new Set([...primary.values()].map((s) => s.triplet))]
// AWDB dates are station-local; a UTC window a day wider on each side covers every offset.
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 13).replace('T', ' ') + ':00'
const begin = fmt(now - (HISTORY_DAYS + 1) * 86_400_000)
const end = fmt(now + 86_400_000)

const stationData = new Map<string, AwdbStationData>()
await mapLimit(chunk(triplets, AWDB_BATCH), 2, async (batch) => {
  const url =
    `${AWDB}/data?stationTriplets=${batch.join(',')}&elements=SNWD,WTEQ&duration=HOURLY` +
    `&beginDate=${encodeURIComponent(begin)}&endDate=${encodeURIComponent(end)}`
  try {
    for (const d of await getJson<AwdbStationData[]>(url)) stationData.set(d.stationTriplet, d)
  } catch (err) {
    console.warn(`awdb data (${batch[0]}…): ${(err as Error).message}`)
  }
})

function snotelFor(match: StationMatch): SnotelObserved | null {
  const d = stationData.get(match.triplet)
  if (!d) return null
  const values = (code: string) =>
    d.data.find((e) => e.stationElement.elementCode === code)?.values ?? []
  const readings = toReadings(values('SNWD'), match.utcOffset)
  const last = readings.at(-1)
  const swe = values('WTEQ').findLast((v) => v.value != null)
  return {
    triplet: match.triplet,
    name: match.name,
    elevationM: match.elevationM,
    distanceKm: match.distanceKm,
    updatedAt: last ? new Date(last.t).toISOString() : null,
    depthCm: last ? round1(last.depthIn * IN_CM) : null,
    sweMm: swe?.value != null ? Math.round(swe.value * 25.4) : null,
    new24hCm: newSnowSince(readings, 24),
    new72hCm: newSnowSince(readings, 72),
    days: dailyHistory(readings, HISTORY_DAYS),
  }
}

// --- NOHRSC: newest 24h/72h/season grids, sampled at each resort -----------------------------

async function loadGrid(url: string | null): Promise<Grid | null> {
  if (!url) return null
  try {
    return readGeoTiff(await getBytes(url))
  } catch (err) {
    console.warn(`nohrsc ${url}: ${(err as Error).message}`)
    return null
  }
}

const listings: Record<string, string> = {}
for (const folder of monthFolders(now)) {
  try {
    listings[folder] = await getText(`https://www.nohrsc.noaa.gov/snowfall_v2/data/${folder}/`)
  } catch (err) {
    console.warn(`nohrsc listing ${folder}: ${(err as Error).message}`)
  }
}
const files = pickFiles(listings)
const [grid24, grid72, gridSeason] = [
  await loadGrid(files.snow24h),
  await loadGrid(files.snow72h),
  await loadGrid(files.season?.url ?? null),
]

function nohrscFor(r: Resort): NohrscObserved | null {
  const cm = (g: Grid | null) => {
    const v = g?.sample(r.lat, r.lon)
    return v == null ? null : round1(v * IN_CM)
  }
  const out: NohrscObserved = {
    snow24hCm: cm(grid24),
    snow72hCm: cm(grid72),
    seasonCm: cm(gridSeason),
    validAt: files.validAt,
    seasonStart: files.season?.start ?? null,
    seasonEnd: files.season?.end ?? null,
  }
  return out.snow24hCm == null && out.snow72hCm == null && out.seasonCm == null ? null : out
}

// --- Write -----------------------------------------------------------------------------------

const generatedAt = new Date(now).toISOString()
const index: ObservedIndex = { generatedAt, resorts: {} }
let snotelCount = 0
let nohrscCount = 0
await mkdir(OUT_DIR, { recursive: true })
for (const r of resorts) {
  const match = primary.get(r.id)
  const observed: ResortObserved = {
    id: r.id,
    generatedAt,
    snotel: match ? snotelFor(match) : null,
    nohrsc: nohrscFor(r),
  }
  if (observed.snotel) snotelCount++
  if (observed.nohrsc) nohrscCount++
  index.resorts[r.id] = {
    new24hCm: observed.nohrsc?.snow24hCm ?? observed.snotel?.new24hCm ?? null,
    new72hCm: observed.nohrsc?.snow72hCm ?? observed.snotel?.new72hCm ?? null,
  }
  await writeFile(new URL(`${r.id}.json`, OUT_DIR), JSON.stringify(observed))
}
await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index))

console.log(
  `observed: ${resorts.filter(isUS).length} US resorts, snotel ${snotelCount}/${primary.size} matched, ` +
    `nohrsc ${nohrscCount}/${resorts.filter(isUS).length} (grids ${files.validAt ?? 'none'}, season to ${files.season?.end ?? 'none'})`,
)
// Fail only if both sources are down, so one flaky station doesn't block a deploy.
if (snotelCount === 0 && nohrscCount === 0) process.exit(1)
