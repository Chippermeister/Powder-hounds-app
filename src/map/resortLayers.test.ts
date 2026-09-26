import { expect, test } from 'vitest'
import { RESORTS } from '../resorts/resorts'
import { resortsToGeoJSON } from './resortLayers'

test('every resort becomes a lon/lat point feature keyed by id', () => {
  const fc = resortsToGeoJSON(RESORTS)
  expect(fc.features).toHaveLength(RESORTS.length)
  const alta = fc.features.find((f) => f.properties.id === 'alta-ski-area')
  expect(alta?.geometry.coordinates).toEqual([expect.closeTo(-111.6, 0), expect.closeTo(40.6, 0)])
})
