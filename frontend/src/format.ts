import type { CheapestItem, Country } from './types.ts'

const FORMATTERS: Record<Country, Intl.NumberFormat> = {
  CA: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }),
  US: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
}

export function formatPrice(cents: number, country: Country): string {
  return FORMATTERS[country].format(cents / 100)
}

// Grams and millilitres are shown per 100, the way shelf tags do it. The API sends cents per single g or ml, which
// as dollars is the same number per 100.
export function formatUnitPrice(item: CheapestItem, country: Country): string {
  const formatter = FORMATTERS[country]
  switch (item.unit) {
    case 'each':
      return `${formatter.format(item.unit_price_cents / 100)} each`
    case 'g':
      return `${formatter.format(item.unit_price_cents)} per 100g`
    case 'ml':
      return `${formatter.format(item.unit_price_cents)} per 100ml`
  }
}

export function compareNote(otherStores: number): string {
  return otherStores === 0 ? 'Only found here' : `Cheapest of ${otherStores + 1} stores`
}

export type SegmentKind = 'name' | 'amount' | 'unit-price'

export interface Segment {
  text: string
  kind: SegmentKind
  start: number // where the segment begins in the label, which makes a stable key
}

const BRACKET = /\([^()]*\)/g

// A bracket with a $ is the typed unit price, one with a number is an amount like (8x) or (500g), anything else is
// part of the name, like (SS)
function bracketKind(bracket: string): SegmentKind {
  if (bracket.includes('$')) return 'unit-price'
  if (/\d/.test(bracket)) return 'amount'
  return 'name'
}

// Splits a label into pieces so the name, the amounts and the typed unit price can each get their own color
export function labelSegments(label: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  for (const match of label.matchAll(BRACKET)) {
    const kind = bracketKind(match[0])
    if (kind === 'name') continue
    if (match.index > cursor) segments.push({ text: label.slice(cursor, match.index), kind: 'name', start: cursor })
    segments.push({ text: match[0], kind, start: match.index })
    cursor = match.index + match[0].length
  }
  if (cursor < label.length) segments.push({ text: label.slice(cursor), kind: 'name', start: cursor })
  return segments
}

interface Sized {
  name: string
  item_count: number | null
  weight_g: number | null
  volume_ml: number | null
}

export interface ItemParts {
  name: Segment[] // the words, with the typed unit price kept in as its own segment
  amounts: string[] // like "8 buns" or "500g", without the brackets
}

// Container words worth naming instead of the raw unit, e.g. "1L" on a milk carton reads better as "1 carton".
const CONTAINER_WORDS = new Set([
  'carton', 'jug', 'bottle', 'box', 'bag', 'case', 'pint', 'quart', 'tub', 'pack', 'dozen', 'container', 'jar', 'can',
  'crate', 'bundle',
])

// The last word of the item's name, ignoring any bracketed text, e.g. "Villagio Hamburger Buns (SS)" gives "buns".
function headNoun(name: Segment[]): string {
  const text = name
    .filter((segment) => segment.kind === 'name')
    .map((segment) => segment.text)
    .join('')
    .replace(/\([^()]*\)/g, ' ')
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 ? words[words.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase() : ''
}

// The noun after "per" in a typed unit price, e.g. "($0.20 per bag)" gives "bag". Only plain words match, so
// "per gram" or "per 100ml" (not a countable noun) are left alone.
function perUnitNoun(name: Segment[]): string | undefined {
  for (const segment of name) {
    if (segment.kind !== 'unit-price') continue
    const match = /per\s+([a-zA-Z]+)$/i.exec(segment.text.slice(0, -1))
    if (match) return match[1].toLowerCase()
  }
  return undefined
}

function pluralize(word: string): string {
  if (/[sxz]$/i.test(word) || /(ch|sh)$/i.test(word)) return `${word}es`
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

function singularize(word: string): string {
  if (/ies$/i.test(word)) return `${word.slice(0, -3)}y`
  if (/(ses|xes|zes|ches|shes)$/i.test(word)) return word.slice(0, -2)
  if (/[^s]s$/i.test(word)) return word.slice(0, -1)
  return word
}

// The word to count by for a "Nx" amount. A typed unit price names it directly ("per bag" -> "bags"), pluralized
// and, if it's a different word than the item's own name, paired with that name ("tea" + "bags" -> "tea bags").
// Without a unit price, or when the unit price just names the item itself (buns "per bun"), the item's own name is
// used alone, since guessing a qualifying word (e.g. "hamburger" buns vs "large" eggs) can't be done reliably.
function countNoun(name: Segment[]): string {
  const productNoun = headNoun(name)
  const perNoun = perUnitNoun(name)
  if (!perNoun) return productNoun
  const perNounPlural = pluralize(perNoun)
  if (perNounPlural === productNoun || !productNoun) return perNounPlural
  return `${singularize(productNoun)} ${perNounPlural}`
}

// A count of 1 says nothing a single listed item doesn't already say, so it's dropped. Other counts read as
// "<n> <noun>" (8 buns, 24 eggs, 50 tea bags). A weight or volume keeps its raw unit (500g, 1L) unless the name
// calls out a container word, in which case that reads better ("1 carton" over "1L").
function describeAmount(amount: string, forCount: string, forMeasure: string): string | null {
  const match = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/.exec(amount)
  if (!match) return amount
  const [, numberText, unit] = match
  if (unit.toLowerCase() === 'x') {
    if (Number(numberText) === 1) return null
    return forCount ? `${numberText} ${forCount}` : amount
  }
  return CONTAINER_WORDS.has(forMeasure) ? `${numberText} ${forMeasure}` : amount
}

// Splits an item into what goes in the Item column and what goes in the Amount column. Imported items have their
// amounts written in the name, items from the add form keep them in their own fields.
export function itemParts(item: Sized): ItemParts {
  const name: Segment[] = []
  const rawAmounts: string[] = []
  for (const segment of labelSegments(item.name)) {
    if (segment.kind === 'amount') {
      rawAmounts.push(segment.text.slice(1, -1).trim())
    } else {
      name.push(segment)
    }
  }
  if (item.item_count !== null) rawAmounts.push(`${item.item_count}x`)
  if (item.weight_g !== null) rawAmounts.push(`${item.weight_g}g`)
  if (item.volume_ml !== null) rawAmounts.push(`${item.volume_ml}ml`)

  const forCount = countNoun(name)
  const forMeasure = headNoun(name)
  const amounts = rawAmounts
    .map((amount) => describeAmount(amount, forCount, forMeasure))
    .filter((amount): amount is string => amount !== null)

  return { name, amounts }
}
