import { useEffect, useState } from 'react'

export type StaticJsonState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'unavailable' }

/**
 * Loads a JSON file the data pipeline wrote into public/ (e.g. /forecast/{id}.json). "unavailable"
 * covers a missing file, which the host answers with the SPA's index.html (so the JSON parse
 * fails) — e.g. in dev before `npm run forecast`.
 */
export function useStaticJson<T>(url: string): StaticJsonState<T> {
  // Remember which URL a result belongs to, so switching resorts never shows the old one.
  const [result, setResult] = useState<{ url: string; data: T | null }>()

  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setResult({ url, data })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (result?.url !== url) return { status: 'loading' }
  return result.data ? { status: 'ready', data: result.data } : { status: 'unavailable' }
}
