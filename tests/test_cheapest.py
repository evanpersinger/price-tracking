"""GET /api/cheapest, matching the same item across stores and comparing on unit price."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient


def cheapest(client: TestClient, country: str = "CA") -> list[dict]:
    return client.get("/api/cheapest", params={"country": country}).json()


def test_a_bigger_pack_can_win_on_price_per_item(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=1200, item_count=24)  # 50 cents each
    add_item(store="Fresco", price_cents=900, item_count=12)  # 75 cents each

    [store] = cheapest(client)
    [item] = store["items"]
    assert store["name"] == "Costco"
    assert (item["other_stores"], item["unit"], item["unit_price_cents"]) == (1, "each", 50)


def test_a_tie_lists_the_item_under_every_tied_store(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", price_cents=600, item_count=12)
    add_item(store="Fresco", price_cents=600, item_count=12)

    assert [store["name"] for store in cheapest(client)] == ["Costco", "Fresco"]


def test_an_item_sold_at_one_store_is_cheapest_there(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco")

    [store] = cheapest(client)
    assert store["items"][0]["other_stores"] == 0


def test_names_match_despite_case_and_a_typo(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Costco", name="Large Eggs", price_cents=1200, item_count=24)
    add_item(store="Fresco", name="large egs", price_cents=900, item_count=12)

    [store] = cheapest(client)
    assert store["name"] == "Costco"


def test_a_pound_and_454_grams_compare_per_gram(client: TestClient, add_imported: Callable[..., None]) -> None:
    add_imported("Costco", "Butter (1lb)", 500)
    add_imported("Fresco", "Butter (454g)", 450)

    [store] = cheapest(client)
    [item] = store["items"]
    assert store["name"] == "Fresco"
    assert item["unit"] == "g"
    assert item["unit_price_cents"] == pytest.approx(0.9912, abs=1e-4)


def test_an_item_with_no_size_is_left_out(client: TestClient, add_imported: Callable[..., None]) -> None:
    add_imported("Costco", "Mystery Item", 500)

    assert cheapest(client) == []


def test_gas_is_left_out_of_the_cheapest_items_and_search(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(store="Shell", name="Gas", fuel_type="Regular", item_count=1, volume_ml=26204, price_cents=4583)

    assert cheapest(client) == []
    assert client.get("/api/search", params={"country": "CA", "q": "gas"}).json() == []


def test_stores_in_another_country_are_not_compared(client: TestClient, add_item: Callable[..., dict]) -> None:
    add_item(country="CA", store="Costco", price_cents=1200, item_count=24)
    add_item(country="US", store="Costco", price_cents=900, item_count=12)

    [store] = cheapest(client, "CA")
    assert store["items"][0]["other_stores"] == 0
