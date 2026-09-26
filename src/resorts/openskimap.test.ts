import { describe, expect, test } from 'vitest'
import { buildCandidates, representativePoint, slugify, type SkiAreaFeature } from './openskimap'

function area(
  id: string,
  overrides: Partial<SkiAreaFeature['properties']> = {},
  geometry: SkiAreaFeature['geometry'] = { type: 'Point', coordinates: [-106.95, 39.2] },
): SkiAreaFeature {
  return {
    geometry,
    properties: {
      id,
      name: id,
      status: 'operating',
      activities: ['downhill'],
      websites: [`https://${id}.example`],
      places: [{ iso3166_2: 'US-CO' }],
      statistics: {
        minElevation: 2400,
        maxElevation: 3600,
        lifts: { byType: { chair_lift: { count: 8 }, gondola: { count: 1 } } },
      },
      ...overrides,
    },
  }
}

describe('slugify', () => {
  test('makes ascii, dash-separated ids', () => {
    expect(slugify('Revelstoke Mountain Resort')).toBe('revelstoke-mountain-resort')
    expect(slugify('Sun Peaks – Tod Mountain')).toBe('sun-peaks-tod-mountain')
    expect(slugify('Ski Montréal & Co.')).toBe('ski-montreal-and-co')
  })
})

describe('representativePoint', () => {
  test('averages the outer ring without the closing vertex', () => {
    const square = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ] as [number, number][]
    expect(representativePoint({ type: 'Polygon', coordinates: [square] })).toEqual([1, 1])
  })
})

describe('buildCandidates', () => {
  test('keeps operating downhill areas in the v1 regions', () => {
    const [c] = buildCandidates([area('aspen')])
    expect(c).toMatchObject({ id: 'aspen', verticalM: 1200, lifts: 9, region: 'US-CO', lat: 39.2 })
  })

  test('drops areas outside v1, closed, nordic-only, small, unnamed or liftless', () => {
    const out = buildCandidates([
      area('vermont', { places: [{ iso3166_2: 'US-VT' }] }),
      area('closed', { status: 'abandoned' }),
      area('xc', { activities: ['nordic'] }),
      area('bump', { statistics: { minElevation: 1000, maxElevation: 1100 } }),
      area('nameless', { name: null }),
      area('trails', { statistics: { minElevation: 1000, maxElevation: 2000 } }),
    ])
    expect(out).toEqual([])
  })

  test('uses the first v1 region of a cross-border area', () => {
    const [c] = buildCandidates([
      area('border', { places: [{ iso3166_2: 'US-MT' }, { iso3166_2: 'CA-BC' }] }),
    ])
    expect(c.region).toBe('US-MT')
  })

  test('sorts by vertical and de-duplicates ids', () => {
    const out = buildCandidates([
      area('a', { name: 'Snow King' }),
      area('b', { name: 'Snow King', places: [{ iso3166_2: 'US-WY' }] }),
      area('big', {
        statistics: {
          minElevation: 1000,
          maxElevation: 3000,
          lifts: { byType: { t_bar: { count: 1 } } },
        },
      }),
    ])
    expect(out.map((c) => c.id)).toEqual(['big', 'snow-king', 'snow-king-wy'])
  })
})
