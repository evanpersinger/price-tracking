// A number glued to a unit, like the "2L" in "LCTS FREE SKM 2L RQ". At most 4 digits and no space before the unit, so a
// product code or a stray "L" or "G" word never counts as a size.
const SIZE = /(?<![\d.])(\d{1,4}(?:\.\d+)?)(kg|ml|l|g)(?![a-z0-9])/gi
// A pack or a count in the name ("12X355ML", "6PK 355ML") means the size is of one item and not of the whole pack, which
// is what the Size box wants, so nothing is guessed.
const PACK = /\d\s*x\s*\d|\d\s*x\b|\bx\s*\d|\b\d+\s*(?:pk|pack|ct|count)\b/i
const UNITS = { l: 'L', ml: 'ml', g: 'g', kg: 'kg' } as const

export interface NamedSize {
  size: string
  unit: 'g' | 'kg' | 'ml' | 'L'
}

// The size a receipt prints in an item's own name, so "LCTS FREE SKM 2L RQ" fills 2 L in without being typed. Undefined
// when the name has no size, has more than one, or has a pack count next to it.
export function sizeInName(printedName: string): NamedSize | undefined {
  if (PACK.test(printedName)) return undefined
  const sizes = [...printedName.matchAll(SIZE)]
  if (sizes.length !== 1) return undefined
  const [, amount, unit] = sizes[0]
  if (Number(amount) <= 0) return undefined
  return { size: amount, unit: UNITS[unit.toLowerCase() as keyof typeof UNITS] }
}
