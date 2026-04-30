"""
Tiny key/value wrapper around the `Setting` table.

Used for runtime config that should outlive a container restart but isn't
worth its own table — currently the OpenAI API key and the chosen vision
model. Env vars still win when set, so existing deployments keep working.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

from app.db import engine
from app.models import Setting

KEY_OPENAI_API_KEY = "openai_api_key"
KEY_OPENAI_VISION_MODEL = "openai_vision_model"


def _get(session: Session, key: str) -> Optional[str]:
    row = session.get(Setting, key)
    return row.value if row else None


def get(key: str) -> Optional[str]:
    with Session(engine) as session:
        return _get(session, key)


def set_value(session: Session, key: str, value: Optional[str]) -> None:
    row = session.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=value)
    else:
        row.value = value
        row.updated_at = datetime.now(timezone.utc)
    session.add(row)
    session.commit()


def all_settings(session: Session) -> dict[str, Optional[str]]:
    rows = session.exec(select(Setting)).all()
    return {r.key: r.value for r in rows}


# ---- OpenAI-specific resolution -------------------------------------------


def resolve_openai_api_key() -> Optional[str]:
    """Env var wins (back-compat), then DB."""
    return os.environ.get("OPENAI_API_KEY") or get(KEY_OPENAI_API_KEY)


def resolve_openai_vision_model(default: str = "gpt-4o") -> str:
    return (
        os.environ.get("OPENAI_VISION_MODEL")
        or get(KEY_OPENAI_VISION_MODEL)
        or default
    )
