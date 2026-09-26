import { expect, test } from 'vitest'
import { monthFolders, NOHRSC_DATA, pickFiles } from './nohrsc'

const listing = (...names: string[]) => names.map((n) => `<a href="${n}">${n}</a>`).join('\n')

test('monthFolders lists this month and last, across a year boundary', () => {
  expect(monthFolders(Date.parse('2026-01-01T03:00:00Z'))).toEqual(['202601', '202512'])
})

test('pickFiles takes the newest time with both 24h and 72h, and the newest season file', () => {
  const files = pickFiles({
    '202609': listing(
      'sfav2_CONUS_24h_2026092512.tif',
      'sfav2_CONUS_72h_2026092512.tif',
      'sfav2_CONUS_24h_2026092600.tif', // 72h for 00Z not out yet
      'sfav2_CONUS_24h_2026092512.nc',
      'sfav2_CONUS_2025093012_to_2026092412.tif',
      'sfav2_CONUS_2025093012_to_2026092512.tif',
    ),
    '202608': listing('sfav2_CONUS_2025093012_to_2026083112.tif'),
  })
  expect(files).toEqual({
    validAt: '2026-09-25T12:00:00Z',
    snow24h: `${NOHRSC_DATA}/202609/sfav2_CONUS_24h_2026092512.tif`,
    snow72h: `${NOHRSC_DATA}/202609/sfav2_CONUS_72h_2026092512.tif`,
    season: {
      url: `${NOHRSC_DATA}/202609/sfav2_CONUS_2025093012_to_2026092512.tif`,
      start: '2025-09-30T12:00:00Z',
      end: '2026-09-25T12:00:00Z',
    },
  })
})

test('pickFiles with nothing listed', () => {
  expect(pickFiles({})).toEqual({ validAt: null, snow24h: null, snow72h: null, season: null })
})
