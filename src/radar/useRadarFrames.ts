import { useEffect, useState } from 'react'
import { fetchRadarFrames, type RadarProduct, type RadarProductId } from './wms'

const REFRESH_MS = 5 * 60_000

type State = { frames: string[]; error: string | null }

const EMPTY: State = { frames: [], error: null }

/** Fetch the latest radar frames for a product, refreshing every few minutes. */
export function useRadarFrames(product: RadarProduct): State {
  // Tag results with their product so a switch shows nothing until the new product's frames arrive.
  const [result, setResult] = useState<State & { productId: RadarProductId | null }>({
    ...EMPTY,
    productId: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    const load = () =>
      fetchRadarFrames(product, controller.signal)
        .then((frames) => setResult({ frames, error: null, productId: product.id }))
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          const error = err instanceof Error ? err.message : String(err)
          setResult((r) => ({
            ...(r.productId === product.id ? r : EMPTY),
            error,
            productId: product.id,
          }))
        })
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [product])

  return result.productId === product.id ? result : EMPTY
}
