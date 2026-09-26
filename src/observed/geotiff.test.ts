import { describe, expect, test } from 'vitest'
import { lzwDecode, readGeoTiff } from './geotiff'

/** TIFF-style LZW encoder (test only): clear code first, MSB-first codes, early change. */
function lzwEncode(data: Uint8Array): Uint8Array {
  const bits: number[] = []
  let width = 9
  const write = (code: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((code >> i) & 1)
  }
  const dict = new Map<string, number>()
  let next = 258
  write(256)
  let w = ''
  for (const byte of data) {
    const wc = w + String.fromCharCode(byte)
    if (w === '' || dict.has(wc) || wc.length === 1) {
      w = wc
      continue
    }
    write(w.length === 1 ? w.charCodeAt(0) : dict.get(w)!)
    dict.set(wc, next++)
    // The decoder adds each entry one code later, so "early change" is next >= 2^width here.
    if (next >= 1 << width) width++
    w = String.fromCharCode(byte)
  }
  if (w) write(w.length === 1 ? w.charCodeAt(0) : dict.get(w)!)
  if (next >= 1 << width) width++
  write(257)
  const out = new Uint8Array(Math.ceil(bits.length / 8))
  bits.forEach((b, i) => (out[i >> 3] |= b << (7 - (i & 7))))
  return out
}

/** A little-endian GeoTIFF shaped like the NOHRSC files: float32 grid, one row per strip. */
function makeTiff(grid: number[][], lzw: boolean): ArrayBuffer {
  const height = grid.length
  const width = grid[0].length
  const strips = grid.map((row) => {
    const raw = new Uint8Array(new Float32Array(row).buffer)
    return lzw ? lzwEncode(raw) : raw
  })
  // tag, type, values (numbers) or string
  const entries: [number, number, number[] | string][] = [
    [256, 3, [width]],
    [257, 3, [height]],
    [258, 3, [32]],
    [259, 3, [lzw ? 5 : 1]],
    [273, 4, []], // strip offsets, filled in below
    [277, 3, [1]],
    [278, 3, [1]],
    [279, 4, strips.map((s) => s.length)],
    [339, 3, [3]],
    [33550, 12, [0.5, 0.5, 0]],
    [33922, 12, [0, 0, 0, -120, 45, 0]],
    [42113, 2, '-99999\0'],
  ]
  const size = { 2: 1, 3: 2, 4: 4, 12: 8 } as Record<number, number>
  const count = (v: number[] | string) => (typeof v === 'string' ? v.length : v.length)
  const ifdAt = 8
  let extraAt = ifdAt + 2 + entries.length * 12 + 4
  const extras: { at: number; entry: (typeof entries)[number] }[] = []
  for (const e of entries) {
    const n = e[0] === 273 ? height : count(e[2])
    if (size[e[1]] * n > 4) {
      extras.push({ at: extraAt, entry: e })
      extraAt += size[e[1]] * n
    }
  }
  let dataAt = extraAt
  const offsets = strips.map((s) => ((dataAt += s.length), dataAt - s.length))
  entries[4][2] = offsets

  const buf = new ArrayBuffer(dataAt)
  const v = new DataView(buf)
  const u8 = new Uint8Array(buf)
  u8.set([0x49, 0x49])
  v.setUint16(2, 42, true)
  v.setUint32(4, ifdAt, true)
  v.setUint16(ifdAt, entries.length, true)
  const writeValues = (at: number, type: number, vals: number[] | string) => {
    if (typeof vals === 'string') return u8.set(new TextEncoder().encode(vals), at)
    vals.forEach((x, i) => {
      const p = at + i * size[type]
      if (type === 3) v.setUint16(p, x, true)
      else if (type === 4) v.setUint32(p, x, true)
      else v.setFloat64(p, x, true)
    })
  }
  entries.forEach(([tag, type, vals], i) => {
    const e = ifdAt + 2 + i * 12
    v.setUint16(e, tag, true)
    v.setUint16(e + 2, type, true)
    v.setUint32(e + 4, count(vals), true)
    const extra = extras.find((x) => x.entry[0] === tag)
    if (extra) {
      v.setUint32(e + 8, extra.at, true)
      writeValues(extra.at, type, vals)
    } else writeValues(e + 8, type, vals)
  })
  strips.forEach((s, i) => u8.set(s, offsets[i]))
  return buf
}

describe('lzwDecode', () => {
  test('round-trips repetitive and varied data', () => {
    // ~1,700 codes: crosses the 9→10→11-bit width changes, stays under the 4,096-entry table.
    const data = new Uint8Array(5000).map((_, i) => (i % 7 === 0 ? i & 255 : 42))
    expect(lzwDecode(lzwEncode(data))).toEqual(data)
  })
})

describe('readGeoTiff', () => {
  const grid = [
    [0, 1.5, -99999],
    [2, 3, 10],
  ]
  test.each([false, true])('samples by lat/lon (lzw: %s)', (lzw) => {
    const g = readGeoTiff(makeTiff(grid, lzw))
    expect([g.width, g.height, g.west, g.north, g.noData]).toEqual([3, 2, -120, 45, -99999])
    expect(g.sample(44.9, -119.9)).toBe(0)
    expect(g.sample(44.9, -119.4)).toBe(1.5)
    expect(g.sample(44.9, -118.9)).toBeNull() // no data
    expect(g.sample(44.4, -118.9)).toBe(10)
    expect(g.sample(46, -119.9)).toBeNull() // off the grid
  })
})
