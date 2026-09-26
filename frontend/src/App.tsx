import { StoreTable } from './StoreTable.tsx'
import { useStores } from './useStores.ts'
import type { StoresState } from './useStores.ts'
import type { Country } from './types.ts'

interface CountryPage {
  code: Country
  path: string
  label: string
  currency: string
}

const PAGES: CountryPage[] = [
  { code: 'CA', path: '/ca', label: 'Canada', currency: 'CAD' },
  { code: 'US', path: '/us', label: 'USA', currency: 'USD' },
]

// The address picks the country, so each one can be opened in its own browser window. Anything else shows Canada.
function pageForPath(pathname: string): CountryPage {
  return PAGES.find((page) => pathname.toLowerCase().startsWith(page.path)) ?? PAGES[0]
}

interface StoreListProps {
  state: StoresState
  country: Country
}

function StoreList({ state, country }: StoreListProps) {
  if (state.status === 'loading') {
    return <p className="status" role="status">Loading prices</p>
  }

  if (state.status === 'error') {
    return (
      <div className="status" role="alert">
        <p>Could not load prices. Make sure the backend is running, then try again.</p>
        <button type="button" className="retry" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  }

  const stores = state.stores.filter((store) => store.items.length > 0)
  if (stores.length === 0) {
    return <p className="status">No prices added yet.</p>
  }

  return (
    <>
      {stores.map((store) => (
        <StoreTable key={store.id} store={store} country={country} />
      ))}
    </>
  )
}

export default function App() {
  const page = pageForPath(window.location.pathname)
  const state = useStores(page.code)

  return (
    <div className="page">
      <header className="header">
        <h1>Grocery prices</h1>
        <nav className="nav" aria-label="Country">
          {PAGES.map((link) => (
            <a
              key={link.code}
              className="nav-link"
              href={link.path}
              aria-current={link.code === page.code ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <p className="currency-note">Prices in {page.currency}</p>
      <main>
        <StoreList state={state} country={page.code} />
      </main>
    </div>
  )
}
