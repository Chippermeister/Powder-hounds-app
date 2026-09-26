// NWS api.weather.gov gridpoints → daily snowfall totals in the resort's local time zone.
// Docs: https://weather-gov.github.io/api/gridpoints
import { round1 } from './types.ts'

/** The bits of /points/{lat},{lon} we keep. Cached in data/nws-grid.json (it never changes). */
export interface NwsGridRef {
  office: string
  x: number
  y: number
  timeZone: string
}

/** A gridpoint series value: `validTime` is an ISO 8601 interval like "2026-09-25T12:00:00+00:00/PT6H". */
export interface NwsValue {
  validTime: string
  value: number | null
}

const HOUR = 3_600_000

/** "2026-09-25T12:00:00+00:00/P1DT6H" → start time (ms) and length in hours. */
export function parseValidTime(validTime: string): { start: number; hours: number } {
  const [start, duration] = validTime.split('/')
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(duration ?? '')
  if (!m) throw new Error(`Bad NWS validTime: ${validTime}`)
  const hours = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60
  return { start: Date.parse(start), hours }
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()

/** Local calendar date (YYYY-MM-DD) of an instant in an IANA time zone. */
export function localDate(ms: number, timeZone: string): string {
  let f = dateFormats.get(timeZone)
  if (!f) {
    // en-CA formats dates as YYYY-MM-DD.
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dateFormats.set(timeZone, f)
  }
  return f.format(ms)
}

/**
 * Sums a snowfallAmount series (mm) into local days (cm). An interval that crosses midnight is split
 * evenly by hour, e.g. 6 mm over 22:00–04:00 puts 2 mm on the first day and 4 mm on the next.
 * Days before `fromDate` are dropped and at most `maxDays` are returned.
 */
export function dailySnow(
  values: NwsValue[],
  timeZone: string,
  fromDate: string,
  maxDays = 7,
): { date: string; snowCm: number }[] {
  const mmByDate = new Map<string, number>()
  for (const v of values) {
    const { start, hours } = parseValidTime(v.validTime)
    const perHour = (v.value ?? 0) / hours
    for (let h = 0; h < hours; h++) {
      const date = localDate(start + h * HOUR, timeZone)
      mmByDate.set(date, (mmByDate.get(date) ?? 0) + perHour)
    }
  }
  return [...mmByDate]
    .filter(([date]) => date >= fromDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxDays)
    .map(([date, mm]) => ({ date, snowCm: round1(mm / 10) }))
}
