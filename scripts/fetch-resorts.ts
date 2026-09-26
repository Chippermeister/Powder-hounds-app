// Downloads OpenSkiMap ski areas and writes data/resorts.openskimap.json (v1 candidates).
// Run: npm run resorts:fetch   (needs network access to tiles.openskimap.org)
// Data © OpenSkiMap.org contributors / OpenStreetMap, ODbL.
import { writeFile } from 'node:fs/promises'
import { buildCandidates, type SkiAreaFeature } from '../src/resorts/openskimap.ts'

const SOURCE = 'https://tiles.openskimap.org/geojson/ski_areas.geojson'
const OUT = new URL('../data/resorts.openskimap.json', import.meta.url)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`${SOURCE}: HTTP ${res.status}`)
const { features } = (await res.json()) as { features: SkiAreaFeature[] }

const resorts = buildCandidates(features)
const out = {
  source: SOURCE,
  license: 'ODbL 1.0 — © OpenSkiMap.org contributors, © OpenStreetMap contributors',
  fetchedAt: new Date().toISOString(),
  resorts,
}
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`${features.length} ski areas → ${resorts.length} v1 candidates → ${OUT.pathname}`)
