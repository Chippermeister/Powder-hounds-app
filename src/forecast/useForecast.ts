import { useEffect, useState } from 'react'
import type { ResortForecast } from './types'

export type ForecastState =
  { status: 'loading' } | { status: 'ready'; forecast: ResortForecast } | { status: 'unavailable' }

/**
 * Loads /forecast/{id}.json written by the pipeline. "unavailable" covers a missing file, which the
 * host answers with the SPA's index.html (so the JSON parse fails) — e.g. in dev before `npm run forecast`.
 */
export function useForecast(id: string): ForecastState {
  // Remember which resort a result belongs to, so switching resorts never shows the old one.
  const [result, setResult] = useState<{ id: string; forecast: ResortForecast | null }>()

  useEffect(() => {
    let cancelled = false
    fetch(`/forecast/${id}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<ResortForecast>) : null))
      .catch(() => null)
      .then((forecast) => {
        if (!cancelled) setResult({ id, forecast })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (result?.id !== id) return { status: 'loading' }
  return result.forecast
    ? { status: 'ready', forecast: result.forecast }
    : { status: 'unavailable' }
}
