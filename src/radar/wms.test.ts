import { describe, expect, test } from 'vitest'
import {
  RADAR_PRODUCTS,
  expandTimeDimension,
  parseDuration,
  pickFrames,
  radarTileUrl,
  timesFromCapabilities,
  toWmsTime,
} from './wms'

const min = 60_000

describe('parseDuration', () => {
  test('reads minute and hour steps', () => {
    expect(parseDuration('PT6M')).toBe(6 * min)
    expect(parseDuration('PT1H30M')).toBe(90 * min)
  })
  test('rejects forms WMS radar does not use', () => {
    expect(() => parseDuration('P1D')).toThrow()
  })
})

describe('expandTimeDimension', () => {
  test('expands a GeoMet-style interval', () => {
    const times = expandTimeDimension('2026-09-25T20:00:00Z/2026-09-25T20:30:00Z/PT6M')
    expect(times).toHaveLength(6)
    expect(toWmsTime(times[5])).toBe('2026-09-25T20:30:00Z')
  })
  test('reads a nowCOAST-style list with milliseconds', () => {
    const times = expandTimeDimension('2026-09-25T23:08:13.000Z,2026-09-25T23:04:12.000Z')
    expect(times.map(toWmsTime)).toEqual(['2026-09-25T23:04:12Z', '2026-09-25T23:08:13Z'])
  })
})

test('timesFromCapabilities finds the time dimension', () => {
  const xml = `<WMS_Capabilities><Capability><Layer><Layer>
    <Dimension name="elevation">0</Dimension>
    <Dimension name="time" units="ISO8601">2026-09-25T20:00:00Z/2026-09-25T20:12:00Z/PT6M</Dimension>
  </Layer></Layer></Capability></WMS_Capabilities>`
  expect(timesFromCapabilities(xml)).toHaveLength(3)
})

describe('pickFrames', () => {
  const start = Date.parse('2026-09-25T20:00:00Z')
  test('walks back from the latest time, keeping the minimum spacing', () => {
    const everyFourMin = Array.from({ length: 30 }, (_, i) => start + i * 4 * min)
    const frames = pickFrames(everyFourMin, 3, 10 * min)
    // 116 is the latest; 112 and 108 are too close, 104 is the next that's ≥10 min back, then 92.
    expect(frames).toEqual([92, 104, 116].map((m) => start + m * min))
  })
  test('returns fewer frames when history is short', () => {
    expect(pickFrames([start], 12)).toEqual([start])
  })
})

test('radarTileUrl leaves the bbox placeholder for MapLibre', () => {
  const url = radarTileUrl(RADAR_PRODUCTS.snowRate, '2026-09-25T20:00:00Z')
  expect(url).toContain('layers=RADAR_1KM_RSNO')
  expect(url).toContain('time=2026-09-25T20:00:00Z')
  expect(url).toContain('bbox={bbox-epsg-3857}')
})
