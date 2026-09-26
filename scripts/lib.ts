// Shared by the data scripts (fetch-forecast.ts, fetch-observed.ts): HTTP with retries, a
// concurrency limiter, and the merged resort list.
import { readFile } from 'node:fs/promises'
import { mergeResorts, type CuratedFile, type Resort } from '../src/resorts/merge.ts'
import type { ResortCandidate } from '../src/resorts/openskimap.ts'

// NWS asks for an identifying User-Agent with a way to reach us; we send it everywhere.
export const USER_AGENT = 'PowderHounds/0.1 (+https://powder-hounds-app.luckyohara.workers.dev)'

export const readJson = async <T>(url: URL): Promise<T> =>
  JSON.parse(await readFile(url, 'utf8')) as T

class HttpError extends Error {
  status: number
  constructor(status: number, url: string) {
    super(`${url}: HTTP ${status}`)
    this.status = status
  }
}

/** GET with a timeout and 3 tries. NWS returns the odd 500 and NOHRSC resets the odd connection. */
async function get(url: string, accept: string, timeoutMs = 30_000): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new HttpError(res.status, url)
      return res
    } catch (err) {
      const permanent = err instanceof HttpError && err.status >= 400 && err.status < 500
      if (permanent || attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

export const getJson = async <T>(url: string): Promise<T> =>
  (await (await get(url, 'application/geo+json, application/json')).json()) as T

export const getText = async (url: string) => (await get(url, 'text/html, */*')).text()

export const getBytes = async (url: string) => (await get(url, '*/*', 60_000)).arrayBuffer()

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return out
}

export const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  )

export async function loadResorts(): Promise<Resort[]> {
  const candidates = await readJson<{ resorts: ResortCandidate[] }>(
    new URL('../data/resorts.openskimap.json', import.meta.url),
  )
  const curated = await readJson<CuratedFile>(
    new URL('../data/resorts.curated.json', import.meta.url),
  )
  return mergeResorts(candidates.resorts, curated)
}

export const isUS = (r: Resort) => r.region.startsWith('US-')

/** Writes a cache file with sorted keys, so diffs stay small when resorts are added. */
export const sortedJson = (obj: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))),
    null,
    2,
  ) + '\n'
