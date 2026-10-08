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

// The same item bought at one store or several: same name, and for gas the same fuel type
interface TrackedItem {
  key: string
  entries: HistoryEntry[] // newest first
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

// The items that have a price history, one row each, and the dotted graph and purchases of the one picked
export function PriceTrackingView({ country }: PriceTrackingViewProps) {
  const state = useLoad<HistoryEntry[]>(`/api/history?country=${country}`)
  const [query, setQuery] = useState('')
  const [pickedKey, setPickedKey] = useState<string | null>(null)

  return (
    <Loaded state={state}>
      {(entries) => {
        if (entries.length === 0) {
          return (
            <p className="status">
              No price tracking yet. A purchase is recorded each time an item with a date is added from a receipt.
            </p>
          )
        }

        // The entries arrive newest first, so each item's list and the order of the items both stay newest first
        const byKey = new Map<string, TrackedItem>()
        for (const entry of entries) {
          const key = keyOf(entry)
          const tracked = byKey.get(key)
          if (tracked) tracked.entries.push(entry)
          else byKey.set(key, { key, entries: [entry] })
        }
        const items = [...byKey.values()]
        const picked = pickedKey === null ? undefined : byKey.get(pickedKey)

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
                  </h2>
                </div>
                <PriceDots
                  entries={picked.entries}
                  value={isFuel ? litrePrice : (entry) => entry.price_cents}
                  format={isFuel ? (value) => formatPerLitre(value, country) : (value) => formatPrice(Math.round(value), country)}
                />
                <table className="items">
                  <thead>
                    <tr>
                      <th scope="col" className="date">Date</th>
                      <th scope="col" className="store-column">Store</th>
                      <th scope="col" className="amount">Amount</th>
                      <th scope="col" className="price">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picked.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="date">{entry.purchased_on}</td>
                        <td className="store-column">{entry.store_name}</td>
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
        const shown = items.filter((tracked) => terms.every((term) => tracked.key.includes(term)))
        return (
          <>
            <input
              type="search"
              className="search-box"
              aria-label="Search for an item name"
              placeholder="Search for an item name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="store-viewport">
              <section className="store" aria-labelledby="price-tracking-heading">
                <div className="store-head">
                  <h2 id="price-tracking-heading" className="store-name">Price Tracking</h2>
                </div>
                <p className="dot-hint">Click an item to see its prices over time.</p>
                {shown.length === 0 ? (
                  <p className="status">No item matches "{query.trim()}".</p>
                ) : (
                  <table className="items">
                    <thead>
                      <tr>
                        <th scope="col" className="row-number">#</th>
                        <th scope="col" className="item">Item name</th>
                        <th scope="col" className="amount">Amount</th>
                        <th scope="col" className="store-column">Last bought at</th>
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
                            <td className="item">
                              <button type="button" className="item-button" onClick={() => setPickedKey(tracked.key)}>
                                <ItemName segments={name} />
                                {newest.fuel_type && ` (${newest.fuel_type})`}
                              </button>
                              {receiptName && <div className="item-receipt-name">{receiptName}</div>}
                            </td>
                            <td className="amount">{amountOf(newest)}</td>
                            <td className="store-column">{newest.store_name}</td>
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
