import { splitItemCode } from './itemCode.ts'
import type { SizeUnit } from './ReceiptReview.tsx'

// Items where there is only one product it can be, so the review page fills in the size instead of asking for it.
// Hand-maintained, add a line whenever one comes up.
export interface KnownItem {
  itemNumber?: string // the product code the store prints on the line, the most reliable way to match
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
    { itemNumber: '6262016', printedAs: 'KS BATH', name: 'Bath Tissue', brand: 'Kirkland', count: 30, unit: 'none' },
    {
      itemNumber: '7175722',
      printedAs: 'CHKN STRIPS',
      name: 'Chicken Strips',
      brand: 'Sunrise Farms',
      count: 1,
      unit: 'g',
      size: 1200, // 1.2 kg
    },
    // Checked before the generic COOKI rule below, since "GINGER COOKI" also contains "COOKI"
    { printedAs: 'GINGER COOKI', matches: 'contains', name: 'Ginger Cookies', brand: 'Kirkland', count: 24, unit: 'none' },
    // Every Costco cookie box has 24, Kirkland brand
    { printedAs: 'COOKI', matches: 'contains', name: 'Cookies', brand: 'Kirkland', count: 24, unit: 'none' },
  ],
}

// Case, spacing, asterisks and the item code don't matter.
function normalize(text: string): string {
  return splitItemCode(text).name.toLowerCase()
}

// Tried in this order, the first hit wins: the item code, then the whole printed name, then a contains rule. So a
// specific item can override the general rule.
export function findKnownItem(store: string, printedName: string): KnownItem | undefined {
  const storeName = store.toLowerCase()
  const items = Object.entries(KNOWN_ITEMS).find(([name]) => storeName.includes(name.toLowerCase()))?.[1]
  if (!items) return undefined

  const { code } = splitItemCode(printedName)
  const printed = normalize(printedName)
  return (
    (code === undefined ? undefined : items.find((item) => item.itemNumber === code)) ??
    items.find((item) => item.matches !== 'contains' && normalize(item.printedAs) === printed) ??
    items.find((item) => item.matches === 'contains' && printed.includes(normalize(item.printedAs)))
  )
}

// Costco prints "KS" as its own word at the front of its Kirkland Signature items ("KS BATH", "KS FR EGGS"), not
// just letters inside a longer word ("MASKS"), so a specific known item isn't needed for the brand to be known.
export function isKirklandSignature(store: string, printedName: string): boolean {
  if (!store.toLowerCase().includes('costco')) return false
  return normalize(printedName)
    .split(/\s+/)
    .some((word) => word === 'ks')
}
