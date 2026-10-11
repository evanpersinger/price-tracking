import { formatPrice, formatUnitPrice, isZeroMoney, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { CheapestStore, Country } from './types.ts'

interface CheapestTableProps {
  store: CheapestStore
  country: Country
}

// One store's cheapest items. The store's name and the search box above it belong to CheapestView, which keeps them in
// place while the search swaps this table for the results.
export function CheapestTable({ store, country }: CheapestTableProps) {
  // Most stores never sell anything dosed by capsule, so the column only shows up where it's actually used
  const showDose = store.items.some((item) => item.dose_mg !== null)

  return (
    <table className="items">
      <thead>
        <tr>
          <th scope="col" className="row-number">#</th>
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
        {store.items.map((item, index) => {
          const { name, amounts, unitPrice } = itemParts(item, store.name)
          const computedUnitPrice = formatUnitPrice(item, country)
          return (
            <tr key={item.id}>
              <td className="row-number">{index + 1}</td>
              <td className="item-code">{item.item_code}</td>
              <td className="brand">{item.brand}</td>
              <td className="item">
                <ItemName segments={name} />
              </td>
              <td className="amount">{amounts.join(' · ')}</td>
              <td className={isZeroMoney(computedUnitPrice) ? 'unit-price zero-money' : 'unit-price'}>
                {computedUnitPrice}
                {unitPrice && <span className={isZeroMoney(unitPrice) ? 'zero-money' : undefined}> ({unitPrice})</span>}
              </td>
              {showDose && <td className="dose">{item.dose_mg !== null && `${item.dose_mg}mg`}</td>}
              <td className="price">{formatPrice(item.price_cents, country)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
