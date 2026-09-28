import { useState } from 'react'
import { Arrow } from './Arrow.tsx'
import { CheapestTable } from './CheapestTable.tsx'
import { COUNTRIES } from './countries.ts'
import type { CountryInfo } from './countries.ts'
import { itemParts } from './format.ts'
import { Loaded } from './Loaded.tsx'
import type { CheapestStore } from './types.ts'
import { useLoad } from './useLoad.ts'

interface CountryCheapestProps {
  country: CountryInfo
  comparedOnly: boolean
}

// One country's cheapest items, one store at a time, same browsing pattern as the Stores page. Countries are never
// mixed, their prices are in different currencies.
function CountryCheapest({ country, comparedOnly }: CountryCheapestProps) {
  const state = useLoad<CheapestStore[]>(`/api/cheapest?country=${country.code}`)
  const headingId = `country-${country.code}`
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <section className="country" aria-labelledby={headingId}>
      <h2 id={headingId} className="country-heading">
        {country.label}
        <span className="country-currency">Prices in {country.currency}</span>
      </h2>
      <Loaded state={state}>
        {(stores) => {
          const withItems = stores
            .map((store) => ({
              ...store,
              items: store.items
                .filter((item) => (comparedOnly ? item.other_stores > 0 : true))
                .filter((item) => itemParts(item).amounts.length > 0),
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
                    aria-current={index === activeIndexInRange ? 'true' : undefined}
                    onClick={() => setActiveIndex(index)}
                  >
                    {store.name}
                  </button>
                ))}
              </div>
              <div className="store-viewport">
                <CheapestTable store={activeStore} country={country.code} />
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
    </section>
  )
}

export function CheapestView() {
  // Most items are only sold at one store, so they are hidden until asked for
  const [comparedOnly, setComparedOnly] = useState(true)

  return (
    <>
      <label className="toggle">
        <input
          type="checkbox"
          checked={comparedOnly}
          onChange={(event) => setComparedOnly(event.target.checked)}
        />
        Only items sold at more than one store
      </label>
      {COUNTRIES.map((country) => (
        <CountryCheapest key={country.code} country={country} comparedOnly={comparedOnly} />
      ))}
    </>
  )
}
