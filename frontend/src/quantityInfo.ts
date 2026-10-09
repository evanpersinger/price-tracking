const LITRES = /(\d+(?:\.\d+)?)\s*(?:L|litres?|liters?)\b/i
const WEIGHT = /^\s*(\d+(?:\.\d+)?)\s*(kg|g|lbs?|oz)\b\s*@\s*\$?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d*\s*[a-zA-Z]+))?/i
const BOUGHT = /^\s*(\d+)\s*@\s*\$?(\d+(?:\.\d+)?)/

const GRAMS = { kg: 1000, g: 1, lb: 453.592, lbs: 453.592, oz: 28.3495 }

// The litres in a receipt's quantity line, like "26.204" from "26.204 L @ 1.749/L" on a fuel receipt, or undefined when
// the line isn't a litre amount. Only the first number counts, so the "/L" in the price per litre is never mistaken
// for the size.
export function litresIn(quantityInfo: string | null | undefined): string | undefined {
  return quantityInfo ? LITRES.exec(quantityInfo)?.[1] : undefined
}

export interface QuantityFill {
  count: string // empty unless the line says; how many items are in one pack, never how many packs were bought
  size: string // empty when the line doesn't say how big it is
  unit: 'g' | 'L' | '' // empty when the line doesn't say, so the person picks it
  bought?: { times: number; unitPrice: number } // "3 @ 2.79": 3 of the item were bought at 2.79 each
  ratePerUnit?: { amount: number; unit: string } // "350 g @ $1.20/100g": 1.20 "100g", exactly as the receipt denominates it
}

// What the line printed under an item already tells us, so it doesn't have to be typed. "1.2 kg @ $4.99/kg" is one item
// of 1200g (lb and oz are turned into grams), keeping the 4.99/kg rate too since a by-weight item (no fixed size) is
// priced by it, not by this one purchase's weight. A litre line is one item of that many litres. "3 @ 2.79" is not a
// count: it says how many of the item were bought, and each one is a pack, so it only gives the price of one (the count
// of items in a pack is still the person's to give). Anything else, like a deal "2 for $1.25", fills nothing.
export function readQuantity(quantityInfo: string | null | undefined): QuantityFill | undefined {
  if (!quantityInfo) return undefined

  const litres = litresIn(quantityInfo)
  if (litres !== undefined) return { count: '1', size: litres, unit: 'L' }

  const weight = WEIGHT.exec(quantityInfo)
  if (weight) {
    const grams = Math.round(Number(weight[1]) * GRAMS[weight[2].toLowerCase() as keyof typeof GRAMS])
    // The rate's own denominator ("/100g") is kept as printed, not assumed to match the purchase's unit (group 2):
    // "350 g @ $1.20/100g" is priced per 100g, not per single gram, a 100x difference. Falls back to group 2 only
    // when the line gives no denominator at all.
    const rateUnit = (weight[4] ?? weight[2]).replace(/\s+/g, '').toLowerCase()
    const ratePerUnit = { amount: Number(weight[3]), unit: rateUnit }
    return { count: '1', size: String(grams), unit: 'g', ratePerUnit }
  }

  const bought = BOUGHT.exec(quantityInfo)
  if (bought) return { count: '', size: '', unit: '', bought: { times: Number(bought[1]), unitPrice: Number(bought[2]) } }

  return undefined
}

// The price to put on the row: the price of one item when the receipt line is "N @ price" and N of them add up to the
// line's total (to the cent, give or take 5 cents), otherwise the line's price as printed, since a total that doesn't
// add up (a discount, a misread) isn't ours to divide.
export function priceOfOne(total: number | null, fill: QuantityFill | undefined): number | null {
  const bought = fill?.bought
  if (total === null || !bought || bought.times < 1) return total
  return Math.abs(bought.times * bought.unitPrice - total) < 0.05 ? bought.unitPrice : total
}
