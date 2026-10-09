"""Read a receipt image and print its purchase date, store, and items as JSON.

local needs Ollama running with a vision model pulled. script needs neither, it's plain OCR
(Tesseract), no model involved. Open-source models only for now, no paid API providers.
"""

import base64
import io
import json
import os
import re
import sys
from pathlib import Path

import pytesseract
import requests
from dotenv import load_dotenv
from PIL import Image, ImageEnhance, ImageFilter
from pytesseract import Output

load_dotenv()

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_KEEP_ALIVE = "15s"  # stop the model 15 seconds after the run, overrides Ollama's 5 min default
RECEIPT_MODEL = os.environ.get("RECEIPT_MODEL", "gemma4:12b")  # model the API uses, set RECEIPT_MODEL to switch
MEDIA_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
INPUT_DIR = Path(__file__).parent / "input"
OUTPUT_DIR = Path(__file__).parent / "output"

_RECEIPT_PROMPT = (  # Prompt given to LLM
    "Read this grocery receipt and return a JSON object with purchase_date (YYYY-MM-DD), "
    "store, store_address (the store's "
    "address as printed near the top, with its city, province or state and postal code or ZIP, "
    "null if it isn't printed), and items. "
    "When the date is printed as three two-digit numbers with no month name, like '26/10/01', that order is "
    "ambiguous between day-month-year and year-month-day. Real Canadian Superstore and other Loblaws-banner "
    "stores (No Frills, Your Independent Grocer, Zehrs) print it year-month-day, so '26/10/01' is 2026-10-01, "
    "not 2001-10-26.\n"
    "Each item has "
    "raw_name (the entire line exactly as printed, including any product code or barcode number on it, "
    "not just the product name by itself), item_name (a clean, consistent product name, "
    "e.g. 'Organic Bananas'), price (a number), category (what kind of item it is, e.g. produce), "
    "quantity_info and on_sale.\n"
    "price is the full amount actually charged for that item, matching what it adds to the subtotal. It is "
    "never a rate: a '$/kg' figure, or the unit price in an 'N @ price' line, is a rate, not a charge.\n"
    "A line below an item is never an item itself, and takes one of these forms:\n"
    "- A quantity or weight line such as '3 @ 2.79' or '1.2 kg @ $4.99/kg'. Copy it exactly as printed into "
    "quantity_info of the item above it.\n"
    "- Three numbers with no '@' in between, for example '10343970564    40.49    80.98H' under "
    "'2  EPSON T232 BLACK INK'. Read these left to right, in this exact order: a product code, a unit price, "
    "then the line's own total (ignore a trailing letter on it, like the 'H' here, it only marks the item as "
    "taxable). When you see this, put the code into raw_name instead (e.g. 'EPSON T232 BLACK INK "
    "10343970564'), write quantity_info as '<quantity> @ <unit price>' using the quantity printed before the "
    "item's own name and the middle number on this line (here '2 @ 40.49'), and price is the last number on "
    "this line (here 80.98), the unit price in the middle is never the price.\n"
    "Use null for quantity_info when an item has no line below it.\n"
    "on_sale is true when a discount was taken off that item: a line under it with an amount that ends in "
    "a minus sign like '4.50-', an 'INSTANT SAVINGS', coupon or discount line that names it, or the word "
    "SALE or SAVE printed on its own line. Otherwise on_sale is false. A shelf offer that was not applied, "
    "such as '2 for $5' or '$4.99 ea or 2/$9.00', does not make an item on sale. A student, senior, "
    "military, employee or membership discount is not a sale either: its line is not an item, but it "
    "never makes any item on_sale, so leave on_sale false for the items it was applied to.\n"
    "Only items that were bought are items. Ignore everything else on the receipt, including:\n"
    "- discount, coupon, instant savings and promo lines, and any line whose amount ends in a minus sign "
    "like 4.50- (they are never items, they only set on_sale on the item they apply to)\n"
    "- barcodes\n"
    "- the card brand (Mastercard, Visa, etc.) and any card number, including masked ones like "
    "XXXXXXXXX9999\n"
    "- the subtotal and the total\n"
    "- the HST tax line\n"
    "- the transaction type and the Account, Card Type and Card Number lines\n"
    "- payment entry lines such as 'Entry: Tap EMV (H)' and 'FF/DT 00'\n"
    "- 'TRANSACTION RECORDED', 'Approved', 'Thank you', 'Customer copy', 'Cardholder copy' and "
    "'Important: retain this copy for your records', with or without asterisks\n"
    "- PC Optimum lines, including promos like 'You could have earned at least 1220 PC Optimum "
    "points with a ...'\n"
    "- lines that are only a row of asterisks or dashes\n"
    "- personal names, such as the cardholder or the cashier\n"
    "Output only the JSON."
)

