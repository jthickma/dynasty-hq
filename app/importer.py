from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select

from app.models import Player

# Canonical MaxPlaysCFB column order. Used to map headers → model fields.
# Keep lowercase for matching; map a couple of reserved/Python-safe aliases.
CORE_COLUMNS = ["rs", "name", "year", "pos", "ovr",
                "spd", "acc", "agi", "cod", "str", "awr", "car", "bcv"]

EXTENDED_COLUMNS = [
    "jmp", "sta", "inj", "tgh", "btk", "trk", "sfa", "jkm", "cth", "cit",
    "spc", "srr", "mrr", "drr", "rls", "thp", "sac", "mac", "dac", "tup",
    "run", "pac", "bsk", "rbk", "pbk", "pbp", "pbf", "rbp", "rbf", "lbk",
    "ibl", "tak", "hpw", "pur", "prc", "bsh", "pmv", "fmv", "zcv", "mcv",
    "prs",
]

ALL_KNOWN = set(CORE_COLUMNS) | set(EXTENDED_COLUMNS)

# MaxPlays uses `STR` but `str` is a Python builtin and our model aliases it.
FIELD_RENAMES = {"str": "strength"}

# Year cell examples the importer must tolerate:
# "FR", "SO", "JR", "SR", "FR (RS)", "SO(RS)", "JR (RS)"
YEAR_RE = re.compile(r"^(FR|SO|JR|SR)\s*(\(RS\))?$", re.IGNORECASE)


@dataclass
class ImportResult:
    created: int
    updated: int
    skipped: int
    errors: list[str]
    total_rows: int

    def as_dict(self) -> dict:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": self.errors,
            "total_rows": self.total_rows,
        }


def _clean_cell(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = v.strip()
    if s == "" or s == "-" or s.lower() == "n/a":
        return None
    return s


def _to_int(v: Optional[str]) -> Optional[int]:
    s = _clean_cell(v)
    if s is None:
        return None
    try:
        # strip anything non-numeric (sometimes OCR leaves stray chars)
        digits = re.sub(r"[^\d-]", "", s)
        return int(digits) if digits else None
    except ValueError:
        return None


def _normalize_year(v: Optional[str]) -> Optional[str]:
    s = _clean_cell(v)
    if s is None:
        return None
    m = YEAR_RE.match(s.replace(" ", ""))
    if not m:
        # fall through — keep the raw value, trust the importer input
        return s.upper()
    base = m.group(1).upper()
    rs = m.group(2)
    return f"{base} (RS)" if rs else base


def _normalize_rs(v: Optional[str]) -> Optional[str]:
    s = _clean_cell(v)
    if s is None:
        return None
    return "yes" if s.lower() in {"yes", "y", "true", "1", "rs"} else None


def _normalize_header(h: str) -> str:
    """Strip the header to a lowercase key we can match."""
    return h.strip().lower().replace(" ", "").replace(".", "")


def parse_roster_csv(raw_csv: str) -> tuple[list[dict], list[str]]:
    """
    Parse a MaxPlaysCFB-formatted CSV string into a list of row dicts keyed by
    our model field names. Returns (rows, warnings).

    Handles:
    - Variable column counts (BCV minimum, up to PRS)
    - Blank RS column when not visible
    - YEAR with or without (RS) suffix
    - Periods inside names
    - Blank cells for unreadable ratings
    """
    warnings: list[str] = []

    # csv.DictReader handles quoted names with commas + periods correctly.
    reader = csv.reader(io.StringIO(raw_csv.strip()))
    try:
        raw_header = next(reader)
    except StopIteration:
        return [], ["CSV is empty"]

    headers = [_normalize_header(h) for h in raw_header]

    # Validate header — first 13 columns MUST match core schema.
    if headers[:len(CORE_COLUMNS)] != CORE_COLUMNS:
        warnings.append(
            f"Header does not start with canonical MaxPlaysCFB columns. "
            f"Got: {headers[:len(CORE_COLUMNS)]}"
        )

    unknown = [h for h in headers if h not in ALL_KNOWN]
    if unknown:
        warnings.append(f"Unknown columns will be ignored: {unknown}")

    rows: list[dict] = []
    for line_no, raw_row in enumerate(reader, start=2):
        if not any(cell.strip() for cell in raw_row):
            continue

        # Align cells to headers, padding short rows, truncating long ones
        cells = list(raw_row) + [""] * (len(headers) - len(raw_row))
        cells = cells[: len(headers)]
        row = dict(zip(headers, cells))

        name = _clean_cell(row.get("name"))
        if not name:
            warnings.append(f"Row {line_no}: no NAME, skipped")
            continue

        parsed: dict = {"name": name}
        parsed["rs"] = _normalize_rs(row.get("rs"))
        parsed["year"] = _normalize_year(row.get("year"))
        parsed["pos"] = _clean_cell(row.get("pos"))
        parsed["ovr"] = _to_int(row.get("ovr"))

        # Everything else is an integer rating (0-99)
        for col in headers:
            if col in {"rs", "name", "year", "pos", "ovr"} or col not in ALL_KNOWN:
                continue
            field = FIELD_RENAMES.get(col, col)
            parsed[field] = _to_int(row.get(col))

        rows.append(parsed)

    return rows, warnings


def import_roster(
    session: Session,
    dynasty_id: int,
    raw_csv: str,
    *,
    update_existing: bool = True,
) -> ImportResult:
    """
    Upsert players for a dynasty. Matching key: (dynasty_id, name, pos).
    Name+position is stable across seasons in-game (names don't change,
    position very rarely does on the roster screen).
    """
    rows, warnings = parse_roster_csv(raw_csv)
    result = ImportResult(
        created=0, updated=0, skipped=0, errors=list(warnings), total_rows=len(rows)
    )

    for row in rows:
        name = row["name"]
        pos = row.get("pos")

        stmt = select(Player).where(
            Player.dynasty_id == dynasty_id,
            Player.name == name,
            Player.pos == pos,
        )
        existing = session.exec(stmt).first()

        if existing is None:
            player = Player(dynasty_id=dynasty_id, **row)
            session.add(player)
            result.created += 1
        elif update_existing:
            for k, v in row.items():
                # Never clobber an existing rating with None — the new screenshot
                # may have had that column cropped out. Only overwrite with real values.
                if v is not None:
                    setattr(existing, k, v)
            session.add(existing)
            result.updated += 1
        else:
            result.skipped += 1

    session.commit()
    return result
