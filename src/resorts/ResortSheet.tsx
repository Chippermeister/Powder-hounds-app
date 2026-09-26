import { useRef, useState, type PointerEvent } from 'react'
import { OVERLAY_ATTR } from '../map/padding'
import { ResortDetails } from './ResortCard'
import type { Resort } from './resorts'

interface Props {
  resort: Resort
  onClose: () => void
}

/** Share of the screen the sheet covers when it first opens: name, stats and the forecast. */
const PEEK = 0.42
/** Map left visible above the sheet when it's fully open. */
const FULL_GAP_PX = 56
/** Movement before a press counts as a drag rather than a tap. */
const DRAG_SLOP_PX = 6

interface Drag {
  pointerId: number
  startY: number
  startH: number
  peekH: number
  fullH: number
  moved: boolean
}

/**
 * Phones: the resort card as a bottom sheet. It opens part-way so the map stays usable above it;
 * swipe up (or tap the handle) for the full card, swipe down to shrink or close it.
 * While peeking, the whole sheet drags; when open, only the handle and header do, so the
 * content can scroll.
 */
export default function ResortSheet({ resort, onClose }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [dragH, setDragH] = useState<number | null>(null)
  const drag = useRef<Drag | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    if (expanded && !target.closest('[data-drag-zone]')) return
    const parentH = e.currentTarget.parentElement?.clientHeight ?? window.innerHeight
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startH: e.currentTarget.offsetHeight,
      peekH: parentH * PEEK,
      fullH: parentH - FULL_GAP_PX,
      moved: false,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dy) < DRAG_SLOP_PX) return
    if (!d.moved) {
      d.moved = true
      // Capture only once it's a drag, so taps still reach buttons and links.
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDragH(Math.min(Math.max(d.startH - dy, 0), d.fullH))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved || dragH == null) return
    setDragH(null)
    if (dragH > (d.peekH + d.fullH) / 2) setExpanded(true)
    else if (dragH < d.peekH * 0.6) onClose()
    else setExpanded(false)
    // No click follows: with the pointer captured, a drag that began on a button ends on the sheet.
  }

  const height =
    dragH != null ? `${dragH}px` : expanded ? `calc(100% - ${FULL_GAP_PX}px)` : `${PEEK * 100}%`

  return (
    <section
      aria-label={resort.name}
      {...{ [OVERLAY_ATTR]: '' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setDragH(null)
      }}
      style={{ height }}
      // The header is a drag handle too; stop the browser claiming its swipes for scrolling.
      className={`panel absolute inset-x-0 bottom-0 z-20 flex flex-col [&_[data-drag-zone]]:touch-none rounded-t-2xl shadow-[0_-4px_24px_rgb(0_0_0/0.18)] ${
        dragH == null ? 'transition-[height] duration-200 ease-out' : ''
      }`}
    >
      <button
        data-drag-zone
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Show less' : 'Show more'}
        className="grid h-5 shrink-0 touch-none place-items-center"
      >
        <span aria-hidden className="h-1 w-9 rounded-full bg-black/20 dark:bg-white/30" />
      </button>
      <div
        className={`flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
          expanded ? 'touch-pan-y overflow-y-auto overscroll-contain' : 'touch-none overflow-hidden'
        }`}
      >
        <ResortDetails resort={resort} onClose={onClose} />
      </div>
    </section>
  )
}
