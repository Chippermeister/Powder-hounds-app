import type {
  HillshadeLayerSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl'

export type MapStyleId = 'standard' | 'dark'

export interface MapStyle {
  id: MapStyleId
  label: string
  url: string
  /** Our hillshade tuned to the basemap: the default white highlights glare on a dark map. */
  hillshade: HillshadeLayerSpecification['paint']
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

/** Sources and layers we add on top of the basemap (see RadarMap and resortLayers). */
export const isOwnId = (id: string) =>
  id === 'terrain' || id === 'hillshade' || /^radar-\d+$/.test(id) || /^resorts?(-|$)/.test(id)

const firstSymbolIndex = (layers: LayerSpecification[]) => {
  const i = layers.findIndex((l) => l.type === 'symbol')
  return i === -1 ? layers.length : i
}

/**
 * `setStyle` replaces everything, so copy our sources and layers from the old style into the new one.
 * Layers that sat under the old basemap's labels (hillshade, radar) go under the new one's labels;
 * the rest (pins) go on top. 3D terrain carries over too; the hillshade takes the new style's paint.
 */
export function carryOver(
  prev: StyleSpecification | undefined,
  next: StyleSpecification,
  hillshade: MapStyle['hillshade'],
): StyleSpecification {
  if (!prev) return next
  const sources = Object.fromEntries(Object.entries(prev.sources).filter(([id]) => isOwnId(id)))
  const cut = firstSymbolIndex(prev.layers)
  const under = prev.layers
    .filter((l, i) => i < cut && isOwnId(l.id))
    .map((l) => (l.type === 'hillshade' ? { ...l, paint: hillshade } : l))
  const over = prev.layers.filter((l, i) => i >= cut && isOwnId(l.id))
  const at = firstSymbolIndex(next.layers)
  return {
    ...next,
    sources: { ...next.sources, ...sources },
    layers: [...next.layers.slice(0, at), ...under, ...next.layers.slice(at), ...over],
    terrain: prev.terrain,
  }
}
