import type { CheapestItem, Country, Item } from './types.ts'

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

// Sizes entered in the add form live in their own fields instead of the name, so they are shown after it
export function itemLabel(item: Item): string {
  const sizes: string[] = []
  if (item.item_count !== null) sizes.push(`(${item.item_count}x)`)
  if (item.weight_g !== null) sizes.push(`(${item.weight_g}g)`)
  if (item.volume_ml !== null) sizes.push(`(${item.volume_ml}ml)`)
  return [item.name, ...sizes].join(' ')
}
