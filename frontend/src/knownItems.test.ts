import { describe, expect, it } from 'vitest'
import { findKnownItem } from './knownItems.ts'

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

  it('uses a store group when the receipt name only contains it', () => {
    expect(findKnownItem('Costco Wholesale - North London', 'KS BATH')?.name).toBe('Bath Tissue')
  })

  it('finds nothing for an unknown item or an unknown store', () => {
    expect(findKnownItem('Costco', 'BANANAS')).toBeUndefined()
    expect(findKnownItem('Fresco', 'KS BATH')).toBeUndefined()
  })
})
