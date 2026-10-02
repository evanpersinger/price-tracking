import { formatPrice, formatUnitPrice, isZeroMoney, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { CheapestStore, Country } from './types.ts'

interface CheapestTableProps {
  store: CheapestStore
  country: Country
}

export function CheapestTable({ store, country }: CheapestTableProps) {
  const headingId = `cheapest-${store.id}`

  return (
    <section className="store" aria-labelledby={headingId}>
      <div className="store-head">
        <h3 id={headingId} className="store-name">{store.name}</h3>
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
            const { name, amounts, unitPrice } = itemParts(item)
            const computedUnitPrice = formatUnitPrice(item, country)
            return (
              <tr key={item.id}>
                <td className="row-number">{index + 1}</td>
                <td className="brand">{item.brand}</td>
                <td className="item-code">{item.item_code}</td>
                <td className="item">
                  <ItemName segments={name} />
                </td>
                <td className="amount">{amounts.join(' · ')}</td>
                <td className={isZeroMoney(computedUnitPrice) ? 'unit-price zero-money' : 'unit-price'}>
                  {computedUnitPrice}
                  {unitPrice && <span className={isZeroMoney(unitPrice) ? 'zero-money' : undefined}> ({unitPrice})</span>}
                </td>
                <td className="price">{formatPrice(item.price_cents, country)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
