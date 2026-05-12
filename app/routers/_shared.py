"""
Shared utilities for routers: patch helper, common patterns.
"""

from typing import Any

from app.models import POSITION_GROUP_NAMES, POSITION_GROUPS


def patch_fields(obj: Any, patch: dict, protected: set[str]) -> None:
    """Apply a dict patch to a SQLModel instance, skipping protected fields."""
    for k, v in patch.items():
        if k in protected or not hasattr(obj, k):
            continue
        setattr(obj, k, v)


def resolve_pos_group(pos_group: str) -> list[str]:
    """Resolve a position group name to its member positions.

    Raises ValueError if unknown.
    """
    group = pos_group.upper()
    if group not in POSITION_GROUPS:
        raise ValueError(
            f"Unknown position group {group!r}. Valid: {', '.join(POSITION_GROUP_NAMES)}"
        )
    return list(POSITION_GROUPS[group])
