import { useEffect, useState } from 'react'
import { useStaticJson } from './data/useStaticJson'
import { OVERLAY_ATTR } from './map/padding'
import RadarMap, { type Selection } from './map/RadarMap'
import SnowLegend from './map/SnowLegend'
import StyleSwitcher from './map/StyleSwitcher'
import { defaultStyle, loadStyle, saveStyle, type MapStyleId } from './map/styles'
import type { ObservedIndex } from './observed/types'
import RadarControls from './radar/RadarControls'
import ResortCard from './resorts/ResortCard'
import ResortSearch from './resorts/ResortSearch'
import ResortSheet from './resorts/ResortSheet'
import { RESORTS } from './resorts/resorts'
import { useRadarFrames } from './radar/useRadarFrames'
import { RADAR_PRODUCTS, type RadarProductId } from './radar/wms'
import { WIDE, useMediaQuery } from './ui/useMediaQuery'

const FRAME_MS = 600
const LAST_FRAME_HOLD_MS = 1500

export default function App() {
  const [productId, setProductId] = useState<RadarProductId>('reflectivity')
  const product = RADAR_PRODUCTS[productId]
  const { frames, error } = useRadarFrames(product)
  // The chosen index is remembered with the frame list it belongs to; a new list starts on its latest frame.
  const [position, setPosition] = useState({ frames, index: 0 })
  const frameIndex = position.frames === frames ? position.index : Math.max(frames.length - 1, 0)
  const setFrameIndex = (index: number) => setPosition({ frames, index })
  const [playing, setPlaying] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const resort = selection && RESORTS.find((r) => r.id === selection.id)
  const observed = useStaticJson<ObservedIndex>('/observed/index.json')
  const wide = useMediaQuery(WIDE)
  // A saved pick wins; otherwise the basemap follows the OS light/dark setting.
  const [pickedStyle, setPickedStyle] = useState<MapStyleId | null>(loadStyle)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const mapStyle = pickedStyle ?? defaultStyle(prefersDark)
  const pickStyle = (id: MapStyleId) => {
    saveStyle(id)
    setPickedStyle(id)
  }

  // Advance while playing; linger on the newest frame so "now" is easy to read.
  useEffect(() => {
    if (!playing || frames.length < 2) return
    const isLast = frameIndex === frames.length - 1
    const t = setTimeout(
      () => setPosition({ frames, index: (frameIndex + 1) % frames.length }),
      isLast ? LAST_FRAME_HOLD_MS : FRAME_MS,
    )
    return () => clearTimeout(t)
  }, [playing, frames, frameIndex])

  const close = () => setSelection(null)

  return (
    <main className="relative h-full overflow-hidden">
      <h1 className="sr-only">Powder Hounds</h1>
      <RadarMap
        product={product}
        frames={frames}
        frameIndex={frameIndex}
        resorts={RESORTS}
        observed={observed.status === 'ready' ? observed.data : null}
        selection={selection}
        onSelectResort={(id) => setSelection({ id, via: 'map' })}
        mapStyle={mapStyle}
        controls={<StyleSwitcher styleId={mapStyle} onChange={pickStyle} />}
      />
      <RadarControls
        productId={productId}
        onProductChange={setProductId}
        frames={frames}
        frameIndex={frameIndex}
        onFrameChange={setFrameIndex}
        playing={playing}
        onPlayingChange={setPlaying}
        error={error}
      />
      {/* Left column: search, pin key, and (wide screens) the resort card. Phones leave room for the zoom buttons. */}
      <div
        {...{ [OVERLAY_ATTR]: '' }}
        className="pointer-events-none absolute top-4 right-14 left-4 flex max-h-[calc(100%-2rem)] flex-col gap-2 *:pointer-events-auto sm:right-auto sm:w-96"
      >
        <ResortSearch resorts={RESORTS} onPick={(id) => setSelection({ id, via: 'search' })} />
        <SnowLegend />
        {resort && wide && <ResortCard key={resort.id} resort={resort} onClose={close} />}
      </div>
      {resort && !wide && <ResortSheet key={resort.id} resort={resort} onClose={close} />}
    </main>
  )
}
