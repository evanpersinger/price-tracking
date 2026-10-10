import { useState } from 'react'
import { formatPrice, itemParts } from './format.ts'
import { formatLitres, formatPerLitre } from './fuel.ts'
import { ItemName } from './ItemName.tsx'
import { Loaded } from './Loaded.tsx'
import { PriceDots } from './PriceDots.tsx'
import type { Country, HistoryEntry } from './types.ts'
import { useLoad } from './useLoad.ts'

interface PriceTrackingViewProps {
  country: Country
}

// The same item bought at one store: same name, and for gas the same fuel type
interface TrackedItem {
  key: string
  entries: HistoryEntry[] // newest first
}

interface TrackedStore {
  id: number
  name: string
  items: TrackedItem[] // the one bought most recently first
}

function keyOf(entry: HistoryEntry): string {
  const name = entry.item_name.toLowerCase()
  return entry.fuel_type ? `${name} (${entry.fuel_type.toLowerCase()})` : name
}

function partsOf(entry: HistoryEntry) {
  return itemParts({
    name: entry.item_name,
    item_count: entry.item_count,
    weight_g: entry.weight_g,
    volume_ml: entry.volume_ml,
    brand: entry.brand,
  }, entry.store_name)
}

function amountOf(entry: HistoryEntry): string {
  return entry.fuel_type && entry.volume_ml ? formatLitres(entry.volume_ml) : partsOf(entry).amounts.join(' · ')
}

// Gas is tracked by what a litre cost, since the total depends on how much was bought
function litrePrice(entry: HistoryEntry): number | null {
  return entry.volume_ml ? entry.price_cents / (entry.volume_ml / 1000) : null
}

// The entries arrive newest first, so each item's purchases and the order of a store's items both stay newest first
function groupByStore(entries: HistoryEntry[]): TrackedStore[] {
  const stores = new Map<number, TrackedStore>()
  for (const entry of entries) {
    let store = stores.get(entry.store_id)
    if (!store) {
      store = { id: entry.store_id, name: entry.store_name, items: [] }
      stores.set(entry.store_id, store)
    }
    const key = keyOf(entry)
    const tracked = store.items.find((item) => item.key === key)
    if (tracked) tracked.entries.push(entry)
    else store.items.push({ key, entries: [entry] })
  }
  return [...stores.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// The stores that have tracked items, one at a time, each with its items, and the dotted graph and purchases of the
// one picked
export function PriceTrackingView({ country }: PriceTrackingViewProps) {
  const state = useLoad<HistoryEntry[]>(`/api/history?country=${country}`)
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [pickedKey, setPickedKey] = useState<string | null>(null)

  return (
    <Loaded state={state}>
      {(entries) => {
        if (entries.length === 0) {
          return (
            <p className="status">
              No price tracking yet. A purchase is recorded each time an item with an item code and a date is added
              from a receipt (gas needs no code).
            </p>
          )
        }

        const stores = groupByStore(entries)
        const activeIndexInRange = Math.min(activeIndex, stores.length - 1)
        const store = stores[activeIndexInRange]
        const picked = store.items.find((item) => item.key === pickedKey)

        if (picked) {
          const newest = picked.entries[0]
          const { name } = partsOf(newest)
          const isFuel = newest.fuel_type !== null
          return (
            <div className="store-viewport">
              <section className="store" aria-labelledby="price-tracking-heading">
                <div className="store-head">
                  <button type="button" className="back-button" onClick={() => setPickedKey(null)}>
                    Back to all items
                  </button>
                  <h2 id="price-tracking-heading" className="store-name">
                    <ItemName segments={name} />
                    {isFuel && ` (${newest.fuel_type})`}
                    {` at ${store.name}`}
                  </h2>
                </div>
                <PriceDots
                  entries={picked.entries}
                  value={isFuel ? litrePrice : (entry) => entry.price_cents}
                  format={isFuel ? (value) => formatPerLitre(value, country) : (value) => formatPrice(Math.round(value), country)}
                  priceLabel={isFuel ? 'Price per litre' : 'Price'}
                />
                <table className="items">
                  <thead>
                    <tr>
                      <th scope="col" className="date">Date</th>
                      <th scope="col" className="item-code">Item code</th>
                      <th scope="col" className="amount">Amount</th>
                      <th scope="col" className="price">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picked.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="date">{entry.purchased_on}</td>
                        <td className="item-code">{entry.item_code}</td>
                        <td className="amount">{amountOf(entry)}</td>
                        <td className="price">{formatPrice(entry.price_cents, country)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )
        }

        const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
        const shown = store.items.filter((tracked) => terms.every((term) => tracked.key.includes(term)))
        return (
          <>
            <input
              type="search"
              className="search-box"
              aria-label={`Search ${store.name} for an item name`}
              placeholder="Search for an item name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="store-jump">
              {stores.map((tracked, index) => (
                <button
                  key={tracked.id}
                  type="button"
                  className="nav-link"
                  aria-current={index === activeIndexInRange ? 'true' : undefined}
                  onClick={() => {
                    setActiveIndex(index)
                    setQuery('')
                  }}
                >
                  {tracked.name}
                </button>
              ))}
            </div>
            <div className="store-viewport">
              <section className="store" aria-labelledby="price-tracking-heading">
                <div className="store-head">
                  <h2 id="price-tracking-heading" className="store-name">{store.name}</h2>
                </div>
                <p className="dot-hint">Click an item to see its prices over time.</p>
                {shown.length === 0 ? (
                  <p className="status">No item in {store.name} matches "{query.trim()}".</p>
                ) : (
                  <table className="items">
                    <thead>
                      <tr>
                        <th scope="col" className="row-number">#</th>
                        <th scope="col" className="item-code">Item code</th>
                        <th scope="col" className="item">Item name</th>
                        <th scope="col" className="amount">Amount</th>
                        <th scope="col" className="date">Last bought</th>
                        <th scope="col" className="amount">Times bought</th>
                        <th scope="col" className="price">Last price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((tracked, index) => {
                        const newest = tracked.entries[0]
                        const { name, receiptName } = partsOf(newest)
                        return (
                          <tr key={tracked.key}>
                            <td className="row-number">{index + 1}</td>
                            <td className="item-code">{newest.item_code}</td>
                            <td className="item">
                              <button type="button" className="item-button" onClick={() => setPickedKey(tracked.key)}>
                                <ItemName segments={name} />
                                {newest.fuel_type && ` (${newest.fuel_type})`}
                              </button>
                              {receiptName && <div className="item-receipt-name">{receiptName}</div>}
                            </td>
                            <td className="amount">{amountOf(newest)}</td>
                            <td className="date">{newest.purchased_on}</td>
                            <td className="amount">{tracked.entries.length}</td>
                            <td className="price">{formatPrice(newest.price_cents, country)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </>
        )
      }}
    </Loaded>
  )
}
