import { render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import ObservedSection from './ObservedSection'
import { snotelStaleness } from './stale'
import type { ResortObserved } from './types'

const days = Array.from({ length: 14 }, (_, i) => ({
  date: `2026-01-${String(i + 1).padStart(2, '0')}`,
  newCm: i === 12 ? 30.5 : i === 0 ? null : 0,
  depthCm: i === 0 ? null : 127,
}))

const observed: ResortObserved = {
  id: 'alta-ski-area',
  generatedAt: '2026-01-14T12:00:00Z',
  snotel: {
    triplet: '1308:UT:SNTL',
    name: 'Atwater',
    elevationM: 2667,
    distanceKm: 1.8,
    updatedAt: '2026-01-14T11:00:00Z',
    depthCm: 127,
    sweMm: 300,
    new24hCm: 5.1,
    new72hCm: 30.5,
    days,
  },
  nohrsc: {
    snow24hCm: 7.6,
    snow72hCm: 35.6,
    seasonCm: 508,
    validAt: '2026-01-14T12:00:00Z',
    seasonStart: '2025-09-30T12:00:00Z',
    seasonEnd: '2026-01-14T12:00:00Z',
  },
}

const stubFetch = (res: Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res),
  )
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('shows SNOTEL and NOHRSC rows and the 14-day bars', async () => {
  vi.useFakeTimers({ now: Date.parse('2026-01-14T12:30:00Z'), toFake: ['Date'] })
  stubFetch(Response.json(observed))
  render(<ObservedSection resortId="alta-ski-area" />)
  const table = await screen.findByRole('table', { name: 'Observed snow in inches' })
  expect(fetch).toHaveBeenCalledWith('/observed/alta-ski-area.json')
  const row = (name: string) => within(table).getByRole('row', { name: new RegExp(`^${name}`) })
  expect(row('SNOTEL')).toHaveTextContent('Atwater · 8,750 ft · 1 mi2″12″50″')
  expect(row('NOHRSC')).toHaveTextContent('3″14″200″')

  expect(screen.getByRole('img', { name: 'New snow per day, last 14 days' })).toBeInTheDocument()
  const history = screen.getByRole('table', { name: 'New snow per day' })
  expect(within(history).getByText('Jan 13: 12 in new, 50 in depth')).toBeInTheDocument()
  expect(within(history).getByText('Jan 1: no data')).toBeInTheDocument()
  expect(within(history).getByText('Jan 2: no new snow, 50 in depth')).toBeInTheDocument()
  expect(screen.getByText('Updated 30 min ago')).toBeInTheDocument()
})

test('flags a SNOTEL reading that is hours old', async () => {
  vi.useFakeTimers({ now: Date.parse('2026-01-15T07:00:00Z'), toFake: ['Date'] })
  stubFetch(Response.json(observed))
  render(<ObservedSection resortId="alta-ski-area" />)
  const table = await screen.findByRole('table', { name: 'Observed snow in inches' })
  expect(within(table).getByRole('row', { name: /^SNOTEL/ })).toHaveTextContent(
    '⚠ Last reading 20 h ago',
  )
  expect(within(table).getByRole('row', { name: /^NOHRSC/ })).not.toHaveTextContent('⚠')
})

test('snotelStaleness stays quiet for a fresh reading', () => {
  const now = Date.parse('2026-01-14T13:00:00Z')
  expect(snotelStaleness('2026-01-14T11:00:00Z', now)).toBeNull()
  expect(snotelStaleness(null, now)).toBe('No recent reading')
})

test('a dry fortnight gets one line instead of an empty chart', async () => {
  const dry = days.map((d) => ({ ...d, newCm: d.newCm == null ? null : 0, depthCm: 0 }))
  stubFetch(Response.json({ ...observed, snotel: { ...observed.snotel!, days: dry } }))
  render(<ObservedSection resortId="alta-ski-area" />)
  expect(
    await screen.findByText('No new snow at the SNOTEL station in the last 14 days.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /New snow per day/ })).not.toBeInTheDocument()
})

test('says so for resorts outside SNOTEL/NOHRSC coverage', async () => {
  stubFetch(Response.json({ ...observed, snotel: null, nohrsc: null }))
  render(<ObservedSection resortId="whistler-blackcomb" />)
  expect(await screen.findByText('No snow observations for this area yet.')).toBeInTheDocument()
})

test('says so when there is no observed file', async () => {
  stubFetch(new Response('<!doctype html>'))
  render(<ObservedSection resortId="nowhere" />)
  expect(await screen.findByText('Observations not available right now.')).toBeInTheDocument()
})
