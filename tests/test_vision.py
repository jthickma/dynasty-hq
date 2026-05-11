import app.vision as vision
from app.vision import _is_supported_vision_model


def test_supported_vision_model_accepts_gpt_5_family_and_newer() -> None:
    assert _is_supported_vision_model("gpt-5")
    assert _is_supported_vision_model("gpt-5-mini")
    assert _is_supported_vision_model("gpt-5-nano")
    assert _is_supported_vision_model("gpt-5.4-mini")
    assert _is_supported_vision_model("gpt-6")


def test_supported_vision_model_rejects_older_and_non_gpt_models() -> None:
    assert not _is_supported_vision_model("gpt-4o")
    assert not _is_supported_vision_model("gpt-4.1")
    assert not _is_supported_vision_model("o4-mini")
    assert not _is_supported_vision_model("chatgpt-5")


def test_supported_vision_model_rejects_non_vision_modalities() -> None:
    assert not _is_supported_vision_model("gpt-5-audio-preview")
    assert not _is_supported_vision_model("gpt-5-image")
    assert not _is_supported_vision_model("gpt-5-transcribe")
    assert not _is_supported_vision_model("text-embedding-5")


def test_list_openai_models_returns_only_supported_models(monkeypatch) -> None:
    class FakeResponse:
        status_code = 200

        def json(self) -> dict:
            return {
                "data": [
                    {"id": "gpt-4o", "created": 1, "owned_by": "openai"},
                    {"id": "gpt-5-mini", "created": 2, "owned_by": "openai"},
                    {"id": "gpt-5-nano", "created": 3, "owned_by": "openai"},
                    {"id": "gpt-5-image", "created": 4, "owned_by": "openai"},
                    {"id": "gpt-6", "created": 5, "owned_by": "openai"},
                ]
            }

    class FakeClient:
        def __init__(self, timeout: float) -> None:
            self.timeout = timeout

        def __enter__(self) -> "FakeClient":
            return self

        def __exit__(self, *args: object) -> None:
            pass

        def get(self, url: str, headers: dict) -> FakeResponse:
            assert url == vision.OPENAI_MODELS_URL
            assert headers == {"Authorization": "Bearer test-key"}
            return FakeResponse()

    monkeypatch.setattr(vision.httpx, "Client", FakeClient)

    models = vision.list_openai_models(api_key="test-key")

    assert [m["id"] for m in models] == ["gpt-5-mini", "gpt-5-nano", "gpt-6"]
    assert all(m["vision"] for m in models)
