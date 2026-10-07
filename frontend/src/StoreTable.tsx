import { useState } from 'react'
import { formatPrice, formatUnitPrice, isZeroMoney, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { Country, Store } from './types.ts'

interface StoreTableProps {
  store: Store
  country: Country
}

export function StoreTable({ store, country }: StoreTableProps) {
  const headingId = `store-${store.id}`
  const [query, setQuery] = useState('')
  // Every word typed has to be in the item's name, ignoring case
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const items = store.items.filter((item) => {
    const itemName = itemParts(item).name.map((segment) => segment.text).join('').toLowerCase()
    return terms.every((term) => itemName.includes(term))
  })

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head store-head-search">
        <div>
          <h2 id={headingId} className="store-name">{store.name}</h2>
          {store.discount_text && <p className="discount">{store.discount_text}</p>}
        </div>
        <input
          type="search"
          className="store-search"
          aria-label={`Search ${store.name} for an item name`}
          placeholder="Search for an item name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {items.length === 0 && <p className="status">No item in {store.name} matches "{query.trim()}".</p>}
      <table className="items" hidden={items.length === 0}>
        <thead>
          <tr>
            <th scope="col" className="row-number">#</th>
            <th scope="col" className="item-code">Item code</th>
            <th scope="col" className="brand">Brand</th>
            <th scope="col" className="item">Item name</th>
            <th scope="col" className="amount">Amount</th>
            <th scope="col" className="unit-price">Unit price</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
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
                <td className="item-code">{item.item_code}</td>
                <td className="brand">{item.brand}</td>
                <td className="item">
                  <ItemName segments={name} />
                </td>
                <td className={amounts.length > 1 ? 'amount amount-split' : 'amount'}>
                  {amounts.length > 1 ? (
                    <span className="amount-chips">
                      {amounts.map((amount) => (
                        <span className="amount-chip" key={amount}>
                          {amount}
                        </span>
                      ))}
                    </span>
                  ) : (
                    amounts[0]
                  )}
                </td>
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
