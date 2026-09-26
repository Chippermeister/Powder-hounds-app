import ForecastSection from '../forecast/ForecastSection'
import ObservedSection from '../observed/ObservedSection'
import { regionLabel, type Resort } from './resorts'

interface Props {
  resort: Resort
  onClose: () => void
}

const ft = (m: number) => Math.round(m * 3.28084).toLocaleString()

/** Desktop: the card floats down the left side, under the search box. */
export default function ResortCard({ resort, onClose }: Props) {
  return (
    <section
      aria-label={resort.name}
      className="panel flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl p-4 shadow-lg"
    >
      <ResortDetails resort={resort} onClose={onClose} />
    </section>
  )
}

/** What a resort card shows, on the side card and the phone sheet alike: stats, forecast, observed, links. */
export function ResortDetails({ resort, onClose }: Props) {
  return (
    <>
      <header className="flex items-start gap-2" data-drag-zone>
        <div className="flex-1">
          <h2 className="text-lg leading-tight font-semibold">{resort.name}</h2>
          <p className="text-sm text-ink-muted">{regionLabel(resort.region)}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid size-7 place-items-center rounded-full bg-black/5 text-ink-muted dark:bg-white/10"
        >
          ✕
        </button>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Summit', `${ft(resort.topM)} ft`],
          ['Vertical', `${ft(resort.verticalM)} ft`],
          ['Lifts', String(resort.lifts)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-black/5 py-1.5 dark:bg-white/10">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <ForecastSection resortId={resort.id} />
      <ObservedSection resortId={resort.id} />

      {resort.blurb && <p className="text-sm leading-relaxed">{resort.blurb}</p>}

      {(resort.webcamUrl || resort.website) && (
        <div className="flex gap-2">
          {resort.webcamUrl && (
            <a
              href={resort.webcamUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg bg-accent py-2 text-center text-sm font-medium text-white"
            >
              Webcams
            </a>
          )}
          {resort.website && (
            <a
              href={resort.website}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg bg-black/5 py-2 text-center text-sm font-medium text-accent dark:bg-white/10"
            >
              Website
            </a>
          )}
        </div>
      )}
    </>
  )
}
