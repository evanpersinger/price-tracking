import { useRef, useState } from 'react'
import { AmountCell } from './AmountCell.tsx'
import { formatCheapestUnitPrice, formatPrice, isZeroMoney, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import { SortableHeader } from './SortableHeader.tsx'
import { nextSort, sortRows } from './sortRows.ts'
import type { SortColumn, SortState } from './sortRows.ts'
import type { Country, Store } from './types.ts'
import { useSlashToFocus } from './useSlashToFocus.ts'

interface StoreTableProps {
  store: Store
  country: Country
}

export function StoreTable({ store, country }: StoreTableProps) {
  const headingId = `store-${store.id}`
  const [query, setQuery] = useState('')
  // Which column the rows are sorted by, none for the order they came in. Each store's table starts unsorted, since
  // StoresView gives every store its own table.
  const [sort, setSort] = useState<SortState | null>(null)
  const onSort = (column: SortColumn) => setSort((current) => nextSort(current, column))
  const searchRef = useRef<HTMLInputElement>(null)
  useSlashToFocus(searchRef)
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
    return { item, name, itemName, amounts, unitPrice, receiptName }
  })
  const sortedRows = sortRows(rows, sort)
  // A store whose items never have a unit price (e.g. furniture, one-off goods) gets no column of blank cells
  const showUnitPrice = rows.some((row) => row.unitPrice !== null)
  // Most stores never sell anything dosed by capsule, so the column only shows up where it's actually used
  const showDose = rows.some((row) => row.item.dose_mg !== null)
  // Only a store with an item another store also sells has anything to put in the Other stores column
  const showOtherStores = rows.some((row) => row.item.is_cheapest || row.item.cheaper_at !== null)

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head store-head-search">
        <div>
          <h2 id={headingId} className="store-name">{store.name}</h2>
          {store.discount_text && <p className="discount">{store.discount_text}</p>}
        </div>
        <input
          ref={searchRef}
          type="search"
          className="store-search"
          aria-keyshortcuts="/"
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
            <SortableHeader column="name" label="Item name" className="item" sort={sort} onSort={onSort} />
            <th scope="col" className="amount">Amount</th>
            {showUnitPrice && (
              <SortableHeader column="unit-price" label="Unit price" className="unit-price" sort={sort} onSort={onSort} />
            )}
            {showDose && <th scope="col" className="dose">Capsule</th>}
            <SortableHeader column="price" label="Price" className="price" sort={sort} onSort={onSort} />
            {showOtherStores && <th scope="col" className="other-stores">Other stores</th>}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ item, name, amounts, unitPrice, receiptName }, index) => (
            <tr key={item.id}>
              <td className="row-number">{index + 1}</td>
              <td className="item-code">{item.item_code}</td>
              <td className="brand">{item.brand}</td>
              <td className="item">
                <ItemName segments={name} />
                {item.brand && <div className="item-brand">{item.brand}</div>}
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
              {showOtherStores && (
                <td className="other-stores">
                  {item.is_cheapest && <span className="price-chip">Cheapest</span>}
                  {item.cheaper_at && (
                    <span className="price-chip">
                      Cheaper at {item.cheaper_at.store} (-{item.cheaper_at.percent}%)
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
