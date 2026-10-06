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
export function formatUnitPrice(item: Pick<CheapestItem, 'unit' | 'unit_price_cents'>, country: Country): string {
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

// A unit price that reads as $0 is never actually free, it means something lost precision along the way (typed with
// too few decimals, or rounded during a computed fill-in). Flagged in the UI rather than shown as if it were normal.
export function isZeroMoney(text: string): boolean {
  return /^\$0(\.0+)?(\s|$)/.test(text)
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
  brand?: string | null
}

// The brand is its own column when known, so its word(s) at the front of the name are just clutter there.
// Only strips an exact, case-insensitive match, since a name can spell the brand differently (a misspelling, or a
// different case) than the curated brand field does.
function stripBrandPrefix(name: string, brand: string | null | undefined): string {
  if (!brand) return name
  if (name.slice(0, brand.length).toLowerCase() !== brand.toLowerCase()) return name
  if (name[brand.length] !== ' ') return name
  return name.slice(brand.length + 1)
}

export interface ItemParts {
  name: Segment[] // just the words, the typed unit price is its own field below
  amounts: string[] // like "8 buns" or "500g", without the brackets
  unitPrice: string | null // the typed unit price, like "$0.50 per bun", without the brackets
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

// Weight and volume units, not countable nouns, so "$0 per gram" doesn't turn a head count into "3 lettuce grams".
const MEASURE_UNITS = new Set(['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'ml', 'l', 'litre', 'litres', 'liter', 'liters', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds'])

// The noun after "per" in a typed unit price, e.g. "($0.20 per bag)" gives "bag", and the last word of a longer one
// ("per tea bag") since that's the thing counted. Only plain, countable words match, so "per gram" or "per 100ml" (a
// weight or volume rate, not a countable noun) are left alone.
function perUnitNoun(name: Segment[]): string | undefined {
  for (const segment of name) {
    if (segment.kind !== 'unit-price') continue
    const match = /per\s+(?:[a-zA-Z]+\s+)*([a-zA-Z]+)$/i.exec(segment.text.slice(0, -1))
    if (match && !MEASURE_UNITS.has(match[1].toLowerCase())) return match[1].toLowerCase()
  }
  return undefined
}

// A few nouns are their own plural (a fish caught this way historically), so "4 salmon" stays "salmon", not
// "salmons".
const INVARIANT_PLURALS = new Set(['salmon', 'trout', 'fish', 'deer', 'sheep', 'moose'])

function pluralize(word: string): string {
  if (INVARIANT_PLURALS.has(word)) return word
  if (word === 'loaf') return 'loaves'
  if (/[sxz]$/i.test(word) || /(ch|sh)$/i.test(word)) return `${word}es`
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

// A few "-ie" plurals (cookie, brownie) end in "ies" the same as a "-y" plural (battery) does, but singularize to
// "-ie", not "-y". There's no telling them apart by shape alone, so the ones seen in grocery names are listed here.
const IE_PLURALS = new Set(['cookies', 'brownies', 'smoothies', 'veggies', 'movies'])

function singularize(word: string): string {
  if (IE_PLURALS.has(word)) return word.slice(0, -1)
  if (/ies$/i.test(word)) return `${word.slice(0, -3)}y`
  if (/(ses|xes|zes|ches|shes)$/i.test(word)) return word.slice(0, -2)
  if (/[^s]s$/i.test(word)) return word.slice(0, -1)
  return word
}

// Nouns worth naming more specifically than the last word of the item alone gives, since nothing in the text
// supplies the extra word: bacon isn't sold loose so "strips" is implied, "buns" alone is ambiguous between
// hamburger and hotdog buns, and "dogs" alone (from "hot dogs") loses the "hot". Zero sugar sodas end in "sugar" or
// "zeros" but are counted in cans, the shakes are protein shakes and bags of cookies are just bags. Checked against
// the full name, not just the last word.
function overrideCountNoun(base: string, name: Segment[]): string {
  if (base === 'shakes') return 'protein shakes'
  if (base === 'cookie bags') return 'bags'
  if (base !== 'bacon' && base !== 'buns' && base !== 'dogs' && base !== 'sugar' && base !== 'zeros') return base
  const text = name
    .filter((segment) => segment.kind === 'name')
    .map((segment) => segment.text)
    .join(' ')
    .toLowerCase()
  if (base === 'bacon') return 'bacon strips'
  if (base === 'sugar' || base === 'zeros') return text.includes('zero') ? 'cans' : base
  if (base === 'dogs') return text.includes('hotdog') || text.includes('hot dog') ? 'hot dogs' : base
  if (text.includes('hamburger')) return 'hamburger buns'
  if (text.includes('hotdog') || text.includes('hot dog')) return 'hotdog buns'
  return base
}

// Units counted on their own, "30 Rolls" of toilet paper, "21 Boxes" of tissues, "4 Tubes" of toothpaste, "2 Loaves"
// of bread and "12 Cans" of hard iced tea, not "30 Paper Rolls".
const COUNTED_ALONE = new Set(['roll', 'box', 'tube', 'loaf', 'can'])

// The word to count by for a "Nx" amount. A typed unit price names it directly ("per bag" -> "bags"), pluralized
// and, if it's a different word than the item's own name, paired with that name ("tea" + "bags" -> "tea bags").
// Without a unit price, or when the unit price just names the item itself (buns "per bun"), the item's own name is
// used alone, since guessing a qualifying word (e.g. "hamburger" buns vs "large" eggs) can't be done reliably in
// general, aside from the specific overrides above.
function countNoun(name: Segment[]): string {
  const productNoun = headNoun(name)
  const perNoun = perUnitNoun(name)
  const base = (() => {
    if (!perNoun) return productNoun
    const perNounPlural = pluralize(perNoun)
    // Same word either way ("container" vs "containers", "head" vs "heads") -> just the one word, not both.
    if (
      !productNoun ||
      COUNTED_ALONE.has(perNoun.toLowerCase()) ||
      perNounPlural === productNoun ||
      perNounPlural === pluralize(productNoun)
    ) {
      return perNounPlural
    }
    return `${singularize(productNoun)} ${perNounPlural}`
  })()
  return overrideCountNoun(base, name)
}

// Item names and Amount text always start each word with a capital. Only a space or the start of the string counts
// as a word start, not any non-letter, so a unit stuck onto a number (500g) and a possessive or contraction
// (Illy's, M&M's) are both left alone rather than capitalizing the letter right after.
function capitalizeWords(text: string): string {
  return text.replace(/(^|\s)([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase())
}

// A count of 1 says nothing a single listed item doesn't already say, so it's dropped. Other counts read as
// "<n> <Noun>" (8 Buns, 24 Eggs, 50 Tea Bags). A weight or volume keeps its raw unit (500g, 3.46L) unless it's exactly
// one and the name calls out a container word, in which case that reads better ("1 Carton" over "1L").
function describeAmount(amount: string, forCount: string, forMeasure: string): string | null {
  const match = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/.exec(amount)
  if (!match) return capitalizeWords(amount)
  const [, numberText, unit] = match
  if (unit.toLowerCase() === 'x') {
    if (Number(numberText) === 1) return null
    return capitalizeWords(forCount ? `${numberText} ${forCount}` : amount)
  }
  const useContainerWord = Number(numberText) === 1 && CONTAINER_WORDS.has(forMeasure)
  return capitalizeWords(useContainerWord ? `${numberText} ${forMeasure}` : amount)
}

// Splits an item into what goes in the Item, Amount and Unit price columns. Imported items have their amounts and
// typed unit price written in the name, items from the add form keep the amount in its own fields.
export function itemParts(item: Sized): ItemParts {
  const segments: Segment[] = []
  const rawAmounts: string[] = []
  let unitPrice: string | null = null
  const label = stripBrandPrefix(item.name, item.brand)
  for (const segment of labelSegments(label)) {
    if (segment.kind === 'amount') {
      rawAmounts.push(segment.text.slice(1, -1).trim())
    } else {
      segments.push(segment)
      if (segment.kind === 'unit-price' && unitPrice === null) unitPrice = segment.text.slice(1, -1).trim()
    }
  }
  if (item.item_count !== null) rawAmounts.push(`${item.item_count}x`)
  if (item.weight_g !== null) rawAmounts.push(`${item.weight_g}g`)
  if (item.volume_ml !== null) rawAmounts.push(`${item.volume_ml}ml`)

  const forCount = countNoun(segments)
  const forMeasure = headNoun(segments)
  const amounts = rawAmounts
    .map((amount) => describeAmount(amount, forCount, forMeasure))
    .filter((amount): amount is string => amount !== null)

  const name = segments
    .filter((segment) => segment.kind === 'name')
    .map((segment) => ({ ...segment, text: capitalizeWords(segment.text) }))
  return { name, amounts, unitPrice }
}
