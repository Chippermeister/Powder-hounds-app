// Pin colours by observed 72 h snow (NOHRSC, SNOTEL fallback; see /observed/index.json).
// One blue ramp, light → dark, so more snow always reads darker. Lightness steps are even
// enough to tell apart, and the palest still has 2:1 contrast on a white basemap.
import type { ExpressionSpecification } from 'maplibre-gl'

/** Pins with no observation carry this instead of cm, so `max` over a cluster still works. */
export const NO_DATA = -1

export const NO_DATA_COLOR = '#8e8e93'

/** Lower bound in cm (inches × 2.54), colour, legend label. */
export const SNOW_BUCKETS = [
  { minCm: 0, color: '#86b6ef', label: '0–1″' },
  { minCm: 2.54, color: '#3987e5', label: '1–6″' },
  { minCm: 15.24, color: '#1c5cab', label: '6–12″' },
  { minCm: 30.48, color: '#0d366b', label: '12″+' },
] as const

/** MapLibre expression: colour for a cm value read by `value`. */
export function snowColorExpression(value: ExpressionSpecification): ExpressionSpecification {
  const steps = SNOW_BUCKETS.flatMap((b) => [b.minCm, b.color])
  return ['step', value, NO_DATA_COLOR, ...steps] as ExpressionSpecification
}

/** Dark text on the palest pin, white on the rest (for cluster counts). */
export function snowTextColorExpression(value: ExpressionSpecification): ExpressionSpecification {
  return ['step', value, '#ffffff', 0, '#1d1d1f', SNOW_BUCKETS[1].minCm, '#ffffff']
}
