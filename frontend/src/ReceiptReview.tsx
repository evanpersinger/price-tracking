import { useState } from 'react'
import { addItem } from './api.ts'
import { COUNTRIES } from './countries.ts'
import { splitItemCode } from './itemCode.ts'
import { guessCountry } from './guessCountry.ts'
import { pricePerLitre } from './fuel.ts'
import { findKnownItem } from './knownItems.ts'
import { matchSavedStore } from './matchSavedStore.ts'
import { litresIn } from './quantityInfo.ts'
import { useLoad } from './useLoad.ts'
import { formatPrice } from './format.ts'
import type { Country, Item, NewItem, ReceiptItem, ReceiptResult, Store } from './types.ts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const NO_BRAND = 'No Brand' // what a blank brand is saved as, see DATA_CONVENTIONS.md

interface Props {
  result: ReceiptResult
  onDone: () => void
}

type RowStatus = 'idle' | 'saving' | 'added' | 'failed'

// What the size number is in. 'none' is for items sold as identical units (soda cans), where the count is the size.
const SIZE_UNITS = ['g', 'ml', 'L', 'none'] as const
export type SizeUnit = (typeof SIZE_UNITS)[number]

function toUnit(value: string): SizeUnit | '' {
  return SIZE_UNITS.find((unit) => unit === value) ?? ''
}

// One receipt item as it's being edited: every field is the text in its input box
interface Row {
  id: number
  rawName: string // as printed, without the code
  code: string | undefined // the store's product code on that line, if it prints one
  quantityInfo: string // a "3 @ 2.79" line printed under the item, empty if none
  name: string
  price: string
  count: string
  size: string
  unit: SizeUnit | '' // '' until the user picks one, there is no default
  brand: string
  fuelType: string // what the fuel is on a gas receipt, empty for every other row
  hasNoSize: boolean // a known item sold by count alone (like toilet paper), so the size box and unit are left out
  known: boolean // matched an entry in knownItems.ts, which wins over a saved item
  saved: Item | null // the item already in this store with the same code, saving overwrites it
  include: boolean
  status: RowStatus
  error: string | null
}

type RowFields = Pick<NewItem, 'name' | 'price_cents' | 'item_count' | 'weight_g' | 'volume_ml' | 'brand' | 'fuel_type'>

function toRow(item: ReceiptItem, id: number, store: string): Row {
  const known = findKnownItem(store, item.raw_name ?? '')
  const printed = splitItemCode(item.raw_name ?? '')
  // A fuel receipt prints its size, so a litre line makes it one item of that many litres without being typed
  const litres = litresIn(item.quantity_info)
  return {
    id,
    rawName: printed.name,
    code: printed.code,
    quantityInfo: item.quantity_info ?? '',
    name: known?.name ?? (litres ? 'Gas' : item.item_name || item.raw_name || ''),
    price: typeof item.price === 'number' ? String(item.price) : '',
    count: known ? String(known.count) : litres ? '1' : '',
    size: known?.size !== undefined ? String(known.size) : (litres ?? ''),
    unit: known?.unit ?? (litres ? 'L' : ''),
    brand: known?.brand ?? '',
    fuelType: litres ? (item.fuel_type || item.raw_name || '') : '',
    hasNoSize: known?.unit === 'none',
    known: known !== undefined,
    saved: null,
    include: true,
    status: 'idle',
    error: null,
  }
}

// Fills a row from the item the store already has under the same code. The price stays the receipt's.
function fillFromSaved(row: Row, storeItems: Item[]): Row {
  if (row.known || row.code === undefined) return row
  const saved = storeItems.find((item) => item.item_code === row.code)
  if (saved === undefined) return row

  const unit: SizeUnit = saved.weight_g !== null ? 'g' : saved.volume_ml !== null ? 'ml' : 'none'
  const size = saved.weight_g ?? saved.volume_ml
  return {
    ...row,
    saved,
    name: saved.name,
    brand: saved.brand ?? '',
    count: saved.item_count === null ? '' : String(saved.item_count),
    size: size === null ? '' : String(size),
    unit,
  }
}

