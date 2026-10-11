import { useState } from 'react'
import { Arrow } from './Arrow.tsx'
import { CheapestTable } from './CheapestTable.tsx'
import { itemParts } from './format.ts'
import { Loaded } from './Loaded.tsx'
import { SearchResults } from './SearchResults.tsx'
import type { CheapestStore, Country } from './types.ts'
import { useLoad } from './useLoad.ts'

interface CheapestViewProps {
  country: Country
}

export function CheapestView({ country }: CheapestViewProps) {
  const state = useLoad<CheapestStore[]>(`/api/cheapest?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState('')
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
          .filter((store) => store.items.length > 0)

        if (withItems.length === 0) {
          return <p className="status">No items to compare yet.</p>
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
                  aria-current={!isSearching && index === activeIndexInRange ? 'true' : undefined}
                  onClick={() => {
                    setActiveIndex(index)
                    setQuery('')
                  }}
                >
                  {store.name}
                </button>
              ))}
            </div>
            <div className="store-viewport">
              {/* One card for both views, so the search box stays mounted (and focused) while typing swaps the store's
                  table for what every store sells the item for */}
              <section className="store" aria-labelledby="cheapest-heading">
                <div className="store-head store-head-search">
                  <div>
                    <h3 id="cheapest-heading" className="store-name">{isSearching ? 'All stores' : activeStore.name}</h3>
                  </div>
                  <input
                    type="search"
                    className="store-search"
                    aria-label="Search for an item"
                    placeholder="Search for an item"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                {isSearching ? (
                  <SearchResults country={country} query={searchText} />
                ) : (
                  <CheapestTable store={activeStore} country={country} />
                )}
              </section>
              {/* The column stays, empty, while searching, so the card and its search box don't shift sideways */}
              <div className="store-nav">
                {!isSearching && activeIndexInRange < withItems.length - 1 && (
                  <button
                    type="button"
                    className="store-nav-button"
                    aria-label="Next store"
                    onClick={() => setActiveIndex(activeIndexInRange + 1)}
                  >
                    <Arrow direction="right" />
                  </button>
                )}
                {!isSearching && activeIndexInRange > 0 && (
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
