"""Read a receipt image and print its purchase date, store, and items as JSON.

OpenAI and Claude need OPENAI_API_KEY / ANTHROPIC_API_KEY (env or .env) and cost money, local needs Ollama.
"""

import base64
import json
import os
import sys
from pathlib import Path

import anthropic
import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_KEEP_ALIVE = "15s"  # stop the model 15 seconds after the run, overrides Ollama's 5 min default
MEDIA_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}

_RECEIPT_PROMPT = (
    "Read this grocery receipt and return a JSON object with purchase_date (YYYY-MM-DD), store, "
    "and items. Each item has raw_name (exactly as printed on the receipt), item_name (a clean, "
    "consistent product name, e.g. 'Organic Bananas'), price (a number), and category (what kind "
    "of item it is, e.g. produce). Output only the JSON."
)


# OpenAI
def _image_openai(model: str, image_b64: str, media_type: str) -> str:
    """Send the receipt to OpenAI and return its JSON reply."""
    response = OpenAI().chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": _RECEIPT_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
            ],
        }],
    )
    return response.choices[0].message.content or ""


# Anthropic
def _image_anthropic(model: str, image_b64: str, media_type: str) -> str:
    """Send the receipt to Claude and return its JSON reply."""
    message = anthropic.Anthropic().messages.create(
        model=model,
        max_tokens=8192,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": _RECEIPT_PROMPT},
            ],
        }],
    )

    if message.stop_reason == "refusal":
        raise RuntimeError("Claude declined to process this image")
    if message.stop_reason == "max_tokens":
        raise RuntimeError("output was cut off")

    return "".join(block.text for block in message.content if block.type == "text")


# Local (Ollama)
def _image_ollama(model: str, image_b64: str, _media_type: str) -> str:
    """Send the receipt to the local Ollama vision model and return its JSON reply."""
    response = requests.post(
        f"{OLLAMA_HOST}/api/chat",
        json={
            "model": model,
            "messages": [{"role": "user", "content": _RECEIPT_PROMPT, "images": [image_b64]}],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0},
            "think": False,  # skip the hidden reasoning on models that support it
            "keep_alive": OLLAMA_KEEP_ALIVE,
        },
        timeout=300,  # local vision models are slow, especially on CPU
    )
    response.raise_for_status()
    return response.json()["message"]["content"]


def _check_provider(provider: str) -> None:
    """Exit with a clear message if the chosen provider isn't ready to use."""
    key_names = {"openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}
    if provider in key_names and not os.environ.get(key_names[provider]):
        sys.exit(f"Error: {key_names[provider]} not found. Please add {key_names[provider]} to your .env file")

    if provider == "local":
        try:
            requests.get(f"{OLLAMA_HOST}/api/version", timeout=2).raise_for_status()
        except requests.exceptions.RequestException:
            sys.exit(f"Error: Ollama not reachable at {OLLAMA_HOST}. Run `ollama serve` (or open the Ollama app).")


def _extract_json(text: str) -> dict:
    """Pull the JSON object out of the reply, in case the model wraps it in a code fence."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        sys.exit(f"No JSON in the model's reply:\n{text}")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        sys.exit(f"Model returned invalid JSON ({e}):\n{text}")


PROVIDERS = {"openai": _image_openai, "anthropic": _image_anthropic, "local": _image_ollama}


if __name__ == "__main__":
    # Usage: python extract_receipt.py <openai|anthropic|local> <model> <image>
    # There is no default model: it is always chosen explicitly.
    if len(sys.argv) != 4 or sys.argv[1] not in PROVIDERS:
        sys.exit("Usage: python extract_receipt.py <openai|anthropic|local> <model> <image> (the model is required)")

    provider, model, image_path = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    if image_path.suffix.lower() not in MEDIA_TYPES:
        sys.exit(f"Only {', '.join(MEDIA_TYPES)} images are supported, got {image_path.suffix or 'no extension'}")
    if not image_path.is_file():
        sys.exit(f"Image not found: {image_path}")

    _check_provider(provider)
    image_b64 = base64.standard_b64encode(image_path.read_bytes()).decode("ascii")
    reply = PROVIDERS[provider](model, image_b64, MEDIA_TYPES[image_path.suffix.lower()])
    print(json.dumps(_extract_json(reply), indent=2))
