import { CheapestView } from './CheapestView.tsx'
import { COUNTRIES } from './countries.ts'
import { StoresView } from './StoresView.tsx'

const CHEAPEST_PATH = '/cheapest'

export default function App() {
  // The address picks the page, so each one can be opened in its own browser window. The stores pages are one per
  // country (/ca and /us), the cheapest page shows both. Anything else shows the Canadian stores.
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '')
  const showCheapest = path.startsWith(CHEAPEST_PATH)
  const country = COUNTRIES.find((candidate) => path.startsWith(candidate.path)) ?? COUNTRIES[0]

  return (
    <div className="page">
      <header className="header">
        <h1>Grocery prices</h1>
        {!showCheapest && (
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
        <a className="nav-link" href={country.path} aria-current={showCheapest ? undefined : 'page'}>
          Stores
        </a>
        <a className="nav-link" href={CHEAPEST_PATH} aria-current={showCheapest ? 'page' : undefined}>
          Cheapest items
        </a>
      </nav>
      <main>
        {showCheapest ? (
          <CheapestView />
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
