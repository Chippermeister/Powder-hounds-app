import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ForecastSection, { formatSnowIn, updatedAgo } from './ForecastSection'
import type { ResortForecast } from './types'

const day = (date: string, snowCm: number) => ({ date, snowCm, tMaxC: 0, tMinC: -5 })

const forecast: ResortForecast = {
  id: 'alta-ski-area',
  generatedAt: '2026-09-26T00:00:00Z',
  timeZone: 'America/Denver',
  summit: { elevationM: 3200, days: [day('2026-09-26', 25.4), day('2026-09-27', 0)] },
  base: { elevationM: 2600, days: [day('2026-09-26', 0), day('2026-09-27', 0)] },
  nws: {
    office: 'SLC',
    updatedAt: '2026-09-25T23:00:00Z',
    gridElevationM: 2900,
    days: [{ date: '2026-09-26', snowCm: 12.7 }],
  },
}

const stubFetch = (res: Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res),
  )
afterEach(() => vi.unstubAllGlobals())

describe('formatSnowIn', () => {
  test.each([
    [0, '–'],
    [1, '<1'],
    [2.54, '1'],
    [30, '12'],
  ])('%f cm → %s', (cm, text) => expect(formatSnowIn(cm)).toBe(text))
})

test('updatedAgo', () => {
  const now = Date.parse('2026-09-26T03:00:00Z')
  expect(updatedAgo('2026-09-26T02:45:00Z', now)).toBe('15 min ago')
  expect(updatedAgo('2026-09-26T00:00:00Z', now)).toBe('3 h ago')
})

test('shows summit, base and NWS rows with 7-day totals', async () => {
  stubFetch(Response.json(forecast))
  render(<ForecastSection resortId="alta-ski-area" />)
  const table = await screen.findByRole('table')
  expect(fetch).toHaveBeenCalledWith('/forecast/alta-ski-area.json')
  const row = (name: string) => within(table).getByRole('row', { name: new RegExp(`^${name}`) })
  expect(row('Summit')).toHaveTextContent('10,499 ft10–10″')
  expect(row('Base')).toHaveTextContent('––0″')
  expect(row('NWS')).toHaveTextContent('55″')
})

test('says so when there is no forecast file', async () => {
  // A missing file comes back as the SPA's HTML page.
  stubFetch(new Response('<!doctype html>'))
  render(<ForecastSection resortId="nowhere" />)
  expect(await screen.findByText('Forecast not available right now.')).toBeInTheDocument()
})
