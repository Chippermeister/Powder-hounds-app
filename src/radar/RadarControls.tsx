import { OVERLAY_ATTR } from '../map/padding'
import { useNow } from '../ui/useNow'
import { RADAR_LEGENDS, frameAge, gradientCss, type RadarLegend } from './legend'
import { RADAR_PRODUCTS, type RadarProductId } from './wms'

interface Props {
  productId: RadarProductId
  onProductChange: (id: RadarProductId) => void
  frames: string[]
  frameIndex: number
  onFrameChange: (i: number) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  error: string | null
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function Legend({ legend }: { legend: RadarLegend }) {
  // Keep the end labels inside the bar.
  const place = (p: number) =>
    p < 0.08 ? { left: 0 } : p > 0.92 ? { right: 0 } : { left: `${p * 100}%`, translate: '-50% 0' }
  return (
    <div className="flex flex-col gap-0.5 text-[10px] text-ink-muted">
      <div
        aria-hidden
        className="h-2 rounded-full"
        style={{ background: gradientCss(legend.stops) }}
      />
      <div className="relative h-3">
        {legend.ticks.map(([label, p]) => (
          <span key={label} className="absolute top-0 leading-3" style={place(p)}>
            {label}
          </span>
        ))}
        {legend.unit && <span className="absolute top-0 right-0 leading-3">{legend.unit}</span>}
      </div>
      {legend.note && <p className="leading-tight">{legend.note}</p>}
    </div>
  )
}

/** Floating panel: product toggle, play/pause, a timeline scrubber and the colour key. */
export default function RadarControls(props: Props) {
  const { frames, frameIndex, playing, error } = props
  const current = frames[frameIndex]
  const now = useNow()

  return (
    <div
      {...{ [OVERLAY_ATTR]: '' }}
      className="glass absolute inset-x-4 bottom-10 mx-auto flex max-w-md flex-col gap-2.5 rounded-2xl p-3 shadow-lg sm:p-4"
    >
      <div
        role="radiogroup"
        aria-label="Radar layer"
        className="flex rounded-lg bg-black/5 p-0.5 dark:bg-white/10"
      >
        {Object.values(RADAR_PRODUCTS).map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={p.id === props.productId}
            onClick={() => props.onProductChange(p.id)}
            className="flex-1 rounded-md px-3 py-1.5 text-sm font-medium aria-checked:bg-surface aria-checked:shadow-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => props.onPlayingChange(!playing)}
          disabled={frames.length < 2}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          aria-label="Radar time"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={frameIndex}
          aria-valuetext={current ? frameAge(current, now) : undefined}
          onChange={(e) => {
            props.onPlayingChange(false)
            props.onFrameChange(Number(e.target.value))
          }}
          disabled={frames.length === 0}
          className="flex-1 accent-accent"
        />
        <output
          title={current ? timeFormat.format(new Date(current)) : undefined}
          className="w-24 text-right text-sm tabular-nums text-ink-muted"
        >
          {current ? frameAge(current, now) : '…'}
        </output>
      </div>

      <Legend legend={RADAR_LEGENDS[props.productId]} />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
