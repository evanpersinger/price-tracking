"""Ordering a receipt's date by how its store prints it, instead of trusting the model's day/month/year guess."""

import extract_receipt


def receipt(store: str, purchase_date: str, date_printed: str | None) -> dict:
    return {"purchase_date": purchase_date, "date_printed": date_printed, "store": store, "items": []}


def test_a_superstore_date_is_read_year_month_day() -> None:
    result = extract_receipt._read_printed_date(receipt("REAL CANADIAN SUPERSTORE", "2018-10-26", "26/10/18"))

    assert result["purchase_date"] == "2026-10-18"


def test_the_time_printed_after_the_date_is_ignored() -> None:
    result = extract_receipt._read_printed_date(receipt("REAL CANADIAN SUPERSTORE", "2018-10-26", "26/10/18 12:59:26"))

    assert result["purchase_date"] == "2026-10-18"


def test_a_store_that_isnt_listed_keeps_the_models_date() -> None:
    result = extract_receipt._read_printed_date(receipt("Costco", "2026-10-05", "10/05/2026"))

    assert result["purchase_date"] == "2026-10-05"
    assert "date_printed" not in result


def test_a_printed_date_that_isnt_a_real_date_keeps_the_models_date() -> None:
    result = extract_receipt._read_printed_date(receipt("REAL CANADIAN SUPERSTORE", "2026-10-18", "99/99/99"))

    assert result["purchase_date"] == "2026-10-18"
