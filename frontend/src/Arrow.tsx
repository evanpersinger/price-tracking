interface ArrowProps {
  direction: 'left' | 'right'
}

export function Arrow({ direction }: ArrowProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: direction === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <path d="M8 4l8 8-8 8" />
    </svg>
  )
}
