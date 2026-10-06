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
            <input
              type="search"
              className="search-box"
              aria-label="Search for an item"
              placeholder="Search for an item name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {searchText !== '' ? (
              <div className="store-viewport">
                <SearchResults country={country} query={searchText} />
              </div>
            ) : (
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
                  <CheapestTable store={activeStore} country={country} />
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
            )}
          </>
        )
      }}
    </Loaded>
  )
}
