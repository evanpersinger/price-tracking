import type { HistoryEntry } from './types.ts'

const WIDTH = 1000
const HEIGHT = 360
const PAD = { left: 100, right: 30, top: 40, bottom: 70 }
const TICKS = 4

// The day a dot sits on across the graph, purchases on the same day line up and differ only in height
function timeOf(entry: HistoryEntry): number {
  return Date.parse(`${entry.purchased_on}T12:00`)
}

interface PriceDotsProps {
  entries: HistoryEntry[] // purchases of one item at one store, in any order
  value: (entry: HistoryEntry) => number | null // what each dot's height is, null leaves that purchase off
  format: (value: number) => string // how a height reads on the axis and in the hover text
  priceLabel: string // the title of the price axis, "Price" or "Price per litre" for gas
}

// An item's price at one store over time: one dot per purchase, with a line through them in date order
export function PriceDots({ entries, value, format, priceLabel }: PriceDotsProps) {
  const dots = entries
    .flatMap((entry) => {
      const height = value(entry)
      return height === null ? [] : [{ entry, height, time: timeOf(entry) }]
    })
    .sort((a, b) => a.time - b.time || a.entry.id - b.entry.id)
  if (dots.length === 0) return null

  const firstTime = dots[0].time
  const lastTime = dots[dots.length - 1].time
  const low = Math.min(...dots.map((dot) => dot.height))
  const high = Math.max(...dots.map((dot) => dot.height))
  // Room above and below the dots, and a range that is one price still gets a little height to sit in
  const span = high - low || high * 0.1 || 1
  const axisLow = Math.max(0, low - span * 0.2)
  const axisHigh = high + span * 0.2

  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const xOf = (time: number) =>
    PAD.left + (lastTime === firstTime ? plotWidth / 2 : ((time - firstTime) / (lastTime - firstTime)) * plotWidth)
  const yOf = (height: number) => PAD.top + plotHeight - ((height - axisLow) / (axisHigh - axisLow)) * plotHeight
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => axisLow + ((axisHigh - axisLow) * index) / TICKS)

  const firstDay = dots[0].entry.purchased_on
  const lastDay = dots[dots.length - 1].entry.purchased_on
  const dateY = HEIGHT - 38

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
      {firstDay === lastDay ? (
        <text x={PAD.left + plotWidth / 2} y={dateY} textAnchor="middle">
          {firstDay}
        </text>
      ) : (
        <>
          <text x={PAD.left} y={dateY} textAnchor="start">
            {firstDay}
          </text>
          <text x={WIDTH - PAD.right} y={dateY} textAnchor="end">
            {lastDay}
          </text>
        </>
      )}
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
