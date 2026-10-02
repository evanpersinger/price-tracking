import { useState } from 'react'
import { AbbreviationsView } from './AbbreviationsView.tsx'
import { CheapestView } from './CheapestView.tsx'
import { COUNTRIES } from './countries.ts'
import { ReceiptModal } from './ReceiptModal.tsx'
import { ReceiptReview } from './ReceiptReview.tsx'
import { StoresView } from './StoresView.tsx'
import type { ReceiptResult } from './types.ts'

const CHEAPEST_PATH = '/cheapest'
const ABBREVIATIONS_PATH = '/abbreviations'

export default function App() {
  // The address picks the page, so each one can be opened in its own browser window. The stores and cheapest pages
  // are both one per country (/ca, /us, /cheapest/ca, /cheapest/us), the abbreviations page shows neither in
  // particular. Anything else shows the Canadian stores.
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '')
  const showCheapest = path.startsWith(CHEAPEST_PATH)
  const showAbbreviations = path.startsWith(ABBREVIATIONS_PATH)
  const showStores = !showCheapest && !showAbbreviations
  const countryNavBase = showCheapest ? CHEAPEST_PATH : ''
  const country = showCheapest
    ? (COUNTRIES.find((candidate) => path === `${CHEAPEST_PATH}${candidate.path}`) ?? COUNTRIES[0])
    : (COUNTRIES.find((candidate) => path.startsWith(candidate.path)) ?? COUNTRIES[0])

  // The modal reads the receipt, the review page then shows what was found until it's added or cancelled. The id
  // gives each receipt its own review state, so a new one never inherits the edits of the last.
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [review, setReview] = useState<{ id: number; result: ReceiptResult } | null>(null)

  return (
    // A dropped file outside the modal must do nothing, not open the image in the tab
    <div className="page" onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()}>
      {review === null && (
        <button type="button" className="add-item-button" onClick={() => setIsReceiptModalOpen(true)}>
          Add Item
        </button>
      )}
      {isReceiptModalOpen && (
        <ReceiptModal
          onClose={() => setIsReceiptModalOpen(false)}
          onResult={(result) => setReview((previous) => ({ id: (previous?.id ?? 0) + 1, result }))}
        />
      )}
      <header className="header">
        <h1>Price Tracking</h1>
        {(showStores || showCheapest) && (
          <div className="country-nav-wrap">
            <nav className="nav country-nav" aria-label="Country">
              {COUNTRIES.map((link) => (
                <a
                  key={link.code}
                  className="nav-link"
                  href={`${countryNavBase}${link.path}`}
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
      {review === null && (
        <nav className="nav view-nav" aria-label="View">
          <a className="nav-link" href={country.path} aria-current={showStores ? 'page' : undefined}>
            Stores
          </a>
          <a
            className="nav-link"
            href={`${CHEAPEST_PATH}${country.path}`}
            aria-current={showCheapest ? 'page' : undefined}
          >
            Cheapest items
          </a>
          <a className="nav-link" href={ABBREVIATIONS_PATH} aria-current={showAbbreviations ? 'page' : undefined}>
            Abbreviations
          </a>
        </nav>
      )}
      <main>
        {review ? (
          <ReceiptReview key={review.id} result={review.result} onDone={() => setReview(null)} />
        ) : showCheapest ? (
          <CheapestView country={country.code} />
        ) : showAbbreviations ? (
          <AbbreviationsView />
        ) : (
          <StoresView country={country.code} />
        )}
      </main>
    </div>
  )
}
