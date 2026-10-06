import { describe, expect, it } from 'vitest'
import { litresIn } from './quantityInfo.ts'

describe('litresIn', () => {
  it('takes the litres from a fuel receipt line', () => {
    expect(litresIn('26.204 L @ 1.749/L')).toBe('26.204')
    expect(litresIn('26.204 litres @ $1.749/litre')).toBe('26.204')
  })

  it('is undefined for a line that is not litres', () => {
    expect(litresIn('3 @ 2.79')).toBeUndefined()
    expect(litresIn('1.2 kg @ $4.99/kg')).toBeUndefined()
    expect(litresIn(null)).toBeUndefined()
    expect(litresIn('')).toBeUndefined()
  })
})
