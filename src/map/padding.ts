// Panels float over the map. To keep a pin (or the first view) clear of them, we turn their
// on-screen boxes into MapLibre padding: the map then centres and fits within what's left.

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

/** Elements marked with this attribute count as covering the map. */
export const OVERLAY_ATTR = 'data-map-overlay'

const MARGIN = 24
/** Never pad the map down to less than this, however many panels are open. */
const MIN_CLEAR = 80

/**
 * Padding that keeps content out from under every panel. Each panel is charged to the one map
 * edge that costs the least area: a bar across the bottom pads the bottom, a tall column on the
 * left pads the left.
 */
export function obscuredPadding(view: Box, panels: Box[], margin = MARGIN): Padding {
  const w = view.right - view.left
  const h = view.bottom - view.top
  const pad: Padding = { top: 0, right: 0, bottom: 0, left: 0 }
  for (const p of panels) {
    const width = Math.min(p.right, view.right) - Math.max(p.left, view.left)
    const height = Math.min(p.bottom, view.bottom) - Math.max(p.top, view.top)
    if (width <= 0 || height <= 0) continue // off-screen or hidden
    const options: [keyof Padding, number][] = [
      ['top', p.bottom - view.top],
      ['bottom', view.bottom - p.top],
      ['left', p.right - view.left],
      ['right', view.right - p.left],
    ]
    const cost = ([side, inset]: [keyof Padding, number]) =>
      inset * (side === 'top' || side === 'bottom' ? w : h)
    const [side, inset] = options.reduce((best, o) => (cost(o) < cost(best) ? o : best))
    pad[side] = Math.max(pad[side], inset)
  }
  for (const side of Object.keys(pad) as (keyof Padding)[]) pad[side] += margin
  fit(pad, 'top', 'bottom', h)
  fit(pad, 'left', 'right', w)
  return pad
}

/** Shrink a pair of opposite insets proportionally if they'd leave less than MIN_CLEAR between them. */
function fit(pad: Padding, a: keyof Padding, b: keyof Padding, size: number) {
  const room = size - MIN_CLEAR
  const total = pad[a] + pad[b]
  if (total <= room) return
  const scale = Math.max(room, 0) / total
  pad[a] = Math.floor(pad[a] * scale)
  pad[b] = Math.floor(pad[b] * scale)
}

/** Is a screen point (relative to the map's top-left) inside the unpadded part of the map? */
export function isClear(x: number, y: number, width: number, height: number, pad: Padding) {
  return x >= pad.left && x <= width - pad.right && y >= pad.top && y <= height - pad.bottom
}

/** Measure every marked panel against the map element. */
export function measurePadding(map: HTMLElement): Padding {
  const panels = Array.from(document.querySelectorAll(`[${OVERLAY_ATTR}]`), (el) =>
    el.getBoundingClientRect(),
  )
  return obscuredPadding(map.getBoundingClientRect(), panels)
}
