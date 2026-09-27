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

  return (
    <div className="page">
      <header className="header">
        <h1>Price Tracking</h1>
        {showStores && (
          <nav className="nav" aria-label="Country">
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
          <>
            <p className="currency-note">Prices in {country.currency}</p>
            <StoresView country={country.code} />
          </>
        )}
      </main>
    </div>
  )
}
