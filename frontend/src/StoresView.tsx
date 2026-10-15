import { useState } from 'react'
import { Arrow } from './Arrow.tsx'
import { ByWeightTable } from './ByWeightTable.tsx'
import { isPricedByWeight, itemParts } from './format.ts'
import { isFuelItem } from './fuel.ts'
import { Loaded } from './Loaded.tsx'
import { StoreButton } from './StoreButton.tsx'
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
        // Anything picked out loose and priced by weight (produce, a bulk bin: no package size, just a per-kg or
        // per-100g rate) gets its own plainer table. Everything else, including a flat-priced item with no size at
        // all (the size just wasn't recorded, it isn't sold by weight), stays in the regular table.
        const byWeightItems = activeStore.items.filter((item) => isPricedByWeight(itemParts(item)))
        const packagedItems = activeStore.items.filter((item) => !byWeightItems.includes(item))
        return (
          <>
            <div className="store-jump">
              {withItems.map((store, index) => (
                <StoreButton
                  key={store.id}
                  name={store.name}
                  selected={index === activeIndexInRange}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
            <div className="store-viewport">
              <div className="store-stack">
                {packagedItems.length > 0 && (
                  <StoreTable
                    key={`${activeStore.id}-packaged`}
                    store={{ ...activeStore, items: packagedItems }}
                    country={country}
                  />
                )}
                {byWeightItems.length > 0 && (
                  <ByWeightTable
                    key={`${activeStore.id}-by-weight`}
                    store={activeStore}
                    items={byWeightItems}
                    country={country}
                    startIndex={packagedItems.length}
                  />
                )}
              </div>
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
