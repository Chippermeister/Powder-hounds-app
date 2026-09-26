// Turns OpenSkiMap's ski_areas.geojson (ODbL) into a small list of candidate resorts.
// Pure functions only: the fetch script and tests both use them.

/** v1 area: western US states plus British Columbia and Alberta (ISO 3166-2 codes). */
export const V1_REGIONS = new Set([
  'US-WA',
  'US-OR',
  'US-CA',
  'US-NV',
  'US-ID',
  'US-MT',
  'US-WY',
  'US-UT',
  'US-CO',
  'US-AZ',
  'US-NM',
  'CA-BC',
  'CA-AB',
])

/** Smallest vertical drop (m) that counts as a destination resort rather than a rope-tow hill. */
export const MIN_VERTICAL_M = 250

/** Nordic trail networks are tagged "downhill" by some mappers but have no lifts. */
export const MIN_LIFTS = 1

type Position = [number, number, ...number[]]
type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }

interface Elevations {
  minElevation?: number | null
  maxElevation?: number | null
}

/** The subset of an OpenSkiMap ski-area feature we read. Everything is optional because the data is crowd-sourced. */
export interface SkiAreaFeature {
  geometry: Geometry | null
  properties: {
    id: string
    name?: string | null
    status?: string | null
    activities?: string[]
    websites?: string[]
    /** Every region the area touches; cross-border areas list several. */
    places?: { iso3166_2?: string | null }[] | null
    statistics?:
      | (Elevations & {
          runs?: Elevations
          lifts?: Elevations & { byType?: Record<string, { count?: number }> }
        })
      | null
  }
}

export interface ResortCandidate {
  /** Stable, URL-safe id used for `resorts/{id}.json` from M3 on. */
  id: string
  openSkiMapId: string
  name: string
  region: string
  lat: number
  lon: number
  topM: number
  baseM: number
  verticalM: number
  lifts: number
  website: string | null
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** A representative point: the Point itself, or the mean vertex of the largest polygon's outer ring. */
export function representativePoint(geometry: Geometry): [number, number] {
  if (geometry.type === 'Point') return [geometry.coordinates[0], geometry.coordinates[1]]
  const rings =
    geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a))
  // GeoJSON rings repeat the first vertex at the end; drop it so it isn't counted twice.
  const pts = ring.slice(0, -1)
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return [lon, lat]
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp

export function toCandidate(feature: SkiAreaFeature): Omit<ResortCandidate, 'id'> | null {
  const p = feature.properties
  const region = p.places?.map((pl) => pl.iso3166_2 ?? '').find((r) => V1_REGIONS.has(r))
  if (!feature.geometry || !p.name || !region) return null
  if ((p.status ?? 'operating') !== 'operating') return null
  if (!p.activities?.includes('downhill')) return null

  const s = p.statistics ?? {}
  const top = s.maxElevation ?? s.runs?.maxElevation ?? s.lifts?.maxElevation
  const base = s.minElevation ?? s.runs?.minElevation ?? s.lifts?.minElevation
  if (top == null || base == null || top - base < MIN_VERTICAL_M) return null

  const lifts = Object.values(s.lifts?.byType ?? {}).reduce((n, t) => n + (t.count ?? 0), 0)
  if (lifts < MIN_LIFTS) return null
  const [lon, lat] = representativePoint(feature.geometry)
  return {
    openSkiMapId: p.id,
    name: p.name,
    region,
    lat: round(lat, 4),
    lon: round(lon, 4),
    topM: Math.round(top),
    baseM: Math.round(base),
    verticalM: Math.round(top - base),
    lifts,
    website: p.websites?.[0] ?? null,
  }
}

/** Filter to v1 candidates, biggest vertical first, with unique slug ids. */
export function buildCandidates(features: SkiAreaFeature[]): ResortCandidate[] {
  const kept = features
    .map(toCandidate)
    .filter((c) => c !== null)
    .sort((a, b) => b.verticalM - a.verticalM || a.name.localeCompare(b.name))

  const used = new Set<string>()
  return kept.map((c) => {
    let id = slugify(c.name)
    // Same name in two places (e.g. two "Snow King"s): suffix the region, then a counter.
    if (used.has(id)) id = `${id}-${c.region.slice(3).toLowerCase()}`
    for (let n = 2; used.has(id); n++) id = `${slugify(c.name)}-${n}`
    used.add(id)
    return { id, ...c }
  })
}
