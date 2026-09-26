import { expect, test } from 'vitest'
import { RADAR_LEGENDS, frameAge, gradientCss } from './legend'

test('frameAge', () => {
  const now = Date.parse('2026-09-26T12:00:00Z')
  expect(frameAge('2026-09-26T11:59:30Z', now)).toBe('Now')
  expect(frameAge('2026-09-26T11:40:00Z', now)).toBe('20 min ago')
  expect(frameAge('2026-09-26T10:55:00Z', now)).toBe('1 h 5 min ago')
  expect(frameAge('2026-09-26T10:00:00Z', now)).toBe('2 h ago')
})

test('legend stops run 0 → 1 in order', () => {
  for (const legend of Object.values(RADAR_LEGENDS)) {
    const positions = legend.stops.map(([, p]) => p)
    expect(positions[0]).toBe(0)
    expect(positions.at(-1)).toBe(1)
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  }
  expect(
    gradientCss([
      ['#000', 0],
      ['#fff', 1],
    ]),
  ).toBe('linear-gradient(to right, #000 0.0%, #fff 100.0%)')
})
