// Stores print a product code on each receipt line: Costco and Real Canadian Superstore put it in front of the name
// ("6262016 KS BATH"), Dollarama puts a barcode after it ("CHOCOLATE 190104059728"). Costco's own codes vary in
// length (Kirkland Baking Soda is only 4 digits), so a run of 4 or more digits is taken as the code. The price is
// never part of this text (it's a separate field), so the only real risk is a short number that's actually part of
// the name (like "7UP" or "2% Milk"), which stays under 4 digits.
const CODE = /\d{4,}/

export interface PrintedItem {
  code: string | undefined
  name: string // the line without the code, and without the asterisks the model sometimes wraps names in
}

export function splitItemCode(printedName: string): PrintedItem {
  const text = printedName.replace(/\*/g, '')
  const match = CODE.exec(text)
  const withoutCode = match ? `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` : text
  return { code: match?.[0], name: withoutCode.replace(/\s+/g, ' ').trim() }
}
