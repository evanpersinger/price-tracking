import { describe, expect, it } from 'vitest'
import { findKnownItem, isKirklandSignature } from './knownItems.ts'

// These use the Costco entries in KNOWN_ITEMS (KS BATH, CHKN STRIPS and the COOKI rule), so they need updating if
// those lines are edited.
describe('findKnownItem', () => {
  it('matches on the item code, even when the name is different', () => {
    expect(findKnownItem('Costco', '6262016 KS BATH')?.name).toBe('Bath Tissue')
    expect(findKnownItem('Costco', '6262016 SOMETHING ELSE')?.name).toBe('Bath Tissue')
  })

  it('matches the whole printed name, ignoring case and asterisks', () => {
    expect(findKnownItem('Costco', '*ks bath*')?.name).toBe('Bath Tissue')
  })

  it('needs the whole name to match unless the entry is a contains rule', () => {
    expect(findKnownItem('Costco', 'KS BATH TISSUE 30')).toBeUndefined()
    expect(findKnownItem('Costco', 'COOKIES CHOC CHIP')?.name).toBe('Cookies')
  })

  it('matches a more specific contains rule before a more general one that also fits', () => {
    expect(findKnownItem('Costco', 'GINGER COOKI')?.name).toBe('Ginger Cookies')
    expect(findKnownItem('Costco', 'COOKI')?.name).toBe('Cookies')
  })

  it('does not take a cooking item for cookies', () => {
    expect(findKnownItem('Costco', '1234567 KS COOKING OIL')).toBeUndefined()
  })

  it('uses a store group when the receipt name only contains it', () => {
    expect(findKnownItem('Costco Wholesale - North London', 'KS BATH')?.name).toBe('Bath Tissue')
  })

  it('finds nothing for an unknown item or an unknown store', () => {
    expect(findKnownItem('Costco', 'BANANAS')).toBeUndefined()
    expect(findKnownItem('Fresco', 'KS BATH')).toBeUndefined()
  })
})

describe('isKirklandSignature', () => {
  it('recognizes KS as its own word at a Costco store', () => {
    expect(isKirklandSignature('Costco', 'KS FR EGGS')).toBe(true)
    expect(isKirklandSignature('Costco', '1706959 KS FR EGGS')).toBe(true)
  })

  it('does not mistake letters inside a longer word for KS', () => {
    expect(isKirklandSignature('Costco', 'FACE MASKS')).toBe(false)
  })

  it('only applies at a Costco store', () => {
    expect(isKirklandSignature('Fresco', 'KS BATH')).toBe(false)
  })
})
