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

/** Floating glass panel: product toggle, play/pause, and a timeline scrubber. */
export default function RadarControls(props: Props) {
  const { frames, frameIndex, playing, error } = props
  const current = frames[frameIndex]

  return (
    <div className="glass absolute inset-x-4 bottom-10 mx-auto flex max-w-md flex-col gap-3 rounded-2xl p-4 shadow-lg">
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
          onChange={(e) => {
            props.onPlayingChange(false)
            props.onFrameChange(Number(e.target.value))
          }}
          disabled={frames.length === 0}
          className="flex-1 accent-accent"
        />
        <output className="w-16 text-right text-sm tabular-nums text-ink-muted">
          {current ? timeFormat.format(new Date(current)) : '…'}
        </output>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
