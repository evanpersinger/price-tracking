import { formatPrice, itemLabel, labelSegments } from './format.ts'
import type { Country, Store } from './types.ts'

interface StoreTableProps {
  store: Store
  country: Country
}

export function StoreTable({ store, country }: StoreTableProps) {
  const headingId = `store-${store.id}`

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head">
        <h2 id={headingId}>{store.name}</h2>
        {store.discount_text && <p className="discount">{store.discount_text}</p>}
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
                {labelSegments(itemLabel(item)).map((segment) => (
                  <span key={segment.start} className={`item-${segment.kind}`}>
                    {segment.text}
                  </span>
                ))}
              </td>
              <td className="price">
                {item.price_cents === null ? (
                  <span className="no-price">No price</span>
                ) : (
                  formatPrice(item.price_cents, country)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
