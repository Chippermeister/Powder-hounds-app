import 'maplibre-gl/dist/maplibre-gl.css'
import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  TerrainControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import type { ObservedIndex } from '../observed/types'
import { RADAR_TILE_SIZE, radarTileUrl, type RadarProduct } from '../radar/wms'
import type { Resort } from '../resorts/resorts'
import { isClear, measurePadding } from './padding'
import { addResortLayers, highlightResort, setResortSnow } from './resortLayers'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const RADAR_OPACITY = 0.75
/** Zoom a search jumps to: close enough to see the resort's neighbours by name. */
const SEARCH_ZOOM = 9
/** Open-Meteo data is CC BY 4.0, which requires this credit wherever it's shown. */
const OPEN_METEO_CREDIT =
  '<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a> (CC BY 4.0)'

// MapLibre looks for its worker next to its own file, but Vite moves the library into a bundle.
// Let Vite build the worker as a separate asset and tell MapLibre where it ended up.
setWorkerUrl(workerUrl)

/** A resort the user picked. `via` decides the camera move; a new object re-runs it. */
export interface Selection {
  id: string
  via: 'map' | 'search'
}

interface Props {
  product: RadarProduct
  frames: string[]
  frameIndex: number
  resorts: Resort[]
  observed: ObservedIndex | null
  selection: Selection | null
  onSelectResort: (id: string) => void
}

const radarId = (i: number) => `radar-${i}`

/**
 * Full-screen map. Every radar frame gets its own layer, all loaded up front at opacity 0.
 * Animating is then just swapping which layer is visible, so there's no network wait between frames.
 */
export default function RadarMap(props: Props) {
  const { product, frames, frameIndex, resorts, observed, selection } = props
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  // The click handler is registered once on load; read the latest callback through a ref.
  const onSelectResort = useRef(props.onSelectResort)
  // The resort list is static for the page's lifetime, so the map is built with the first one.
  const initialResorts = useRef(resorts)
  useEffect(() => {
    onSelectResort.current = props.onSelectResort
  })

  useEffect(() => {
    if (!container.current) return
    const small = window.matchMedia?.('(max-width: 640px)').matches ?? false
    const map = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      // First view: every resort, clear of the search box and radar panel.
      bounds: boundsOf(initialResorts.current),
      fitBoundsOptions: { padding: measurePadding(container.current) },
      maxPitch: 70,
      // Phones get the (i) button only; expanded, the credits cover the radar panel.
      attributionControl: { compact: small, customAttribution: OPEN_METEO_CREDIT },
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    // MapLibre opens a compact attribution at first and only folds it on the first drag.
    if (small) {
      map.once('load', () =>
        container.current
          ?.querySelector('.maplibregl-ctrl-attrib')
          ?.classList.remove('maplibregl-compact-show'),
      )
    }

    map.on('load', () => {
      map.addSource('terrain', {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain: Mapzen / AWS Open Data',
      })
      map.addLayer(
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'terrain',
          paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#3d4a5c' },
        },
        firstSymbolLayer(map),
      )
      map.addControl(new TerrainControl({ source: 'terrain', exaggeration: 1.4 }), 'top-right')
      // Added last, so pins sit above radar and basemap labels.
      addResortLayers(map, initialResorts.current, (id) => onSelectResort.current(id))
      setReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // (Re)build radar layers when the product or frame list changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const beforeId = firstSymbolLayer(map)
    frames.forEach((time, i) => {
      map.addSource(radarId(i), {
        type: 'raster',
        tiles: [radarTileUrl(product, time)],
        tileSize: RADAR_TILE_SIZE,
        attribution: product.attribution,
      })
      map.addLayer(
        {
          id: radarId(i),
          type: 'raster',
          source: radarId(i),
          paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 },
        },
        beforeId,
      )
    })
    return () => {
      frames.forEach((_, i) => {
        if (map.getLayer(radarId(i))) map.removeLayer(radarId(i))
        if (map.getSource(radarId(i))) map.removeSource(radarId(i))
      })
    }
  }, [ready, product, frames])

  // Show only the current frame.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    frames.forEach((_, i) => {
      if (!map.getLayer(radarId(i))) return
      map.setPaintProperty(radarId(i), 'raster-opacity', i === frameIndex ? RADAR_OPACITY : 0)
    })
  }, [ready, frames, frameIndex])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready && observed) setResortSnow(map, initialResorts.current, observed)
  }, [ready, observed])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready) highlightResort(map, selection?.id ?? null)
  }, [ready, selection?.id])

  // Bring the picked resort into the part of the map no panel covers. The card or sheet for it
  // is already in the DOM (same render), so it's part of the measurement.
  useEffect(() => {
    const map = mapRef.current
    const resort = selection && initialResorts.current.find((r) => r.id === selection.id)
    if (!map || !ready || !resort) return
    const center: [number, number] = [resort.lon, resort.lat]
    const padding = measurePadding(map.getContainer())
    if (selection.via === 'search') {
      map.flyTo({ center, zoom: Math.max(map.getZoom(), SEARCH_ZOOM), padding })
      return
    }
    const { x, y } = map.project(center)
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    if (!isClear(x, y, w, h, padding)) map.easeTo({ center, padding })
  }, [ready, selection])

  // MapLibre's CSS forces `position: relative` on the map element, so position a wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" data-testid="map" />
    </div>
  )
}

function boundsOf(resorts: Resort[]): LngLatBounds {
  const bounds = new LngLatBounds()
  for (const r of resorts) bounds.extend([r.lon, r.lat])
  return bounds
}

/** Insert our layers under the basemap's labels so place names stay readable over radar. */
function firstSymbolLayer(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id
}
