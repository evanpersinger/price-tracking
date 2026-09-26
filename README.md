# price-tracking

Reads a photo or screenshot of a grocery receipt with an LLM and prints the purchase date, store, and every item (raw name, clean name, price, category) as JSON. The goal is to track the price of the same item over time, and to see which store is cheapest for it.

So far there are two parts: the receipt extraction script (prints JSON, saves nothing) and an importer that loads a store-prices CSV into a local SQLite database.

## Setup

```bash
uv sync
cp .env.example .env
```

Add `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` to `.env`. The local route needs [Ollama](https://ollama.com) running with a vision model pulled (`ollama pull <model>`).

## Run

```bash
uv run python backend/extract_receipt.py <openai|anthropic|local> <model> <image>
```

The model is always required, there is no default. Images can be JPG or PNG. Try it on a receipt in `test_files/` (gitignored).

OpenAI and Anthropic bill per receipt.

## Import a store-prices CSV

```bash
uv run python backend/import_sheet.py backend/data/imports/store_prices_ca.csv CA
uv run python backend/import_sheet.py backend/data/imports/store_prices_us.csv US
```

Creates `backend/data/prices.db` (gitignored) with the stores, their discount text, items and prices. The last argument is the country, `CA` or `US`. It refuses to import a country twice, so the database stays the source of truth once you start editing it.

## Run the API

```bash
uv run python backend/server.py
```

Serves on http://127.0.0.1:8021. Prices come back as `price_cents`, and `country` is `CA` or `US`.

- `GET /api/stores?country=CA` returns each store in that country with its discount text and items.
- `GET /api/cheapest?country=CA` returns each store with the items it sells cheapest, matching items by exact name across stores.
