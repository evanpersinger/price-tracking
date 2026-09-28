import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AbbreviationsView } from './AbbreviationsView.tsx'
import { CheapestView } from './CheapestView.tsx'
import { COUNTRIES } from './countries.ts'
import { StoresView } from './StoresView.tsx'

const CHEAPEST_PATH = '/cheapest'
const ABBREVIATIONS_PATH = '/abbreviations'

export default function App() {
  // The address picks the page, so each one can be opened in its own browser window. The stores pages are one per
  // country (/ca and /us), the cheapest and abbreviations pages show neither in particular. Anything else shows the
  // Canadian stores.
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '')
  const showCheapest = path.startsWith(CHEAPEST_PATH)
  const showAbbreviations = path.startsWith(ABBREVIATIONS_PATH)
  const showStores = !showCheapest && !showAbbreviations
  const country = COUNTRIES.find((candidate) => path.startsWith(candidate.path)) ?? COUNTRIES[0]

  // Picking or dropping a file is wired up, what happens with it isn't yet: reading the receipt and adding its
  // items comes next.
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const [, setReceiptFile] = useState<File | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingFile(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingFile(false)
    const file = event.dataTransfer.files[0]
    if (file) setReceiptFile(file)
  }

  return (
    <div
      className={isDraggingFile ? 'page page-drag-over' : 'page'}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button type="button" className="add-item-button" onClick={() => receiptInputRef.current?.click()}>
        Add Item
      </button>
      <input
        ref={receiptInputRef}
        type="file"
        accept="image/*"
        className="add-item-input"
        onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
      />
      <header className="header">
        <h1>Price Tracking</h1>
        {showStores && (
          <div className="country-nav-wrap">
            <nav className="nav country-nav" aria-label="Country">
              {COUNTRIES.map((link) => (
                <a
                  key={link.code}
                  className="nav-link"
                  href={link.path}
                  aria-current={link.code === country.code ? 'page' : undefined}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <p className="currency-note">Currency: {country.currency}</p>
          </div>
        )}
      </header>
      <nav className="nav view-nav" aria-label="View">
        <a className="nav-link" href={country.path} aria-current={showStores ? 'page' : undefined}>
          Stores
        </a>
        <a className="nav-link" href={CHEAPEST_PATH} aria-current={showCheapest ? 'page' : undefined}>
          Cheapest items
        </a>
        <a className="nav-link" href={ABBREVIATIONS_PATH} aria-current={showAbbreviations ? 'page' : undefined}>
          Abbreviations
        </a>
      </nav>
      <main>
        {showCheapest ? (
          <CheapestView />
        ) : showAbbreviations ? (
          <AbbreviationsView />
        ) : (
          <StoresView country={country.code} />
        )}
      </main>
    </div>
  )
}
