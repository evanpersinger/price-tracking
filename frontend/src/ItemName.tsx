import { labelSegments } from './format.ts'

interface ItemNameProps {
  label: string
}

// An item's name with its amounts and typed unit price each in their own color
export function ItemName({ label }: ItemNameProps) {
  return (
    <>
      {labelSegments(label).map((segment) => (
        <span key={segment.start} className={`item-${segment.kind}`}>
          {segment.text}
        </span>
      ))}
    </>
  )
}
