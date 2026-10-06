import { describe, expect, it } from 'vitest'
import { formatLitres, pricePerLitre } from './fuel.ts'

describe('pricePerLitre', () => {
  it('works out the price of a litre to three decimals', () => {
    expect(pricePerLitre(4583, 26204, 'CA')).toBe('$1.749')
  })

  it('is null without a price or litres', () => {
    expect(pricePerLitre(null, 26204, 'CA')).toBeNull()
    expect(pricePerLitre(4583, null, 'CA')).toBeNull()
    expect(pricePerLitre(4583, 0, 'CA')).toBeNull()
  })
})

describe('formatLitres', () => {
  it('turns ml back into litres', () => {
    expect(formatLitres(26204)).toBe('26.204 L')
    expect(formatLitres(40000)).toBe('40 L')
  })
})
