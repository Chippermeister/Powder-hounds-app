import { useEffect, useState } from 'react'
import RadarMap from './map/RadarMap'
import RadarControls from './radar/RadarControls'
import { useRadarFrames } from './radar/useRadarFrames'
import { RADAR_PRODUCTS, type RadarProductId } from './radar/wms'

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

  return (
    <main className="relative h-full overflow-hidden">
      <h1 className="sr-only">Powder Hounds</h1>
      <RadarMap product={product} frames={frames} frameIndex={frameIndex} />
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
    </main>
  )
}
