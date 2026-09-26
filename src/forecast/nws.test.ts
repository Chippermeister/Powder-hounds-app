import { describe, expect, test } from 'vitest'
import { dailySnow, localDate, parseValidTime } from './nws'

describe('parseValidTime', () => {
  test.each([
    ['2026-09-25T12:00:00+00:00/PT6H', 6],
    ['2026-09-25T12:00:00+00:00/PT1H', 1],
    ['2026-09-25T12:00:00+00:00/P1D', 24],
    ['2026-09-25T12:00:00+00:00/P1DT6H', 30],
  ])('%s → %i h', (validTime, hours) => {
    expect(parseValidTime(validTime)).toEqual({ start: Date.parse('2026-09-25T12:00:00Z'), hours })
  })

  test('rejects garbage', () => {
    expect(() => parseValidTime('2026-09-25T12:00:00+00:00')).toThrow()
  })
})

test('localDate uses the resort time zone', () => {
  // 03:00 UTC is still the previous evening in Denver (UTC−6 in September).
  expect(localDate(Date.parse('2026-09-26T03:00:00Z'), 'America/Denver')).toBe('2026-09-25')
})

describe('dailySnow', () => {
  test('splits an interval that crosses local midnight by hour', () => {
    // 04:00–10:00 UTC = 22:00–04:00 Denver: 2 h on the 25th, 4 h on the 26th.
    const out = dailySnow(
      [{ validTime: '2026-09-26T04:00:00+00:00/PT6H', value: 60 }],
      'America/Denver',
      '2026-09-25',
    )
    expect(out).toEqual([
      { date: '2026-09-25', snowCm: 2 },
      { date: '2026-09-26', snowCm: 4 },
    ])
  })

  test('drops past days, treats null as 0 and caps the day count', () => {
    const values = [0, 1, 2, 3].map((d) => ({
      validTime: `2026-09-2${4 + d}T18:00:00+00:00/PT6H`,
      value: d === 2 ? null : 10,
    }))
    expect(dailySnow(values, 'America/Denver', '2026-09-25', 2)).toEqual([
      { date: '2026-09-25', snowCm: 1 },
      { date: '2026-09-26', snowCm: 0 },
    ])
  })
})
