import { describe, expect, it } from 'vitest'
import { formatPrice, formatUnitPrice, isZeroMoney, itemParts, labelSegments } from './format.ts'

const sized = { item_count: null, weight_g: null, volume_ml: null }

// The words of the Item column as one string
function nameText(item: Parameters<typeof itemParts>[0]): string {
  return itemParts(item).name.map((segment) => segment.text).join('').trim()
}

describe('formatPrice', () => {
  it('turns cents into dollars for both countries', () => {
    expect(formatPrice(1299, 'CA')).toBe('$12.99')
    expect(formatPrice(1299, 'US')).toBe('$12.99')
    expect(formatPrice(5, 'CA')).toBe('$0.05')
    expect(formatPrice(123456, 'US')).toBe('$1,234.56')
  })
})

describe('formatUnitPrice', () => {
  it('shows a per-item price in dollars', () => {
    expect(formatUnitPrice({ unit: 'each', unit_price_cents: 50 }, 'CA')).toBe('$0.50 each')
  })

  it('shows grams and ml per 100, which is the same number as cents per single g or ml', () => {
    expect(formatUnitPrice({ unit: 'g', unit_price_cents: 0.9912 }, 'CA')).toBe('$0.99 per 100g')
    expect(formatUnitPrice({ unit: 'ml', unit_price_cents: 0.2995 }, 'US')).toBe('$0.30 per 100ml')
  })
})

describe('isZeroMoney', () => {
  it('flags a unit price that rounded down to nothing', () => {
    expect(isZeroMoney('$0 per bun')).toBe(true)
    expect(isZeroMoney('$0.00 each')).toBe(true)
  })

  it('leaves real prices alone', () => {
    expect(isZeroMoney('$0.50 per bun')).toBe(false)
    expect(isZeroMoney('$0.05 each')).toBe(false)
  })
})

describe('labelSegments', () => {
  const split = (label: string) => labelSegments(label).map(({ kind, text }) => [kind, text])

  it('separates an amount bracket from the name', () => {
    expect(split('Buns (8x)')).toEqual([['name', 'Buns '], ['amount', '(8x)']])
  })

  it('separates a typed unit price bracket from the name', () => {
    expect(split('Buns ($0.50 per bun)')).toEqual([['name', 'Buns '], ['unit-price', '($0.50 per bun)']])
  })

  it('keeps a bracket with no number or $ as part of the name', () => {
    expect(split('Hamburger Buns (SS)')).toEqual([['name', 'Hamburger Buns (SS)']])
  })
})

describe('itemParts', () => {
  it('splits an imported name into item, amount and typed unit price, naming what is counted', () => {
    const item = { ...sized, name: 'Villagio Hamburger Buns (8x) ($0.50 per bun)', brand: 'Villagio' }
    const parts = itemParts(item)

    expect(nameText(item)).toBe('Hamburger Buns')
    expect(parts.amounts).toEqual(['8 Hamburger Buns'])
    expect(parts.unitPrice).toBe('$0.50 per bun')
  })

  it('reads the amount from the size fields for an item added through the form', () => {
    const parts = itemParts({ ...sized, name: 'Large Eggs', item_count: 12 })

    expect(parts.amounts).toEqual(['12 Eggs'])
    expect(parts.unitPrice).toBeNull()
  })

  it('names a count of 1 and keeps a weight as typed', () => {
    expect(itemParts({ ...sized, name: 'Chicken Strips', item_count: 1, weight_g: 1200 }).amounts).toEqual([
      '1 Strips',
      '1200g',
    ])
  })

  it('names the container for a size typed in the name', () => {
    expect(itemParts({ ...sized, name: 'Milk Carton (1L)' }).amounts).toEqual(['1 Carton'])
  })

  it('capitalizes every word of the item', () => {
    expect(nameText({ ...sized, name: 'large eggs' })).toBe('Large Eggs')
  })

  it('takes the brand off the front of the name, only on an exact word match', () => {
    expect(nameText({ ...sized, name: 'kirkland Eggs', brand: 'Kirkland' })).toBe('Eggs')
    expect(nameText({ ...sized, name: 'Kirklands Eggs', brand: 'Kirkland' })).toBe('Kirklands Eggs')
  })

  it('keeps a bracket like (SS) in the name', () => {
    expect(nameText({ ...sized, name: 'Hamburger Buns (SS)' })).toBe('Hamburger Buns (SS)')
  })
})
