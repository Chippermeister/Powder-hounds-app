import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { ObservedIndex } from '../observed/types'
import type { Resort } from '../resorts/resorts'
import { NO_DATA, snowColorExpression, snowTextColorExpression } from './snowColors'

const SOURCE = 'resorts'
const FONT = ['Noto Sans Bold'] // must be a font the basemap style's glyph server has
const INK = '#1d1d1f'

export const RESORT_LAYERS = {
  clusters: 'resort-clusters',
  clusterCount: 'resort-cluster-count',
  pins: 'resort-pins',
  labels: 'resort-labels',
  selected: 'resort-selected',
} as const

export interface PinProps {
  id: string
  name: string
  /** Observed 72 h snow in cm, or NO_DATA */
  snow72: number
}

/** Pins only carry what the map draws; the card looks the rest up by id. */
export function resortsToGeoJSON(
  resorts: Resort[],
  observed?: ObservedIndex | null,
): FeatureCollection<Point, PinProps> {
  return {
    type: 'FeatureCollection',
    features: resorts.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: {
        id: r.id,
        name: r.name,
        snow72: observed?.resorts[r.id]?.new72hCm ?? NO_DATA,
      },
    })),
  }
}

/** Swap in pins coloured by the latest observations. */
export function setResortSnow(map: MapLibreMap, resorts: Resort[], observed: ObservedIndex) {
  map.getSource<GeoJSONSource>(SOURCE)?.setData(resortsToGeoJSON(resorts, observed))
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
    // A cluster takes the colour of its snowiest member.
    clusterProperties: { maxSnow72: ['max', ['get', 'snow72']] },
    attribution: '<a href="https://openskimap.org">Resorts: © OpenSkiMap</a> (ODbL)',
  })

  map.addLayer({
    id: RESORT_LAYERS.clusters,
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': snowColorExpression(['get', 'maxSnow72']),
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
    paint: { 'text-color': snowTextColorExpression(['get', 'maxSnow72']) },
  })
  map.addLayer({
    id: RESORT_LAYERS.pins,
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': snowColorExpression(['get', 'snow72']),
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
    // A ring around the pin, so its snow colour still shows.
    paint: {
      'circle-opacity': 0,
      'circle-radius': 11,
      'circle-stroke-width': 3,
      'circle-stroke-color': INK,
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
    paint: { 'text-color': INK, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
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
