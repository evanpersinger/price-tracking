import { describe, expect, it } from 'vitest'
import { dedupeExact } from './dedupeExact.ts'
import type { ReceiptItem } from './types.ts'

function item(overrides: Partial<ReceiptItem> = {}): ReceiptItem {
  return { raw_name: 'EGGS', item_name: 'Eggs', price: 8.99, category: 'dairy', ...overrides }
}

describe('dedupeExact', () => {
  it('drops a line that repeats another one in every field', () => {
    expect(dedupeExact([item(), item()])).toEqual([item()])
  })

  it('keeps both when the price differs, since that really was bought twice', () => {
    const items = [item({ price: 8.99 }), item({ price: 7.49 })]
    expect(dedupeExact(items)).toEqual(items)
  })

  it('keeps both when the quantity line differs', () => {
    const items = [item({ quantity_info: '3 @ 2.79' }), item({ quantity_info: '2 @ 2.79' })]
    expect(dedupeExact(items)).toEqual(items)
  })

  it('keeps both when the name differs', () => {
    const items = [item({ raw_name: 'EGGS' }), item({ raw_name: 'LARGE EGGS' })]
    expect(dedupeExact(items)).toEqual(items)
  })
})
