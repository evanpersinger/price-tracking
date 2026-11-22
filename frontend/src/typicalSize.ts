import { splitItemCode } from './itemCode.ts'
import type { NamedSize } from './sizeInName.ts'

// A size a product usually comes in, told apart from its bigger or smaller packs by its price. Hand-maintained, add a
// line whenever one comes up. It only fills the size box in, which stays editable, and it never applies outside its
// price range.
interface TypicalSize {
  word: string // a whole word of the printed name, in capitals
  minPrice: number // in dollars, the price range the size is usual for
  maxPrice: number
  size: NamedSize
}

const TYPICAL_SIZES: TypicalSize[] = [
  // Drizzilicious snacks: around $5 to $8 is the single 113 g bag
  { word: 'DRIZZILICI', minPrice: 5, maxPrice: 8, size: { size: '113', unit: 'g' } },
]

// The size a printed name and its price usually mean, or undefined when no line fits.
export function typicalSize(printedName: string, price: number | null): NamedSize | undefined {
  if (price === null) return undefined
  const words = splitItemCode(printedName).name.toUpperCase().split(/[^A-Z0-9]+/)
  return TYPICAL_SIZES.find(
    (entry) => words.includes(entry.word) && price >= entry.minPrice && price <= entry.maxPrice,
  )?.size
}
