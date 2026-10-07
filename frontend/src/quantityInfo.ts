const LITRES = /(\d+(?:\.\d+)?)\s*(?:L|litres?|liters?)\b/i
const WEIGHT = /^\s*(\d+(?:\.\d+)?)\s*(kg|g|lbs?|oz)\b\s*@/i
const COUNT = /^\s*(\d+)\s*@/

const GRAMS = { kg: 1000, g: 1, lb: 453.592, lbs: 453.592, oz: 28.3495 }

// The litres in a receipt's quantity line, like "26.204" from "26.204 L @ 1.749/L" on a fuel receipt, or undefined when
// the line isn't a litre amount. Only the first number counts, so the "/L" in the price per litre is never mistaken
// for the size.
export function litresIn(quantityInfo: string | null | undefined): string | undefined {
  return quantityInfo ? LITRES.exec(quantityInfo)?.[1] : undefined
}

export interface QuantityFill {
  count: string
  size: string // empty when the line doesn't say how big it is
  unit: 'g' | 'L' | '' // empty when the line doesn't say, so the person picks it
}

// What the line printed under an item already tells us, so it doesn't have to be typed: "3 @ 2.79" is a count of 3,
// "1.2 kg @ $4.99/kg" is one item of 1200g (lb and oz are turned into grams), and a litre line is one item of that many
// litres. Anything else, like a deal "2 for $1.25", fills nothing.
export function readQuantity(quantityInfo: string | null | undefined): QuantityFill | undefined {
  if (!quantityInfo) return undefined

  const litres = litresIn(quantityInfo)
  if (litres !== undefined) return { count: '1', size: litres, unit: 'L' }

  const weight = WEIGHT.exec(quantityInfo)
  if (weight) {
    const grams = Math.round(Number(weight[1]) * GRAMS[weight[2].toLowerCase() as keyof typeof GRAMS])
    return { count: '1', size: String(grams), unit: 'g' }
  }

  const count = COUNT.exec(quantityInfo)
  if (count) return { count: count[1], size: '', unit: '' }

  return undefined
}
