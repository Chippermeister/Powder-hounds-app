import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { afterEach, expect, test, vi } from 'vitest'
import { carryOver, isOwnId, loadStyle, saveStyle } from './styles'

type LayerType = 'background' | 'fill' | 'symbol' | 'raster' | 'circle' | 'hillshade'
const layer = (id: string, type: LayerType) =>
  ({ id, type, source: type === 'background' ? undefined : 's' }) as LayerSpecification

const style = (layers: LayerSpecification[], sources: string[]): StyleSpecification => ({
  version: 8,
  sources: Object.fromEntries(sources.map((s) => [s, { type: 'vector', url: s }])),
  layers,
})

afterEach(() => localStorage.clear())

test('recognises our sources and layers, not the basemap’s', () => {
  for (const id of ['terrain', 'hillshade', 'radar-0', 'radar-12', 'resorts', 'resort-pins'])
    expect(isOwnId(id)).toBe(true)
  for (const id of ['water', 'openmaptiles', 'radar', 'resort_area', 'road_label'])
    expect(isOwnId(id)).toBe(false)
})

test('carries our layers into the new style: radar under labels, pins on top', () => {
  const prev = {
    ...style(
      [
        layer('bg', 'background'),
        layer('hillshade', 'hillshade'),
        layer('radar-0', 'raster'),
        layer('old_label', 'symbol'),
        layer('resort-pins', 'circle'),
      ],
      ['openmaptiles', 'terrain', 'radar-0', 'resorts'],
    ),
    terrain: { source: 'terrain', exaggeration: 1.4 },
  }
  const next = style(
    [layer('dark_bg', 'background'), layer('water', 'fill'), layer('place', 'symbol')],
    ['openmaptiles', 'ne2_shaded'],
  )

  const merged = carryOver(prev, next, { 'hillshade-exaggeration': 0.3 })

  expect(merged.layers.map((l) => l.id)).toEqual([
    'dark_bg',
    'water',
    'hillshade',
    'radar-0',
    'place',
    'resort-pins',
  ])
  expect(Object.keys(merged.sources).sort()).toEqual([
    'ne2_shaded',
    'openmaptiles',
    'radar-0',
    'resorts',
    'terrain',
  ])
  expect(merged.layers.find((l) => l.id === 'hillshade')).toMatchObject({
    paint: { 'hillshade-exaggeration': 0.3 },
  })
  expect(merged.terrain).toEqual({ source: 'terrain', exaggeration: 1.4 })
})

test('first style load passes through untouched', () => {
  const next = style([layer('bg', 'background')], ['openmaptiles'])
  expect(carryOver(undefined, next, {})).toBe(next)
})

test('remembers the pick, and ignores junk or broken storage', () => {
  expect(loadStyle()).toBeNull()
  saveStyle('dark')
  expect(loadStyle()).toBe('dark')
  localStorage.setItem('mapStyle', 'neon')
  expect(loadStyle()).toBeNull()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(loadStyle()).toBeNull()
  vi.restoreAllMocks()
})
