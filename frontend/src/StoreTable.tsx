import { formatPrice, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { Country, Store } from './types.ts'

interface StoreTableProps {
  store: Store
  country: Country
}

export function storeHeadingId(storeId: number): string {
  return `store-${storeId}`
}

export function StoreTable({ store, country }: StoreTableProps) {
  const headingId = storeHeadingId(store.id)

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head">
        <h2 id={headingId} className="store-name">{store.name}</h2>
        {store.discount_text && <p className="discount">{store.discount_text}</p>}
      </div>
      <table className="items">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className="amount">Amount</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {store.items.map((item) => {
            const { name, amounts } = itemParts(item)
            return (
              <tr key={item.id}>
                <td>
                  <ItemName segments={name} />
                </td>
                <td className="amount">{amounts.join(' · ')}</td>
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
