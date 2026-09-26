import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import StyleSwitcher from './StyleSwitcher'

test('opens a menu, marks the current style, and closes after a pick', () => {
  const onChange = vi.fn()
  render(<StyleSwitcher styleId="standard" onChange={onChange} />)
  const toggle = screen.getByRole('button', { name: 'Map style' })
  expect(screen.queryByRole('radiogroup')).toBeNull()

  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked()

  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  expect(onChange).toHaveBeenCalledWith('dark')
  expect(screen.queryByRole('radiogroup')).toBeNull()
})

test('Escape and outside taps close the menu', () => {
  render(<StyleSwitcher styleId="dark" onChange={() => {}} />)
  const toggle = screen.getByRole('button', { name: 'Map style' })

  fireEvent.click(toggle)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('radiogroup')).toBeNull()

  fireEvent.click(toggle)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('radiogroup')).toBeNull()
})