function parsePositive(text: string): number | null {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

// What a row still needs before it can be added, and the fields to send once it needs nothing
function checkRow(row: Row): { problems: string[]; fields: RowFields | null } {
  const price = parsePositive(row.price)
  const count = parsePositive(row.count)
  const size = parsePositive(row.size)

  const problems: string[] = []
  if (!row.name.trim()) problems.push('name')
  if (price === null || Math.round(price * 100) < 1) problems.push('price')
  if (count === null) problems.push('count')
  else if (!Number.isInteger(count)) problems.push('whole-number count')
  if (row.unit === '') problems.push('unit')
  else if (row.unit !== 'none' && size === null) problems.push('size')
  if (problems.length > 0 || price === null || count === null) return { problems, fields: null }

  return {
    problems,
    fields: {
      name: row.name.trim(),
      price_cents: Math.round(price * 100),
      item_count: count,
      weight_g: row.unit === 'g' ? (size ?? undefined) : undefined,
      volume_ml: row.unit === 'ml' ? (size ?? undefined) : row.unit === 'L' && size !== null ? Math.round(size * 1000) : undefined,
      brand: row.brand.trim() || NO_BRAND,
      fuel_type: row.fuelType.trim() || undefined,
    },
  }
}

function rowStatus(row: Row, problems: string[]): { text: string; className: string } {
  if (row.status === 'added') return { text: 'Added', className: 'row-status row-status-good' }
  if (row.status === 'saving') return { text: 'Saving...', className: 'row-status' }
  if (row.status === 'failed') return { text: row.error ?? 'Failed', className: 'row-status row-status-bad' }
  if (!row.include) return { text: 'Skipped', className: 'row-status' }
  if (problems.length > 0) return { text: `Needs ${problems.join(', ')}`, className: 'row-status row-status-warn' }
  return { text: 'Ready', className: 'row-status row-status-good' }
}

export function ReceiptReview({ result, onDone }: Props) {
  const [pickedCountry, setPickedCountry] = useState<Country | null>(null)
  const [typedStore, setTypedStore] = useState<string | null>(null) // null until the person edits the store box
  const receiptStore = result.store ?? ''
  // A litre line means a fuel receipt, where a brand makes no sense, so the Brand column becomes Fuel type and the item
  // saves as No Brand
  const isFuelReceipt = (result.items ?? []).some((item) => litresIn(item.quantity_info) !== undefined)
  // Left blank when the receipt's date couldn't be read, nothing is guessed, and an item with no date isn't recorded in
  // the price history
  const [date, setDate] = useState(result.purchase_date && ISO_DATE.test(result.purchase_date) ? result.purchase_date : '')
  const [rows, setRows] = useState<Row[]>(() =>
    (result.items ?? []).map((item, index) => toRow(item, index, result.store ?? '')),
  )
  const [isSaving, setIsSaving] = useState(false)

  const caStores = useLoad<Store[]>('/api/stores?country=CA')
  const usStores = useLoad<Store[]>('/api/stores?country=US')
  // The person's pick wins, otherwise the country the store name points to, when only one country has that store
  const guessedCountry =
    caStores.status === 'ready' && usStores.status === 'ready'
      ? guessCountry(typedStore ?? receiptStore, result.store_address, caStores.data, usStores.data)
      : null
  const country = pickedCountry ?? guessedCountry
  const storeState = country === 'CA' ? caStores : country === 'US' ? usStores : null
  const storeList = storeState?.status === 'ready' ? storeState.data : null

  // The saved store the receipt's name points to ("Costco 530" for "Costco") fills the store box, until the person types
  const matchedStore = storeList !== null && typedStore === null ? matchSavedStore(receiptStore, storeList) : null
  const store = typedStore ?? matchedStore?.name ?? receiptStore

  const trimmedStore = store.trim()
  const countryLabel = COUNTRIES.find((candidate) => candidate.code === country)?.label ?? ''
  // Same match the server makes: a store in that country with the same name, ignoring case
  const existingStore = storeList?.find((candidate) => candidate.name.toLowerCase() === trimmedStore.toLowerCase())

  // Once the store is known to exist, rows whose code it already has are filled in from its saved items (once per store)
  const [filledFor, setFilledFor] = useState<number | null>(null)
  const existingStoreId = existingStore?.id ?? null
  if (existingStoreId !== filledFor) {
    setFilledFor(existingStoreId)
    if (existingStore) setRows((current) => current.map((row) => fillFromSaved(row, existingStore.items)))
  }

  const readyRows = rows.filter((row) => row.include && row.status !== 'added' && checkRow(row).fields !== null)
  const countLabel = `${readyRows.length} ${readyRows.length === 1 ? 'item' : 'items'}`
  const targetLabel = existingStore ? existingStore.name : `new store "${trimmedStore}"`
  const saveLabel = isSaving
    ? 'Saving...'
    : storeList !== null && trimmedStore !== ''
      ? `Add ${countLabel} to ${targetLabel}`
      : `Add ${countLabel}`
  const canSave = country !== null && trimmedStore !== '' && storeList !== null && readyRows.length > 0 && !isSaving

  function patchRow(id: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  async function save() {
    if (country === null) return
    setIsSaving(true)
    for (const row of readyRows) {
      const fields = checkRow(row).fields
      if (fields === null) continue
      patchRow(row.id, { status: 'saving', error: null })
      try {
        await addItem({
          country,
          store: trimmedStore,
          purchased_on: date || undefined,
          ...fields,
          item_code: row.code,
        })
        patchRow(row.id, { status: 'added' })
      } catch (caught) {
        patchRow(row.id, { status: 'failed', error: caught instanceof Error ? caught.message : 'Something went wrong' })
      }
    }
    setIsSaving(false)
  }

  function renderStoreBanner() {
    if (country === null) return <p className="store-banner">Pick a country to see which store this goes to.</p>
    if (trimmedStore === '') return <p className="store-banner store-banner-warn">Enter the store name.</p>
    if (storeState?.status === 'loading') return <p className="store-banner">Checking {countryLabel} stores...</p>
    if (storeList === null) {
      return (
        <p className="store-banner store-banner-warn">
          Couldn&apos;t load the {countryLabel} stores, so there&apos;s no way to tell whether this store exists.
        </p>
      )
    }
    if (existingStore) return null // nothing to warn about, the Add button names the store
    return (
      <p className="store-banner store-banner-warn">
        <strong>&quot;{trimmedStore}&quot;</strong> isn&apos;t an existing {countryLabel} store, a new one will be created.
      </p>
    )
  }

  const hasAdded = rows.some((row) => row.status === 'added')

  return (
    <section className="review">
      <h2 className="page-heading">Review receipt</h2>

      <div className="review-controls">
        <div className="review-field">
          <span className="review-label">Country</span>
          <nav className="nav" aria-label="Country">
            {COUNTRIES.map((candidate) => (
              <button
                key={candidate.code}
                type="button"
                className="nav-link country-pick"
                aria-current={candidate.code === country ? 'true' : undefined}
                disabled={isSaving}
                onClick={() => setPickedCountry(candidate.code)}
              >
                {candidate.label}
              </button>
            ))}
          </nav>
        </div>
        <label className="review-field">
          <span className="review-label">Store</span>
          <input
            className="review-input review-input-store"
            list="receipt-stores"
            value={store}
            disabled={isSaving}
            onChange={(event) => setTypedStore(event.target.value)}
          />
          <datalist id="receipt-stores">
            {storeList?.map((candidate) => <option key={candidate.id} value={candidate.name} />)}
          </datalist>
        </label>
        <label className="review-field">
          <span className="review-label">Date</span>
          <input
            className="review-input"
            type="date"
            value={date}
            disabled={isSaving}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>

      {renderStoreBanner()}

      {rows.length === 0 ? (
        <p className="status">No items were found on this receipt.</p>
      ) : (
        <div className="review-table-wrap">
          <table className="items">
            <thead>
              <tr>
                <th>Add</th>
                <th>Item name</th>
                <th>Price</th>
                {!isFuelReceipt && <th>Count</th>}
                {isFuelReceipt ? (
                  <>
                    <th>Litres</th>
                    <th>Price per litre</th>
                  </>
                ) : (
                  <th className="has-tip" tabIndex={0} aria-describedby="size-tip">
                    Size (whole pack)
                    <span id="size-tip" role="tooltip" className="tip">
                      The total size of everything in the pack, not each item. For example, 6 boxes of 454g is 2724g.
                    </span>
                  </th>
                )}
                {isFuelReceipt ? (
                  <th>Fuel type</th>
                ) : (
                  <th className="has-tip" tabIndex={0} aria-describedby="brand-tip">
                    Brand
                    <span id="brand-tip" role="tooltip" className="tip tip-right">
                      Enter the brand name as accurately as possible. Upper and lowercase don't matter.
                    </span>
                  </th>
                )}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const { problems } = checkRow(row)
                const status = rowStatus(row, problems)
                const locked = isSaving || row.status === 'added'
                const rowNumber = index + 1
                const fuelPrice = parsePositive(row.price)
                const litres = parsePositive(row.size)
                const litrePrice =
                  fuelPrice !== null && litres !== null
                    ? pricePerLitre(Math.round(fuelPrice * 100), litres * 1000, country ?? 'CA')
                    : null
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Add item ${rowNumber}`}
                        checked={row.include}
                        disabled={locked}
                        onChange={(event) => patchRow(row.id, { include: event.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className="review-input review-input-name"
                        aria-label={`Name of item ${rowNumber}`}
                        value={row.name}
                        disabled={locked}
                        onChange={(event) => patchRow(row.id, { name: event.target.value })}
                      />
                      {!isFuelReceipt && (
                        <div className="raw-name">
                          Printed as {row.rawName || 'nothing'}
                          {row.code ? `, code ${row.code}` : ''}
                        </div>
                      )}
                      {!isFuelReceipt && row.quantityInfo && (
                        <div className="raw-name">Quantity line: {row.quantityInfo}</div>
                      )}
                      {row.saved && country !== null && (
                        <div className="raw-name">
                          Matched saved item, overwrites its price of{' '}
                          {row.saved.price_cents === null ? 'nothing' : formatPrice(row.saved.price_cents, country)}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        className="review-input review-input-number"
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Price of item ${rowNumber} in dollars`}
                        value={row.price}
                        disabled={locked}
                        onChange={(event) => patchRow(row.id, { price: event.target.value })}
                      />
                    </td>
                    {!isFuelReceipt && (
                      <td>
                        <input
                          className="review-input review-input-number"
                          type="number"
                          min="1"
                          step="1"
                          aria-label={`Count of item ${rowNumber}`}
                          value={row.count}
                          disabled={locked}
                          onChange={(event) => patchRow(row.id, { count: event.target.value })}
                        />
                      </td>
                    )}
                    <td>
                      {isFuelReceipt && (
                        <input
                          className="review-input review-input-number"
                          type="number"
                          min="0"
                          step="any"
                          aria-label={`Litres of item ${rowNumber}`}
                          value={row.size}
                          disabled={locked}
                          onChange={(event) => patchRow(row.id, { size: event.target.value })}
                        />
                      )}
                      {!isFuelReceipt && !row.hasNoSize && (
                        <div className="review-size">
                          <input
                            className="review-input review-input-number"
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`Size of item ${rowNumber}`}
                            value={row.size}
                            disabled={locked || row.unit === 'none' || row.unit === ''}
                            onChange={(event) => patchRow(row.id, { size: event.target.value })}
                          />
                          <select
                            className="review-input"
                            aria-label={`Size unit of item ${rowNumber}`}
                            value={row.unit}
                            disabled={locked}
                            onChange={(event) => {
                              const unit = toUnit(event.target.value)
                              patchRow(row.id, unit === 'none' ? { unit, size: '' } : { unit })
                            }}
                          >
                            <option value="">Unit</option>
                            {SIZE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    {isFuelReceipt && <td>{litrePrice}</td>}
                    <td>
                      {isFuelReceipt ? (
                        <input
                          className="review-input"
                          aria-label={`Fuel type of item ${rowNumber}`}
                          value={row.fuelType}
                          disabled={locked}
                          onChange={(event) => patchRow(row.id, { fuelType: event.target.value })}
                        />
                      ) : (
                        <input
                          className="review-input"
                          aria-label={`Brand of item ${rowNumber}`}
                          value={row.brand}
                          disabled={locked}
                          onChange={(event) => patchRow(row.id, { brand: event.target.value })}
                        />
                      )}
                    </td>
                    <td className={status.className}>{status.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="review-actions">
        <button type="button" className="save-button" disabled={!canSave} onClick={() => void save()}>
          {saveLabel}
        </button>
        <button type="button" className="retry" disabled={isSaving} onClick={onDone}>
          {hasAdded ? 'Done' : 'Cancel'}
        </button>
      </div>
    </section>
  )
}
