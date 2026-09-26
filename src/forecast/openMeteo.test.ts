import { describe, expect, test } from 'vitest'
import {
  hourlySnowCm,
  openMeteoUrl,
  snowFraction,
  snowRatio,
  toElevationForecast,
} from './openMeteo'

test('openMeteoUrl batches points into comma lists', () => {
  const url = new URL(
    openMeteoUrl([
      { lat: 39.6, lon: -106.3, elevationM: 2475 },
      { lat: 39.6, lon: -106.3, elevationM: 3527 },
    ]),
  )
  expect(url.searchParams.get('latitude')).toBe('39.6,39.6')
  expect(url.searchParams.get('elevation')).toBe('2475,3527')
  expect(url.searchParams.get('timezone')).toBe('auto')
})

describe('rain/snow split', () => {
  test('fraction is 1 at or below 0 °C, 0 at or above 2 °C', () => {
    expect(snowFraction(-5)).toBe(1)
    expect(snowFraction(0)).toBe(1)
    expect(snowFraction(1)).toBe(0.5)
    expect(snowFraction(2)).toBe(0)
  })

  test('ratio is 10:1 near freezing and 15:1 when very cold', () => {
    expect(snowRatio(0)).toBe(10)
    expect(snowRatio(-4)).toBe(13)
    expect(snowRatio(-20)).toBe(15)
  })

  test('1 mm of water at −1 °C is 1 cm of snow; rain makes none', () => {
    expect(hourlySnowCm(1, -1)).toBe(1)
    expect(hourlySnowCm(5, 4)).toBe(0)
  })
})

test('toElevationForecast groups local hours into days', () => {
  const out = toElevationForecast(
    {
      timezone: 'America/Denver',
      hourly: {
        time: ['2026-09-25T22:00', '2026-09-25T23:00', '2026-09-26T00:00', '2026-09-26T01:00'],
        temperature_2m: [-1, 5, -1, null],
        precipitation: [2, 3, 1, 9],
      },
    },
    3500,
  )
  expect(out).toEqual({
    elevationM: 3500,
    days: [
      { date: '2026-09-25', snowCm: 2, tMaxC: 5, tMinC: -1 },
      { date: '2026-09-26', snowCm: 1, tMaxC: -1, tMinC: -1 },
    ],
  })
})
