import { expect, test } from 'vitest'
import { RESORTS } from '../resorts/resorts'
import { resortsToGeoJSON } from './resortLayers'
import { NO_DATA } from './snowColors'

test('every resort becomes a lon/lat point feature keyed by id', () => {
  const fc = resortsToGeoJSON(RESORTS)
  expect(fc.features).toHaveLength(RESORTS.length)
  const alta = fc.features.find((f) => f.properties.id === 'alta-ski-area')
  expect(alta?.geometry.coordinates).toEqual([expect.closeTo(-111.6, 0), expect.closeTo(40.6, 0)])
})

test('pins carry observed 72h snow, or NO_DATA when the index has none', () => {
  const observed = {
    generatedAt: '2026-01-14T12:00:00Z',
    resorts: { 'alta-ski-area': { new24hCm: 5, new72hCm: 30.5 } },
  }
  const fc = resortsToGeoJSON(RESORTS, observed)
  const snow = (id: string) => fc.features.find((f) => f.properties.id === id)?.properties.snow72
  expect(snow('alta-ski-area')).toBe(30.5)
  expect(snow('whistler-blackcomb')).toBe(NO_DATA)
})
