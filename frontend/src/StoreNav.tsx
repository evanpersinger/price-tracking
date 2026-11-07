import { useEffect } from 'react'
import { Arrow } from './Arrow.tsx'
import { isTypingTarget } from './isTypingTarget.ts'

interface StoreNavProps {
  noun: 'store' | 'station' // what the buttons call the thing they switch between
  onPrevious: (() => void) | null // null when there is no previous one, or the arrows are hidden
  onNext: (() => void) | null
}

// The next and previous arrows beside a table on the Store Prices, Cheapest and Gas pages, and the left and right arrow
// keys that do the same. The keys are left alone while typing in a box (they move the cursor there), with a modifier
// held (Cmd+Left is the browser's Back) and while a window like Add a receipt is open on top.
export function StoreNav({ noun, onPrevious, onNext }: StoreNavProps) {
  useEffect(() => {
    function switchStore(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (isTypingTarget(event.target) || document.querySelector('dialog[open]')) return
      const switchTo = event.key === 'ArrowRight' ? onNext : onPrevious
      if (switchTo === null) return
      event.preventDefault()
      switchTo()
    }
    window.addEventListener('keydown', switchStore)
    return () => window.removeEventListener('keydown', switchStore)
  }, [onPrevious, onNext])

  return (
    <div className="store-nav">
      {onNext && (
        <button type="button" className="store-nav-button" aria-label={`Next ${noun}`} onClick={onNext}>
          <Arrow direction="right" />
        </button>
      )}
      {onPrevious && (
        <button type="button" className="store-nav-button" aria-label={`Previous ${noun}`} onClick={onPrevious}>
          <Arrow direction="left" />
        </button>
      )}
    </div>
  )
}
