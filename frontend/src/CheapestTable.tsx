import { compareNote, formatPrice, formatUnitPrice } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { CheapestStore, Country } from './types.ts'

interface CheapestTableProps {
  store: CheapestStore
  country: Country
}

export function CheapestTable({ store, country }: CheapestTableProps) {
  const headingId = `cheapest-${store.id}`

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head">
        <h3 id={headingId} className="store-name">{store.name}</h3>
      </div>
      <table className="items">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {store.items.map((item) => (
            <tr key={item.id}>
              <td>
                <ItemName label={item.name} />
                <div className="item-meta">
                  <span className="item-unit-price">{formatUnitPrice(item, country)}</span>
                  <span className="item-compare">{compareNote(item.other_stores)}</span>
                </div>
              </td>
              <td className="price">{formatPrice(item.price_cents, country)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
