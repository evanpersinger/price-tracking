# price-tracking

Tracks grocery prices per store in Canada and the USA, so the same item can be compared across stores. Items get in through a receipt photo (read by an LLM) or by hand, and the app works out which store sells each item cheapest per item, per gram or per ml.

So far there are four parts: a script that reads a receipt photo, an importer that loaded the existing store-prices sheets into a local SQLite database, an API that serves and adds that data, and a basic UI with a stores page per country and a Cheapest Items page. Not built yet: the manual add form and receipt upload in the UI.

## Setup

```bash
uv sync
cp .env.example .env
cd frontend && pnpm install
```

Add `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` to `.env`, only needed for receipts read by OpenAI or Anthropic. The local route needs [Ollama](https://ollama.com) running with a vision model pulled (`ollama pull <model>`).

## Read a receipt

```bash
uv run python backend/extract_receipt.py <openai|anthropic|local> <model> <image>
```

Prints the purchase date, store, and every item (raw name, clean name, price, category) as JSON, and saves nothing yet. The model is always required, there is no default. Images can be JPG or PNG. Try it on a receipt in `test_files/` (gitignored). OpenAI and Anthropic bill per receipt.

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
- `POST /api/items` adds an item to a store, creating the store if it isn't in that country yet. The body has `country`, `store`, `name`, `price_cents`, and at least one of `item_count` (how many in the pack), `weight_g` or `volume_ml`, because an item with no size is rejected. `purchased_on` is optional and defaults to today. When those size boxes are filled in, `/api/cheapest` uses them instead of reading the size from the name.

Set `PRICES_DB` to a file path to point the API and importer at a different database, handy for testing on a copy.

## Run the UI

```bash
cd frontend && pnpm dev
```

Opens on http://localhost:3009 and needs the API running. Each page has its own address, so you can open them in separate browser windows:

- `/ca` and `/us` show one store at a time for that country: its discount line and a table of Brand, Item, Amount, Unit price and Price. A row of buttons lists every store, click one to jump straight to it, or use the arrow button beside the table to step to the next or previous store. An item with no amount at all is hidden until its data has one (it isn't deleted, just not shown yet), and when an item's brand is known, that text is trimmed off the front of its Item name since it's already in the Brand column.
- `/cheapest` shows the cheapest items for both countries, Canada and the USA as two separate sections since the prices are in different currencies. Each item shows its unit price and how many stores it was compared across, and a checkbox (on by default) hides items sold at only one store.

It has a dark theme with a different color for store names, item names, amounts, unit prices, prices and discounts. `pnpm build` type-checks and builds, and `pnpm lint` runs oxlint.
