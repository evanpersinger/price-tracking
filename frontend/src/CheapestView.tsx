import { useRef, useState } from 'react'
import { CheapestByWeightTable } from './CheapestByWeightTable.tsx'
import { CheapestTable } from './CheapestTable.tsx'
import { itemParts } from './format.ts'
import { Loaded } from './Loaded.tsx'
import { SearchResults } from './SearchResults.tsx'
import { StoreButton } from './StoreButton.tsx'
import { StoreNav } from './StoreNav.tsx'
import type { CheapestStore, Country } from './types.ts'
import { useLoad } from './useLoad.ts'
import { useSlashToFocus } from './useSlashToFocus.ts'

interface CheapestViewProps {
  country: Country
}

export function CheapestView({ country }: CheapestViewProps) {
  const state = useLoad<CheapestStore[]>(`/api/cheapest?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  useSlashToFocus(searchRef)
  const searchText = query.trim()
  const isSearching = searchText !== ''

  return (
    <Loaded state={state}>
      {(stores) => {
        const withItems = stores
          .map((store) => ({
            ...store,
            items: store.items.filter((item) => itemParts(item).amounts.length > 0),
          }))
          .filter((store) => store.items.length > 0 || store.by_weight.length > 0)

        if (withItems.length === 0) {
          return <p className="status">No items to compare yet.</p>
        }
        const activeIndexInRange = Math.min(activeIndex, withItems.length - 1)
        const activeStore = withItems[activeIndexInRange]
        return (
          <>
            <div className="store-jump">
              {withItems.map((store, index) => (
                <StoreButton
                  key={store.id}
                  name={store.name}
                  selected={!isSearching && index === activeIndexInRange}
                  onClick={() => {
                    setActiveIndex(index)
                    setQuery('')
                  }}
                />
              ))}
            </div>
            <div className="store-viewport">
              {/* One card for both views, so the search box stays mounted (and focused) while typing swaps the store's
                  table for what every store sells the item for */}
              <section className="store" aria-labelledby={isSearching ? undefined : 'cheapest-heading'}>
                <div className="store-head store-head-search">
                  <div>
                    {!isSearching && <h3 id="cheapest-heading" className="store-name">{activeStore.name}</h3>}
                  </div>
                  <input
                    ref={searchRef}
                    type="search"
                    className="store-search"
                    aria-keyshortcuts="/"
                    aria-label="Search for an item"
                    placeholder="Search for an item"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                {isSearching ? (
                  <SearchResults country={country} query={searchText} />
                ) : (
                  <>
                    {activeStore.items.length > 0 && <CheapestTable store={activeStore} country={country} />}
                    {activeStore.by_weight.length > 0 && (
                      <CheapestByWeightTable
                        storeName={activeStore.name}
                        items={activeStore.by_weight}
                        country={country}
                        startIndex={activeStore.items.length}
                      />
                    )}
                  </>
                )}
              </section>
              {/* The column stays, empty, while searching, so the card and its search box don't shift sideways */}
              <StoreNav
                noun="store"
                onPrevious={!isSearching && activeIndexInRange > 0 ? () => setActiveIndex(activeIndexInRange - 1) : null}
                onNext={
                  !isSearching && activeIndexInRange < withItems.length - 1
                    ? () => setActiveIndex(activeIndexInRange + 1)
                    : null
                }
              />
            </div>
          </>
        )
      }}
    </Loaded>
  )
}
