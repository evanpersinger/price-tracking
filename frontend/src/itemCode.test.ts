import { describe, expect, it } from 'vitest'
import { splitItemCode } from './itemCode.ts'

describe('splitItemCode', () => {
  it('takes a code printed in front of the name (Costco)', () => {
    expect(splitItemCode('6262016 KS BATH')).toEqual({ code: '6262016', name: 'KS BATH' })
  })

  it('takes a barcode printed after the name (Dollarama)', () => {
    expect(splitItemCode('CHOCOLATE 190104059728')).toEqual({ code: '190104059728', name: 'CHOCOLATE' })
  })

  it('drops the asterisks the model wraps names in', () => {
    expect(splitItemCode('*KS BATH*')).toEqual({ code: undefined, name: 'KS BATH' })
  })

  it('has no code when the store prints none (Fresco)', () => {
    expect(splitItemCode('BANANAS')).toEqual({ code: undefined, name: 'BANANAS' })
  })

  it('does not mistake a price or a short number for a code', () => {
    expect(splitItemCode('MILK 4.99').code).toBeUndefined()
    expect(splitItemCode('MILK 123').code).toBeUndefined()
  })

  it('takes a 4-digit code (Costco codes vary in length)', () => {
    expect(splitItemCode('4725 BAKING SODA')).toEqual({ code: '4725', name: 'BAKING SODA' })
  })

  it('does not mistake a size with a unit for a code', () => {
    expect(splitItemCode('ORANGE JUICE 1750ML')).toEqual({ code: undefined, name: 'ORANGE JUICE 1750ML' })
    expect(splitItemCode('COCA COLA 2000 ML').code).toBeUndefined()
    expect(splitItemCode('FLOUR 2000G').code).toBeUndefined()
    expect(splitItemCode('WATER 6/2000ML').code).toBeUndefined()
  })

  it('still takes the real code when a size is printed too', () => {
    expect(splitItemCode('6262016 KS WATER 6/2000ML')).toEqual({ code: '6262016', name: 'KS WATER 6/2000ML' })
    expect(splitItemCode('WATER 2000ML 190104059728').code).toBe('190104059728')
  })
})
