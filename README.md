# price-tracking

Tracks grocery prices per store in Canada and the USA, so the same item can be compared across stores. Items get in through a receipt photo (read by a local open-source vision model, or by a plain OCR script) or by hand, and the app works out which store sells each item cheapest per item, per gram or per ml.

So far there are four parts: a script that reads a receipt photo, an importer that loaded the existing store-prices sheets into a local SQLite database, an API that serves, adds and reads receipts for that data, and a UI with a stores page per country, a Cheapest Items page, and an Add Item flow: drop a receipt photo, review what the local model read, and save the items into the tables. Not built yet: manual item entry with no receipt.

## Setup

```bash
uv sync
cd frontend && pnpm install
```

Receipt reading is open-source only right now, no paid API keys needed. The `local` route needs [Ollama](https://ollama.com) running with a vision model pulled (`ollama pull <model>`). The `script` route needs Tesseract installed separately (`brew install tesseract` on macOS), no model at all. The `local` route also uses Tesseract for one quick check, spotting gas receipts, and reads every receipt as a grocery one if it isn't installed.

## Read a receipt

```bash
uv run python backend/extract_receipt.py local <model>  # or omit <model> to be prompted
uv run python backend/extract_receipt.py script          # plain OCR, no model
```

No image argument, either one converts every image currently sitting in `backend/input/` (gitignored).

For each image found, prints the purchase date, store, the store's address, and every item (raw name, clean name, price, category, and a quantity line like `3 @ 2.79` if the receipt has one under the item) as JSON, and also saves it to `backend/output/<image-name>.json`. The prompt tells the model to skip everything that isn't a bought item: barcodes, card and payment lines, subtotal and total, HST, copy and thank-you footers, PC Optimum, separator rows and personal names. A gas station receipt has no item lines, so it's spotted first from the words on it (two or more of Pump, Grade, Litres, Price/Litre, Fuel Sale, Unleaded or Diesel, found with a quick Tesseract read) and the model gets a separate fuel prompt: one item, the grade plus "gasoline", priced at the Fuel Sale amount, with the litres in its quantity line. The CLI always chooses the model explicitly, by flag or by prompt. The API can't prompt, so it uses the `RECEIPT_MODEL` env var (default `gemma4:12b`). Images can be JPG or PNG. `script` can't clean up names or infer a category the way a model can, so its `item_name` just repeats `raw_name` and `category` is always null.

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
- `POST /api/items` adds an item to a store, creating the store if it isn't in that country yet. The body has `country`, `store`, `name`, `price_cents`, and at least one of `item_count` (how many in the pack), `weight_g` or `volume_ml`, because an item with no size is rejected. `weight_g` and `volume_ml` are the total for the whole pack, not per item (6 boxes of 454g is `item_count` 6 and `weight_g` 2724). `purchased_on` (the receipt's date), `brand`, `item_code` and `fuel_type` (what the fuel is on a gas receipt, as printed) are optional. A date is only saved when the receipt gave one, nothing is guessed, and an item with no date isn't recorded in the price history. Only the date is kept, not the time of day. Capitals don't matter in a brand: one that matches a saved brand ignoring case is saved with the saved spelling, so `Arm&Hammer` and `arm&hammer` are one brand. When those size boxes are filled in, `/api/cheapest` uses them instead of reading the size from the name. `item_code` is the product code the store prints on the receipt line. If the store already has an item with the same code, that row is overwritten with the new price, date and details instead of adding a second one. The old price isn't lost: whenever an item is saved with a date, a row (item, price, date) is also added to the `price_history` table, which is kept for good so the Price Tracking page can show how an item's price changed over time. Gas fill-ups are recorded the same way. `price_history` is a table in the same `prices.db`, not a separate database file.
- `GET /api/history?country=CA` returns every recorded purchase in that country's stores, newest first, each with its store, item, brand, size, price and date.
- `POST /api/receipt` takes a JPEG or PNG as the raw request body and returns what the local model read from it. It saves nothing. Only one receipt is read at a time, a second one gets a 409 until the first is done.

Set `PRICES_DB` to a file path to point the API and importer at a different database, handy for testing on a copy.

## Run the UI

```bash
cd frontend && pnpm dev
```

Opens on http://localhost:3009 and needs the API running. Each page has its own address, so you can open them in separate browser windows:

