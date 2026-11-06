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

  it('does not take a size in the name for a code', () => {
    expect(splitItemCode('COCA COLA 1500ML')).toEqual({ code: undefined, name: 'COCA COLA 1500ML' })
    expect(splitItemCode('KS WATER 6/2000ML')).toEqual({ code: undefined, name: 'KS WATER 6/2000ML' })
    expect(splitItemCode('FLOUR 2000 ML')).toEqual({ code: undefined, name: 'FLOUR 2000 ML' })
    expect(splitItemCode('OIL 15000ML')).toEqual({ code: undefined, name: 'OIL 15000ML' })
  })

  it('still finds the code when the name also has a size', () => {
    expect(splitItemCode('6262016 COCA COLA 1500ML')).toEqual({ code: '6262016', name: 'COCA COLA 1500ML' })
    expect(splitItemCode('OIL 1000ML 7654321')).toEqual({ code: '7654321', name: 'OIL 1000ML' })
    expect(splitItemCode("1234567 L'OREAL SHAMPOO")).toEqual({ code: '1234567', name: "L'OREAL SHAMPOO" })
  })

  it('takes a 4-digit code (Costco codes vary in length)', () => {
    expect(splitItemCode('4725 BAKING SODA')).toEqual({ code: '4725', name: 'BAKING SODA' })
  })

  it('takes a lettered code after an Item No. label (Healthy Planet)', () => {
    expect(splitItemCode('Item No.: FRU026\nPears Bartlett Green')).toEqual({ code: 'FRU026', name: 'Pears Bartlett Green' })
    expect(splitItemCode('Item No.: A0087814\nIsoPure Zero Carb')).toEqual({ code: 'A0087814', name: 'IsoPure Zero Carb' })
  })

  it('does not mistake a longer word starting with "Item No" for the label', () => {
    expect(splitItemCode('Item Notes: 5')).toEqual({ code: undefined, name: 'Item Notes: 5' })
  })
})
