import { useEffect, useRef, useState } from 'react'
import { MAP_STYLES, type MapStyleId } from './styles'

interface Props {
  styleId: MapStyleId
  onChange: (id: MapStyleId) => void
}

/** Stacked-sheets icon, the usual sign for "map layers". */
const LayersIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor">
    <path strokeWidth="1.8" strokeLinejoin="round" d="M12 3 2.5 8 12 13l9.5-5L12 3Z" />
    <path strokeWidth="1.8" strokeLinejoin="round" d="m2.5 12 9.5 5 9.5-5M2.5 16l9.5 5 9.5-5" />
  </svg>
)

/**
 * Basemap picker. Sits in MapLibre's top-right control stack (RadarMap portals it in), so it looks
 * like the zoom and 3D buttons; the menu opens to the left.
 */
export default function StyleSwitcher({ styleId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // Close on Escape or a tap anywhere else.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Map style"
        title="Map style"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid place-items-center text-[#333]"
      >
        <LayersIcon />
      </button>
      {open && (
        <div
          role="radiogroup"
          aria-label="Map style"
          className="panel absolute top-0 right-full mr-2 flex w-36 flex-col gap-0.5 rounded-xl p-1 text-sm text-ink shadow-lg"
        >
          {Object.values(MAP_STYLES).map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === styleId}
              onClick={() => {
                onChange(s.id)
                setOpen(false)
              }}
              // MapLibre's control CSS (unlayered, so it beats Tailwind) sizes every button as a 29 px icon; hence the `!`s.
              className="h-auto! w-full! rounded-lg border-0! px-3! py-2! text-left font-medium aria-checked:bg-accent! aria-checked:text-white"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
