import { useState } from 'react'
import { CheapestTable } from './CheapestTable.tsx'
import { COUNTRIES } from './countries.ts'
import type { CountryInfo } from './countries.ts'
import { Loaded } from './Loaded.tsx'
import type { CheapestStore } from './types.ts'
import { useLoad } from './useLoad.ts'

interface CountryCheapestProps {
  country: CountryInfo
  comparedOnly: boolean
}

// One country's cheapest items. Countries are never mixed, their prices are in different currencies.
function CountryCheapest({ country, comparedOnly }: CountryCheapestProps) {
  const state = useLoad<CheapestStore[]>(`/api/cheapest?country=${country.code}`)
  const headingId = `country-${country.code}`

  return (
    <section className="country" aria-labelledby={headingId}>
      <h2 id={headingId} className="country-heading">
        {country.label}
        <span className="country-currency">Prices in {country.currency}</span>
      </h2>
      <Loaded state={state}>
        {(stores) => {
          const visible = stores
            .map((store) => ({
              ...store,
              items: comparedOnly ? store.items.filter((item) => item.other_stores > 0) : store.items,
            }))
            .filter((store) => store.items.length > 0)

          if (visible.length === 0) {
            return <p className="status">No items to compare yet.</p>
          }
          return visible.map((store) => <CheapestTable key={store.id} store={store} country={country.code} />)
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
