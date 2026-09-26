// Shapes of the JSON the observed-snow pipeline writes to /observed/. Shared by the script and the UI.
// Metric like /forecast/ (cm, mm, m); the UI converts for display.

/** One local day at the SNOTEL station. */
export interface ObservedDay {
  /** Station-local date, YYYY-MM-DD */
  date: string
  /** New snow derived from depth rises (settled snow, so it reads low vs. a snow stake) */
  newCm: number | null
  /** Depth at the day's last reading */
  depthCm: number | null
}

/** The SNOTEL station matched to a resort, and what it measured. */
export interface SnotelObserved {
  triplet: string
  name: string
  elevationM: number
  distanceKm: number
  /** Time of the latest hourly reading */
  updatedAt: string | null
  depthCm: number | null
  sweMm: number | null
  new24hCm: number | null
  new72hCm: number | null
  /** Last 14 days, oldest first */
  days: ObservedDay[]
}

/** NOHRSC National Snowfall Analysis, sampled at the resort's 4 km grid cell (CONUS only). */
export interface NohrscObserved {
  snow24hCm: number | null
  snow72hCm: number | null
  seasonCm: number | null
  /** End of the 24 h / 72 h windows (analysis time) */
  validAt: string | null
  /** Season window: NOHRSC starts it Sep 30 12Z */
  seasonStart: string | null
  seasonEnd: string | null
}

export interface ResortObserved {
  id: string
  generatedAt: string
  snotel: SnotelObserved | null
  nohrsc: NohrscObserved | null
}

/** /observed/index.json: one small summary per resort, for the map later on. */
export interface ObservedIndex {
  generatedAt: string
  resorts: Record<string, { new24hCm: number | null; new72hCm: number | null }>
}
