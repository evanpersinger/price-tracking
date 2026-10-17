import { describe, expect, it } from 'vitest'
import { guessCountry } from './guessCountry.ts'
import type { Store } from './types.ts'

function stores(...names: string[]): Store[] {
  return names.map((name, index) => ({ id: index + 1, name, discount_text: null, items: [] }))
}

const CANADA = stores('Fresco', 'Canadian Superstore', 'Costco')
const USA = stores('Target', 'Costco')

describe('guessCountry from the address', () => {
  it('picks Canada from a city, even for a store both countries have', () => {
    expect(guessCountry('Costco', '693 Wonderland Road North, London, ON N6H 4L1', CANADA, USA)).toBe('CA')
    expect(guessCountry('Costco', '12 Main St, Guelph', CANADA, USA)).toBe('CA')
    expect(guessCountry('Costco', 'Saint Thomas', CANADA, USA)).toBe('CA')
  })

  it('falls back to the postal code, then the province, when the city is not known', () => {
    expect(guessCountry('Costco', '1 Pine Rd, Smallville K1A 0B1', CANADA, USA)).toBe('CA')
    expect(guessCountry('Costco', '1 Pine Rd, Smallville ON', CANADA, USA)).toBe('CA')
  })

  it('picks the US from a state and ZIP', () => {
    expect(guessCountry('Costco', '500 Congress Ave, Austin, TX 78701', CANADA, USA)).toBe('US')
  })

  it('does not call an American London Canadian', () => {
    expect(guessCountry('Costco', '100 Main St, London, KY 40741', CANADA, USA)).toBe('US')
  })

  it('does not take a mistyped postal code or the word on for Canada', () => {
    expect(guessCountry('Costco', 'N73 5X1 turn on the lights', CANADA, USA)).toBeNull()
  })
})

describe('guessCountry from the store name', () => {
  it('does not match a store name that is only part of a longer word', () => {
    expect(guessCountry('Metro', null, [], stores('Metropolitan Market'))).toBeNull()
    expect(guessCountry('Cos', null, [], stores('Costco'))).toBeNull()
  })

  it('picks the country when only one has the store and there is no address', () => {
    expect(guessCountry('Fresco', null, CANADA, USA)).toBe('CA')
    expect(guessCountry('target', undefined, CANADA, USA)).toBe('US')
  })

  it('matches a receipt name that contains the saved one', () => {
    expect(guessCountry('REAL CANADIAN SUPERSTORE #1234', '', CANADA, USA)).toBe('CA')
  })

  it('leaves it for the person when both countries have the store or neither does', () => {
    expect(guessCountry('Costco', null, CANADA, USA)).toBeNull()
    expect(guessCountry('Some New Store', null, CANADA, USA)).toBeNull()
    expect(guessCountry('', null, CANADA, USA)).toBeNull()
  })
})