_FUEL_PROMPT = (  # Prompt for a gas station receipt, which has no item lines, only the fuel sale
    "Read this fuel receipt from a gas station and return a JSON object with purchase_date (YYYY-MM-DD), "
    "store, store_address (the station's "
    "address as printed near the top, with its city, province or state and postal code or ZIP, "
    "null if it isn't printed), and items.\n"
    "Items has exactly one item, the fuel: raw_name is the grade as printed (like 'Unleaded'), item_name "
    "is 'Gas', fuel_type is the grade or fuel as printed (like 'Unleaded', '87', 'Premium 91' or 'Diesel'), "
    "price is the Fuel Sale amount as a number (not the HST line), category is 'fuel', and quantity_info "
    "is '<litres> L @ <price per litre>/L' with the numbers as printed.\n"
    "Output only the JSON."
)

# Words a fuel receipt prints. One alone isn't enough (Grade A eggs), so two or more make it a fuel receipt.
_FUEL_WORDS = (
    r"\bpump\b", r"\bgrade\b", r"\blitres?\b", r"\bliters?\b", r"price\s*/\s*lit", r"\bfuel\s+sale\b", r"\bunleaded\b",
    r"\bdiesel\b",
)
_FUEL_WORDS_NEEDED = 2


# Local (Ollama)
def _image_ollama(model: str, image_b64: str, _media_type: str) -> str:
    """Send the receipt to the local Ollama vision model and return its JSON reply.

    A fuel receipt gets its own prompt, picked from the words on the receipt, so the grocery prompt stays as it was.
    """
    prompt = _FUEL_PROMPT if _is_fuel_receipt(image_b64) else _RECEIPT_PROMPT
    response = requests.post(
        f"{OLLAMA_HOST}/api/chat",
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt, "images": [image_b64]}],
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


def _is_fuel_receipt(image_b64: str) -> bool:
    """Whether the words on the receipt say it is from a gas station, found with OCR before the model reads it.

    A grocery receipt is assumed when OCR can't run, so a broken Tesseract never blocks a receipt from being read.
    """
    try:
        image = Image.open(io.BytesIO(base64.standard_b64decode(image_b64)))
        text = pytesseract.image_to_string(_preprocess_for_ocr(image), config=r"--oem 3 --psm 6")
    except (pytesseract.TesseractError, OSError):  # TesseractNotFoundError and a bad image are both OSErrors
        return False
    return sum(bool(re.search(word, text, re.IGNORECASE)) for word in _FUEL_WORDS) >= _FUEL_WORDS_NEEDED


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
    header = [line.strip() for line in full_text.splitlines() if line.strip()]
    store = header[0] if header else None
    store_address = " ".join(header[1:4]) or None  # the lines under the store name, where the address usually is

    return json.dumps({
        "purchase_date": date_match.group() if date_match else None,
        "store": store,
        "store_address": store_address,
        "items": items,
    })


def _check_provider(provider: str) -> None:
    """Exit with a clear message if the chosen provider isn't ready to use."""
    if provider == "local":
        try:
            requests.get(f"{OLLAMA_HOST}/api/version", timeout=2).raise_for_status()
        except requests.exceptions.RequestException:
            sys.exit(f"Error: Ollama not reachable at {OLLAMA_HOST}. Run `ollama serve` (or open the Ollama app).")


def _list_ollama_models() -> list[str]:
    """Names of models currently pulled in the local Ollama installation."""
    response = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
    response.raise_for_status()
    return sorted(m["name"] for m in response.json().get("models", []))


