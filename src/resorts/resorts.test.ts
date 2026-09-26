import { describe, expect, test } from 'vitest'
import type { ResortCandidate } from './openskimap'
import { CANDIDATES, CURATED, RESORTS, mergeResorts, unknownCuratedIds } from './resorts'

const candidate = (id: string): ResortCandidate => ({
  id,
  openSkiMapId: id,
  name: id,
  region: 'US-UT',
  lat: 40,
  lon: -111,
  topM: 3200,
  baseM: 2600,
  verticalM: 600,
  lifts: 5,
  website: null,
})

describe('mergeResorts', () => {
  test('drops excluded ids and applies overrides', () => {
    const out = mergeResorts([candidate('alta'), candidate('club')], {
      exclude: { club: 'private' },
      resorts: { alta: { name: 'Alta', blurb: 'Deep.' } },
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'alta', name: 'Alta', blurb: 'Deep.', verticalM: 600 })
  })
})

describe('data/resorts.curated.json', () => {
  test('every curated id matches an OpenSkiMap candidate', () => {
    expect(unknownCuratedIds(CANDIDATES, CURATED)).toEqual([])
  })

  test('links are https', () => {
    for (const r of RESORTS) {
      for (const url of [r.website, r.webcamUrl]) if (url) expect(url).toMatch(/^https:\/\//)
    }
  })

  test('ids are unique', () => {
    expect(new Set(RESORTS.map((r) => r.id)).size).toBe(RESORTS.length)
  })
})
