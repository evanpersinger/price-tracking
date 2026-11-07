import { useEffect } from 'react'
import type { RefObject } from 'react'

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

// Pressing "/" with no text box selected puts the cursor in the page's search box, like GitHub and YouTube do. Typed in
// a text box it is just a slash, and a page with no search box on screen (ref empty) leaves the key alone.
export function useSlashToFocus(searchRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.includes(target.tagName))) return
      if (searchRef.current === null) return
      event.preventDefault() // stops Firefox opening its own quick find
      searchRef.current.focus()
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [searchRef])
}
