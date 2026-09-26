# price-tracking

Reads a photo or screenshot of a grocery receipt with an LLM and prints the purchase date, store, and every item (raw name, clean name, price, category) as JSON. The goal is to track the price of the same item over time.

Right now it only extracts and prints. Nothing is saved yet.

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
