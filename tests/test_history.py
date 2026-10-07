"""GET /api/history, every recorded purchase newest first."""

from collections.abc import Callable

from fastapi.testclient import TestClient


def history(client: TestClient, country: str = "CA") -> list[dict]:
    return client.get("/api/history", params={"country": country}).json()


def test_purchases_are_listed_newest_first_and_a_repeat_keeps_the_old_price(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(item_code="123456", price_cents=1000, purchased_on="2026-09-01")
    add_item(name="Butter", price_cents=700, purchased_on="2026-09-20")
    add_item(item_code="123456", price_cents=1200, purchased_on="2026-09-25")

    assert [(entry["item_name"], entry["price_cents"], entry["purchased_on"]) for entry in history(client)] == [
        ("Large Eggs", 1200, "2026-09-25"),
        ("Butter", 700, "2026-09-20"),
        ("Large Eggs", 1000, "2026-09-01"),
    ]


def test_an_item_with_no_date_is_not_in_the_history(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item()

    assert history(client) == []


def test_only_the_countrys_own_purchases_are_listed(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(country="CA", store="Costco", purchased_on="2026-09-01")
    add_item(country="US", store="Target", purchased_on="2026-09-02")

    assert [entry["store_name"] for entry in history(client, "US")] == ["Target"]
