import type { Item } from './types.ts'

interface OtherStoresCellProps {
  item: Pick<Item, 'is_cheapest' | 'cheaper_at'>
}

// The Other stores cell of a store table: says this store is the cheapest one for the item, or which other store sells
// it for less. Empty for an item no other store sells.
export function OtherStoresCell({ item }: OtherStoresCellProps) {
  return (
    <td className="other-stores">
      {item.is_cheapest && 'Cheapest'}
      {item.cheaper_at && `Cheaper at ${item.cheaper_at.store} (-${item.cheaper_at.percent}%)`}
    </td>
  )
}
