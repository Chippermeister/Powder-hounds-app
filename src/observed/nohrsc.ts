// NOHRSC National Snowfall Analysis v2: CONUS snowfall grids on a 0.04° (~4 km) lat/lon grid.
// Product page: https://www.nohrsc.noaa.gov/snowfall/  Files: https://www.nohrsc.noaa.gov/snowfall_v2/data/YYYYMM/
// It's not on NOAA's ArcGIS server (that only has SNODAS depth/SWE), so we download the GeoTIFFs
// and sample them (see geotiff.ts). Values are inches.
//   24h/72h: sfav2_CONUS_24h_YYYYMMDDHH.tif, issued for 00Z and 12Z
//   season:  sfav2_CONUS_{Sep 30 12Z}_to_{YYYYMMDD}12.tif, daily

export const NOHRSC_DATA = 'https://www.nohrsc.noaa.gov/snowfall_v2/data'

export interface NohrscFiles {
  /** Analysis time shared by the 24h and 72h files (the newest time both exist for) */
  validAt: string | null
  snow24h: string | null
  snow72h: string | null
  season: { url: string; start: string; end: string } | null
}

/** "2026092612" → "2026-09-26T12:00:00Z" */
export const stampToIso = (s: string) =>
  `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:00:00Z`

/** Month folders to list: this month and last (early in a month the newest files may be in the last one). */
export function monthFolders(now: number): string[] {
  const d = new Date(now)
  const ym = (y: number, m: number) => `${y}${String(m + 1).padStart(2, '0')}`
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
  return [ym(d.getUTCFullYear(), d.getUTCMonth()), ym(prev.getUTCFullYear(), prev.getUTCMonth())]
}

/** Picks the newest files from directory listings (HTML with href="…"), keyed by folder. */
export function pickFiles(listings: Record<string, string>): NohrscFiles {
  const byHours = { 24: new Map<string, string>(), 72: new Map<string, string>() }
  let season: NohrscFiles['season'] = null
  for (const [folder, html] of Object.entries(listings)) {
    for (const [, name] of html.matchAll(/href="(sfav2_CONUS_[^"]+\.tif)"/g)) {
      const url = `${NOHRSC_DATA}/${folder}/${name}`
      const window = /^sfav2_CONUS_(24|72)h_(\d{10})\.tif$/.exec(name)
      if (window) byHours[window[1] as '24' | '72'].set(window[2], url)
      const s = /^sfav2_CONUS_(\d{10})_to_(\d{10})\.tif$/.exec(name)
      if (s && (!season || stampToIso(s[2]) > season.end))
        season = { url, start: stampToIso(s[1]), end: stampToIso(s[2]) }
    }
  }
  const both = [...byHours[24].keys()].filter((t) => byHours[72].has(t)).sort()
  const latest = both.at(-1)
  return {
    validAt: latest ? stampToIso(latest) : null,
    snow24h: latest ? byHours[24].get(latest)! : null,
    snow72h: latest ? byHours[72].get(latest)! : null,
    season,
  }
}
