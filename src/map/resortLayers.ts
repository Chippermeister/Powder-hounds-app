import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Resort } from '../resorts/resorts'

const SOURCE = 'resorts'
const FONT = ['Noto Sans Bold'] // must be a font the basemap style's glyph server has
const ACCENT = '#0a84ff'

export const RESORT_LAYERS = {
  clusters: 'resort-clusters',
  clusterCount: 'resort-cluster-count',
  pins: 'resort-pins',
  labels: 'resort-labels',
  selected: 'resort-selected',
} as const

/** Pins only carry what the map draws; the card looks the rest up by id. */
export function resortsToGeoJSON(
  resorts: Resort[],
): FeatureCollection<Point, { id: string; name: string }> {
  return {
    type: 'FeatureCollection',
    features: resorts.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { id: r.id, name: r.name },
    })),
  }
}

/**
 * Clustering happens inside MapLibre (supercluster on the worker): nearby pins merge into a
 * counted bubble when zoomed out and split apart as you zoom in. Tapping a bubble zooms to split it.
 */
export function addResortLayers(
  map: MapLibreMap,
  resorts: Resort[],
  onSelect: (id: string) => void,
) {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: resortsToGeoJSON(resorts),
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 8,
    attribution: '<a href="https://openskimap.org">Resorts: © OpenSkiMap</a> (ODbL)',
  })

  map.addLayer({
    id: RESORT_LAYERS.clusters,
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ACCENT,
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 22],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  })
  map.addLayer({
    id: RESORT_LAYERS.clusterCount,
    type: 'symbol',
    source: SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': FONT,
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  })
  map.addLayer({
    id: RESORT_LAYERS.pins,
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ACCENT,
      'circle-radius': 7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  })
  map.addLayer({
    id: RESORT_LAYERS.selected,
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'id'], ''],
    paint: {
      'circle-color': '#ffffff',
      'circle-radius': 10,
      'circle-stroke-width': 4,
      'circle-stroke-color': ACCENT,
    },
  })
  map.addLayer({
    id: RESORT_LAYERS.labels,
    type: 'symbol',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    minzoom: 6,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT,
      'text-size': 12,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': '#1d1d1f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })

  map.on('click', RESORT_LAYERS.clusters, async (e) => {
    const feature = e.features?.[0]
    if (!feature || feature.geometry.type !== 'Point') return
    const source = map.getSource<GeoJSONSource>(SOURCE)
    const zoom = await source?.getClusterExpansionZoom(feature.properties.cluster_id)
    map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
  })
  map.on('click', RESORT_LAYERS.pins, (e) => {
    const id = e.features?.[0]?.properties.id
    if (typeof id === 'string') onSelect(id)
  })
  for (const layer of [RESORT_LAYERS.clusters, RESORT_LAYERS.pins]) {
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }
}

export function highlightResort(map: MapLibreMap, id: string | null) {
  map.setFilter(RESORT_LAYERS.selected, ['==', ['get', 'id'], id ?? ''])
}
