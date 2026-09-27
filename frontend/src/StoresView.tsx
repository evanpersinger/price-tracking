import { useState } from 'react'
import { itemParts } from './format.ts'
import { Loaded } from './Loaded.tsx'
import { StoreTable } from './StoreTable.tsx'
import type { Country, Store } from './types.ts'
import { useLoad } from './useLoad.ts'

interface StoresViewProps {
  country: Country
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: direction === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <path d="M8 4l8 8-8 8" />
    </svg>
  )
}

export function StoresView({ country }: StoresViewProps) {
  const state = useLoad<Store[]>(`/api/stores?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <Loaded state={state}>
      {(stores) => {
        const withItems = stores
          // No amount to show is not worth a row, for now. Once the item's data gets an amount, it reappears.
          .map((store) => ({ ...store, items: store.items.filter((item) => itemParts(item).amounts.length > 0) }))
          .filter((store) => store.items.length > 0)
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
            <div className="store-viewport">
              <StoreTable store={activeStore} country={country} />
              <div className="store-nav">
                {activeIndexInRange < withItems.length - 1 && (
                  <button
                    type="button"
                    className="store-nav-button"
                    aria-label="Next store"
                    onClick={() => setActiveIndex(activeIndexInRange + 1)}
                  >
                    <Arrow direction="right" />
                  </button>
                )}
                {activeIndexInRange > 0 && (
                  <button
                    type="button"
                    className="store-nav-button"
                    aria-label="Previous store"
                    onClick={() => setActiveIndex(activeIndexInRange - 1)}
                  >
                    <Arrow direction="left" />
                  </button>
                )}
              </div>
            </div>
          </>
        )
      }}
    </Loaded>
  )
}
