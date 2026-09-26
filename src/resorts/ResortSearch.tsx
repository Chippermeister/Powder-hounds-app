import { useId, useState } from 'react'
import { regionLabel, type Resort } from './resorts'
import { searchResorts } from './search'

interface Props {
  resorts: Resort[]
  onPick: (id: string) => void
}

/** Type-ahead resort finder. Arrow keys move through matches, Enter picks, Escape clears. */
export default function ResortSearch({ resorts, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const listId = useId()
  const matches = open ? searchResorts(resorts, query) : []
  const showList = query.trim() !== '' && open

  const pick = (r: Resort) => {
    onPick(r.id)
    setQuery('')
    setOpen(false)
    // Close the phone keyboard so the sheet has the screen.
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-label="Search resorts"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
        placeholder="Search resorts"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((i) => (matches.length ? (i + step + matches.length) % matches.length : 0))
          } else if (e.key === 'Enter' && matches[active]) {
            pick(matches[active])
          } else if (e.key === 'Escape') {
            setQuery('')
          }
        }}
        className="panel w-full rounded-xl px-3 py-2 text-base shadow-lg outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-accent sm:text-sm"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching resorts"
          className="panel absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">No resorts match.</li>
          )}
          {matches.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list before a click lands.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(r)
              }}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-baseline justify-between gap-2 px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-white"
            >
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 text-xs opacity-70">{regionLabel(r.region)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
