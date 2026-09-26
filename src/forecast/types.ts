// Shapes of the JSON the forecast pipeline writes to /forecast/. Shared by the script and the UI.
// Everything is metric (cm, °C, m); the UI converts for display.

/** One local calendar day at one elevation, computed from Open-Meteo hourly data. */
export interface ForecastDay {
  /** Local date at the resort, YYYY-MM-DD */
  date: string
  snowCm: number
  tMaxC: number
  tMinC: number
}

export interface ElevationForecast {
  elevationM: number
  days: ForecastDay[]
}

/** NWS forecaster-adjusted snowfall for the 2.5 km grid cell containing the resort (US only). */
export interface NwsForecast {
  office: string
  /** When NWS last updated this grid */
  updatedAt: string
  gridElevationM: number
  days: { date: string; snowCm: number }[]
}

export interface ResortForecast {
  id: string
  generatedAt: string
  timeZone: string
  base: ElevationForecast | null
  summit: ElevationForecast | null
  nws: NwsForecast | null
}

/** /forecast/index.json: one small summary per resort, for the map later on. */
export interface ForecastIndex {
  generatedAt: string
  resorts: Record<string, { summit7dCm: number | null; nws7dCm: number | null }>
}

export const round1 = (n: number) => Math.round(n * 10) / 10

export const sumSnow = (days: { snowCm: number }[]) =>
  round1(days.reduce((s, d) => s + d.snowCm, 0))
