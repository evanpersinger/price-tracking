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
    expect(splitItemCode('MILK 12345').code).toBeUndefined()
  })
})
