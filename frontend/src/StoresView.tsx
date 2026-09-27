import { useRef, useState, type WheelEvent } from 'react'
import { Loaded } from './Loaded.tsx'
import { StoreTable } from './StoreTable.tsx'
import type { Country, Store } from './types.ts'
import { useLoad } from './useLoad.ts'

interface StoresViewProps {
  country: Country
}

const SWIPE_THRESHOLD = 40 // how far a wheel/trackpad delta has to move before it counts as a swipe
const SWIPE_COOLDOWN_MS = 400 // one swap per gesture, not one per wheel event a trackpad fires while swiping

export function StoresView({ country }: StoresViewProps) {
  const state = useLoad<Store[]>(`/api/stores?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)
  const lastSwapAt = useRef(0)

  function handleWheel(event: WheelEvent<HTMLDivElement>, count: number) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(delta) < SWIPE_THRESHOLD) return
    const now = Date.now()
    if (now - lastSwapAt.current < SWIPE_COOLDOWN_MS) return
    lastSwapAt.current = now
    setActiveIndex((index) => Math.min(Math.max(index + (delta > 0 ? 1 : -1), 0), count - 1))
  }

  return (
    <Loaded state={state}>
      {(stores) => {
        const withItems = stores.filter((store) => store.items.length > 0)
        if (withItems.length === 0) {
          return <p className="status">No prices added yet.</p>
        }
        const activeIndexInRange = Math.min(activeIndex, withItems.length - 1)
        const activeStore = withItems[activeIndexInRange]
        return (
          <>
            <div className="store-jump">
              {withItems.map((store, index) => (
                <button
                  key={store.id}
                  type="button"
                  className="nav-link"
                  aria-current={index === activeIndexInRange ? 'true' : undefined}
                  onClick={() => setActiveIndex(index)}
                >
                  {store.name}
                </button>
              ))}
            </div>
            <div className="store-viewport" onWheel={(event) => handleWheel(event, withItems.length)}>
              <StoreTable store={activeStore} country={country} />
            </div>
          </>
        )
      }}
    </Loaded>
  )
}
