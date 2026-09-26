// Colour keys for the radar layers, read off each server's GetLegendGraphic image (2026-09-26):
// nowCOAST conus_base_reflectivity_mosaic (default style) and GeoMet RADAR_1KM_RSNO
// (Radar-Snow_14colors, the default). Positions are 0–1 along the bar, low → high.
import type { RadarProductId } from './wms'

export interface RadarLegend {
  /** [colour, position] gradient stops */
  stops: [string, number][]
  /** [label, position] ticks under the bar */
  ticks: [string, number][]
  unit: string
  note?: string
}

export const RADAR_LEGENDS: Record<RadarProductId, RadarLegend> = {
  // Evenly spaced 5–80 dBZ in the source image.
  reflectivity: {
    stops: [
      ['#7a7a7a', 0],
      ['#16ecec', 0.066],
      ['#17a1f6', 0.124],
      ['#1616f6', 0.186],
      ['#16ff16', 0.248],
      ['#16c816', 0.306],
      ['#169116', 0.36],
      ['#ffff16', 0.426],
      ['#e7c116', 0.48],
      ['#ff9116', 0.543],
      ['#ff1616', 0.605],
      ['#dd1616', 0.659],
      ['#c11616', 0.717],
      ['#9a58c9', 0.841],
      ['#ca1af1', 0.899],
      ['#19c6c8', 0.965],
      ['#c4f0f1', 1],
    ],
    ticks: [
      ['Light', 0],
      ['Moderate', 0.4],
      ['Heavy', 0.6],
    ],
    unit: 'dBZ 5–80',
  },
  // The source scale is cm/h on uneven steps (0.1 … 20); ticks are placed at the matching inches.
  snowRate: {
    stops: [
      ['#92c9fe', 0],
      ['#0098fe', 0.082],
      ['#00fe66', 0.15],
      ['#00cb00', 0.219],
      ['#009800', 0.288],
      ['#006600', 0.356],
      ['#fefe00', 0.425],
      ['#fecb00', 0.493],
      ['#fe9800', 0.565],
      ['#fe6600', 0.633],
      ['#fe0000', 0.702],
      ['#fe0298', 0.77],
      ['#9833cb', 0.839],
      ['#660098', 0.908],
      ['#31004a', 1],
    ],
    ticks: [
      ['0.1', 0.116],
      ['½', 0.414],
      ['1', 0.565],
      ['2', 0.747],
      ['4″/h', 0.897],
    ],
    unit: '',
    note: 'Treats all precipitation as snow, so rain shows too.',
  },
}

export const gradientCss = (stops: [string, number][]) =>
  `linear-gradient(to right, ${stops.map(([c, p]) => `${c} ${(p * 100).toFixed(1)}%`).join(', ')})`

/** "Now" for the last few minutes, then "25 min ago", "2 h 5 min ago". */
export function frameAge(iso: string, now: number): string {
  const min = Math.round((now - Date.parse(iso)) / 60_000)
  if (min < 2) return 'Now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return min % 60 ? `${h} h ${min % 60} min ago` : `${h} h ago`
}
