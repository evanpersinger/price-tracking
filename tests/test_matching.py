"""Reading sizes out of item names and deciding two sizes are the same."""

from server import _same_sizes, _split_name


def test_sizes_are_taken_out_of_the_words() -> None:
    words, amounts = _split_name("Villagio Hamburger Buns (8x) ($0.50 per bun)")

    assert words == "villagio hamburger buns"
    assert amounts == {"count": 8}


def test_weights_become_grams_and_volumes_become_ml() -> None:
    assert _split_name("Rice (2kg)")[1] == {"weight": 2000}
    assert _split_name("Juice (1.5L)")[1] == {"volume": 1500}


def test_an_amount_written_twice_keeps_the_first() -> None:
    assert _split_name("Butter (454g) (1lb)")[1] == {"weight": 454}


def test_oz_next_to_a_volume_is_fluid_ounces_not_a_weight() -> None:
    assert _split_name("Cola (709ml) (24oz)")[1] == {"volume": 709}


def test_a_bracket_that_is_not_a_plain_size_stays_in_the_words() -> None:
    words, amounts = _split_name("Vitamin D (250mg per)")

    assert words == "vitamin d (250mg per)"
    assert amounts == {}


def test_sizes_within_two_percent_are_the_same() -> None:
    assert _same_sizes({"weight": 453.592}, {"weight": 454})
    assert not _same_sizes({"weight": 500}, {"weight": 454})
    assert not _same_sizes({"weight": 454}, {"volume": 454})
