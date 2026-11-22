"""Ordering a receipt's date by how its store prints it, instead of trusting the model's day/month/year guess."""

from datetime import date

import extract_receipt


def receipt(store: str, purchase_date: str, date_printed: str | None) -> dict:
    return {"purchase_date": purchase_date, "date_printed": date_printed, "store": store, "items": []}


def test_a_superstore_date_is_read_year_month_day() -> None:
    result = extract_receipt._read_printed_date(receipt("REAL CANADIAN SUPERSTORE", "2018-10-26", "26/10/18"))

    assert result["purchase_date"] == "2026-10-18"


def test_a_dollarama_date_is_read_year_month_day() -> None:
    result = extract_receipt._read_printed_date(receipt("Dollarama", "2028-10-26", "26/10/28"))

    assert result["purchase_date"] == "2026-10-28"


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


TODAY = date(2026, 11, 22)


def test_a_future_date_is_swapped_for_the_one_reading_that_fits() -> None:
    result = extract_receipt._read_printed_date(receipt("Shoppers", "2028-10-26", "26/10/28"), today=TODAY)

    assert result["purchase_date"] == "2026-10-28"


def test_a_future_date_stays_when_no_reading_fits() -> None:
    result = extract_receipt._read_printed_date(receipt("Shoppers", "2028-10-26", "26/10/28"), today=date(2026, 12, 30))

    assert result["purchase_date"] == "2028-10-26"


def test_a_future_date_stays_when_two_readings_fit() -> None:
    # 10/11/26 is 10 Nov or 11 Oct 2026, both within 30 days of the 10th of November
    result = extract_receipt._read_printed_date(receipt("Shoppers", "2027-01-01", "10/11/26"), today=date(2026, 11, 10))

    assert result["purchase_date"] == "2027-01-01"


def test_a_date_that_isnt_in_the_future_is_left_alone() -> None:
    result = extract_receipt._read_printed_date(receipt("Shoppers", "2026-10-26", "26/10/28"), today=TODAY)

    assert result["purchase_date"] == "2026-10-26"
