"""GET /api/history, every recorded purchase newest first."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient


def history(client: TestClient, country: str = "CA") -> list[dict]:
    return client.get("/api/history", params={"country": country}).json()


def test_purchases_are_listed_newest_first_and_a_repeat_keeps_the_old_price(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(item_code="123456", price_cents=1000, purchased_on="2026-09-01")
    add_item(name="Butter", item_code="654321", price_cents=700, purchased_on="2026-09-20")
    add_item(item_code="123456", price_cents=1200, purchased_on="2026-09-25")

    assert [
        (entry["item_name"], entry["item_code"], entry["price_cents"], entry["purchased_on"])
        for entry in history(client)
    ] == [
        ("Large Eggs", "123456", 1200, "2026-09-25"),
        ("Butter", "654321", 700, "2026-09-20"),
        ("Large Eggs", "123456", 1000, "2026-09-01"),
    ]


def test_only_the_countrys_own_purchases_are_listed(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(country="CA", store="Costco", item_code="123456", purchased_on="2026-09-01")
    add_item(country="US", store="Target", item_code="123456", purchased_on="2026-09-02")

    assert [entry["store_name"] for entry in history(client, "US")] == ["Target"]


@pytest.mark.parametrize(
    ("rate", "cents_per_kg"), [("($7.72 per kg)", 772), ("($0.27 per 100g)", 270), ("($5.91 per lb)", 1303)]
)
def test_a_by_weight_purchase_records_its_rate_per_kg_not_the_price_paid(
    client: TestClient, add_item: Callable[..., dict], rate: str, cents_per_kg: int
) -> None:
    add_item(name=f"Granny Smith Apples {rate}", item_code="4011", price_cents=888, item_count=None)

    assert [entry["price_cents"] for entry in history(client)] == [cents_per_kg]


def test_an_item_with_a_size_and_a_typed_rate_still_records_the_price_paid(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(name="Sea Salt (500g) ($1.00 per 100g)", item_code="4011", price_cents=500, item_count=None)

    assert [entry["price_cents"] for entry in history(client)] == [500]
