import { describe, expect, it } from 'vitest'
import { sizeInName } from './sizeInName.ts'

describe('sizeInName', () => {
  it('reads a litre size out of a printed name', () => {
    expect(sizeInName('LCTS FREE SKM 2L RQ')).toEqual({ size: '2', unit: 'L' })
  })

  it('reads each unit, ignoring case and keeping a decimal', () => {
    expect(sizeInName('coke 500ml')).toEqual({ size: '500', unit: 'ml' })
    expect(sizeInName('BUTTER 454G')).toEqual({ size: '454', unit: 'g' })
    expect(sizeInName('RICE 1.5KG')).toEqual({ size: '1.5', unit: 'kg' })
    expect(sizeInName('OJ 0.5L')).toEqual({ size: '0.5', unit: 'L' })
  })

  it('finds nothing when the name has no size', () => {
    expect(sizeInName('SIMP ORA W/PLP J MRJ')).toBeUndefined()
    expect(sizeInName('CB CHDR MED SLC MRJ')).toBeUndefined()
  })

  it('does not take a pack or a count for a size', () => {
    expect(sizeInName('COKE 12X355ML')).toBeUndefined()
    expect(sizeInName('WATER 24 X 500ML')).toBeUndefined()
    expect(sizeInName('POP 6PK 355ML')).toBeUndefined()
    expect(sizeInName('WATER 24 PACK 500ML')).toBeUndefined()
  })

  it('finds nothing when there are two sizes, since it cannot tell which is the pack', () => {
    expect(sizeInName('CHIPS 200G 400G')).toBeUndefined()
  })

  it('does not take letters after a number for a unit', () => {
    expect(sizeInName('SKM 2LB')).toBeUndefined()
    expect(sizeInName('ITEM 5GO')).toBeUndefined()
  })

  it('does not take a long number such as a code, or a zero size, for a size', () => {
    expect(sizeInName('12345678L')).toBeUndefined()
    expect(sizeInName('WATER 0G')).toBeUndefined()
  })

  it('needs the unit right against the number', () => {
    expect(sizeInName('SALT 2 L')).toBeUndefined()
  })
})
