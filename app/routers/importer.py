from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session

from app.db import get_session
from app.importer import (
    import_roster,
    import_season_stats,
    parse_roster_csv,
    parse_season_stats_text,
)
from app.models import Dynasty
from app.vision import (
    VisionConfigError,
    VisionExtractionError,
    extract_roster_csv,
    extract_season_stats_text,
)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 12 * 1024 * 1024  # 12 MB per image — generous for 4K screenshots

router = APIRouter(prefix="/dynasties/{dynasty_id}/import", tags=["import"])


class RosterImportRequest(BaseModel):
    csv: str
    update_existing: bool = True


class SeasonStatsImportRequest(BaseModel):
    text: str
    season_year: int | None = None


@router.post("/roster/text")
def import_roster_text(
    dynasty_id: int,
    payload: RosterImportRequest,
    session: Session = Depends(get_session),
) -> dict:
    """
    Paste CSV straight from the Claude/MaxPlaysCFB prompt output.
    The block *with* the "Here are your results!" preamble is fine —
    anything before the header row is stripped automatically.
    """
    if not session.get(Dynasty, dynasty_id):
        raise HTTPException(404, "Dynasty not found")

    csv_text = _strip_preamble(payload.csv)
    result = import_roster(session, dynasty_id, csv_text, update_existing=payload.update_existing)
    return result.as_dict()


@router.post("/roster/file")
async def import_roster_file(
    dynasty_id: int,
    file: UploadFile = File(...),
    update_existing: bool = Form(True),
    session: Session = Depends(get_session),
) -> dict:
    if not session.get(Dynasty, dynasty_id):
        raise HTTPException(404, "Dynasty not found")

    raw = (await file.read()).decode("utf-8", errors="replace")
    csv_text = _strip_preamble(raw)
    result = import_roster(session, dynasty_id, csv_text, update_existing=update_existing)
    return result.as_dict()


@router.post("/roster/preview")
def preview_roster(
    dynasty_id: int,
    payload: RosterImportRequest,
    session: Session = Depends(get_session),
) -> dict:
    """Dry-run the import — returns parsed rows + warnings, writes nothing."""
    csv_text = _strip_preamble(payload.csv)
    rows, warnings = parse_roster_csv(csv_text)
    return {"rows": rows, "warnings": warnings, "count": len(rows)}


@router.post("/season-stats/text")
def import_season_stats_text(
    dynasty_id: int,
    payload: SeasonStatsImportRequest,
    session: Session = Depends(get_session),
) -> dict:
    dynasty = session.get(Dynasty, dynasty_id)
    if not dynasty:
        raise HTTPException(404, "Dynasty not found")

    result = import_season_stats(
        session,
        dynasty_id,
        payload.season_year or dynasty.current_season_year,
        payload.text,
    )
    return result.as_dict()


@router.post("/season-stats/file")
async def import_season_stats_file(
    dynasty_id: int,
    file: UploadFile = File(...),
    season_year: int | None = Form(None),
    session: Session = Depends(get_session),
) -> dict:
    dynasty = session.get(Dynasty, dynasty_id)
    if not dynasty:
        raise HTTPException(404, "Dynasty not found")

    raw = (await file.read()).decode("utf-8", errors="replace")
    result = import_season_stats(
        session,
        dynasty_id,
        season_year or dynasty.current_season_year,
        raw,
    )
    return result.as_dict()


@router.post("/season-stats/preview")
def preview_season_stats(
    dynasty_id: int,
    payload: SeasonStatsImportRequest,
    session: Session = Depends(get_session),
) -> dict:
    if not session.get(Dynasty, dynasty_id):
        raise HTTPException(404, "Dynasty not found")

    rows, warnings = parse_season_stats_text(payload.text)
    return {"rows": rows, "warnings": warnings, "count": len(rows)}


