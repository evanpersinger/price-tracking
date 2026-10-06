import { formatPrice } from './format.ts'
import { formatLitres, pricePerLitre } from './fuel.ts'
import type { Country, Store } from './types.ts'

interface GasTableProps {
  store: Store // a station with only its fuel items
  country: Country
}

// One gas station's fill-ups, newest first, each with what a litre cost
export function GasTable({ store, country }: GasTableProps) {
  const headingId = `gas-${store.id}`
  const fills = [...store.items].sort(
    (a, b) => (b.purchased_on ?? '').localeCompare(a.purchased_on ?? '') || b.id - a.id,
  )

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head">
        <h2 id={headingId} className="store-name">{store.name}</h2>
      </div>
      <table className="items">
        <thead>
          <tr>
            <th scope="col" className="row-number">#</th>
            <th scope="col" className="date">Date</th>
            <th scope="col" className="fuel-type">Fuel type</th>
            <th scope="col" className="amount">Litres</th>
            <th scope="col" className="unit-price">Unit price</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {fills.map((item, index) => {
            const perLitre = pricePerLitre(item.price_cents, item.volume_ml, country)
            return (
              <tr key={item.id}>
                <td className="row-number">{index + 1}</td>
                <td className="date">{item.purchased_on}</td>
                <td className="fuel-type">{item.fuel_type}</td>
                <td className="amount">{item.volume_ml ? formatLitres(item.volume_ml) : ''}</td>
                <td className="unit-price">{perLitre && `${perLitre} per L`}</td>
                <td className="price">
                  {item.price_cents === null ? (
                    <span className="no-price">No price</span>
                  ) : (
                    formatPrice(item.price_cents, country)
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
