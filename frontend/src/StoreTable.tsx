import { formatPrice, formatUnitPrice, isZeroMoney, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
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
        <h2 id={headingId} className="store-name">{store.name}</h2>
        {store.discount_text && <p className="discount">{store.discount_text}</p>}
      </div>
      <table className="items">
        <thead>
          <tr>
            <th scope="col" className="row-number">#</th>
            <th scope="col" className="brand">Brand</th>
            <th scope="col" className="item-code">Item code</th>
            <th scope="col" className="item">Item</th>
            <th scope="col" className="amount">Amount</th>
            <th scope="col" className="unit-price">Unit price</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {store.items.map((item, index) => {
            const { name, amounts, unitPrice: typedUnitPrice } = itemParts(item)
            // No typed unit price: work one out from the price and size, per item, else per gram, else per ml
            const unit = item.item_count ? 'each' : item.weight_g ? 'g' : item.volume_ml ? 'ml' : null
            const size = item.item_count || item.weight_g || item.volume_ml
            const unitPrice =
              typedUnitPrice ??
              (unit && size && item.price_cents !== null
                ? formatUnitPrice({ unit, unit_price_cents: item.price_cents / size }, country)
                : null)
            return (
              <tr key={item.id}>
                <td className="row-number">{index + 1}</td>
                <td className="brand">{item.brand}</td>
                <td className="item-code">{item.item_code}</td>
                <td className="item">
                  <ItemName segments={name} />
                </td>
                <td className="amount">{amounts.join(' · ')}</td>
                <td className={unitPrice && isZeroMoney(unitPrice) ? 'unit-price zero-money' : 'unit-price'}>
                  {unitPrice}
                </td>
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
