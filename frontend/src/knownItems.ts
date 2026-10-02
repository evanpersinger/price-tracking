import type { SizeUnit } from './ReceiptReview.tsx'

// Items where there is only one product it can be, so the review page fills in the size instead of asking for it.
// Hand-maintained, add a line whenever one comes up.
export interface KnownItem {
  printedAs: string // exactly how it prints on the receipt, matched ignoring case and extra spaces
  name: string
  brand?: string
  count: number
  unit: SizeUnit // 'none' when the count is the whole size
  size?: number // in the unit above, left out for 'none'
}

export const KNOWN_ITEMS: KnownItem[] = [
  { printedAs: 'KS BATH', name: 'Bath Tissue', brand: 'Kirkland Signature', count: 30, unit: 'none' },
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function findKnownItem(printedName: string): KnownItem | undefined {
  const printed = normalize(printedName)
  return KNOWN_ITEMS.find((item) => normalize(item.printedAs) === printed)
}
