import type {
  HillshadeLayerSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'

export type MapStyleId = 'standard' | 'dark' | 'topo' | 'satellite'

export interface MapStyle {
  id: MapStyleId
  label: string
  url: string
  /** Our hillshade tuned to the basemap: the default white highlights glare on a dark map. */
  hillshade: HillshadeLayerSpecification['paint']
  /** Draw contour lines (src/map/contours.ts). */
  contours?: boolean
  /** Imagery under the basemap's labels (src/map/satellite.ts). */
  satellite?: boolean
}

/** Basemaps the user can pick. Radar, pins and hillshade are ours and ride along on every one. */
export const MAP_STYLES: Record<MapStyleId, MapStyle> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    hillshade: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#3d4a5c' },
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    url: 'https://tiles.openfreemap.org/styles/dark',
    hillshade: {
      'hillshade-exaggeration': 0.3,
      'hillshade-shadow-color': '#000000',
      'hillshade-highlight-color': '#4a4a4a',
    },
  },
  topo: {
    id: 'topo',
    label: 'Topo',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    hillshade: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#3d4a5c' },
    contours: true,
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    // Photos already show the relief.
    hillshade: { 'hillshade-exaggeration': 0 },
    satellite: true,
  },
}

/** With no saved pick, the basemap follows the OS light/dark setting like the panels do. */
export function defaultStyle(prefersDark: boolean): MapStyleId {
  return prefersDark ? 'dark' : 'standard'
}

const STORAGE_KEY = 'mapStyle'

/** The user's saved pick, or null. Storage can be missing or throw (private mode), so fail quietly. */
export function loadStyle(): MapStyleId | null {
  try {
    const id = localStorage.getItem(STORAGE_KEY)
    return id && id in MAP_STYLES ? (id as MapStyleId) : null
  } catch {
    return null
  }
}

export function saveStyle(id: MapStyleId) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Not saved; the pick still applies for this visit.
  }
}

const isContourId = (id: string) => /^contours?(-|$)/.test(id)

/** Sources and layers we add on top of the basemap (see RadarMap, resortLayers, contours). */
export const isOwnId = (id: string) =>
  id === 'terrain' ||
  id === 'hillshade' ||
  /^radar-\d+$/.test(id) ||
  /^resorts?(-|$)/.test(id) ||
  isContourId(id)

/** Where the basemap's own labels start. Our layers (contour labels are symbols too) don't count. */
export function firstLabelIndex(layers: LayerSpecification[]): number {
  const i = layers.findIndex((l) => l.type === 'symbol' && !isOwnId(l.id))
  return i === -1 ? layers.length : i
}

/** Contour source + layers to add when switching to a style that wants them. */
export interface Contours {
  id: string
  source: SourceSpecification
  layers: LayerSpecification[]
}

export interface Extras {
  contours?: Contours
  /** Reshapes the downloaded basemap before our layers go in (satellite: imagery + labels only). */
  base?: (next: StyleSpecification) => StyleSpecification
}

/**
 * `setStyle` replaces everything, so copy our sources and layers from the old style into the new one.
 * Layers that sat under the old basemap's labels (hillshade, radar) go under the new one's labels;
 * the rest (pins) go on top. 3D terrain carries over too; the hillshade takes the new style's paint.
 * Contours are dropped, or added just above the hillshade when `contours` is given.
 */
export function carryOver(
  prev: StyleSpecification | undefined,
  downloaded: StyleSpecification,
  target: MapStyle,
  { contours, base }: Extras = {},
): StyleSpecification {
  const next = base ? base(downloaded) : downloaded
  if (!prev) return next
  const keep = (id: string) => isOwnId(id) && (!isContourId(id) || !!contours)
  const sources = Object.fromEntries(Object.entries(prev.sources).filter(([id]) => keep(id)))
  const cut = firstLabelIndex(prev.layers)
  let under: LayerSpecification[] = prev.layers
    .filter((l, i) => i < cut && keep(l.id))
    .map((l): LayerSpecification =>
      l.type === 'hillshade' ? { ...l, paint: target.hillshade } : l,
    )
  const over = prev.layers.filter((l, i) => i >= cut && keep(l.id))
  if (contours && !sources[contours.id]) {
    sources[contours.id] = contours.source
    const h = under.findIndex((l) => l.id === 'hillshade') + 1
    under = [...under.slice(0, h), ...contours.layers, ...under.slice(h)]
  }
  const at = firstLabelIndex(next.layers)
  return {
    ...next,
    sources: { ...next.sources, ...sources },
    layers: [...next.layers.slice(0, at), ...under, ...next.layers.slice(at), ...over],
    terrain: prev.terrain,
  }
}
