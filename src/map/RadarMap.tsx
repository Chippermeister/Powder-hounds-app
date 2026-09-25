import 'maplibre-gl/dist/maplibre-gl.css'
import { Map as MapLibreMap, NavigationControl, TerrainControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef, useState } from 'react'
import { RADAR_TILE_SIZE, radarTileUrl, type RadarProduct } from '../radar/wms'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const RADAR_OPACITY = 0.75

// MapLibre looks for its worker next to its own file, but Vite moves the library into a bundle.
// Let Vite build the worker as a separate asset and tell MapLibre where it ended up.
setWorkerUrl(workerUrl)

interface Props {
  product: RadarProduct
  frames: string[]
  frameIndex: number
}

const radarId = (i: number) => `radar-${i}`

/**
 * Full-screen map. Every radar frame gets its own layer, all loaded up front at opacity 0.
 * Animating is then just swapping which layer is visible, so there's no network wait between frames.
 */
export default function RadarMap({ product, frames, frameIndex }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!container.current) return
    const map = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: [-116.5, 45.5], // western US + BC/AB
      zoom: 4.2,
      maxPitch: 70,
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')

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

  // MapLibre's CSS forces `position: relative` on the map element, so position a wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" data-testid="map" />
    </div>
  )
}

/** Insert our layers under the basemap's labels so place names stay readable over radar. */
function firstSymbolLayer(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id
}
