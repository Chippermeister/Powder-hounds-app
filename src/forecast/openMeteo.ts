// Open-Meteo per-elevation forecast → daily snow. Data CC BY 4.0, https://open-meteo.com
//
// Why not Open-Meteo's own `snowfall`? It comes from the model's grid cell and ignores the
// `elevation=` downscaling, so base and summit get the same snow even when the base is at +7 °C.
// Temperature *is* downscaled, so we split hourly precipitation into rain/snow ourselves.
import { round1, type ElevationForecast } from './types.ts'

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

export interface ForecastPoint {
  lat: number
  lon: number
  elevationM: number
}

/** One request for many points (Open-Meteo accepts comma-separated lists). */
export function openMeteoUrl(points: ForecastPoint[], days = 7): string {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    elevation: points.map((p) => p.elevationM).join(','),
    hourly: 'temperature_2m,precipitation',
    timezone: 'auto',
    forecast_days: String(days),
  })
  return `${OPEN_METEO_URL}?${params}`
}

/** The part of one location's response we use. Times are local, e.g. "2026-09-25T13:00". */
export interface OpenMeteoLocation {
  timezone: string
  hourly: { time: string[]; temperature_2m: (number | null)[]; precipitation: (number | null)[] }
}

/** Share of precipitation falling as snow: all snow at ≤ 0 °C, all rain at ≥ 2 °C, linear between. */
export function snowFraction(tempC: number): number {
  return Math.min(1, Math.max(0, (2 - tempC) / 2))
}

/**
 * Snow-to-liquid ratio: ~10:1 near freezing, fluffier when cold (capped at 15:1).
 * A deliberately simple rule; real ratios depend on the whole column, not just 2 m temperature.
 */
export function snowRatio(tempC: number): number {
  return Math.min(15, Math.max(10, 10 + (-1 - tempC)))
}

/** Snow (cm) from one hour of precipitation (mm of water) at a given temperature. */
export function hourlySnowCm(precipMm: number, tempC: number): number {
  return (precipMm * snowFraction(tempC) * snowRatio(tempC)) / 10
}

export function toElevationForecast(loc: OpenMeteoLocation, elevationM: number): ElevationForecast {
  const byDate = new Map<string, { snow: number; temps: number[] }>()
  const { time, temperature_2m: temps, precipitation: precip } = loc.hourly
  time.forEach((t, i) => {
    const date = t.slice(0, 10)
    const day = byDate.get(date) ?? { snow: 0, temps: [] }
    byDate.set(date, day)
    const temp = temps[i]
    if (temp == null) return
    day.temps.push(temp)
    day.snow += hourlySnowCm(precip[i] ?? 0, temp)
  })
  const days = [...byDate]
    .filter(([, d]) => d.temps.length > 0)
    .map(([date, d]) => ({
      date,
      snowCm: round1(d.snow),
      tMaxC: round1(Math.max(...d.temps)),
      tMinC: round1(Math.min(...d.temps)),
    }))
  return { elevationM, days }
}
