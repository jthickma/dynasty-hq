"""
App-wide settings: OpenAI API key, vision model selection, and a passthrough
for OpenAI's `GET /v1/models` endpoint so the UI can populate a model picker.

API key is write-only over the wire — GET returns whether it is set, never the
plaintext value.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.db import get_session
from app.models import Setting
from app.settings_store import (
    KEY_OPENAI_API_KEY,
    KEY_OPENAI_VISION_MODEL,
    resolve_openai_vision_model,
    set_value,
)
from app.vision import (
    DEFAULT_MODEL,
    VisionConfigError,
    VisionExtractionError,
    list_openai_models,
)

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsRead(BaseModel):
    openai_api_key_set: bool
    openai_api_key_source: str  # "env" | "db" | "unset"
    openai_vision_model: str
    openai_vision_model_source: str  # "env" | "db" | "default"
    default_model: str


class SettingsUpdate(BaseModel):
    openai_api_key: str | None = Field(
        default=None,
        description="Plaintext OpenAI API key. Send empty string to clear.",
    )
    openai_vision_model: str | None = Field(
        default=None,
        description="Model id from GET /settings/openai/models. Empty to clear.",
    )


@router.get("", response_model=SettingsRead)
def read_settings(session: Session = Depends(get_session)) -> SettingsRead:
    import os

    env_key = os.environ.get("OPENAI_API_KEY")
    db_key_row = session.get(Setting, KEY_OPENAI_API_KEY)
    db_key_value = db_key_row.value if db_key_row else None
    if env_key:
        key_source = "env"
    elif db_key_value:
        key_source = "db"
    else:
        key_source = "unset"

    env_model = os.environ.get("OPENAI_VISION_MODEL")
    db_model_row = session.get(Setting, KEY_OPENAI_VISION_MODEL)
    db_model_value = db_model_row.value if db_model_row else None
    if env_model:
        model_source = "env"
    elif db_model_value:
        model_source = "db"
    else:
        model_source = "default"

    return SettingsRead(
        openai_api_key_set=bool(env_key or db_key_value),
        openai_api_key_source=key_source,
        openai_vision_model=resolve_openai_vision_model(default=DEFAULT_MODEL),
        openai_vision_model_source=model_source,
        default_model=DEFAULT_MODEL,
    )


@router.put("", response_model=SettingsRead)
def update_settings(
    payload: SettingsUpdate,
    session: Session = Depends(get_session),
) -> SettingsRead:
    if payload.openai_api_key is not None:
        # Empty string clears the stored key (env var still wins if present).
        value = payload.openai_api_key.strip() or None
        set_value(session, KEY_OPENAI_API_KEY, value)
    if payload.openai_vision_model is not None:
        value = payload.openai_vision_model.strip() or None
        set_value(session, KEY_OPENAI_VISION_MODEL, value)
    return read_settings(session)


@router.get("/openai/models")
def get_openai_models(api_key: str | None = None) -> dict:
    """
    Proxy GET /v1/models. If `api_key` query param is provided we use it
    (lets the UI test a key before saving); otherwise the resolved key is used.

    Returns: {models: [{id, created, owned_by, vision}], default: "gpt-4o"}
    """
    try:
        models = list_openai_models(api_key=api_key)
    except VisionConfigError as e:
        raise HTTPException(503, str(e)) from e
    except VisionExtractionError as e:
        raise HTTPException(502, str(e)) from e
    return {"models": models, "default": DEFAULT_MODEL}


@router.post("/openai/test")
def test_openai_key(payload: dict | None = None) -> dict:
    """
    Cheap connectivity check — calls /v1/models with the resolved (or supplied)
    key. Useful for the Settings page "Test connection" button.
    """
    api_key = (payload or {}).get("api_key") if payload else None
    try:
        models = list_openai_models(api_key=api_key)
    except VisionConfigError as e:
        raise HTTPException(503, str(e)) from e
    except VisionExtractionError as e:
        raise HTTPException(502, str(e)) from e
    return {"ok": True, "model_count": len(models)}
