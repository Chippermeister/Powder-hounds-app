import type { ExpressionSpecification, LayerSpecification, SourceSpecification } from 'maplibre-gl'
import { addProtocol } from 'maplibre-gl'
import mlcontour from 'maplibre-contour'

/** AWS Open Data elevation tiles: hillshade, 3D terrain, and (Topo style) contour lines. */
export const TERRAIN_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

export const CONTOUR_SOURCE = 'contours'
const CONTOUR_LAYER = 'contours' // layer name inside the generated vector tiles
const FEET_PER_METRE = 3.28084
const COLOR = '#9a6b4a'

/**
 * Contours are drawn in the browser: maplibre-contour fetches the same elevation tiles as the
 * hillshade and traces lines through them (in a worker), serving the result as vector tiles.
 */
let dem: InstanceType<typeof mlcontour.DemSource> | undefined

/** Set up on first use, so Standard/Dark never start the contour worker. */
export function contourSource(): SourceSpecification {
  if (!dem) {
    dem = new mlcontour.DemSource({
      url: TERRAIN_TILES,
      encoding: 'terrarium',
      maxzoom: 13,
      worker: true,
    })
    dem.setupMaplibre({ addProtocol })
  }
  return {
    type: 'vector',
    maxzoom: 15,
    tiles: [
      dem.contourProtocolUrl({
        multiplier: FEET_PER_METRE,
        // [minor, major] spacing in feet per zoom. Lines start at z10; below that they're noise.
        thresholds: { 10: [500, 2000], 11: [200, 1000], 13: [100, 500], 14: [40, 200] },
        contourLayer: CONTOUR_LAYER,
        elevationKey: 'ele',
        levelKey: 'level',
      }),
    ],
  }
}

const major: ExpressionSpecification = ['>', ['get', 'level'], 0]

export const CONTOUR_LAYERS: LayerSpecification[] = [
  {
    id: 'contour-lines',
    type: 'line',
    source: CONTOUR_SOURCE,
    'source-layer': CONTOUR_LAYER,
    minzoom: 10,
    paint: {
      'line-color': COLOR,
      'line-opacity': ['case', major, 0.7, 0.4],
      'line-width': ['case', major, 1.1, 0.5],
    },
  },
  {
    id: 'contour-labels',
    type: 'symbol',
    source: CONTOUR_SOURCE,
    'source-layer': CONTOUR_LAYER,
    minzoom: 11,
    filter: major,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' ft'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
    },
    paint: { 'text-color': COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
  },
]
