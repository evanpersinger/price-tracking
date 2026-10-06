"""Telling a gas station receipt from a grocery one by the words on it, and giving it its own prompt."""

import base64
import io

import pytest
import pytesseract
from PIL import Image

import extract_receipt


def a_receipt_image() -> str:
    """A tiny blank PNG as base64, what the OCR is mocked over."""
    buffer = io.BytesIO()
    Image.new("RGB", (10, 10), "white").save(buffer, format="PNG")
    return base64.standard_b64encode(buffer.getvalue()).decode()


def read_as(monkeypatch: pytest.MonkeyPatch, text: str) -> None:
    monkeypatch.setattr(pytesseract, "image_to_string", lambda *args, **kwargs: text)


def test_two_fuel_words_make_it_a_fuel_receipt(monkeypatch: pytest.MonkeyPatch) -> None:
    read_as(monkeypatch, "Pump # 15\nGrade: Unleaded\nLitres: 26.204\nPrice/Litre: $1.749\nFuel Sale: $45.83")

    assert extract_receipt._is_fuel_receipt(a_receipt_image()) is True


def test_one_fuel_word_on_a_grocery_receipt_is_not_enough(monkeypatch: pytest.MonkeyPatch) -> None:
    read_as(monkeypatch, "Grade A Large Eggs 4.99\nBananas 1.20\nSUBTOTAL 6.19")

    assert extract_receipt._is_fuel_receipt(a_receipt_image()) is False


def test_a_missing_tesseract_means_a_grocery_receipt(monkeypatch: pytest.MonkeyPatch) -> None:
    def missing(*args: object, **kwargs: object) -> str:
        raise pytesseract.TesseractNotFoundError()

    monkeypatch.setattr(pytesseract, "image_to_string", missing)

    assert extract_receipt._is_fuel_receipt(a_receipt_image()) is False


@pytest.mark.parametrize(("is_fuel", "prompt"), [(True, extract_receipt._FUEL_PROMPT), (False, extract_receipt._RECEIPT_PROMPT)])
def test_the_model_gets_the_prompt_for_that_kind_of_receipt(
    monkeypatch: pytest.MonkeyPatch, is_fuel: bool, prompt: str
) -> None:
    sent: dict = {}

    class Reply:
        def raise_for_status(self) -> None: ...

        def json(self) -> dict:
            return {"message": {"content": "{}"}}

    def post(url: str, json: dict, timeout: int) -> Reply:
        sent.update(json)
        return Reply()

    monkeypatch.setattr(extract_receipt, "_is_fuel_receipt", lambda image_b64: is_fuel)
    monkeypatch.setattr(extract_receipt.requests, "post", post)

    extract_receipt._image_ollama("any-model", a_receipt_image(), "image/png")

    assert sent["messages"][0]["content"] == prompt
