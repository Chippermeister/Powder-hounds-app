import type { StyleSpecification } from 'maplibre-gl'
import { expect, test } from 'vitest'
import { routeTile, satelliteBase } from './satellite'

// z/x/y of the tile holding a point, as a map would request it.
const tile = (lat: number, lon: number, z: number): [number, number, number] => {
  const n = 2 ** z
  const r = (lat * Math.PI) / 180
  return [
    z,
    Math.floor(((lon + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  ]
}

test('US tiles go to USGS, Canada and border tiles to Esri', () => {
  expect(routeTile(...tile(40.58, -111.64, 13), true)).toBe('usgs') // Alta
  expect(routeTile(...tile(50.11, -122.95, 13), true)).toBe('esri') // Whistler
  expect(routeTile(...tile(49.0, -118.0, 10), true)).toBe('esri') // straddles the border
  expect(routeTile(...tile(48.5, -118.0, 13), true)).toBe('usgs') // just south of it
  expect(routeTile(...tile(40.58, -111.64, 6), true)).toBe('esri') // zoomed out: one look everywhere
})

test('without an Esri key USGS covers what it can, the rest stays empty', () => {
  expect(routeTile(...tile(40.58, -111.64, 13), false)).toBe('usgs')
  expect(routeTile(...tile(50.11, -122.95, 13), false)).toBe('none')
  expect(routeTile(...tile(40.58, -111.64, 6), false)).toBe('usgs')
})

test('satellite base keeps only borders and labels over the imagery', () => {
  const liberty = {
    version: 8,
    sources: { openmaptiles: { type: 'vector', url: 'x' } },
    layers: [
      { id: 'background', type: 'background' },
      { id: 'water', type: 'fill', source: 'openmaptiles' },
      { id: 'boundary_2', type: 'line', source: 'openmaptiles' },
      { id: 'place_city', type: 'symbol', source: 'openmaptiles' },
    ],
  } as StyleSpecification
  const out = satelliteBase(liberty, { type: 'raster', tiles: ['satellite://{z}/{x}/{y}'] })
  expect(out.layers.map((l) => l.id)).toEqual([
    'satellite-bg',
    'satellite-imagery',
    'boundary_2',
    'place_city',
  ])
  expect(out.sources.satellite).toBeDefined()
})
