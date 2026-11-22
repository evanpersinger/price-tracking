import type { SortColumn, SortState } from './sortRows.ts'

interface SortableHeaderProps {
  column: SortColumn
  label: string
  className: string
  sort: SortState | null
  onSort: (column: SortColumn) => void
}

// A column header that sorts its table when clicked, with a small arrow while it is the one sorted
export function SortableHeader({ column, label, className, sort, onSort }: SortableHeaderProps) {
  const direction = sort?.column === column ? sort.direction : null
  return (
    <th
      scope="col"
      className={className}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined}
    >
      <button type="button" className="sort-button" onClick={() => onSort(column)}>
        {label}
        {/* Always there, only hidden while unsorted, so the header doesn't change width when it gets sorted */}
        <svg
          className="sort-arrow"
          viewBox="0 0 10 10"
          width="10"
          height="10"
          aria-hidden="true"
          style={{
            visibility: direction === null ? 'hidden' : 'visible',
            transform: direction === 'desc' ? 'scaleY(-1)' : undefined,
          }}
        >
          <path d="M1 7L5 2L9 7Z" fill="currentColor" />
        </svg>
      </button>
    </th>
  )
}
