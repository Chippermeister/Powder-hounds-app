import { updatedAgo } from '../forecast/ForecastSection'

/** SNOTEL reports hourly and usually lands within a few hours; older than this gets flagged. */
const STALE_MS = 6 * 3_600_000

/** Why the SNOTEL numbers may be out of date, or null when they're fresh. */
export function snotelStaleness(updatedAt: string | null, now = Date.now()): string | null {
  if (!updatedAt) return 'No recent reading'
  return now - Date.parse(updatedAt) > STALE_MS
    ? `Last reading ${updatedAgo(updatedAt, now)}`
    : null
}
