import { NO_DATA_COLOR, SNOW_BUCKETS } from './snowColors'

const Dot = ({ color }: { color: string }) => (
  <span
    aria-hidden
    className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-white"
    style={{ background: color }}
  />
)

/** Key for the pin colours. */
export default function SnowLegend() {
  return (
    <figure
      aria-label="Pin colour: observed snow, last 72 hours"
      className="panel flex w-fit flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl px-3 py-1.5 text-xs shadow-lg"
    >
      <figcaption className="font-medium">72h snow</figcaption>
      <ul className="contents">
        {SNOW_BUCKETS.map((b) => (
          <li key={b.label} className="flex items-center gap-1 tabular-nums">
            <Dot color={b.color} />
            {b.label}
          </li>
        ))}
        <li className="flex items-center gap-1 text-ink-muted">
          <Dot color={NO_DATA_COLOR} />
          No data
        </li>
      </ul>
    </figure>
  )
}
