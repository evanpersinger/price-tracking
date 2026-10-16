// Stores print a product code on each receipt line: Costco and Real Canadian Superstore put it in front of the name
// ("6262016 KS BATH"), Dollarama puts a barcode after it ("CHOCOLATE 190104059728"). Costco's own codes vary in
// length (Kirkland Baking Soda is only 4 digits), so a run of 4 or more digits is taken as the code. The price is
// never part of this text (it's a separate field), so the only real risk is a short number that's actually part of
// the name (like "7UP" or "2% Milk"), which stays under 4 digits. A size written with a unit ("1750ML", "2000 G") is
// not a code either, so a run of digits followed by a unit is skipped.
const CODE = /\d{4,}(?!\d)(?!\s*(?:ml|l|g|kg|lbs?|oz)\b)/i

// Healthy Planet labels its code on a line above the name ("Item No.: FRU026"), and its codes mix in letters
// ("A0087814"), so the digit run above would miss the first and cut the letter off the second. Checked first, since
// the label says outright that what follows is the code.
const LABELLED_CODE = /Item No\b\.?:?\s*(\S+)/i

export interface PrintedItem {
  code: string | undefined
  name: string // the line without the code, and without the asterisks the model sometimes wraps names in
}

export function splitItemCode(printedName: string): PrintedItem {
  const text = printedName.replace(/\*/g, '')
  const match = LABELLED_CODE.exec(text) ?? CODE.exec(text)
  const withoutCode = match ? `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` : text
  return { code: match?.[1] ?? match?.[0], name: withoutCode.replace(/\s+/g, ' ').trim() }
}
