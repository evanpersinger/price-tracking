# price-tracking

![Scrolling through each store's items](docs/store_items.gif)

![Adding a receipt: the app reads it and lists the items to review](docs/add_receipt.gif)

[![CI](https://github.com/evanpersinger/price-tracking/actions/workflows/ci.yml/badge.svg)](https://github.com/evanpersinger/price-tracking/actions/workflows/ci.yml)

Tracks grocery prices per store in Canada and the USA, so the same item can be compared across stores. Items get in through a receipt photo (read by a local open-source vision model), and the app works out which store sells each item cheapest per item, per gram or per ml. Not built yet: adding an item by hand with no receipt.

## Setup

```bash
uv sync
cd frontend && pnpm install
```

Receipt reading is open-source only, no paid API keys. It needs [Ollama](https://ollama.com) running with a vision model pulled (`ollama pull <model>`, the app defaults to `gemma4:12b`). Tesseract (`brew install tesseract` on macOS) is used to spot gas receipts, and without it every receipt is read as a grocery one.

## Try it with demo data

A fresh clone has an empty database, and adding items needs a receipt photo and a local vision model. To see the app with something in it, fill the database with made-up prices first:

```bash
uv run python backend/seed_demo.py
```

It adds three Canadian and three US stores (real store names), about 70 items, price history and a few gas fill-ups. Every item, price and date is invented. It refuses to run if the database already has stores, so it can't touch real data. To keep the demo apart from a database of your own, set `PRICES_DB` to a new file first, for the script and for the API.

## Run it

```bash
uv run python backend/server.py   # API on http://127.0.0.1:8021, restart it after code changes
cd frontend && pnpm dev           # UI on http://localhost:3009, needs the API running
```

Optional environment variables: `PRICES_DB` (path to a different database, handy for testing on a copy), `OLLAMA_HOST`, and `RECEIPT_MODEL` (the model the API reads receipts with, default `gemma4:12b`).

## How to use it

- `/ca` and `/us`: Store Prices, one store at a time, with a search box.
- `/gas/ca` and `/gas/us`: Gas Prices, each station's fill-ups with the price per litre.
- `/cheapest/ca` and `/cheapest/us`: the cheapest items per store, and a search for what every store sells an item for.
- `/tracking/ca` and `/tracking/us`: Price Tracking, a graph of an item's price at one store over time.
- `/abbreviations`: shorthand used in item names, like `SS` for sesame seed.
- The Add Item button: drop a receipt photo, review and edit what the model read, then save the items.

## How it works

- **Adding items:** the model reads the receipt and saves nothing until you review it. The Item name box is the item's display name, and the receipt's printed text is saved next to it. One receipt is read at a time.
- **Cheapest:** each store's items are compared per item, per gram or per ml, and produce or bulk items with no size are compared per kg. The search lists what every store sells an item for, cheapest first.
- **Price history:** an item with an item code and a date is also recorded in the price history, which Price Tracking graphs.
- **Size check:** saving an item over one that's already stored is rejected if its price per unit is more than 5 times higher or lower, since that means a typed size is wrong.
- **Data rules:** how item names, brands and unit prices are stored is in [DATA_CONVENTIONS.md](DATA_CONVENTIONS.md).

## License

MIT, see [LICENSE](LICENSE). Store logos belong to their respective owners and are not covered by this license.