async def _read_images(files: list[UploadFile]) -> list[tuple[bytes, str]]:
    if not files:
        raise HTTPException(400, "At least one image is required")
    images: list[tuple[bytes, str]] = []
    for f in files:
        content_type = (f.content_type or "").lower()
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                400,
                f"Unsupported image type '{f.content_type}'. "
                f"Allowed: {sorted(ALLOWED_IMAGE_TYPES)}",
            )
        data = await f.read()
        if not data:
            raise HTTPException(400, f"Image '{f.filename}' is empty")
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                413, f"Image '{f.filename}' exceeds {MAX_IMAGE_BYTES // (1024 * 1024)} MB limit"
            )
        images.append((data, content_type))
    return images


@router.post("/roster/image")
async def import_roster_image(
    dynasty_id: int,
    files: list[UploadFile] = File(...),
    update_existing: bool = Form(True),
    dry_run: bool = Form(False),
    instructions: str | None = Form(None),
    session: Session = Depends(get_session),
) -> dict:
    """
    Upload one or more screenshots of the in-game roster screen. The image
    is sent to OpenAI's vision model, which returns canonical MaxPlaysCFB
    CSV — that CSV is then run through the same importer used for paste/CSV
    upload, so all the upsert / no-clobber rules still apply.

    Set `dry_run=true` to preview the extracted CSV without writing.
    """
    if not session.get(Dynasty, dynasty_id):
        raise HTTPException(404, "Dynasty not found")

    images = await _read_images(files)

    try:
        csv_text = extract_roster_csv(images, extra_instructions=instructions)
    except VisionConfigError as e:
        raise HTTPException(503, str(e)) from e
    except VisionExtractionError as e:
        raise HTTPException(502, str(e)) from e

    csv_text = _strip_preamble(csv_text)

    if dry_run:
        rows, warnings = parse_roster_csv(csv_text)
        return {
            "dry_run": True,
            "extracted_csv": csv_text,
            "rows": rows,
            "warnings": warnings,
            "count": len(rows),
        }

    result = import_roster(session, dynasty_id, csv_text, update_existing=update_existing)
    payload = result.as_dict()
    payload["extracted_csv"] = csv_text
    return payload


@router.post("/season-stats/image")
async def import_season_stats_image(
    dynasty_id: int,
    files: list[UploadFile] = File(...),
    season_year: int | None = Form(None),
    team_name: str | None = Form(None),
    dry_run: bool = Form(False),
    instructions: str | None = Form(None),
    session: Session = Depends(get_session),
) -> dict:
    """
    Upload one or more screenshots of season stat leader screens (rushing,
    passing, receiving, defense). The vision model converts them into the
    same text block the existing importer parses.
    """
    dynasty = session.get(Dynasty, dynasty_id)
    if not dynasty:
        raise HTTPException(404, "Dynasty not found")

    images = await _read_images(files)

    try:
        text = extract_season_stats_text(
            images,
            team_name=team_name,
            extra_instructions=instructions,
        )
    except VisionConfigError as e:
        raise HTTPException(503, str(e)) from e
    except VisionExtractionError as e:
        raise HTTPException(502, str(e)) from e

    if dry_run:
        rows, warnings = parse_season_stats_text(text)
        return {
            "dry_run": True,
            "extracted_text": text,
            "rows": rows,
            "warnings": warnings,
            "count": len(rows),
        }

    result = import_season_stats(
        session,
        dynasty_id,
        season_year or dynasty.current_season_year,
        text,
    )
    payload = result.as_dict()
    payload["extracted_text"] = text
    return payload


def _strip_preamble(text: str) -> str:
    """
    The CSV block is sometimes pasted with Max's preamble line
    ("Here are your results!...") above it. Drop everything before the
    canonical header row.
    """
    lines = text.splitlines()
    for i, line in enumerate(lines):
        lower = line.strip().lower().replace(" ", "")
        if lower.startswith("rs,name,year,pos,ovr"):
            return "\n".join(lines[i:])
    # no header found — return as-is and let the parser warn
    return text
