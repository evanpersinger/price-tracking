import { useState } from 'react'
import { AmountCell } from './AmountCell.tsx'
import { formatCheapestUnitPrice, formatPrice, isZeroMoney, itemParts } from './format.ts'
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
    const itemName = itemParts(item, store.name).name.map((segment) => segment.text).join('').toLowerCase()
    return terms.every((term) => itemName.includes(term))
  })

  const rows = items.map((item) => {
    const { name, amounts, unitPrice: typedUnitPrice, receiptName } = itemParts(item, store.name)
    // No typed unit price: the one the API worked out from the price and the size (written in the name, or in the size
    // fields), per item, else per gram, else per ml
    const itemName = name.map((segment) => segment.text).join('').trim()
    const unitPrice =
      typedUnitPrice ??
      (item.unit && item.unit_price_cents !== null && item.price_cents !== null
        ? formatCheapestUnitPrice(
            { unit: item.unit, unit_price_cents: item.unit_price_cents, price_cents: item.price_cents },
            itemName,
            country,
          )
        : null)
    return { item, name, amounts, unitPrice, receiptName }
  })
  // A store whose items never have a unit price (e.g. furniture, one-off goods) gets no column of blank cells
  const showUnitPrice = rows.some((row) => row.unitPrice !== null)
  // Most stores never sell anything dosed by capsule, so the column only shows up where it's actually used
  const showDose = rows.some((row) => row.item.dose_mg !== null)

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
            {showUnitPrice && <th scope="col" className="unit-price">Unit price</th>}
            {showDose && <th scope="col" className="dose">Capsule</th>}
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, name, amounts, unitPrice, receiptName }, index) => (
            <tr key={item.id}>
              <td className="row-number">{index + 1}</td>
              <td className="item-code">{item.item_code}</td>
              <td className="brand">{item.brand}</td>
              <td className="item">
                <ItemName segments={name} />
                {receiptName && <div className="item-receipt-name">{receiptName}</div>}
              </td>
              <AmountCell amounts={amounts} />
              {showUnitPrice && (
                <td className={unitPrice && isZeroMoney(unitPrice) ? 'unit-price zero-money' : 'unit-price'}>
                  {unitPrice}
                </td>
              )}
              {showDose && <td className="dose">{item.dose_mg !== null && `${item.dose_mg}mg`}</td>}
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
