import { useStaticJson } from '../data/useStaticJson'
import { formatSnowIn, updatedAgo } from '../forecast/ForecastSection'
import { snotelStaleness } from './stale'
import type { ObservedDay, ResortObserved } from './types'

const ft = (m: number) => Math.round(m * 3.28084).toLocaleString()
const mi = (km: number) => Math.max(1, Math.round(km * 0.621371))

/** "2026-09-26T12:00:00Z" → "Sep 26" */
const monthDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Blank for "no data", "–" for a measured zero. */
function inches(cm: number | null): string {
  if (cm == null) return ''
  const text = formatSnowIn(cm)
  return text === '–' ? text : `${text}″`
}

function ObservedTable({ observed }: { observed: ResortObserved }) {
  const { snotel, nohrsc } = observed
  const cell = 'px-0.5 py-1 text-center tabular-nums'
  const rows = [
    snotel && {
      label: 'SNOTEL',
      sub: `${snotel.name} · ${ft(snotel.elevationM)} ft · ${mi(snotel.distanceKm)} mi`,
      stale: snotelStaleness(snotel.updatedAt),
      values: [snotel.new24hCm, snotel.new72hCm, null, snotel.depthCm],
    },
    nohrsc && {
      label: 'NOHRSC',
      sub: '4 km analysis cell',
      stale: null,
      values: [nohrsc.snow24hCm, nohrsc.snow72hCm, nohrsc.seasonCm, null],
    },
  ].filter((r) => !!r)

  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Observed snow in inches</caption>
      <thead>
        <tr className="text-ink-muted">
          <th scope="col" className="text-left font-normal">
            <span className="sr-only">Source</span>
          </th>
          {['24h', '72h', 'Season', 'Depth'].map((h) => (
            <th key={h} scope="col" className={`${cell} w-12 font-normal`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-black/5 dark:border-white/10">
            <th scope="row" className="py-1 pr-1 text-left font-medium leading-tight">
              {r.label}
              <span className="block text-[10px] font-normal text-ink-muted">{r.sub}</span>
              {r.stale && (
                <span className="mt-0.5 block text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  ⚠ {r.stale}
                </span>
              )}
            </th>
            {r.values.map((cm, i) => (
              <td
                key={i}
                className={`${cell} ${cm && i < 2 && !r.stale ? 'font-semibold text-accent' : ''} ${cm && !r.stale ? '' : 'text-ink-muted'}`}
              >
                {inches(cm)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const W = 280
const H = 56
const LABEL_H = 12
/** The y-axis tops out at 6″ at least, so a 1″ day doesn't look like a dump. */
const MIN_SCALE_CM = 15.24

/** Daily new snow at the SNOTEL station as bars; hover a bar for the day, amount and depth. */
export function HistoryBars({ days }: { days: ObservedDay[] }) {
  const max = Math.max(MIN_SCALE_CM, ...days.map((d) => d.newCm ?? 0))
  const slot = W / days.length
  const barW = slot - 2 // 2px surface gap between bars
  const plotH = H - LABEL_H
  const peak = days.reduce<ObservedDay | null>(
    (best, d) => ((d.newCm ?? 0) > (best?.newCm ?? 0) ? d : best),
    null,
  )
  const label = (d: ObservedDay) => {
    const date = monthDay(`${d.date}T12:00:00Z`)
    if (d.newCm == null) return `${date}: no data`
    const fresh = d.newCm === 0 ? 'no new snow' : `${formatSnowIn(d.newCm)} in new`
    if (d.depthCm == null) return `${date}: ${fresh}`
    const depth = d.depthCm === 0 ? 'bare ground' : `${formatSnowIn(d.depthCm)} in depth`
    return `${date}: ${fresh}, ${depth}`
  }

  return (
    <figure className="flex flex-col gap-0.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`New snow per day, last ${days.length} days`}
      >
        <line
          x1={0}
          x2={W}
          y1={plotH}
          y2={plotH}
          className="stroke-black/15 dark:stroke-white/20"
        />
        {days.map((d, i) => {
          const x = i * slot + 1
          const h = d.newCm ? Math.max(2, (d.newCm / max) * (plotH - 10)) : 0
          const r = Math.min(4, barW / 2, h)
          return (
            <g key={d.date}>
              <title>{label(d)}</title>
              {/* Hit target: the whole column, bigger than the bar. */}
              <rect x={i * slot} y={0} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${plotH} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                  className="fill-accent"
                />
              )}
              {d.newCm == null && (
                <text
                  x={x + barW / 2}
                  y={plotH - 2}
                  textAnchor="middle"
                  className="fill-ink-muted text-[8px]"
                >
                  ·
                </text>
              )}
              {d === peak && (
                <text
                  x={x + barW / 2}
                  y={plotH - h - 3}
                  textAnchor="middle"
                  className="fill-ink text-[9px] font-semibold"
                >
                  {formatSnowIn(d.newCm ?? 0)}″
                </text>
              )}
            </g>
          )
        })}
        {[0, days.length - 1].map((i) => (
          <text
            key={i}
            x={i === 0 ? 0 : W}
            y={H - 1}
            textAnchor={i === 0 ? 'start' : 'end'}
            className="fill-ink-muted text-[9px]"
          >
            {i === 0 ? monthDay(`${days[i].date}T12:00:00Z`) : 'Today'}
          </text>
        ))}
      </svg>
      <table className="sr-only">
        <caption>New snow per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{label(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="text-[10px] text-ink-muted">
        New snow per day at the SNOTEL station, last {days.length} days
      </figcaption>
    </figure>
  )
}

/** Card section: measured snow from the nearest SNOTEL station and the NOHRSC snowfall analysis. */
export default function ObservedSection({ resortId }: { resortId: string }) {
  const state = useStaticJson<ResortObserved>(`/observed/${resortId}.json`)

  return (
    <section aria-label="Observed snow" className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Observed snow</h3>
      {state.status === 'loading' && <p className="text-xs text-ink-muted">Loading…</p>}
      {state.status === 'unavailable' && (
        <p className="text-xs text-ink-muted">Observations not available right now.</p>
      )}
      {state.status === 'ready' && !state.data.snotel && !state.data.nohrsc && (
        <p className="text-xs text-ink-muted">No snow observations for this area yet.</p>
      )}
      {state.status === 'ready' && (state.data.snotel || state.data.nohrsc) && (
        <ObservedDetail observed={state.data} />
      )}
    </section>
  )
}

function ObservedDetail({ observed }: { observed: ResortObserved }) {
  const days = observed.snotel?.days ?? []
  const measured = days.filter((d) => d.newCm != null)
  const anySnow = days.some((d) => (d.newCm ?? 0) > 0)
  return (
    <>
      <ObservedTable observed={observed} />
      {/* An all-zero chart is an empty band, so a dry spell gets one line instead. */}
      {anySnow && <HistoryBars days={days} />}
      {measured.length > 0 && !anySnow && (
        <p className="text-xs text-ink-muted">
          No new snow at the SNOTEL station in the last {days.length} days.
        </p>
      )}
      <p className="text-[10px] text-ink-muted">Updated {updatedAgo(observed.generatedAt)}</p>
    </>
  )
}
