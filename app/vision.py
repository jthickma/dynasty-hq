"""
OpenAI vision-based extraction. Turns CFB 26 roster / season-stats screenshots
into the canonical text formats the existing importer already understands —
no new parser path, just OCR + structured prompting.

Env: OPENAI_API_KEY (required), OPENAI_VISION_MODEL (optional, default gpt-4o).
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Iterable, Literal

import httpx

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")
TIMEOUT_SECONDS = float(os.environ.get("OPENAI_VISION_TIMEOUT", "90"))

ExtractMode = Literal["roster", "season_stats"]


class VisionConfigError(RuntimeError):
    """Raised when OpenAI is not configured (missing API key, etc.)."""


class VisionExtractionError(RuntimeError):
    """Raised when the model returned something we cannot use."""


# ---- Prompts ----------------------------------------------------------------

ROSTER_SYSTEM_PROMPT = """You are a CFB 26 dynasty data extractor.

You will receive one or more screenshots of MaxPlaysCFB / CFB 26 roster
screens. Extract every player visible into a CSV that matches this exact
header order:

RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV

If extended ratings are visible (any of:
JMP,STA,INJ,TGH,BTK,TRK,SFA,JKM,CTH,CIT,SPC,SRR,MRR,DRR,RLS,THP,SAC,MAC,DAC,
TUP,RUN,PAC,BSK,RBK,PBK,PBP,PBF,RBP,RBF,LBK,IBL,TAK,HPW,PUR,PRC,BSH,PMV,FMV,
ZCV,MCV,PRS), append them to the header in the order they appear on screen,
and emit the matching values for every row.

Rules — follow exactly:
- Output ONLY the CSV. No prose, no markdown fences, no preamble.
- One row per player.
- RS column: "yes" if the redshirt indicator is visible for that row,
  otherwise leave it BLANK (empty cell, not "no").
- YEAR: FR, SO, JR, or SR. Append " (RS)" if redshirt, e.g. "JR (RS)".
- For any rating you cannot read confidently, leave the cell BLANK.
  Never guess. Never write 0 for an unreadable rating.
- Quote names that contain commas or periods, e.g. "T.J. O'Neil".
- Skip team totals / aggregate rows.
"""

SEASON_STATS_SYSTEM_PROMPT = """You are a CFB 26 dynasty stats extractor.

You will receive screenshots of season stat leader screens. Output ONE
TEXT BLOCK in this exact format (the existing importer parses it):

TEAM - SECTION
header,row,csv
player,row,csv
player,row,csv

(blank line)

TEAM - SECTION
...

Where SECTION is one of: RUSHING, PASSING, RECEIVING, DEFENSE.

The header row for each section MUST be (in this order):

RUSHING:    NAME,POS,GP,CAR,YARDS,AVG,TD,AVG G,20+,BTK,YAC,LONG
PASSING:    NAME,POS,GP,COMP,ATT,COMP%,YARDS,TD,TD %,INT,INT %,TD:IN
RECEIVING:  NAME,POS,GP,REC,YARDS,AVG,TD,AVG G,LONG,RAC,RAC.AVG,DROP
DEFENSE:    NAME,POS,GP,SOLO,ASSISTS,TAK,TFL,SACK,INT,INT.YDS,INT.AVG,INT.L

Rules:
- Output ONLY the formatted block. No prose, no markdown fences.
- Skip TEAM / TOTAL aggregate rows.
- Use the exact team name visible at the top of the screen for the TEAM
  prefix; if no team name is visible, write "TEAM".
- Use the on-screen position label as POS. QB position may appear as "OB"
  in passing — keep whatever the screen shows.
- Numeric cells: omit thousands separators. Keep one decimal point where
  the screen shows one. Leave a cell BLANK if you cannot read it. Never
  guess.
- Quote names containing commas or periods.
"""


# ---- HTTP -------------------------------------------------------------------


def _api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise VisionConfigError(
            "OPENAI_API_KEY is not set — image import is disabled until it is configured."
        )
    return key


def _image_part(image_bytes: bytes, content_type: str) -> dict:
    """Build the chat-completions image_url part with a base64 data URL."""
    if content_type not in {"image/png", "image/jpeg", "image/webp", "image/gif"}:
        # OpenAI accepts these explicitly; default to png for unknown.
        content_type = "image/png"
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{content_type};base64,{encoded}"},
    }


def _call_openai(
    *,
    system_prompt: str,
    images: Iterable[tuple[bytes, str]],
    user_hint: str | None = None,
    model: str | None = None,
) -> str:
    parts: list[dict] = []
    if user_hint:
        parts.append({"type": "text", "text": user_hint})
    for image_bytes, content_type in images:
        parts.append(_image_part(image_bytes, content_type))

    if not parts or not any(p["type"] == "image_url" for p in parts):
        raise VisionExtractionError("At least one image is required for vision extraction.")

    body = {
        "model": model or DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": parts},
        ],
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
        resp = client.post(OPENAI_API_URL, headers=headers, json=body)

    if resp.status_code >= 400:
        # Don't leak the API key, but surface model/error context for debugging.
        try:
            payload = resp.json()
            err = payload.get("error", {}).get("message") or json.dumps(payload)[:300]
        except Exception:
            err = resp.text[:300]
        raise VisionExtractionError(f"OpenAI returned {resp.status_code}: {err}")

    data = resp.json()
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise VisionExtractionError(f"Unexpected OpenAI response shape: {data}") from exc

    return _strip_code_fences(text or "").strip()


# ---- Public API -------------------------------------------------------------


def extract_roster_csv(
    images: Iterable[tuple[bytes, str]],
    *,
    extra_instructions: str | None = None,
    model: str | None = None,
) -> str:
    """Extract MaxPlaysCFB-format roster CSV from one or more screenshots."""
    return _call_openai(
        system_prompt=ROSTER_SYSTEM_PROMPT,
        images=images,
        user_hint=extra_instructions,
        model=model,
    )


def extract_season_stats_text(
    images: Iterable[tuple[bytes, str]],
    *,
    team_name: str | None = None,
    extra_instructions: str | None = None,
    model: str | None = None,
) -> str:
    """Extract season-stats block (RUSHING/PASSING/RECEIVING/DEFENSE) from screenshots."""
    hint_parts = []
    if team_name:
        hint_parts.append(f"Use '{team_name.upper()}' as the TEAM prefix for every section.")
    if extra_instructions:
        hint_parts.append(extra_instructions)
    return _call_openai(
        system_prompt=SEASON_STATS_SYSTEM_PROMPT,
        images=images,
        user_hint="\n".join(hint_parts) or None,
        model=model,
    )


# ---- Helpers ----------------------------------------------------------------


_CODE_FENCE_RE = re.compile(r"^```(?:[a-zA-Z0-9_-]+)?\s*\n?(.*?)\n?```\s*$", re.DOTALL)


def _strip_code_fences(text: str) -> str:
    """LLMs sometimes wrap output in ```csv ... ``` despite instructions."""
    text = text.strip()
    m = _CODE_FENCE_RE.match(text)
    return m.group(1) if m else text
