import { formatPrice, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { Country, Item, Store } from './types.ts'

interface ByWeightTableProps {
  store: Store
  items: Item[] // this store's items with no fixed count, weight or volume, priced by weight instead
  country: Country
  startIndex: number // how many rows the regular table above already used, so "item N" keeps counting from there
}

// Produce and bulk-bin items (apples, broccoli, a scoop bin) have no package size to put in an Amount column, only a
// price, so this is a plainer table than StoreTable's.
export function ByWeightTable({ store, items, country, startIndex }: ByWeightTableProps) {
  return (
    <section className="store store-compact" aria-label={`${store.name}, sold by weight`}>
      {startIndex === 0 && (
        <div className="store-head">
          <h2 className="store-name">{store.name}</h2>
          {store.discount_text && <p className="discount">{store.discount_text}</p>}
        </div>
      )}
      <table className="items">
        <thead>
          <tr>
            <th scope="col" className="row-number">#</th>
            <th scope="col" className="item">Item name</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const { name, unitPrice } = itemParts(item)
            return (
              <tr key={item.id}>
                <td className="row-number">{startIndex + index + 1}</td>
                <td className="item">
                  <ItemName segments={name} />
                </td>
                <td className="price">
                  {unitPrice ?? (item.price_cents === null ? (
                    <span className="no-price">No price</span>
                  ) : (
                    formatPrice(item.price_cents, country)
                  ))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
