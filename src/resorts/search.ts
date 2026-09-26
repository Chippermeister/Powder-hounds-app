import type { Resort } from './resorts'

/** Lowercase, accents off, punctuation to spaces, so "big-sky" finds "Big Sky" and "revel" finds "Revelstoke". */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Resorts whose name contains the query. Names that start with it come first, then names with a
 * word that starts with it, then the rest; alphabetical within each group.
 */
export function searchResorts(resorts: Resort[], query: string, limit = 8): Resort[] {
  const q = normalize(query)
  if (!q) return []
  const scored: [number, Resort][] = []
  for (const r of resorts) {
    const name = normalize(r.name)
    const at = name.indexOf(q)
    if (at < 0) continue
    scored.push([at === 0 ? 0 : name.includes(` ${q}`) ? 1 : 2, r])
  }
  return scored
    .sort(([a, ra], [b, rb]) => a - b || ra.name.localeCompare(rb.name))
    .slice(0, limit)
    .map(([, r]) => r)
}
