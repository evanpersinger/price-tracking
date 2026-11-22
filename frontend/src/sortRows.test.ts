import { describe, expect, it } from 'vitest'
import { nextSort, sortRows } from './sortRows.ts'
import type { SortableRow, SortState } from './sortRows.ts'

function row(itemName: string, item: Partial<SortableRow['item']> = {}): SortableRow {
  return { itemName, item: { price_cents: 500, unit: null, unit_price_cents: null, ...item } }
}

function names(rows: SortableRow[]): string[] {
  return rows.map((entry) => entry.itemName)
}

const ASC = (column: SortState['column']): SortState => ({ column, direction: 'asc' })
const DESC = (column: SortState['column']): SortState => ({ column, direction: 'desc' })

describe('nextSort', () => {
  it('starts a new column ascending', () => {
    expect(nextSort(null, 'price')).toEqual(ASC('price'))
    expect(nextSort(ASC('name'), 'price')).toEqual(ASC('price'))
  })

  it('goes descending on a second click, then back to no sort on a third', () => {
    expect(nextSort(ASC('price'), 'price')).toEqual(DESC('price'))
    expect(nextSort(DESC('price'), 'price')).toBeNull()
  })
})

describe('sortRows', () => {
  it('gives the rows back in their own order when there is no sort', () => {
    const rows = [row('Pears'), row('Apples')]
    expect(sortRows(rows, null)).toBe(rows)
  })

  it('sorts by name ignoring case, and descending reverses it', () => {
    const rows = [row('pears'), row('Apples'), row('Bread')]
    expect(names(sortRows(rows, ASC('name')))).toEqual(['Apples', 'Bread', 'pears'])
    expect(names(sortRows(rows, DESC('name')))).toEqual(['pears', 'Bread', 'Apples'])
  })

  it('sorts by price and always leaves an item with no price last', () => {
    const rows = [row('B', { price_cents: 900 }), row('None', { price_cents: null }), row('A', { price_cents: 300 })]
    expect(names(sortRows(rows, ASC('price')))).toEqual(['A', 'B', 'None'])
    expect(names(sortRows(rows, DESC('price')))).toEqual(['B', 'A', 'None'])
  })

  it('keeps rows that tie in their own order', () => {
    const rows = [row('First', { price_cents: 500 }), row('Second', { price_cents: 500 })]
    expect(names(sortRows(rows, ASC('price')))).toEqual(['First', 'Second'])
    expect(names(sortRows(rows, DESC('price')))).toEqual(['First', 'Second'])
  })

  it('does not change the rows it was given', () => {
    const rows = [row('B', { price_cents: 900 }), row('A', { price_cents: 300 })]
    sortRows(rows, ASC('price'))
    expect(names(rows)).toEqual(['B', 'A'])
  })

  it('ranks unit prices only inside their own unit: per item, then per g, then per ml', () => {
    const rows = [
      row('ml dear', { unit: 'ml', unit_price_cents: 4 }),
      row('g dear', { unit: 'g', unit_price_cents: 3 }),
      row('each cheap', { unit: 'each', unit_price_cents: 50 }),
      row('g cheap', { unit: 'g', unit_price_cents: 1 }),
      row('each dear', { unit: 'each', unit_price_cents: 200 }),
    ]
    expect(names(sortRows(rows, ASC('unit-price')))).toEqual(['each cheap', 'each dear', 'g cheap', 'g dear', 'ml dear'])
    expect(names(sortRows(rows, DESC('unit-price')))).toEqual(['each dear', 'each cheap', 'g dear', 'g cheap', 'ml dear'])
  })

  it('leaves an item with no unit price last, whichever way the column goes', () => {
    const rows = [row('None'), row('Each', { unit: 'each', unit_price_cents: 50 })]
    expect(names(sortRows(rows, ASC('unit-price')))).toEqual(['Each', 'None'])
    expect(names(sortRows(rows, DESC('unit-price')))).toEqual(['Each', 'None'])
  })
})