- `/ca` and `/us` (Store Prices) show one store at a time for that country, with gas left out: its discount line and a table of Item code, Brand, Item name, Amount, Unit price and Price. An item with no typed unit price in its name but a saved count, weight or volume gets one worked out from its price, per item, else per 100g, else per 100ml. The Item code column may be removed later. A row of buttons lists every store, click one to jump straight to it, or use the arrow button beside the table to step to the next or previous store. An item with no amount at all is hidden until its data has one (it isn't deleted, just not shown yet), and when an item's brand is known, that text is trimmed off the front of its Item name since it's already in the Brand column.
- `/cheapest` shows the cheapest items for both countries, Canada and the USA as two separate sections since the prices are in different currencies. Each section browses one store at a time, just like `/ca` and `/us` do: click a store name or use the arrow button to switch. Each item shows its unit price and how many stores it was compared across, and a checkbox (on by default) hides items sold at only one store. A "Search for an item name" box sits above the store buttons: type a name and the store view is replaced by what every store sells that item for, cheapest first, as one list per unit (per item, per 100g or per 100ml). Clear the box to go back to the stores.
- `/gas/ca` and `/gas/us` (Gas Prices, the button next to Store Prices) list the gas stations that have a fill-up saved from a gas receipt, like Costco, Shell or 76, one at a time like Store Prices. Each table shows the Date, Fuel type (as the receipt prints it, like Unleaded, 87 or Diesel), Litres, Unit price (the price of a litre to three decimals, like `$1.749 per L`) and Price, newest first. A station with only gas shows here and not in Store Prices, and gas is left out of Cheapest items and search.
- `/tracking/ca` and `/tracking/us` (Price Tracking) list the items that have a price history, newest purchase first, with a "Search for an item name" box above. Click an item to see a dotted graph of its price over time (date across, price up, one dot per purchase, colored by store, hover a dot for the details) and a table of its purchases, with a button to go back to the list. Gas is graphed by price per litre, per fuel type. It's empty until items are added from receipts that have a date.
- The Add Item button opens a dialog where you drop a receipt photo or choose a file. The local model reads it (this is slow), then a review page lists the items. The country is filled in when the receipt makes it clear, from the address's city first (a hand-edited list in `frontend/src/cities.ts`), then its postal code or ZIP, then the store name, otherwise pick it yourself. The store box is filled with the saved store the receipt's name points to (a receipt that says "Costco 530" fills in the saved "Costco"). A gas receipt gets a smaller row: the item name is just "Gas", then the price, the litres, the price per litre (worked out, not typed) and the fuel type, with no count, unit or brand. Check the store and date (the date is editable, and left blank if the receipt's couldn't be read), and fill in what the receipt can't show: count (always required), size (the whole pack's total, not per item) and unit, and brand. Hovering the Size and Brand column headers explains each. A banner warns in amber if the store would be created new, and says nothing when it's an existing store, since the Add button names it. Items whose code the store already has are filled in from the saved item and say their price will be overwritten. Items listed in `frontend/src/knownItems.ts` (like Costco's `KS BATH`) are filled in by name or code. Rows that still need something are skipped on save.
- `/abbreviations` is a plain reference table explaining shorthand used in item names, like `SS` for sesame seed.

It has a dark theme with a different color for store names, item names, amounts, unit prices, prices and discounts. The store prices, gas and cheapest pages are split into two colors, a lighter top half (title, nav and store buttons, all centered with every button's words on one line) and a black bottom half for the data. The bottom half never scrolls sideways: tables fill the width up to the arrow button and narrow to fit, with text that scales with the window, and on a window under 1700px wide their text wraps. `pnpm build` type-checks and builds, and `pnpm lint` runs oxlint.

## Run the tests

```bash
uv run pytest                 # backend, from the repo root
cd frontend && pnpm test      # frontend helpers, vitest
```

The backend tests (`tests/`) cover adding items, cheapest matching, search, the receipt endpoint's status codes, spotting a gas receipt and the database setup. Every test uses its own temporary database, so `prices.db` is never touched. The frontend tests (`frontend/src/*.test.ts`) cover the pure helpers in `format.ts`, `itemCode.ts` and `knownItems.ts`, there are no component tests.
