"""Read a receipt image and print its purchase date, store, and items as JSON.

OpenAI and Claude need OPENAI_API_KEY / ANTHROPIC_API_KEY (env or .env) and cost money, local
needs Ollama. script needs neither, it's plain OCR (Tesseract), no model involved.
"""

import base64
import io
import json
import os
import re
import sys
from pathlib import Path

import anthropic
import pytesseract
import requests
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image, ImageEnhance, ImageFilter
from pytesseract import Output

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


_PRICE_RE = re.compile(r"\$?\d+\.\d{2}")
_TOTAL_LINE_RE = re.compile(r"\bsubtotal\b|\btotal\b|\btax\b", re.IGNORECASE)
_DATE_RE = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")


def _preprocess_for_ocr(image: Image.Image) -> Image.Image:
    """Sharpen contrast a bit before OCR, this measurably helps Tesseract on a phone photo."""
    if image.mode != "L":
        image = image.convert("L")
    image = ImageEnhance.Contrast(image).enhance(1.5)
    image = ImageEnhance.Sharpness(image).enhance(1.2)
    return image.filter(ImageFilter.MedianFilter(size=3))


def _ocr_lines(image: Image.Image) -> list[tuple[int, int, str]]:
    """OCR the image and return each recognized line as (top, bottom, text), top to bottom."""
    data = pytesseract.image_to_data(image, config=r"--oem 3 --psm 6", output_type=Output.DICT)
    grouped: dict[tuple[int, int, int], list[tuple[int, int, str]]] = {}
    for i, word in enumerate(data["text"]):
        if not word.strip():
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        grouped.setdefault(key, []).append((data["top"][i], data["top"][i] + data["height"][i], word))

    lines = [
        (min(w[0] for w in words), max(w[1] for w in words), " ".join(w[2] for w in words))
        for words in grouped.values()
    ]
    return sorted(lines)


def _find_item_block(lines: list[tuple[int, int, str]]) -> tuple[int, int] | None:
    """Find the (top, bottom) pixel range of the item list: from the first priced line up to the
    first SUBTOTAL/TOTAL line after it. This is a standard receipt shape, not specific to one
    store, so it should generalize across different receipts.
    """
    start = next((top for top, _, text in lines if _PRICE_RE.search(text)), None)
    if start is None:
        return None
    end = next((top for top, _, text in lines if top > start and _TOTAL_LINE_RE.search(text)), None)
    if end is None:
        return None
    return start, end


def _parse_item_line(text: str) -> dict | None:
    """Split one OCR'd line into a name and price, anchored on the last price-looking match.

    Returns None for a line with no price, e.g. OCR noise or a blank line.
    """
    matches = list(_PRICE_RE.finditer(text))
    if not matches:
        return None
    name = text[:matches[-1].start()].strip()
    if not name:
        return None
    return {"raw_name": name, "item_name": name, "price": float(matches[-1].group().lstrip("$")), "category": None}


# Plain script (no LLM)
def _image_script(_model: str | None, image_b64: str, _media_type: str) -> str:
    """Read the receipt with plain OCR (Tesseract), no model involved.

    Crops to the item block first (the lines between the first price and the SUBTOTAL/TOTAL line)
    since OCR-ing the whole receipt picks up too much noise from the header and card/payment
    footer. Unlike the LLM providers, this can't clean up names or infer a category, so
    item_name is left equal to raw_name and category is always null.
    """
    image = Image.open(io.BytesIO(base64.standard_b64decode(image_b64)))
    full_text = pytesseract.image_to_string(_preprocess_for_ocr(image), config=r"--oem 3 --psm 6")

    block = _find_item_block(_ocr_lines(_preprocess_for_ocr(image)))
    if block is not None:
        top, bottom = block
        padding = 10
        crop = image.crop((0, max(top - padding, 0), image.width, min(bottom + padding, image.height)))
        item_text = pytesseract.image_to_string(_preprocess_for_ocr(crop), config=r"--oem 3 --psm 6")
    else:
        item_text = full_text

    items = [item for line in item_text.splitlines() if (item := _parse_item_line(line)) is not None]
    date_match = _DATE_RE.search(full_text)
    store = next((line.strip() for line in full_text.splitlines() if line.strip()), None)

    return json.dumps({
        "purchase_date": date_match.group() if date_match else None,
        "store": store,
        "items": items,
    })


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


PROVIDERS = {"openai": _image_openai, "anthropic": _image_anthropic, "local": _image_ollama, "script": _image_script}


if __name__ == "__main__":
    # Usage: python extract_receipt.py <openai|anthropic|local> <model> <image>
    #    or: python extract_receipt.py script <image> (no model, it's plain OCR)
    # There is no default model: it is always chosen explicitly.
    usage = "Usage: python extract_receipt.py <openai|anthropic|local> <model> <image>\n   or: python extract_receipt.py script <image>"
    if len(sys.argv) < 3 or sys.argv[1] not in PROVIDERS:
        sys.exit(usage)

    provider = sys.argv[1]
    if provider == "script":
        if len(sys.argv) != 3:
            sys.exit(usage)
        model, image_path = None, Path(sys.argv[2])
    else:
        if len(sys.argv) != 4:
            sys.exit(usage)
        model, image_path = sys.argv[2], Path(sys.argv[3])

    if image_path.suffix.lower() not in MEDIA_TYPES:
        sys.exit(f"Only {', '.join(MEDIA_TYPES)} images are supported, got {image_path.suffix or 'no extension'}")
    if not image_path.is_file():
        sys.exit(f"Image not found: {image_path}")

    _check_provider(provider)
    image_b64 = base64.standard_b64encode(image_path.read_bytes()).decode("ascii")
    reply = PROVIDERS[provider](model, image_b64, MEDIA_TYPES[image_path.suffix.lower()])
    print(json.dumps(_extract_json(reply), indent=2))
