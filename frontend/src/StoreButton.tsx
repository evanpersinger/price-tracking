import { storeLogo } from './storeLogos.ts'

interface StoreButtonProps {
  name: string
  selected: boolean
  onClick: () => void
}

// One store's button in the row above the tables, shared by the Store Prices, Gas Prices, Cheapest items and Price
// Tracking pages. The logo is decoration (the name is right beside it), and a store with no logo file is just its name.
export function StoreButton({ name, selected, onClick }: StoreButtonProps) {
  const logo = storeLogo(name)
  return (
    <button type="button" className="nav-link" aria-current={selected ? 'true' : undefined} onClick={onClick}>
      {name}
      {logo && <img className="store-logo" src={logo} alt="" />}
    </button>
  )
}
