import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

// jsdom has no WebGL, so stand the map in with a stub that shows which frame is active.
vi.mock('./map/RadarMap', () => ({
  default: ({ product, frameIndex }: { product: { id: string }; frameIndex: number }) => (
    <div data-testid="map">
      {product.id}:{frameIndex}
    </div>
  ),
}))

const caps = (dim: string) =>
  `<WMS_Capabilities><Layer><Dimension name="time">${dim}</Dimension></Layer></WMS_Capabilities>`

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          url.includes('geomet')
            ? caps('2026-09-25T20:00:00Z/2026-09-25T21:00:00Z/PT6M')
            : caps('2026-09-25T20:00:00Z,2026-09-25T20:10:00Z,2026-09-25T20:20:00Z'),
        ),
    ),
  )
})
afterEach(() => vi.unstubAllGlobals())

test('loads radar frames and starts on the latest one', async () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Powder Hounds' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('map')).toHaveTextContent('reflectivity:2'))
  expect(screen.getByRole('slider', { name: 'Radar time' })).toHaveAttribute('max', '2')
})

test('switching to snow rate loads GeoMet frames', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('radio', { name: 'Snow rate' }))
  // 11 six-minute steps in the hour; 10-minute spacing keeps every other one → 6 frames.
  await waitFor(() => expect(screen.getByTestId('map')).toHaveTextContent('snowRate:5'))
})
