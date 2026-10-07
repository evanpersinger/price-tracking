import { describe, expect, it } from 'vitest'
import { litresIn, priceOfOne, readQuantity } from './quantityInfo.ts'

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
  it('reads "3 @ 2.79" as 3 bought at 2.79 each, not as a count of 3', () => {
    expect(readQuantity('3 @ 2.79')).toEqual({ count: '', size: '', unit: '', bought: { times: 3, unitPrice: 2.79 } })
    expect(readQuantity('1 @ $4.99 ea')).toEqual({
      count: '',
      size: '',
      unit: '',
      bought: { times: 1, unitPrice: 4.99 },
    })
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

describe('priceOfOne', () => {
  it('is the price of one carton when 3 @ 2.79 adds up to the 8.37 on the line', () => {
    expect(priceOfOne(8.37, readQuantity('3 @ 2.79'))).toBe(2.79)
  })

  it('keeps the printed price when the bought amounts do not add up to the total', () => {
    expect(priceOfOne(7.5, readQuantity('3 @ 2.79'))).toBe(7.5)
  })

  it('keeps the printed price for a single item, a weight, or no line at all', () => {
    expect(priceOfOne(4.99, readQuantity('1 @ $4.99 ea'))).toBe(4.99)
    expect(priceOfOne(5.99, readQuantity('1.2 kg @ $4.99/kg'))).toBe(5.99)
    expect(priceOfOne(5.99, undefined)).toBe(5.99)
    expect(priceOfOne(null, readQuantity('3 @ 2.79'))).toBeNull()
  })
})
