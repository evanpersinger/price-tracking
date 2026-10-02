import type { SizeUnit } from './ReceiptReview.tsx'

// Items where there is only one product it can be, so the review page fills in the size instead of asking for it.
// Hand-maintained, add a line whenever one comes up.
export interface KnownItem {
  printedAs: string // how the name prints on the receipt, without the item number
  matches?: 'contains' // any line with printedAs in it, left out means the whole name has to match
  name: string
  brand?: string
  count: number
  unit: SizeUnit // 'none' when the count is the whole size
  size?: number // in the unit above, left out for 'none'
}

// Grouped by store. A group applies when the receipt's store name contains the group's name, ignoring case, so
// "Costco Wholesale - North London" uses the Costco group.
export const KNOWN_ITEMS: Record<string, KnownItem[]> = {
  Costco: [
    { printedAs: 'KS BATH', name: 'Bath Tissue', brand: 'Kirkland', count: 30, unit: 'none' },
    { printedAs: 'CHKN STRIPS', name: 'Chicken Strips', brand: 'Sunrise Farms', count: 1, unit: 'g', size: 1200 }, // 1.2 kg
    // Every Costco cookie box has 24
    { printedAs: 'COOKI', matches: 'contains', name: 'Cookies', count: 24, unit: 'none' },
  ],
}

// Case, spacing, the asterisks the model sometimes wraps a name in, and Costco's item number in front of the name
// ("6262016 **KS BATH**") don't matter.
function normalize(text: string): string {
  return text.toLowerCase().replace(/\*/g, '').replace(/^\s*\d+\s+/, '').replace(/\s+/g, ' ').trim()
}

export function findKnownItem(store: string, printedName: string): KnownItem | undefined {
  const storeName = store.toLowerCase()
  const items = Object.entries(KNOWN_ITEMS).find(([name]) => storeName.includes(name.toLowerCase()))?.[1]
  const printed = normalize(printedName)
  // A whole-name entry wins over a contains one, so a specific item can override the general rule
  return (
    items?.find((item) => item.matches !== 'contains' && normalize(item.printedAs) === printed) ??
    items?.find((item) => item.matches === 'contains' && printed.includes(normalize(item.printedAs)))
  )
}
