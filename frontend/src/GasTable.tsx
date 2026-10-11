import { useState } from 'react'
import { formatLitres, pricePerLitre } from './fuel.ts'
import type { Country, Store } from './types.ts'

interface GasTableProps {
  store: Store // a station with only its fuel items
  country: Country
}

// One gas station's fill-ups, newest first, each with what a litre cost
export function GasTable({ store, country }: GasTableProps) {
  const headingId = `gas-${store.id}`
  const [query, setQuery] = useState('')
  const sorted = [...store.items].sort(
    (a, b) => (b.purchased_on ?? '').localeCompare(a.purchased_on ?? '') || b.id - a.id,
  )
  // A fill-up has no item name to look through, so every word typed has to be in its fuel type or its date
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const fills = sorted.filter((item) => {
    const text = `${item.fuel_type ?? ''} ${item.purchased_on ?? ''}`.toLowerCase()
    return terms.every((term) => text.includes(term))
  })

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head store-head-search">
        <div>
          <h2 id={headingId} className="store-name">{store.name}</h2>
        </div>
        <input
          type="search"
          className="store-search"
          aria-label={`Search ${store.name} fill-ups by fuel type or date`}
          placeholder="Search a fuel type or date"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {fills.length === 0 && <p className="status">No fill-up at {store.name} matches "{query.trim()}".</p>}
      <table className="items items-compact items-large" hidden={fills.length === 0}>
        <thead>
          <tr>
            <th scope="col" className="date">Date</th>
            <th scope="col" className="fuel-type">Fuel type</th>
            <th scope="col" className="amount">Litres</th>
            <th scope="col" className="unit-price">Unit price</th>
          </tr>
        </thead>
        <tbody>
          {fills.map((item) => {
            const perLitre = pricePerLitre(item.price_cents, item.volume_ml, country)
            return (
              <tr key={item.id}>
                <td className="date">{item.purchased_on}</td>
                <td className="fuel-type">{item.fuel_type}</td>
                <td className="amount">{item.volume_ml ? formatLitres(item.volume_ml) : ''}</td>
                <td className="unit-price">{perLitre && `${perLitre} per L`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
