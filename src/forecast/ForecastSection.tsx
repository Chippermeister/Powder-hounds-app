import { localDate } from './nws'
import { sumSnow, type ResortForecast } from './types'
import { useForecast } from './useForecast'

const ft = (m: number) => Math.round(m * 3.28084).toLocaleString()

/** Snow in whole inches; "–" for none and "<1" for a dusting. */
export function formatSnowIn(cm: number | undefined): string {
  if (cm == null) return ''
  if (cm === 0) return '–'
  const inches = cm / 2.54
  return inches < 0.5 ? '<1' : String(Math.round(inches))
}

/** "2026-09-26" → "Sat". Noon UTC keeps the weekday right in every time zone. */
const weekday = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

export function updatedAgo(iso: string, now = Date.now()): string {
  const min = Math.round((now - Date.parse(iso)) / 60_000)
  if (min < 60) return `${Math.max(min, 0)} min ago`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

interface Row {
  label: string
  sub: string
  byDate: Map<string, number>
  totalCm: number
}

function rows(f: ResortForecast): Row[] {
  const out: Row[] = []
  const add = (label: string, sub: string, days: { date: string; snowCm: number }[]) =>
    out.push({
      label,
      sub,
      byDate: new Map(days.map((d) => [d.date, d.snowCm])),
      totalCm: sumSnow(days),
    })
  if (f.summit) add('Summit', `${ft(f.summit.elevationM)} ft`, f.summit.days)
  if (f.base) add('Base', `${ft(f.base.elevationM)} ft`, f.base.days)
  if (f.nws) add('NWS', `${ft(f.nws.gridElevationM)} ft`, f.nws.days)
  return out
}

function ForecastTable({ forecast }: { forecast: ResortForecast }) {
  const table = rows(forecast)
  const dates = [...new Set(table.flatMap((r) => [...r.byDate.keys()]))].sort().slice(0, 7)
  const today = localDate(Date.now(), forecast.timeZone)
  const cell = 'py-1 text-center tabular-nums'

  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Snowfall forecast in inches</caption>
      <thead>
        <tr className="text-ink-muted">
          <th scope="col" className="text-left font-normal">
            <span className="sr-only">Source</span>
          </th>
          {dates.map((d) => (
            <th key={d} scope="col" className={`${cell} font-normal`}>
              {d === today ? 'Today' : weekday(d)}
            </th>
          ))}
          <th scope="col" className={`${cell} font-normal`}>
            7d
          </th>
        </tr>
      </thead>
      <tbody>
        {table.map((r) => (
          <tr key={r.label} className="border-t border-black/5 dark:border-white/10">
            <th scope="row" className="py-1 pr-1 text-left font-medium leading-tight">
              {r.label}
              <span className="block text-[10px] font-normal text-ink-muted">{r.sub}</span>
            </th>
            {dates.map((d) => {
              const cm = r.byDate.get(d)
              return (
                <td
                  key={d}
                  className={`${cell} ${cm ? 'font-semibold text-accent' : 'text-ink-muted'}`}
                >
                  {formatSnowIn(cm)}
                </td>
              )
            })}
            <td className={`${cell} font-semibold`}>
              {r.totalCm ? formatSnowIn(r.totalCm) : '0'}″
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Card section: 7-day snowfall at summit and base (Open-Meteo) plus NWS for US resorts. */
export default function ForecastSection({ resortId }: { resortId: string }) {
  const state = useForecast(resortId)

  return (
    <section aria-label="Snow forecast" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Snow forecast</h3>
      {state.status === 'loading' && <p className="text-xs text-ink-muted">Loading…</p>}
      {state.status === 'unavailable' && (
        <p className="text-xs text-ink-muted">Forecast not available right now.</p>
      )}
      {state.status === 'ready' && (
        <>
          <ForecastTable forecast={state.forecast} />
          <p className="text-[10px] text-ink-muted">
            Updated {updatedAgo(state.forecast.generatedAt)} · Summit/base from{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open-Meteo
            </a>{' '}
            (CC BY 4.0), NWS for the surrounding 2.5 km grid cell
          </p>
        </>
      )}
    </section>
  )
}
