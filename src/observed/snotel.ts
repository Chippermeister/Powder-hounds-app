// NRCS SNOTEL via the AWDB REST API: station matching and "new snow" from hourly snow depth.
// Docs: https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html
// SNOTEL measures depth (SNWD) and water (WTEQ), not snowfall, so new snow = depth rises.
// Depth settles as it falls, so these read lower than a resort's snow stake. We say so on the card.

export const AWDB = 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1'

/** The bits of /stations we use. Elevation is in feet; the rest of the API is in inches. */
export interface AwdbStation {
  stationTriplet: string
  name: string
  latitude: number
  longitude: number
  elevation: number
  /** Hours from UTC of the station's (standard) clock; data dates are in this time. */
  dataTimeZone: number
}

/** A matched station, cached per resort in data/snotel-stations.json. */
export interface StationMatch {
  triplet: string
  name: string
  lat: number
  lon: number
  elevationM: number
  distanceKm: number
  utcOffset: number
}

export interface AwdbValue {
  date: string
  value: number | null
}

export interface AwdbStationData {
  stationTriplet: string
  data: { stationElement: { elementCode: string }; values?: AwdbValue[] }[]
}

/** Stations farther than this are a different mountain. */
export const MAX_DISTANCE_KM = 30
/** Stations below the base by more than this sit in a valley; above the summit by this, on another peak. */
export const BELOW_BASE_M = 300
export const ABOVE_TOP_M = 150

const FT = 0.3048
const IN_CM = 2.54
const round1 = (n: number) => Math.round(n * 10) / 10

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

/**
 * Up to `max` stations for a resort, nearest first: within MAX_DISTANCE_KM and with an elevation
 * between (base − BELOW_BASE_M) and (summit + ABOVE_TOP_M). The first one is what the card shows.
 */
export function matchStations(
  resort: { lat: number; lon: number; baseM: number; topM: number },
  stations: AwdbStation[],
  max = 3,
): StationMatch[] {
  return stations
    .map((s) => ({
      triplet: s.stationTriplet,
      name: s.name,
      lat: s.latitude,
      lon: s.longitude,
      elevationM: Math.round(s.elevation * FT),
      distanceKm: round1(distanceKm(resort.lat, resort.lon, s.latitude, s.longitude)),
      utcOffset: s.dataTimeZone,
    }))
    .filter(
      (m) =>
        m.distanceKm <= MAX_DISTANCE_KM &&
        m.elevationM >= resort.baseM - BELOW_BASE_M &&
        m.elevationM <= resort.topM + ABOVE_TOP_M,
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, max)
}

/** AWDB date "2026-09-25 13:00" in a station's UTC offset → epoch ms. */
export function awdbTime(date: string, utcOffset: number): number {
  return Date.parse(`${date.replace(' ', 'T')}:00Z`) - utcOffset * 3_600_000
}

/** Rolling median over 5 readings: kills single-hour sensor spikes without shifting storms. */
export function median5(values: number[]): number[] {
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b)
    return w[w.length >> 1]
  })
}

/**
 * Total rise of a depth series, in its own units. Adds up each climb from a trough to a peak, and
 * only ends a climb when depth falls more than `tolerance` below the peak, so settling after a
 * storm doesn't eat the storm. Climbs of `tolerance` or less are sensor jitter and don't count
 * (SNOTEL depth is whole inches and wobbles ±1).
 */
export function depthRise(depths: number[], tolerance = 1): number {
  let total = 0
  let low = depths[0]
  let high = depths[0]
  const endClimb = () => {
    if (high - low > tolerance) total += high - low
  }
  for (const d of depths.slice(1)) {
    if (d > high) high = d
    else if (d < high - tolerance) {
      endClimb()
      low = high = d
    } else if (d < low) low = high = d
  }
  if (depths.length > 1) endClimb()
  return total
}

export interface HourlyReading {
  /** Epoch ms */
  t: number
  /** Station-local date, YYYY-MM-DD */
  date: string
  depthIn: number
}

/** Hourly SNWD values → sorted readings with nulls dropped and the median filter applied. */
export function toReadings(values: AwdbValue[], utcOffset: number): HourlyReading[] {
  const valid = values.filter((v): v is { date: string; value: number } => v.value != null)
  const smooth = median5(valid.map((v) => v.value))
  return valid.map((v, i) => ({
    t: awdbTime(v.date, utcOffset),
    date: v.date.slice(0, 10),
    depthIn: smooth[i],
  }))
}

/** New snow (cm) over the `hours` before the latest reading. Null if the window has <2 readings. */
export function newSnowSince(readings: HourlyReading[], hours: number): number | null {
  const last = readings.at(-1)
  if (!last) return null
  const start = last.t - hours * 3_600_000
  // Include the reading at the window start, so a rise in its first hour counts.
  const window = readings.filter((r) => r.t >= start)
  if (window.length < 2) return null
  return round1(depthRise(window.map((r) => r.depthIn)) * IN_CM)
}

/** Per-day new snow and end-of-day depth for the last `days` station-local days. */
export function dailyHistory(readings: HourlyReading[], days = 14): ReturnType<typeof dayRow>[] {
  const last = readings.at(-1)
  if (!last) return []
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.parse(`${last.date}T00:00:00Z`) - i * 86_400_000)
      .toISOString()
      .slice(0, 10)
    out.push(dayRow(readings, date))
  }
  return out
}

function dayRow(readings: HourlyReading[], date: string) {
  const idx = readings.findIndex((r) => r.date === date)
  if (idx === -1) return { date, newCm: null, depthCm: null }
  const day = readings.filter((r) => r.date === date)
  // Start from the previous day's last reading, so a rise at midnight lands on this day.
  const series = (idx > 0 ? [readings[idx - 1], ...day] : day).map((r) => r.depthIn)
  return {
    date,
    newCm: series.length < 2 ? null : round1(depthRise(series) * IN_CM),
    depthCm: round1(day[day.length - 1].depthIn * IN_CM),
  }
}
