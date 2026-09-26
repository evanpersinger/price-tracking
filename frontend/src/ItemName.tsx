import type { Segment } from './format.ts'

interface ItemNameProps {
  segments: Segment[]
}

// An item's name with its typed unit price in its own color
export function ItemName({ segments }: ItemNameProps) {
  return (
    <>
      {segments.map((segment) => (
        <span key={segment.start} className={`item-${segment.kind}`}>
          {segment.text}
        </span>
      ))}
    </>
  )
}
