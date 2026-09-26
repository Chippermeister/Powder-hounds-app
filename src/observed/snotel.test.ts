import { describe, expect, test } from 'vitest'
import {
  awdbTime,
  dailyHistory,
  depthRise,
  matchStations,
  median5,
  newSnowSince,
  toReadings,
  type AwdbStation,
} from './snotel'

describe('depthRise', () => {
  test('a storm then settling counts the storm once', () => {
    expect(depthRise([40, 44, 50, 52, 50, 48, 47])).toBe(12)
  })
  test('two storms with settling between add up', () => {
    expect(depthRise([40, 46, 43, 49])).toBe(12)
  })
  test('±1 in jitter is not snow', () => {
    expect(depthRise([40, 41, 40, 41, 40, 41])).toBe(0)
  })
  test('melt-out is zero', () => {
    expect(depthRise([30, 28, 25, 20])).toBe(0)
  })
  test('empty and single readings are zero', () => {
    expect(depthRise([])).toBe(0)
    expect(depthRise([30])).toBe(0)
  })
})

test('median5 removes a one-hour spike', () => {
  expect(median5([40, 40, 90, 40, 40])).toEqual([40, 40, 40, 40, 40])
})

test('awdbTime reads station standard time', () => {
  expect(new Date(awdbTime('2026-01-15 05:00', -7)).toISOString()).toBe('2026-01-15T12:00:00.000Z')
})

const station = (id: string, lat: number, lon: number, elevationFt: number): AwdbStation => ({
  stationTriplet: `${id}:UT:SNTL`,
  name: id,
  latitude: lat,
  longitude: lon,
  elevation: elevationFt,
  dataTimeZone: -7,
})

test('matchStations keeps close stations in the elevation band, nearest first', () => {
  const resort = { lat: 40.58, lon: -111.63, baseM: 2600, topM: 3200 }
  const matches = matchStations(resort, [
    station('valley', 40.6, -111.64, 5000), // 1,524 m: far below the base
    station('far', 41.2, -111.63, 9000), // ~69 km away
    station('second', 40.6, -111.6, 9000),
    station('nearest', 40.58, -111.64, 8700),
  ])
  expect(matches.map((m) => m.name)).toEqual(['nearest', 'second'])
  expect(matches[0].elevationM).toBe(2652)
})

// Hourly readings: 10 in steady, then 8 in overnight on the last day.
const hours = (day: string, depths: number[]) =>
  depths.map((value, h) => ({ date: `${day} ${String(h).padStart(2, '0')}:00`, value }))
const values = [
  ...hours('2026-01-01', Array(24).fill(10)),
  ...hours('2026-01-02', Array(24).fill(10)),
  ...hours('2026-01-03', [10, 11, 12, 14, 16, 18, 18, 18]),
  { date: '2026-01-03 08:00', value: null },
]

test('newSnowSince measures the window before the latest reading', () => {
  const readings = toReadings(values, -7)
  expect(readings).toHaveLength(56)
  expect(newSnowSince(readings, 24)).toBeCloseTo(8 * 2.54, 1)
  expect(newSnowSince(readings, 72)).toBeCloseTo(8 * 2.54, 1)
  expect(newSnowSince([], 24)).toBeNull()
})

test('dailyHistory puts snow on its day and marks missing days', () => {
  const days = dailyHistory(toReadings(values, -7), 4)
  expect(days.map((d) => d.date)).toEqual(['2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03'])
  expect(days[0]).toEqual({ date: '2025-12-31', newCm: null, depthCm: null })
  expect(days[1].newCm).toBe(0)
  expect(days[3].newCm).toBeCloseTo(8 * 2.54, 1)
  expect(days[3].depthCm).toBeCloseTo(18 * 2.54, 1)
})