def _prompt_for_local_model() -> str:
    """Ask which installed Ollama model to use.

    There is no default: a blank or invalid answer asks again, so a run never starts on a
    model nobody chose.
    """
    try:
        models = _list_ollama_models()
    except requests.exceptions.RequestException:
        sys.exit(f"Error: Ollama not reachable at {OLLAMA_HOST}. Run `ollama serve` (or open the Ollama app).")

    if not models:
        sys.exit("No Ollama models installed. Pull one with `ollama pull <model>`.")

    print("Installed Ollama models:")
    for i, name in enumerate(models, start=1):
        print(f"  {i}) {name}")

    while True:
        choice = input("Select a model: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(models):
            return models[int(choice) - 1]
        print("Please enter a number from the list.")


def _extract_json(text: str) -> dict:
    """Pull the JSON object out of the reply, in case the model wraps it in a code fence.

    Raises ValueError if there's no valid JSON, so the API can turn it into an error response.
    """
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON in the model's reply:\n{text}")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"Model returned invalid JSON ({e}):\n{text}") from e


# Words that mark a line as a deal or a discount and not a bought item
_DEAL_LINE_RE = re.compile(r"\b(instant|savings?|discount|coupon|promo|promotion|markdown|rebate|you saved)\b|\bsale\b", re.IGNORECASE)
# A Costco discount line, "0000391935 /5051501", starts with its own long number and names the item code it took money
# off after a slash. A size like "6/2000ML" in a product name has no long number in front, so it never matches.
_DISCOUNT_FOR_RE = re.compile(r"^\s*\d{6,}\s*/\s*(\d{4,})")
# A shelf offer printed under an item, "2 for $1.25" or "$4.99 ea or 2/$9.00", is not what was bought
_DEAL_QUANTITY_RE = re.compile(r"\bfor\s*\$?\d|\bea\b.*\bor\b|\d\s*/\s*\$?\d|\bsave\b|%\s*off", re.IGNORECASE)


_QUANTITY_AT_RE = re.compile(r"^\s*(\d+)\s*@\s*\$?(\d+(?:\.\d+)?)\s*$")


def _fix_misread_unit_price(receipt: dict) -> dict:
    """Catch the model reporting an item's unit price as its price, instead of the line's total.

    A plain quantity line like '2 @ 40.49' (no weight unit) means N units at that unit price, so the
    item's real price is N times it. The model sometimes reports the unit price itself instead,
    especially on a store-printed 'code  unit price  total' line with no '@' in it (Staples prints
    these), where it has to tell three bare numbers apart. Only overrides when price exactly matches
    the unit price, since a real per-line discount can legitimately make the total something other
    than quantity times unit price.
    """
    items = receipt.get("items") or []
    fixed = []
    for item in items:
        match = _QUANTITY_AT_RE.match(str(item.get("quantity_info") or ""))
        price = item.get("price")
        if match and isinstance(price, int | float):
            quantity, unit_price = int(match.group(1)), float(match.group(2))
            if quantity > 1 and abs(price - unit_price) < 0.005:
                item = {**item, "price": round(quantity * unit_price, 2)}
        fixed.append(item)
    return {**receipt, "items": fixed}


def _drop_deals(receipt: dict) -> dict:
    """The receipt without anything bought on sale or with a discount, and without the deal lines themselves.

    An item the model flagged on_sale is dropped, and so is any item a discount line names by its code. A line that
    is a discount (a price of zero or less, or words like INSTANT SAVINGS) is dropped too. Sale prices aren't the
    regular price, so they never reach the review page, the items table or the price history. A shelf offer left in
    an item's quantity_info is cleared, the item itself stays.
    """
    items = receipt.get("items") or []
    discounted_codes = {
        match.group(1) for item in items if (match := _DISCOUNT_FOR_RE.search(str(item.get("raw_name") or "")))
    }

    kept = []
    dropped = []
    for item in items:
        raw_name = str(item.get("raw_name") or "")
        price = item.get("price")
        is_deal_line = (
            (isinstance(price, int | float) and price <= 0)
            or bool(_DEAL_LINE_RE.search(raw_name))
            or bool(_DISCOUNT_FOR_RE.search(raw_name))
        )
        is_on_sale = item.get("on_sale") is True or any(code in raw_name for code in discounted_codes)
        if is_deal_line or is_on_sale:
            dropped.append(item)
            continue
        quantity_info = item.get("quantity_info")
        if quantity_info and _DEAL_QUANTITY_RE.search(str(quantity_info)):
            item = {**item, "quantity_info": None}
        kept.append({key: value for key, value in item.items() if key != "on_sale"})
    return {**receipt, "items": kept, "_dropped_items": dropped}


def extract_receipt(image_bytes: bytes, media_type: str) -> dict:
    """Read one receipt image with the local model (RECEIPT_MODEL) and return its JSON as a dict, deals dropped.

    Also carries _raw_reply, the model's reply exactly as it came back, before any parsing: the only way to see
    what the model actually said when the parsed result looks wrong. The API logs it and _dropped_items (see
    _drop_deals) to activity.log, then strips both before the result reaches the client.
    """
    image_b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    raw_reply = _image_ollama(RECEIPT_MODEL, image_b64, media_type)
    return {**_drop_deals(_fix_misread_unit_price(_extract_json(raw_reply))), "_raw_reply": raw_reply}


PROVIDERS = {"local": _image_ollama, "script": _image_script}


def _input_images() -> list[Path]:
    """Every supported image currently sitting in backend/input/, alphabetical."""
    if not INPUT_DIR.is_dir():
        return []
    return sorted(p for p in INPUT_DIR.iterdir() if p.suffix.lower() in MEDIA_TYPES)


def _prompt_for_provider() -> tuple[str, str | None]:
    """Ask the user to pick across all options in one combined list: every installed Ollama
    model, plus script. Matches the sibling file-converter project's `_prompt_for_provider`.

    Returns (provider, model). model is None for "script", which has no model.
    """
    try:
        local_models = _list_ollama_models()
    except requests.exceptions.RequestException:
        local_models = []

    entries: list[tuple[str, str | None]] = [("local", name) for name in local_models] + [("script", None)]

    print("Open Source models:")
    if local_models:
        for i, name in enumerate(local_models, start=1):
            print(f"  {i}) {name}")
    else:
        print("  (none installed)")
    print(f"  {len(local_models) + 1}) script (plain OCR, no model)")

    while True:
        choice = input("Select an option: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(entries):
            return entries[int(choice) - 1]
        print("Enter a number from the list above.")


if __name__ == "__main__":
    # Usage: python extract_receipt.py local [model]  (prompts for a model if not given)
    #    or: python extract_receipt.py script
    #    or: python extract_receipt.py  (prompts for provider and model together)
    # No image argument: it always converts every image sitting in backend/input/.
    # There is no default model or provider: both are always chosen explicitly, by flag or by prompt.
    usage = "Usage: python extract_receipt.py local [model]\n   or: python extract_receipt.py script"
    args = sys.argv[1:]
    if args and args[0] not in PROVIDERS:
        sys.exit(usage)

    if not args:
        provider, model = _prompt_for_provider()
    elif args[0] == "script":
        if len(args) != 1:
            sys.exit(usage)
        provider, model = "script", None
    else:
        provider = "local"
        if len(args) == 1:
            model = _prompt_for_local_model()
        elif len(args) == 2:
            model = args[1]
        else:
            sys.exit(usage)

    images = _input_images()
    if not images:
        sys.exit(f"No images found in {INPUT_DIR}. Drop a receipt there first.")

    _check_provider(provider)
    OUTPUT_DIR.mkdir(exist_ok=True)
    for image_path in images:
        image_b64 = base64.standard_b64encode(image_path.read_bytes()).decode("ascii")
        reply = PROVIDERS[provider](model, image_b64, MEDIA_TYPES[image_path.suffix.lower()])
        try:
            result = json.dumps(_drop_deals(_fix_misread_unit_price(_extract_json(reply))), indent=2)
        except ValueError as e:
            sys.exit(str(e))
        print(f"{image_path.name}:")
        print(result)
        (OUTPUT_DIR / f"{image_path.stem}.json").write_text(result)
