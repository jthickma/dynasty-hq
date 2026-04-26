from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session

from app.db import get_session
from app.importer import import_roster, parse_roster_csv
from app.models import Dynasty

router = APIRouter(prefix="/dynasties/{dynasty_id}/import", tags=["import"])


class RosterImportRequest(BaseModel):
    csv: str
    update_existing: bool = True


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
