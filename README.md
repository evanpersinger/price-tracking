# price-tracking

Tracks grocery prices per store in Canada and the USA, so the same item can be compared across stores. Items get in through a receipt photo (read by a local open-source vision model, or by a plain OCR script) or by hand, and the app works out which store sells each item cheapest per item, per gram or per ml.

So far there are four parts: a script that reads a receipt photo, an importer that loaded the existing store-prices sheets into a local SQLite database, an API that serves, adds and reads receipts for that data, and a UI with a stores page per country, a Cheapest Items page, and an Add Item flow: drop a receipt photo, review what the local model read, and save the items into the tables. Not built yet: manual item entry with no receipt.

## Setup

```bash
uv sync
cd frontend && pnpm install
```

Receipt reading is open-source only right now, no paid API keys needed. The `local` route needs [Ollama](https://ollama.com) running with a vision model pulled (`ollama pull <model>`). The `script` route needs Tesseract installed separately (`brew install tesseract` on macOS), no model at all.

## Read a receipt

```bash
uv run python backend/extract_receipt.py local <model>  # or omit <model> to be prompted
uv run python backend/extract_receipt.py script          # plain OCR, no model
```

No image argument, either one converts every image currently sitting in `backend/input/` (gitignored).

For each image found, prints the purchase date, time, store, the store's address, and every item (raw name, clean name, price, category, and a quantity line like `3 @ 2.79` if the receipt has one under the item) as JSON, and also saves it to `backend/output/<image-name>.json`. The prompt tells the model to skip everything that isn't a bought item: barcodes, card and payment lines, subtotal and total, HST, copy and thank-you footers, PC Optimum, separator rows and personal names. The CLI always chooses the model explicitly, by flag or by prompt. The API can't prompt, so it uses the `RECEIPT_MODEL` env var (default `gemma4:12b`). Images can be JPG or PNG. `script` can't clean up names or infer a category the way a model can, so its `item_name` just repeats `raw_name` and `category` is always null.

## Import a store-prices CSV

```bash
uv run python backend/import_sheet.py backend/data/imports/store_prices_ca.csv CA
uv run python backend/import_sheet.py backend/data/imports/store_prices_us.csv US
```

A one-time load, already done for both countries. It creates `backend/data/prices.db` (gitignored) with the stores, their discount text, student discounts, items and prices, plus any items that exist only in the sheet's hand-made Cheapest Items list. The last argument is the country, `CA` or `US`. It refuses to import a country twice, so the database stays the source of truth once you start adding to it.

## Run the API

```bash
uv run python backend/server.py
```

Serves on http://127.0.0.1:8021 and has to be restarted after code changes. Prices come back as `price_cents`, and `country` is `CA` or `US`.

- `GET /api/stores?country=CA` returns each store in that country with its discount text and items, including each item's brand where known.
- `GET /api/cheapest?country=CA` returns each store with the items it sells cheapest, matching the same item across stores. Case, small spelling differences and the typed unit price (like `($0.57 per pill)`) don't matter. Items are compared on unit price, per item if the name has a count (`(8x)`), otherwise per gram or per ml, so a 24-pack can be compared with an 8-pack and `(1lb)` counts the same as `(454g)`. Items with no size are left out.
- `GET /api/search?country=CA&q=milk` returns what every store sells an item for, cheapest first, for every item whose name has all the words in `q` (case doesn't matter). Offers are ranked on their own unit price, per item if the name has a count, else per gram, else per ml, and each of those gets its own list since they can't be ranked against each other. Each offer has the store, its price, its unit price, its size and its brand. A store that has the same item and size more than once only counts at its cheapest, and items with no price or size are left out. It searches the item name only for now, more arguments can be added next to `q` later.
- `POST /api/items` adds an item to a store, creating the store if it isn't in that country yet. The body has `country`, `store`, `name`, `price_cents`, and at least one of `item_count` (how many in the pack), `weight_g` or `volume_ml`, because an item with no size is rejected. `weight_g` and `volume_ml` are the total for the whole pack, not per item (6 boxes of 454g is `item_count` 6 and `weight_g` 2724). `purchased_on`, `brand` and `item_code` are optional, and `purchased_on` defaults to today. Capitals don't matter in a brand: one that matches a saved brand ignoring case is saved with the saved spelling, so `Arm&Hammer` and `arm&hammer` are one brand. When those size boxes are filled in, `/api/cheapest` uses them instead of reading the size from the name. `item_code` is the product code the store prints on the receipt line. If the store already has an item with the same code, that row is overwritten with the new price, date and details instead of adding a second one, so there is no price history.
- `POST /api/receipt` takes a JPEG or PNG as the raw request body and returns what the local model read from it. It saves nothing. Only one receipt is read at a time, a second one gets a 409 until the first is done.

Set `PRICES_DB` to a file path to point the API and importer at a different database, handy for testing on a copy.

## Run the UI

```bash
cd frontend && pnpm dev
```

Opens on http://localhost:3009 and needs the API running. Each page has its own address, so you can open them in separate browser windows:

- `/ca` and `/us` show one store at a time for that country: its discount line and a table of Brand, Item code, Item, Amount, Unit price and Price. An item with no typed unit price in its name but a saved count, weight or volume gets one worked out from its price, per item, else per 100g, else per 100ml. The Item code column may be removed later. A row of buttons lists every store, click one to jump straight to it, or use the arrow button beside the table to step to the next or previous store. An item with no amount at all is hidden until its data has one (it isn't deleted, just not shown yet), and when an item's brand is known, that text is trimmed off the front of its Item name since it's already in the Brand column.
- `/cheapest` shows the cheapest items for both countries, Canada and the USA as two separate sections since the prices are in different currencies. Each section browses one store at a time, just like `/ca` and `/us` do: click a store name or use the arrow button to switch. Each item shows its unit price and how many stores it was compared across, and a checkbox (on by default) hides items sold at only one store. A "Search for an item name" box sits above the store buttons: type a name and the store view is replaced by what every store sells that item for, cheapest first, as one list per unit (per item, per 100g or per 100ml). Clear the box to go back to the stores.
- The Add Item button opens a dialog where you drop a receipt photo or choose a file. The local model reads it (this is slow), then a review page lists the items. The country is filled in when the receipt makes it clear, from the address's city first (a hand-edited list in `frontend/src/cities.ts`), then its postal code or ZIP, then the store name, otherwise pick it yourself. Check the store and date, and fill in what the receipt can't show: count (always required), size (the whole pack's total, not per item) and unit, and brand. Hovering the Size and Brand column headers explains each. A banner says which store will be updated, and warns if it would create a new one. Items whose code the store already has are filled in from the saved item and say their price will be overwritten. Items listed in `frontend/src/knownItems.ts` (like Costco's `KS BATH`) are filled in by name or code. Rows that still need something are skipped on save.
- `/abbreviations` is a plain reference table explaining shorthand used in item names, like `SS` for sesame seed.

It has a dark theme with a different color for store names, item names, amounts, unit prices, prices and discounts. The stores and cheapest pages are split into two colors, a lighter top half (title, nav and store buttons) and a black bottom half for the data. `pnpm build` type-checks and builds, and `pnpm lint` runs oxlint.

## Run the tests

```bash
uv run pytest                 # backend, from the repo root
cd frontend && pnpm test      # frontend helpers, vitest
```

The backend tests (`tests/`) cover adding items, cheapest matching, search, the receipt endpoint's status codes and the database setup. Every test uses its own temporary database, so `prices.db` is never touched. The frontend tests (`frontend/src/*.test.ts`) cover the pure helpers in `format.ts`, `itemCode.ts` and `knownItems.ts`, there are no component tests.
