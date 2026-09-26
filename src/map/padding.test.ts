import { expect, test } from 'vitest'
import { isClear, obscuredPadding } from './padding'

const view = { left: 0, top: 0, right: 390, bottom: 844 }

test('a bottom panel pads the bottom and a top bar pads the top (phone)', () => {
  const search = { left: 16, top: 16, right: 334, bottom: 100 }
  const radar = { left: 16, top: 650, right: 374, bottom: 804 }
  expect(obscuredPadding(view, [search, radar], 0)).toEqual({
    top: 100,
    right: 0,
    bottom: 194,
    left: 0,
  })
})

test('a tall side column pads the left (desktop card)', () => {
  const wide = { left: 0, top: 0, right: 1280, bottom: 800 }
  const card = { left: 16, top: 16, right: 400, bottom: 784 }
  expect(obscuredPadding(wide, [card], 10)).toEqual({ top: 10, right: 10, bottom: 10, left: 410 })
})

test('hidden panels are ignored and padding never swallows the map', () => {
  const hidden = { left: 0, top: 0, right: 0, bottom: 0 }
  const sheet = { left: 0, top: 50, right: 390, bottom: 844 }
  const top = { left: 16, top: 16, right: 334, bottom: 100 }
  const pad = obscuredPadding(view, [hidden, sheet, top], 0)
  expect(pad.top + pad.bottom).toBeLessThanOrEqual(844 - 80)
  expect(pad.bottom).toBeGreaterThan(pad.top)
})

test('isClear checks the unpadded window', () => {
  const pad = { top: 100, right: 0, bottom: 200, left: 0 }
  expect(isClear(195, 400, 390, 844, pad)).toBe(true)
  expect(isClear(195, 700, 390, 844, pad)).toBe(false)
})
