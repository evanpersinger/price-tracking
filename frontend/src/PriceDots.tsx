import type { HistoryEntry } from './types.ts'

const WIDTH = 1000
const HEIGHT = 360
const PAD = { left: 100, right: 30, top: 24, bottom: 50 }
const TICKS = 4
// One color per store, from the page's own text colors, cycling if there are more stores than colors
const DOT_COLORS = ['--store', '--item', '--amount', '--unit-price', '--price', '--discount']

// The day a dot sits on across the graph, purchases on the same day line up and differ only in height
function timeOf(entry: HistoryEntry): number {
  return Date.parse(`${entry.purchased_on}T12:00`)
}

interface PriceDotsProps {
  entries: HistoryEntry[] // purchases of one item, in any order
  value: (entry: HistoryEntry) => number | null // what each dot's height is, null leaves that purchase off
  format: (value: number) => string // how a height reads on the axis and in the hover text
}

// An item's price over time as dots, one per purchase, colored by store, with no line joining them
export function PriceDots({ entries, value, format }: PriceDotsProps) {
  const dots = entries.flatMap((entry) => {
    const height = value(entry)
    return height === null ? [] : [{ entry, height, time: timeOf(entry) }]
  })
  if (dots.length === 0) return null

  const stores = [...new Set(dots.map((dot) => dot.entry.store_name))].sort()
  const colorOf = (store: string) => `var(${DOT_COLORS[stores.indexOf(store) % DOT_COLORS.length]})`

  const firstTime = Math.min(...dots.map((dot) => dot.time))
  const lastTime = Math.max(...dots.map((dot) => dot.time))
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

  const days = [...new Set(dots.map((dot) => dot.entry.purchased_on))].sort()
  const firstDay = days[0]
  const lastDay = days[days.length - 1]

  return (
    <>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="dot-graph" role="img" aria-label="Price of the item over time">
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
          <text x={PAD.left + plotWidth / 2} y={HEIGHT - 14} textAnchor="middle">
            {firstDay}
          </text>
        ) : (
          <>
            <text x={PAD.left} y={HEIGHT - 14} textAnchor="start">
              {firstDay}
            </text>
            <text x={WIDTH - PAD.right} y={HEIGHT - 14} textAnchor="end">
              {lastDay}
            </text>
          </>
        )}
        {dots.map(({ entry, height, time }) => (
          <circle key={entry.id} cx={xOf(time)} cy={yOf(height)} r={8} style={{ fill: colorOf(entry.store_name) }}>
            <title>
              {`${entry.store_name}, ${entry.purchased_on}, ${format(height)}`}
            </title>
          </circle>
        ))}
      </svg>
      <ul className="dot-legend">
        {stores.map((store) => (
          <li key={store}>
            <span className="dot-swatch" style={{ background: colorOf(store) }} />
            {store}
          </li>
        ))}
      </ul>
    </>
  )
}
