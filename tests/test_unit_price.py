"""Fixing an item's price when the model reports its unit price instead of the line's real total."""

import json

import pytest

import extract_receipt


def receipt(*items: dict) -> dict:
    return {"purchase_date": "2026-09-28", "store": "Staples", "items": list(items)}


def prices(result: dict) -> list[float]:
    return [item["price"] for item in result["items"]]


def test_a_price_that_matches_the_unit_price_is_corrected_to_the_real_total() -> None:
    result = extract_receipt._fix_misread_unit_price(receipt(
        {"raw_name": "EPSON T232 BLACK INK 10343970564", "price": 40.49, "quantity_info": "2 @ 40.49"},
    ))

    assert prices(result) == [80.98]


def test_a_price_that_already_is_the_real_total_is_left_alone() -> None:
    result = extract_receipt._fix_misread_unit_price(receipt(
        {"raw_name": "EPSON T232 BLACK INK 10343970564", "price": 80.98, "quantity_info": "2 @ 40.49"},
    ))

    assert prices(result) == [80.98]


def test_a_single_quantity_line_is_left_alone() -> None:
    result = extract_receipt._fix_misread_unit_price(receipt(
        {"raw_name": "MILK", "price": 2.79, "quantity_info": "1 @ 2.79"},
    ))

    assert prices(result) == [2.79]


def test_a_weight_line_is_never_touched_even_if_price_matches_the_rate() -> None:
    result = extract_receipt._fix_misread_unit_price(receipt(
        {"raw_name": "BANANAS", "price": 4.99, "quantity_info": "1.2 kg @ $4.99/kg"},
    ))

    assert prices(result) == [4.99]


def test_an_item_with_no_quantity_info_is_left_alone() -> None:
    result = extract_receipt._fix_misread_unit_price(receipt(
        {"raw_name": "EGGS", "price": 8.99, "quantity_info": None},
    ))

    assert prices(result) == [8.99]


def test_reading_a_receipt_fixes_the_misread_price(monkeypatch: pytest.MonkeyPatch) -> None:
    reply = json.dumps(receipt(
        {"raw_name": "EPSON T232 BLACK INK 10343970564", "price": 40.49, "quantity_info": "2 @ 40.49"},
    ))
    monkeypatch.setattr(extract_receipt, "_image_ollama", lambda *args: reply)

    result = extract_receipt.extract_receipt(b"not really an image", "image/jpeg")

    assert prices(result) == [80.98]
