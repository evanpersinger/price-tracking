import { formatPrice, itemParts } from './format.ts'
import { ItemName } from './ItemName.tsx'
import type { CheapestByWeightItem, Country } from './types.ts'

interface CheapestByWeightTableProps {
  storeName: string
  items: CheapestByWeightItem[]
  country: Country
  startIndex: number // how many rows the table above used, so the numbering keeps counting from there
}

// The produce and bulk-bin items a store sells cheapest, compared on what a kg costs, in the same plain columns as
// Store Prices' "Priced by weight" table.
export function CheapestByWeightTable({ storeName, items, country, startIndex }: CheapestByWeightTableProps) {
  return (
    <>
      <h3 className="review-subheading">Priced by weight</h3>
      <table className="items items-fit">
        <thead>
          <tr>
            <th scope="col" className="row-number">#</th>
            <th scope="col" className="item-code">Item code</th>
            <th scope="col" className="item">Item name</th>
            <th scope="col" className="price">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const { name } = itemParts({ ...item, item_count: null, weight_g: null, volume_ml: null }, storeName)
            return (
              <tr key={item.id}>
                <td className="row-number">{startIndex + index + 1}</td>
                <td className="item-code">{item.item_code}</td>
                <td className="item">
                  <ItemName segments={name} />
                </td>
                <td className="price">{formatPrice(Math.round(item.price_per_kg_cents), country)} per kg</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
