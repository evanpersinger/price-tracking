import { useEffect, useState } from 'react'
import { formatPrice, formatUnitPrice, isZeroMoney, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import { Loaded } from './Loaded.tsx'
import type { Country, SearchList } from './types.ts'
import { useLoad } from './useLoad.ts'

const TYPING_PAUSE_MS = 250

// Each list is ranked on one unit, a per item price can't be put against a per gram one
const LIST_HEADINGS = { each: 'Compared per item', g: 'Compared per 100g', ml: 'Compared per 100ml' }

interface SearchResultsProps {
  country: Country
  query: string
}

// What every store sells the searched item for, cheapest first
export function SearchResults({ country, query }: SearchResultsProps) {
  // Wait for a pause in typing, so each keystroke isn't its own request
  const [settledQuery, setSettledQuery] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(query), TYPING_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const state = useLoad<SearchList[]>(`/api/search?country=${country}&q=${encodeURIComponent(settledQuery)}`)

  return (
    <Loaded state={state}>
      {(lists) =>
        lists.length === 0 ? (
          <p className="status">No item matches "{settledQuery}".</p>
        ) : (
          <div className="search-results">
            {lists.map((list) => {
              // Most stores never sell anything dosed by capsule, so the column only shows up where it's actually used
              const showDose = list.offers.some((offer) => offer.dose_mg !== null)
              return (
                <section key={list.unit} className="store" aria-labelledby={`search-${list.unit}`}>
                  <div className="store-head">
                    <h3 id={`search-${list.unit}`} className="store-name">{LIST_HEADINGS[list.unit]}</h3>
                  </div>
                  <table className="items">
                    <thead>
                      <tr>
                        <th scope="col" className="row-number">#</th>
                        <th scope="col" className="store-column">Store</th>
                        <th scope="col" className="item-code">Item code</th>
                        <th scope="col" className="brand">Brand</th>
                        <th scope="col" className="item">Item name</th>
                        <th scope="col" className="amount">Amount</th>
                        <th scope="col" className="unit-price">Unit price</th>
                        {showDose && <th scope="col" className="dose">Capsule</th>}
                        <th scope="col" className="price">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.offers.map((offer, index) => {
                        const { name, amounts, unitPrice, receiptName } = itemParts(offer, offer.store_name)
                        const computedUnitPrice = formatUnitPrice({ unit: list.unit, unit_price_cents: offer.unit_price_cents }, country)
                        return (
                          <tr key={offer.id}>
                            <td className="row-number">{index + 1}</td>
                            <td className="store-column">{offer.store_name}</td>
                            <td className="item-code">{offer.item_code}</td>
                            <td className="brand">{offer.brand}</td>
                            <td className="item">
                              <ItemName segments={name} />
                              {receiptName && <div className="item-receipt-name">{receiptName}</div>}
                            </td>
                            <td className="amount">{amounts.join(' · ')}</td>
                            <td className={isZeroMoney(computedUnitPrice) ? 'unit-price zero-money' : 'unit-price'}>
                              {computedUnitPrice}
                              {unitPrice && <span className={isZeroMoney(unitPrice) ? 'zero-money' : undefined}> ({unitPrice})</span>}
                            </td>
                            {showDose && <td className="dose">{offer.dose_mg !== null && `${offer.dose_mg}mg`}</td>}
                            <td className="price">{formatPrice(offer.price_cents, country)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>
              )
            })}
          </div>
        )
      }
    </Loaded>
  )
}
