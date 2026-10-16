"""Reading prices from the store-prices CSV."""

import pytest
from import_sheet import _parse_price_cents


@pytest.mark.parametrize("text", ["$NaN", "nan", "Infinity", "$inf", "-Infinity", "$", ""])
def test_an_unreadable_price_becomes_none(text: str) -> None:
    assert _parse_price_cents(text) is None


def test_a_normal_price_is_read_in_cents() -> None:
    assert _parse_price_cents("$4.00") == 400
    assert _parse_price_cents("$1,299.50") == 129950
