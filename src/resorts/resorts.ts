// The resort list the app shows: OpenSkiMap candidates with hand-curated overrides applied.
import candidatesFile from '../../data/resorts.openskimap.json'
import curatedFile from '../../data/resorts.curated.json'
import { mergeResorts, type CuratedFile } from './merge'
import type { ResortCandidate } from './openskimap'

export { mergeResorts, unknownCuratedIds } from './merge'
export type { CuratedFile, Resort, ResortOverride } from './merge'

export const CANDIDATES = candidatesFile.resorts as ResortCandidate[]
export const CURATED = curatedFile as CuratedFile
export const RESORTS = mergeResorts(CANDIDATES, CURATED)

/** Region code → short label for the card, e.g. "US-CO" → "CO". */
export const regionLabel = (region: string) => region.slice(3)
