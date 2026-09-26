import { useSyncExternalStore } from 'react'

/** True while a CSS media query matches. False where matchMedia doesn't exist (tests). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(query).matches ?? false,
  )
}

/** Tailwind's `sm` breakpoint: side card above it, bottom sheet below. */
export const WIDE = '(min-width: 640px)'
