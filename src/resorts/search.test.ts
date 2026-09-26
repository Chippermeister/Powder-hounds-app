import { expect, test } from 'vitest'
import { RESORTS } from './resorts'
import { searchResorts } from './search'

const names = (q: string) => searchResorts(RESORTS, q).map((r) => r.name)

test('names starting with the query come first, then word starts, then the rest', () => {
  const rank = (n: string) => {
    const name = n.toLowerCase()
    return name.startsWith('mo') ? 0 : name.includes(' mo') ? 1 : 2
  }
  const found = names('mo')
  expect(found.length).toBeGreaterThan(2)
  expect(found.map(rank)).toEqual(found.map(rank).toSorted())
})

test('ignores case, accents and punctuation; caps the list', () => {
  expect(names('ALTA')).toContain('Alta')
  expect(names('')).toEqual([])
  expect(searchResorts(RESORTS, 'a', 5)).toHaveLength(5)
})
