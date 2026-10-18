"""Dropping deals and anything bought on sale from a read receipt, so they never reach the items or price history."""

import json

import pytest

import extract_receipt


def receipt(*items: dict) -> dict:
    return {"purchase_date": "2026-09-28", "store": "Costco", "items": list(items)}


def names(result: dict) -> list[str]:
    return [item["raw_name"] for item in result["items"]]


def test_an_item_the_model_flagged_on_sale_is_dropped() -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "EGGS", "price": 8.99, "on_sale": False},
        {"raw_name": "BREAD", "price": 3.49, "on_sale": True},
    ))

    assert names(result) == ["EGGS"]
    assert "on_sale" not in result["items"][0]


def test_a_discount_line_takes_its_item_with_it() -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "5051501 CHICKN BITES", "price": 21.99},
        {"raw_name": "0000391935 /5051501", "price": 4.50},
        {"raw_name": "1706959 KS FR EGGS", "price": 8.99},
    ))

    assert names(result) == ["1706959 KS FR EGGS"]


def test_a_discount_line_does_not_take_an_item_whose_code_only_contains_its_code() -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "1234 BAKING SODA", "price": 3.99},
        {"raw_name": "0000391935 /1234", "price": 1.00},
        {"raw_name": "6123456 KS BUTTER", "price": 12.99},
        {"raw_name": "7712345 KS EGGS", "price": 9.99},
    ))

    assert names(result) == ["6123456 KS BUTTER", "7712345 KS EGGS"]


def test_a_size_with_a_slash_in_a_product_name_is_not_taken_for_a_discount() -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "CHEETOS 6/2000", "price": 9.99},
        {"raw_name": "2000 PASTA", "price": 2.49},
    ))

    assert names(result) == ["CHEETOS 6/2000", "2000 PASTA"]


@pytest.mark.parametrize(
    "line",
    [
        {"raw_name": "INSTANT SAVINGS", "price": 3.0},
        {"raw_name": "COUPON", "price": 1.5},
        {"raw_name": "MANAGER SPECIAL", "price": -2.0},
        {"raw_name": "PHY STAMP EARN", "price": 0.0},
    ],
)
def test_a_deal_line_is_never_an_item(line: dict) -> None:
    result = extract_receipt._drop_deals(receipt(line, {"raw_name": "EGGS", "price": 8.99}))

    assert names(result) == ["EGGS"]


@pytest.mark.parametrize("discount", ["STUDENT DISCOUNT", "SENIOR DISCOUNT", "MEMBERSHIP DISCOUNT"])
def test_a_student_or_senior_discount_is_not_a_sale_so_no_item_is_dropped_for_it(discount: str) -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "EGGS", "price": 8.99, "on_sale": False},
        {"raw_name": discount, "price": -2.0},
    ))

    assert names(result) == ["EGGS"]


def test_a_shelf_offer_under_an_item_is_cleared_but_the_item_stays() -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "DORITOS", "price": 4.99, "quantity_info": "$4.99 ea or 2/$9.00 KB"},
        {"raw_name": "ISLAND BAR", "price": 0.63, "quantity_info": "2 for $1.25"},
    ))

    assert [item["quantity_info"] for item in result["items"]] == [None, None]


def test_a_real_quantity_line_is_kept() -> None:
    result = extract_receipt._drop_deals(receipt(
        {"raw_name": "MILK", "price": 8.37, "quantity_info": "3 @ 2.79"},
        {"raw_name": "BANANAS", "price": 5.99, "quantity_info": "1.2 kg @ $4.99/kg"},
        {"raw_name": "GUMMIES", "price": 4.04, "quantity_info": "0.245 kg @ $16.50 /0.00xkg"},
        {"raw_name": "ALMONDS", "price": 3.50, "quantity_info": "350 g @ $1.00/100g"},
    ))

    assert [item["quantity_info"] for item in result["items"]] == [
        "3 @ 2.79",
        "1.2 kg @ $4.99/kg",
        "0.245 kg @ $16.50 /0.00xkg",
        "350 g @ $1.00/100g",
    ]


def test_a_receipt_with_no_items_is_left_alone() -> None:
    assert extract_receipt._drop_deals({"store": "Costco"}) == {"store": "Costco", "items": [], "_dropped_items": []}


def test_reading_a_receipt_drops_the_deals(monkeypatch: pytest.MonkeyPatch) -> None:
    reply = json.dumps(receipt(
        {"raw_name": "EGGS", "price": 8.99, "on_sale": False},
        {"raw_name": "BREAD", "price": 3.49, "on_sale": True},
    ))
    monkeypatch.setattr(extract_receipt, "_image_ollama", lambda *args: reply)

    result = extract_receipt.extract_receipt(b"not really an image", "image/jpeg")

    assert names(result) == ["EGGS"]
