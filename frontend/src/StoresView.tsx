import { useState } from 'react'
import { Arrow } from './Arrow.tsx'
import { itemParts } from './format.ts'
import { isFuelItem } from './fuel.ts'
import { Loaded } from './Loaded.tsx'
import { StoreTable } from './StoreTable.tsx'
import type { Country, Store } from './types.ts'
import { useLoad } from './useLoad.ts'

interface StoresViewProps {
  country: Country
}

export function StoresView({ country }: StoresViewProps) {
  const state = useLoad<Store[]>(`/api/stores?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <Loaded state={state}>
      {(stores) => {
        const withItems = stores
          // Nothing to show (no amount, no typed unit price, no price at all) is not worth a row, for now. A
          // bulk-bin item (no package size, just a per-kg/per-100g rate) or a flat-priced item with no size still has
          // something to show. Gas is left out, it has its own Gas Prices page.
          .map((store) => ({
            ...store,
            items: store.items.filter((item) => {
              if (isFuelItem(item)) return false
              const parts = itemParts(item)
              return parts.amounts.length > 0 || parts.unitPrice !== null || item.price_cents !== null
            }),
          }))
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
              <StoreTable key={activeStore.id} store={activeStore} country={country} />
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
