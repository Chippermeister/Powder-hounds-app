// Minimal GeoTIFF point sampler for the NOHRSC snowfall grids (sfav2_CONUS_*.tif).
// Those files are one plain lat/lon grid: float32, LZW or uncompressed, no predictor, one or more
// rows per strip. We only support that, and throw on anything else so a format change is loud.
// Reading only the strips we need keeps a full run fast (~160 points out of 850 rows).

export interface Grid {
  width: number
  height: number
  /** Top-left corner (pixel edge) and pixel size in degrees */
  west: number
  north: number
  dx: number
  dy: number
  noData: number | null
  /** Value at (lat, lon), or null outside the grid / no data */
  sample(lat: number, lon: number): number | null
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8 }

export function readGeoTiff(buf: ArrayBuffer): Grid {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  const le = view.getUint16(0) === 0x4949 // "II"
  if (view.getUint16(2, le) !== 42) throw new Error('not a classic TIFF')

  // Read the first IFD into tag → values (numbers) or string.
  const tags = new Map<number, number[] | string>()
  const ifd = view.getUint32(4, le)
  const count = view.getUint16(ifd, le)
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12
    const tag = view.getUint16(e, le)
    const type = view.getUint16(e + 2, le)
    const n = view.getUint32(e + 4, le)
    const size = TYPE_SIZE[type]
    if (!size) continue
    const at = size * n <= 4 ? e + 8 : view.getUint32(e + 8, le)
    if (type === 2) {
      tags.set(tag, new TextDecoder().decode(bytes.subarray(at, at + n)).replace(/\0.*$/s, ''))
      continue
    }
    const vals: number[] = []
    for (let j = 0; j < n; j++) {
      const p = at + j * size
      if (type === 1) vals.push(view.getUint8(p))
      else if (type === 3) vals.push(view.getUint16(p, le))
      else if (type === 4) vals.push(view.getUint32(p, le))
      else if (type === 5) vals.push(view.getUint32(p, le) / view.getUint32(p + 4, le))
      else if (type === 11) vals.push(view.getFloat32(p, le))
      else vals.push(view.getFloat64(p, le))
    }
    tags.set(tag, vals)
  }
  const num = (tag: number, fallback?: number) => {
    const v = tags.get(tag)
    if (Array.isArray(v)) return v[0]
    if (fallback !== undefined) return fallback
    throw new Error(`TIFF tag ${tag} missing`)
  }
  const arr = (tag: number) => {
    const v = tags.get(tag)
    if (!Array.isArray(v)) throw new Error(`TIFF tag ${tag} missing`)
    return v
  }

  const width = num(256)
  const height = num(257)
  const compression = num(259, 1)
  if (num(258) !== 32 || num(339, 1) !== 3) throw new Error('expected float32 samples')
  if (num(277, 1) !== 1) throw new Error('expected one sample per pixel')
  if (num(317, 1) !== 1) throw new Error('TIFF predictor not supported')
  if (compression !== 1 && compression !== 5) throw new Error(`compression ${compression}`)
  const rowsPerStrip = num(278, height)
  const offsets = arr(273)
  const byteCounts = arr(279)
  const [dx, dy] = arr(33550) // ModelPixelScale
  const [, , , west, north] = arr(33922) // ModelTiepoint: raster (0,0) → (west, north)
  const noDataTag = tags.get(42113)
  const noData = typeof noDataTag === 'string' && noDataTag ? Number(noDataTag) : null

  const strips = new Map<number, DataView>()
  const strip = (s: number) => {
    let d = strips.get(s)
    if (!d) {
      const raw = bytes.subarray(offsets[s], offsets[s] + byteCounts[s])
      const data = compression === 5 ? lzwDecode(raw) : raw.slice()
      d = new DataView(data.buffer, data.byteOffset, data.byteLength)
      strips.set(s, d)
    }
    return d
  }

  return {
    width,
    height,
    west,
    north,
    dx,
    dy,
    noData,
    sample(lat, lon) {
      const col = Math.floor((lon - west) / dx)
      const row = Math.floor((north - lat) / dy)
      if (col < 0 || row < 0 || col >= width || row >= height) return null
      const s = Math.floor(row / rowsPerStrip)
      const p = ((row % rowsPerStrip) * width + col) * 4
      const v = strip(s).getFloat32(p, le)
      if (!Number.isFinite(v) || v === noData || v < -1) return null
      return v
    },
  }
}

/** TIFF-flavoured LZW (MSB-first codes, "early change" code-width bump). */
export function lzwDecode(input: Uint8Array): Uint8Array {
  const CLEAR = 256
  const EOI = 257
  let out = new Uint8Array(Math.max(1024, input.length * 4))
  let outLen = 0
  const ensure = (n: number) => {
    if (n <= out.length) return
    const bigger = new Uint8Array(Math.max(n, out.length * 2))
    bigger.set(out)
    out = bigger
  }

  // Dictionary entries as (prefix code, last byte, length); strings are rebuilt on output.
  const prefix = new Int32Array(4096)
  const suffix = new Uint8Array(4096)
  const length = new Uint16Array(4096)
  for (let i = 0; i < 256; i++) {
    prefix[i] = -1
    suffix[i] = i
    length[i] = 1
  }
  const firstByte = (code: number) => {
    while (prefix[code] !== -1) code = prefix[code]
    return suffix[code]
  }
  const emit = (code: number) => {
    const len = length[code]
    ensure(outLen + len)
    for (let i = len - 1; i >= 0; i--) {
      out[outLen + i] = suffix[code]
      code = prefix[code]
    }
    outLen += len
  }

  let bitPos = 0
  const read = (width: number) => {
    let code = 0
    for (let i = 0; i < width; i++) {
      const byte = input[(bitPos + i) >> 3] ?? 0
      code = (code << 1) | ((byte >> (7 - ((bitPos + i) & 7))) & 1)
    }
    bitPos += width
    return code
  }

  let next = 258
  let width = 9
  let prev = -1
  while (bitPos + width <= input.length * 8) {
    const code = read(width)
    if (code === EOI) break
    if (code === CLEAR) {
      next = 258
      width = 9
      prev = -1
      continue
    }
    // A code can be at most the one about to be added; anything else is a corrupt stream
    // (and would send firstByte() walking off the table).
    if (code > next || (code === next && (prev === -1 || next === 4096))) {
      throw new Error('corrupt LZW data')
    }
    if (prev === -1) {
      emit(code)
      prev = code
      continue
    }
    const known = code < next
    const first = firstByte(known ? code : prev)
    if (next < 4096) {
      prefix[next] = prev
      suffix[next] = first
      length[next] = length[prev] + 1
      next++
    }
    emit(code)
    prev = code
    if (next + 1 >= 1 << width && width < 12) width++
  }
  return out.subarray(0, outLen)
}
