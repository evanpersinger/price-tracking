import { describe, expect, it } from 'vitest'
import { matchSavedStore } from './matchSavedStore.ts'
import type { Store } from './types.ts'

function stores(...names: string[]): Store[] {
  return names.map((name, index) => ({ id: index + 1, name, discount_text: null, items: [] }))
}

const SAVED = stores('Costco', 'Metro', 'Canadian Superstore', 'Super')

describe('matchSavedStore', () => {
  it('matches the same name ignoring case', () => {
    expect(matchSavedStore('COSTCO', SAVED)?.name).toBe('Costco')
  })

  it('matches a receipt name that holds the saved name as whole words', () => {
    expect(matchSavedStore('Costco 530', SAVED)?.name).toBe('Costco')
    expect(matchSavedStore('COSTCO WHOLESALE', SAVED)?.name).toBe('Costco')
    expect(matchSavedStore('Real Canadian Superstore #1234', SAVED)?.name).toBe('Canadian Superstore')
  })

  it('does not match part of a word', () => {
    expect(matchSavedStore('Metropolitan Market', SAVED)).toBeNull()
  })

  it('finds nothing for a new store or a blank name', () => {
    expect(matchSavedStore('Some New Store', SAVED)).toBeNull()
    expect(matchSavedStore('', SAVED)).toBeNull()
  })
})
