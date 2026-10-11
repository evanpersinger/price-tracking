import type { HistoryEntry } from './types.ts'

const WIDTH = 1000
const HEIGHT = 360
const PAD = { left: 100, right: 60, top: 40, bottom: 70 }
const TICKS = 5
// The first day on the date axis sits this far in from the price axis line, so its dot doesn't sit on top of the line
const DOT_INSET = 20
// Two dates closer than this across the axis would run into each other, so the later one goes unwritten
const MIN_DATE_GAP = 100

// The day a dot sits on across the graph, purchases on the same day line up and differ only in height
function timeOf(entry: HistoryEntry): number {
  return Date.parse(`${entry.purchased_on}T12:00`)
}

// From marks in order along an axis, the ones that sit at least `gap` past the last one kept, so labels don't overlap
function spacedOut<T extends { pos: number }>(marks: T[], gap: number): T[] {
  const kept: T[] = []
  for (const mark of marks) {
    if (kept.length === 0 || mark.pos - kept[kept.length - 1].pos >= gap) kept.push(mark)
  }
  return kept
}

interface PriceDotsProps {
  entries: HistoryEntry[] // purchases of one item at one store, in any order
  value: (entry: HistoryEntry) => number | null // what each dot's height is, null leaves that purchase off
  format: (value: number) => string // how a height reads on the axis and in the hover text
  priceLabel: string // the title of the price axis, "Price" or "Price per litre" for gas
  axisMax: number // the price axis runs from 0 up to this, or the next multiple of it if a dot is higher
  start: string // the first and last day the date axis covers, as YYYY-MM-DD, purchases outside them don't belong here,
  // and the first one is where the leftmost dot sits
  end: string
}

// An item's price at one store over time: one dot per purchase, with a line through them in date order, and each
// dot's date written under it
export function PriceDots({ entries, value, format, priceLabel, axisMax, start, end }: PriceDotsProps) {
  const dots = entries
    .flatMap((entry) => {
      const height = value(entry)
      return height === null ? [] : [{ entry, height, time: timeOf(entry) }]
    })
    .sort((a, b) => a.time - b.time || a.entry.id - b.entry.id)
  if (dots.length === 0) return null

  const startTime = Date.parse(`${start}T12:00`)
  const endTime = Date.parse(`${end}T12:00`)
  const high = Math.max(...dots.map((dot) => dot.height))
  const axisHigh = Math.ceil(high / axisMax) * axisMax

  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  // A start day that is also the end day (the first purchase was today) has no width to spread over, it sits at the start
  const xOf = (time: number) =>
    PAD.left + DOT_INSET + ((time - startTime) / (endTime - startTime || 1)) * (plotWidth - DOT_INSET)
  const yOf = (height: number) => PAD.top + plotHeight - (height / axisHigh) * plotHeight
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => (axisHigh * index) / TICKS)

  const axisY = PAD.top + plotHeight
  const dateY = HEIGHT - 38
  // A tick and the date under each purchase day, left to right, leaving out a date that wouldn't fit after the last
  // one (the dot's hover text still has it)
  const dates = spacedOut(
    [...new Map(dots.map((dot) => [dot.entry.purchased_on, xOf(dot.time)]))].map(([day, pos]) => ({ day, pos })),
    MIN_DATE_GAP,
  )

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="dot-graph" role="img" aria-label="Price of the item over time">
      <text x={PAD.left - 12} y={PAD.top - 20} textAnchor="end">
        {priceLabel}
      </text>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={yOf(tick)}
            y2={yOf(tick)}
            stroke="var(--table-border)"
            strokeDasharray="4 6"
          />
          <text x={PAD.left - 12} y={yOf(tick) + 5} textAnchor="end">
            {format(tick)}
          </text>
        </g>
      ))}
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={axisY} y2={axisY} stroke="var(--text-muted)" strokeWidth={2} />
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={axisY} stroke="var(--text-muted)" strokeWidth={2} />
      {dates.map(({ day, pos }) => (
        <g key={day}>
          <line x1={pos} x2={pos} y1={axisY} y2={axisY + 6} stroke="var(--text-muted)" strokeWidth={2} />
          <text x={pos} y={dateY} textAnchor="middle">
            {day}
          </text>
        </g>
      ))}
      <text x={PAD.left + plotWidth / 2} y={HEIGHT - 10} textAnchor="middle">
        Date
      </text>
      <polyline
        points={dots.map((dot) => `${xOf(dot.time)},${yOf(dot.height)}`).join(' ')}
        fill="none"
        stroke="var(--price)"
        strokeWidth={2}
      />
      {dots.map(({ entry, height, time }) => (
        <circle key={entry.id} cx={xOf(time)} cy={yOf(height)} r={8} style={{ fill: 'var(--price)' }}>
          <title>{`${entry.purchased_on}, ${format(height)}`}</title>
        </circle>
      ))}
    </svg>
  )
}
