import { describe, expect, it } from 'vitest'
import { litresIn, readQuantity } from './quantityInfo.ts'

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

describe('readQuantity', () => {
  it('reads a count from "3 @ 2.79" and leaves the size and unit to the person', () => {
    expect(readQuantity('3 @ 2.79')).toEqual({ count: '3', size: '', unit: '' })
    expect(readQuantity('1 @ $4.99 ea')).toEqual({ count: '1', size: '', unit: '' })
  })

  it('reads a weight as one item of that many grams', () => {
    expect(readQuantity('1.2 kg @ $4.99/kg')).toEqual({ count: '1', size: '1200', unit: 'g' })
    expect(readQuantity('350 g @ $1.20/100g')).toEqual({ count: '1', size: '350', unit: 'g' })
    expect(readQuantity('2 lb @ $3.00/lb')).toEqual({ count: '1', size: '907', unit: 'g' })
  })

  it('reads litres as one item of that many litres', () => {
    expect(readQuantity('26.204 L @ 1.749/L')).toEqual({ count: '1', size: '26.204', unit: 'L' })
  })

  it('fills nothing for a deal or an empty line', () => {
    expect(readQuantity('2 for $1.25')).toBeUndefined()
    expect(readQuantity('$4.99 ea or 2/$9.00 KB')).toBeUndefined()
    expect(readQuantity(null)).toBeUndefined()
    expect(readQuantity('')).toBeUndefined()
  })
})
