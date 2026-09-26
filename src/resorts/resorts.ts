// The resort list the app shows: OpenSkiMap candidates with hand-curated overrides applied.
import candidatesFile from '../../data/resorts.openskimap.json'
import curatedFile from '../../data/resorts.curated.json'
import type { ResortCandidate } from './openskimap'

/**
 * Fields a curator can set or override. All optional so new ones (tags, snow stake cam,
 * NWS zone, SNOTEL station...) can be added later without touching existing entries.
 */
export interface ResortOverride {
  name?: string
  website?: string | null
  webcamUrl?: string
  blurb?: string
  lat?: number
  lon?: number
}

export interface CuratedFile {
  /** id → reason it's left off the map */
  exclude: Record<string, string>
  resorts: Record<string, ResortOverride>
}

export type Resort = ResortCandidate & ResortOverride

export function mergeResorts(candidates: ResortCandidate[], curated: CuratedFile): Resort[] {
  return candidates
    .filter((c) => !(c.id in curated.exclude))
    .map((c) => ({ ...c, ...curated.resorts[c.id] }))
}

/** Curated ids that match no candidate: usually a renamed OpenSkiMap area. Kept at zero by a test. */
export function unknownCuratedIds(candidates: ResortCandidate[], curated: CuratedFile): string[] {
  const ids = new Set(candidates.map((c) => c.id))
  return [...Object.keys(curated.exclude), ...Object.keys(curated.resorts)].filter(
    (id) => !ids.has(id),
  )
}

export const CANDIDATES = candidatesFile.resorts as ResortCandidate[]
export const CURATED = curatedFile as CuratedFile
export const RESORTS = mergeResorts(CANDIDATES, CURATED)

/** Region code → short label for the card, e.g. "US-CO" → "CO". */
export const regionLabel = (region: string) => region.slice(3)
