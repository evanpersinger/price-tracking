import type { Item } from './types.ts'

export type SortColumn = 'name' | 'unit-price' | 'price'
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  column: SortColumn
  direction: SortDirection
}

// What a row needs for sorting: the name as shown on screen, and the numbers the API sent
export interface SortableRow {
  itemName: string
  item: Pick<Item, 'price_cents' | 'unit' | 'unit_price_cents'>
}

// A unit price per item, per gram and per ml can't be ranked against each other, so they stay in these groups and
// only the ones inside a group are ranked
const UNIT_ORDER = ['each', 'g', 'ml']

// Which group an item's unit price is ranked in, or null when it has none
function unitGroup(item: SortableRow['item']): number | null {
  if (item.unit === null || item.unit_price_cents === null) return null
  return UNIT_ORDER.indexOf(item.unit)
}

// Clicking a header: a new column starts ascending, the same one goes descending, then back to the original order
export function nextSort(current: SortState | null, column: SortColumn): SortState | null {
  if (current === null || current.column !== column) return { column, direction: 'asc' }
  return current.direction === 'asc' ? { column, direction: 'desc' } : null
}

// Compares two values that may be missing. A missing one is always last, whichever way the column is sorted.
function compareOptional(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return direction === 'asc' ? a - b : b - a
}

// The rows in the order the sort asks for, as a new array. No sort gives the rows back in the order they came in, and
// two rows that tie stay in the order they came in.
export function sortRows<T extends SortableRow>(rows: T[], sort: SortState | null): T[] {
  if (sort === null) return rows
  const { column, direction } = sort
  return [...rows].sort((a, b) => {
    switch (column) {
      case 'name': {
        const byName = a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' })
        return direction === 'asc' ? byName : -byName
      }
      case 'price':
        return compareOptional(a.item.price_cents, b.item.price_cents, direction)
      case 'unit-price': {
        const aGroup = unitGroup(a.item)
        const bGroup = unitGroup(b.item)
        if (aGroup === null || bGroup === null) return compareOptional(aGroup, bGroup, direction)
        if (aGroup !== bGroup) return aGroup - bGroup
        return compareOptional(a.item.unit_price_cents, b.item.unit_price_cents, direction)
      }
    }
  })
}
