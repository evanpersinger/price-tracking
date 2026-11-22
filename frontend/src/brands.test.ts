import { describe, expect, it } from 'vitest'
import { findBrandInName, findClosestBrand, isOldSpice, isSoda } from './brands.ts'

describe('findClosestBrand', () => {
  it('matches a brand typed exactly', () => {
    expect(findClosestBrand('Kirkland')).toBe('Kirkland')
  })

  it('ignores case, spacing and punctuation', () => {
    expect(findClosestBrand('kelloggs')).toBe("Kellogg's")
    expect(findClosestBrand('fibre1')).toBe('Fibre 1')
  })

  it('corrects a misspelled brand', () => {
    expect(findClosestBrand('Drizzzlicious')).toBe('Drizzilicious')
  })

  it('corrects a misspelling, including a swapped pair of letters', () => {
    expect(findClosestBrand('Fiber1')).toBe('Fibre 1')
    expect(findClosestBrand('Biscof')).toBe('Biscoff')
  })

  it('does not turn a short brand into a different one over a single edit', () => {
    for (const typed of ['Care', 'Bare', 'Wide', 'Guest']) expect(findClosestBrand(typed)).toBeNull()
    expect(findClosestBrand('dare')).toBe('Dare')
    expect(findClosestBrand('TIDE')).toBe('Tide')
  })

  it('still corrects a typo in a longer brand', () => {
    expect(findClosestBrand('Sprit')).toBe('Sprite')
    expect(findClosestBrand('Natura')).toBe('Natural')
  })

  it('returns null for a brand not on the list, rather than guessing', () => {
    expect(findClosestBrand('Some Random Brand Nobody Has Heard Of')).toBeNull()
  })

  it('returns null for a blank brand', () => {
    expect(findClosestBrand('')).toBeNull()
    expect(findClosestBrand('   ')).toBeNull()
  })
})

describe('findBrandInName', () => {
  it('finds the brand a store spells out in an item name, ignoring case and the item code', () => {
    expect(findBrandInName('Walmart', 'CHIPITS S DK')).toBe('Chipits')
    expect(findBrandInName('Walmart Supercentre', '0001234 chipits s dk')).toBe('Chipits')
  })

  it('does nothing at a store that has no entry for it', () => {
    expect(findBrandInName('Costco', 'CHIPITS S DK')).toBeNull()
  })

  it('finds a brand that is the same at every store, with or without a group of its own', () => {
    expect(findBrandInName('Sobeys', 'DORITOS NACHO CHEESE')).toBe('Doritos')
    expect(findBrandInName('Walmart', 'DORITOS NACHO CHEESE')).toBe('Doritos')
  })

  it('only matches a whole word, not letters inside a longer one', () => {
    expect(findBrandInName('Walmart', 'CHIPITSY COOKIES')).toBeNull()
  })

  it('finds a brand printed as two words, only at a store that lists it', () => {
    expect(findBrandInName('Real Canadian Superstore', 'NO NAME CHOC ICE MLK')).toBe('No Name')
    expect(findBrandInName('Costco', 'NO NAME CHOC ICE MLK')).toBeNull()
  })
})

describe('isOldSpice', () => {
  it('recognizes Old Spice in a printed name, at any store', () => {
    expect(isOldSpice('Old Spice Original')).toBe(true)
    expect(isOldSpice('123456 OLD SPICE DEODORANT')).toBe(true)
  })
})

describe('isSoda', () => {
  it('recognizes a soda brand in the Brand box, ignoring case and punctuation', () => {
    expect(isSoda('Coca Cola', 'COKE ZERO')).toBe(true)
    expect(isSoda('coca-cola', '')).toBe(true)
    expect(isSoda('Dr Pepper', '')).toBe(true)
  })

  it('recognizes a soda brand spelled out in the printed name, as one word or two', () => {
    expect(isSoda('', '2068040 COKE VANILLA')).toBe(true)
    expect(isSoda('', '1153876 DR PEPPER')).toBe(true)
    expect(isSoda('', 'COCA-COLA CLASSIC')).toBe(true)
    expect(isSoda('', 'SPRITE')).toBe(true)
  })

  it('does not take letters inside a longer word, or another item, for a soda', () => {
    expect(isSoda('No Brand', 'COKED OVEN PIZZA')).toBe(false)
    expect(isSoda('Kirkland', 'KS BATH')).toBe(false)
    expect(isSoda('', 'CRUSHED TOMATOES')).toBe(false)
    expect(isSoda('', '')).toBe(false)
  })
})
