// The litres in a receipt's quantity line, like "26.204" from "26.204 L @ 1.749/L" on a fuel receipt, or undefined when
// the line isn't a litre amount. Only the first number counts, so the "/L" in the price per litre is never mistaken
// for the size.
export function litresIn(quantityInfo: string | null | undefined): string | undefined {
  return quantityInfo ? /(\d+(?:\.\d+)?)\s*(?:L|litres?|liters?)\b/i.exec(quantityInfo)?.[1] : undefined
}
