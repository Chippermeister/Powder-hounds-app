// Radar products served over WMS, and helpers to turn their capabilities into animation frames.
// Findings from the M1 spike (2026-09-25):
// - Both servers send `Access-Control-Allow-Origin: *` on GetMap images, so MapLibre can draw them with no proxy.
// - nowCOAST lists irregular timestamps (~4 min apart) and snaps to the nearest one (nearestValue="1").
// - GeoMet declares an interval (start/end/PT6M) and does NOT snap (nearestValue="0"): times must be exact.

export type RadarProductId = 'reflectivity' | 'snowRate'

export interface RadarProduct {
  id: RadarProductId
  label: string
  wmsUrl: string
  layer: string
  /** Small per-layer capabilities document (the full nowCOAST one is ~230 KB). */
  capabilitiesUrl: string
  attribution: string
}

const NOWCOAST_LAYER_URL =
  'https://nowcoast.noaa.gov/geoserver/weather_radar/conus_base_reflectivity_mosaic/ows'
const GEOMET_URL = 'https://geo.weather.gc.ca/geomet'

export const RADAR_PRODUCTS: Record<RadarProductId, RadarProduct> = {
  reflectivity: {
    id: 'reflectivity',
    label: 'Radar',
    wmsUrl: NOWCOAST_LAYER_URL,
    layer: 'conus_base_reflectivity_mosaic',
    capabilitiesUrl: `${NOWCOAST_LAYER_URL}?service=WMS&version=1.3.0&request=GetCapabilities`,
    attribution: 'Radar: NOAA MRMS via nowCOAST',
  },
  snowRate: {
    id: 'snowRate',
    label: 'Snow rate',
    wmsUrl: GEOMET_URL,
    layer: 'RADAR_1KM_RSNO',
    capabilitiesUrl: `${GEOMET_URL}?service=WMS&version=1.3.0&request=GetCapabilities&layer=RADAR_1KM_RSNO`,
    attribution: 'Snow rate: Environment and Climate Change Canada (MSC GeoMet)',
  },
}

/** Tile size we request. 512 px means 4× fewer requests than 256 px, which matters with ~12 frames. */
export const RADAR_TILE_SIZE = 512

/** MapLibre tile URL template. MapLibre substitutes `{bbox-epsg-3857}` for each tile. */
export function radarTileUrl(product: RadarProduct, time: string): string {
  const params = [
    'service=WMS',
    'version=1.3.0',
    'request=GetMap',
    `layers=${product.layer}`,
    'styles=',
    'format=image/png',
    'transparent=true',
    'crs=EPSG:3857',
    `width=${RADAR_TILE_SIZE}`,
    `height=${RADAR_TILE_SIZE}`,
    `time=${time}`,
    'bbox={bbox-epsg-3857}',
  ]
  return `${product.wmsUrl}?${params.join('&')}`
}

/** ISO 8601 duration like PT6M or PT1H into milliseconds (only the hour/minute/second forms WMS uses). */
export function parseDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) throw new Error(`Unsupported duration: ${iso}`)
  const [, h = '0', min = '0', s = '0'] = m
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000
}

/**
 * Expand a WMS time dimension value into a sorted list of times (ms since epoch).
 * Handles both forms: a comma list ("t1,t2,…") and intervals ("start/end/PT6M"), or a mix of them.
 */
export function expandTimeDimension(value: string): number[] {
  const times: number[] = []
  for (const part of value.trim().split(',')) {
    const piece = part.trim()
    if (!piece) continue
    const [start, end, step] = piece.split('/')
    if (end === undefined) {
      times.push(Date.parse(start))
      continue
    }
    const stepMs = parseDuration(step)
    for (let t = Date.parse(start); t <= Date.parse(end); t += stepMs) times.push(t)
  }
  return times.filter((t) => !Number.isNaN(t)).sort((a, b) => a - b)
}

/** Read the `time` dimension of the first layer that declares one in a WMS 1.3.0 capabilities XML. */
export function timesFromCapabilities(xml: string): number[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const dims = Array.from(doc.getElementsByTagName('Dimension'))
  const time = dims.find((d) => d.getAttribute('name') === 'time')
  if (!time?.textContent) throw new Error('No time dimension in capabilities')
  return expandTimeDimension(time.textContent)
}

/**
 * Choose up to `count` frames, walking back from the latest time and keeping frames at least `minStepMs` apart.
 * Returned oldest → newest, ready to animate.
 */
export function pickFrames(times: number[], count = 12, minStepMs = 10 * 60_000): number[] {
  const picked: number[] = []
  for (let i = times.length - 1; i >= 0 && picked.length < count; i--) {
    const last = picked[picked.length - 1]
    if (last === undefined || last - times[i] >= minStepMs) picked.push(times[i])
  }
  return picked.reverse()
}

/** WMS wants ISO 8601 UTC. GeoMet rejects milliseconds it didn't advertise, so drop them. */
export function toWmsTime(ms: number): string {
  return new Date(ms).toISOString().replace('.000Z', 'Z')
}

export async function fetchRadarFrames(
  product: RadarProduct,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(product.capabilitiesUrl, { signal })
  if (!res.ok) throw new Error(`${product.label} capabilities: HTTP ${res.status}`)
  return pickFrames(timesFromCapabilities(await res.text())).map(toWmsTime)
}
