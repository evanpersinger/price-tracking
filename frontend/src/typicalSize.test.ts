import { describe, expect, it } from 'vitest'
import { typicalSize } from './typicalSize.ts'

describe('typicalSize', () => {
  it('fills 113 g for a Drizzilicious line priced like the single bag', () => {
    expect(typicalSize('85790000517 DRIZZILICI SMORE MRJ', 6.49)).toEqual({ size: '113', unit: 'g' })
    expect(typicalSize('DRIZZILICI SMORE', 5)).toEqual({ size: '113', unit: 'g' })
    expect(typicalSize('DRIZZILICI SMORE', 8)).toEqual({ size: '113', unit: 'g' })
  })

  it('fills nothing when the price is outside the range', () => {
    expect(typicalSize('DRIZZILICI SMORE', 4.99)).toBeUndefined()
    expect(typicalSize('DRIZZILICI SMORE', 8.01)).toBeUndefined()
  })

  it('fills nothing without a price', () => {
    expect(typicalSize('DRIZZILICI SMORE', null)).toBeUndefined()
  })

  it('needs the whole word, and fills nothing for another item', () => {
    expect(typicalSize('DRIZZILICIOUS SMORE', 6.5)).toBeUndefined()
    expect(typicalSize('SIMP ORA W/PLP J MRJ', 6.5)).toBeUndefined()
  })
})
