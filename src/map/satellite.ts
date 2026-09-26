import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl'
import { addProtocol } from 'maplibre-gl'

/**
 * Satellite imagery from two servers, picked per tile:
 * - USGS National Map (NAIP aerial photos): free, public domain, sharpest, but US only.
 * - Esri World Imagery: global, needs an API key, free up to 2 M tiles a month.
 * USGS gets every tile it can serve, so Esri (the one that can bill) only covers the rest.
 */
const USGS =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'
const ESRI =
  'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_KEY: string | undefined = import.meta.env.VITE_ESRI_API_KEY

/** Where USGS has imagery at every zoom: the western US below the straight 49th-parallel border. */
const USGS_BOX = { west: -124.8, east: -95.2, south: 32.72, north: 49 }
/** Up to here USGS has low-res world imagery; past it, Canada and the ocean come back blank. */
const USGS_WORLD_MAXZOOM = 8

const PROTOCOL = 'satellite'
export const SATELLITE_SOURCE = 'satellite'

const tileLat = (y: number, n: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI

/**
 * USGS only for tiles wholly inside USGS_BOX: a tile across the border would be half white
 * (USGS paints "no imagery" opaque white, it isn't transparent).
 */
export function routeTile(
  z: number,
  x: number,
  y: number,
  hasEsri = !!ESRI_KEY,
): 'usgs' | 'esri' | 'none' {
  if (z <= USGS_WORLD_MAXZOOM) return hasEsri ? 'esri' : 'usgs'
  const n = 2 ** z
  const west = (x / n) * 360 - 180
  const east = ((x + 1) / n) * 360 - 180
  const inside =
    west >= USGS_BOX.west &&
    east <= USGS_BOX.east &&
    tileLat(y + 1, n) >= USGS_BOX.south &&
    tileLat(y, n) <= USGS_BOX.north
  return inside ? 'usgs' : hasEsri ? 'esri' : 'none'
}

const url = (template: string, z: number, x: number, y: number) =>
  template.replace('{z}', `${z}`).replace('{x}', `${x}`).replace('{y}', `${y}`)

async function fetchTile(src: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
  const res = await fetch(src, { signal })
  return res.ok ? res.arrayBuffer() : null
}

/** USGS answers "no imagery here" (offshore) with a small all-white JPEG. Only small tiles get decoded. */
async function isBlank(data: ArrayBuffer): Promise<boolean> {
  if (data.byteLength > 4000) return false
  const bitmap = await createImageBitmap(new Blob([data]))
  const ctx = new OffscreenCanvas(8, 8).getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, 8, 8)
  return ctx.getImageData(0, 0, 8, 8).data.every((v) => v >= 250)
}

/** A see-through tile, so the dark background shows where there's no imagery. */
const empty = () => createImageBitmap(new ImageData(1, 1))

let registered = false

function register() {
  if (registered) return
  registered = true
  addProtocol(PROTOCOL, async (params, abort) => {
    const [z, x, y] = params.url.slice(`${PROTOCOL}://`.length).split('/').map(Number)
    const route = routeTile(z, x, y)
    if (route === 'usgs') {
      const data = await fetchTile(url(USGS, z, x, y), abort.signal)
      if (data && !(await isBlank(data))) return { data }
    }
    if (route === 'none' || !ESRI_KEY) return { data: await empty() }
    const data = await fetchTile(`${url(ESRI, z, x, y)}?token=${ESRI_KEY}`, abort.signal)
    if (!data) throw new Error(`Esri tile ${z}/${x}/${y} failed`)
    return { data }
  })
}

/** Set up on first use, so the other styles never register the protocol. */
export function satelliteSource(): SourceSpecification {
  register()
  return {
    type: 'raster',
    tiles: [`${PROTOCOL}://{z}/{x}/{y}`],
    tileSize: 256,
    maxzoom: 19,
    attribution: ESRI_KEY
      ? 'Imagery: USGS/USDA NAIP | Powered by Esri | Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      : 'Imagery: USGS/USDA NAIP',
  }
}

/** Basemap lines that still help over imagery: borders. Labels (symbols) are kept too. */
const keepOverImagery = (l: LayerSpecification) =>
  l.type === 'symbol' || l.id.startsWith('boundary')

/**
 * Turn a vector basemap into a satellite one: imagery at the bottom, then only the basemap's
 * borders and labels (places, peaks, roads) on top.
 */
export function satelliteBase(
  next: StyleSpecification,
  source: SourceSpecification,
): StyleSpecification {
  return {
    ...next,
    sources: { ...next.sources, [SATELLITE_SOURCE]: source },
    layers: [
      { id: 'satellite-bg', type: 'background', paint: { 'background-color': '#1b2330' } },
      { id: 'satellite-imagery', type: 'raster', source: SATELLITE_SOURCE },
      ...next.layers.filter(keepOverImagery),
    ],
  }
}
