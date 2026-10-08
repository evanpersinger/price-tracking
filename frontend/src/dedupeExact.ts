import type { ReceiptItem } from './types.ts'

// A receipt sometimes rings up the same product on two separate lines instead of one quantity line, which reads
// as the same item bought twice. That's a real, common case (see Row and toRow in ReceiptReview.tsx, which already
// handle a genuine "3 @ 2.79" quantity line), so only a line that matches another one in every field is dropped
// here; a price, weight or quantity that actually differs means it really was a separate purchase.
export function dedupeExact(items: ReceiptItem[]): ReceiptItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = JSON.stringify([
      item.raw_name, item.item_name, item.price, item.category, item.quantity_info ?? null, item.fuel_type ?? null,
    ])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
