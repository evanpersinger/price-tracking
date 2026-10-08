import { describe, expect, it } from 'vitest'
import { findClosestBrand, isOldSpice } from './brands.ts'

describe('findClosestBrand', () => {
  it('matches a brand typed exactly', () => {
    expect(findClosestBrand('Kirkland')).toBe('Kirkland')
  })

  it('ignores case, spacing and punctuation', () => {
    expect(findClosestBrand('kelloggs')).toBe("Kellogg's")
    expect(findClosestBrand('fibre1')).toBe('Fibre 1')
  })

  it('corrects a misspelling, including a swapped pair of letters', () => {
    expect(findClosestBrand('Fiber1')).toBe('Fibre 1')
    expect(findClosestBrand('Biscof')).toBe('Biscoff')
  })

  it('returns null for a brand not on the list, rather than guessing', () => {
    expect(findClosestBrand('Some Random Brand Nobody Has Heard Of')).toBeNull()
  })

  it('returns null for a blank brand', () => {
    expect(findClosestBrand('')).toBeNull()
    expect(findClosestBrand('   ')).toBeNull()
  })
})

describe('isOldSpice', () => {
  it('recognizes Old Spice in a printed name, at any store', () => {
    expect(isOldSpice('Old Spice Original')).toBe(true)
    expect(isOldSpice('123456 OLD SPICE DEODORANT')).toBe(true)
  })

  it('returns false for anything else', () => {
    expect(isOldSpice('Dove Deodorant')).toBe(false)
  })
})
