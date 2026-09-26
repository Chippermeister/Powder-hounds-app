import { useStaticJson } from '../data/useStaticJson'
import type { ResortForecast } from './types'

export type ForecastState =
  { status: 'loading' } | { status: 'ready'; forecast: ResortForecast } | { status: 'unavailable' }

/** Loads /forecast/{id}.json written by scripts/fetch-forecast.ts. */
export function useForecast(id: string): ForecastState {
  const state = useStaticJson<ResortForecast>(`/forecast/${id}.json`)
  return state.status === 'ready' ? { status: 'ready', forecast: state.data } : state
}
