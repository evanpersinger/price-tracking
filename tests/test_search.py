"""GET /api/search, what every store sells an item for, ordered from cheapest to most expensive."""

from collections.abc import Callable

from fastapi.testclient import TestClient


def search(client: TestClient, q: str, country: str = "CA") -> list[dict]:
    return client.get("/api/search", params={"country": country, "q": q}).json()


def test_stores_are_listed_cheapest_first_on_unit_price(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Walmart", price_cents=1000, item_count=12)  # 83 cents each
    add_item(store="Costco", price_cents=1200, item_count=24)  # 50 cents each
    add_item(store="Fresco", price_cents=900, item_count=12)  # 75 cents each

    [result] = search(client, "LARGE eggs")
    assert result["unit"] == "each"
    assert [(offer["store_name"], offer["price_cents"]) for offer in result["offers"]] == [
        ("Costco", 1200), ("Fresco", 900), ("Walmart", 1000),
    ]


def test_differently_named_versions_of_an_item_are_ranked_together(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(store="Fresco", name="Natural 2% Milk", price_cents=570, item_count=None, volume_ml=2000)
    add_item(store="Loblaws", name="2% Milk", price_cents=360, item_count=None, volume_ml=2000)

    [result] = search(client, "milk")
    assert [offer["store_name"] for offer in result["offers"]] == ["Loblaws", "Fresco"]


def test_a_search_word_matches_the_start_of_a_word_not_the_middle(
    client: TestClient, add_item: Callable[..., dict]
) -> None:
    add_item(store="Fresco", name="Graham Crackers", price_cents=400, item_count=1)
    add_item(store="Costco", name="Ham Sliced", price_cents=500, item_count=1)
    add_item(store="Walmart", name="Chicken Breast", price_cents=600, item_count=1)

    [ham] = search(client, "ham")
    assert [offer["store_name"] for offer in ham["offers"]] == ["Costco"]
    [chicken] = search(client, "chick")
    assert [offer["store_name"] for offer in chicken["offers"]] == ["Walmart"]


def test_a_search_with_no_match_returns_nothing(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco")

    assert search(client, "milk") == []
