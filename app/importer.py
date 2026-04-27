from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select

from app.models import Player, PlayerSeasonStat

# Canonical MaxPlaysCFB column order. Used to map headers → model fields.
# Keep lowercase for matching; map a couple of reserved/Python-safe aliases.
CORE_COLUMNS = [
    "rs",
    "name",
    "year",
    "pos",
    "ovr",
    "spd",
    "acc",
    "agi",
    "cod",
    "str",
    "awr",
    "car",
    "bcv",
]

EXTENDED_COLUMNS = [
    "jmp",
    "sta",
    "inj",
    "tgh",
    "btk",
    "trk",
    "sfa",
    "jkm",
    "cth",
    "cit",
    "spc",
    "srr",
    "mrr",
    "drr",
    "rls",
    "thp",
    "sac",
    "mac",
    "dac",
    "tup",
    "run",
    "pac",
    "bsk",
    "rbk",
    "pbk",
    "pbp",
    "pbf",
    "rbp",
    "rbf",
    "lbk",
    "ibl",
    "tak",
    "hpw",
    "pur",
    "prc",
    "bsh",
    "pmv",
    "fmv",
    "zcv",
    "mcv",
    "prs",
]

ALL_KNOWN = set(CORE_COLUMNS) | set(EXTENDED_COLUMNS)

# MaxPlays uses `STR` but `str` is a Python builtin and our model aliases it.
FIELD_RENAMES = {"str": "strength"}

# Year cell examples the importer must tolerate:
# "FR", "SO", "JR", "SR", "FR (RS)", "SO(RS)", "JR (RS)"
YEAR_RE = re.compile(r"^(FR|SO|JR|SR)\s*(\(RS\))?$", re.IGNORECASE)
STAT_SECTION_RE = re.compile(
    r"^\s*(?P<team>.+?)\s*-\s*(?P<section>RUSHING|PASSING|RECEIVING|DEFENSE)\s*$",
    re.IGNORECASE,
)

STAT_SECTION_COLUMNS = {
    "rushing": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "car": "rush_att",
        "yards": "rush_yds",
        "avg": "rush_avg",
        "td": "rush_td",
        "avgg": "rush_yds_per_game",
        "20plus": "rush_20_plus",
        "btk": "rush_broken_tackles",
        "yac": "rush_yac",
        "long": "rush_long",
    },
    "passing": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "comp": "pass_comp",
        "att": "pass_att",
        "comppct": "pass_pct",
        "yards": "pass_yds",
        "td": "pass_td",
        "tdpct": "pass_td_pct",
        "int": "pass_int",
        "intpct": "pass_int_pct",
        "tdtoin": "pass_td_int_ratio",
    },
    "receiving": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "rec": "receptions",
        "yards": "rec_yds",
        "avg": "rec_avg",
        "td": "rec_td",
        "avgg": "rec_yds_per_game",
        "long": "rec_long",
        "rac": "rec_rac",
        "racavg": "rec_rac_avg",
        "drop": "rec_drop",
    },
    "defense": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "solo": "solo_tackles",
        "assists": "assisted_tackles",
        "tak": "tackles",
        "tfl": "tfl",
        "sack": "sacks",
        "int": "interceptions",
        "intyds": "interception_yards",
        "intavg": "interception_avg",
        "intl": "interception_long",
    },
}

STAT_FLOAT_FIELDS = {
    "pass_pct",
    "pass_td_pct",
    "pass_int_pct",
    "pass_td_int_ratio",
    "rush_avg",
    "rush_yds_per_game",
    "rec_avg",
    "rec_yds_per_game",
    "rec_rac_avg",
    "sacks",
    "interception_avg",
}

STAT_POSITION_ALIASES = {"OB": "QB"}
POSITION_GROUPS = {
    "QB": {"QB"},
    "RB": {"HB", "FB", "RB"},
    "WR": {"WR"},
    "TE": {"TE"},
    "OL": {"LT", "LG", "C", "RG", "RT", "OL"},
    "DL": {"LE", "RE", "DT", "DL", "REDG"},
    "LB": {"LOLB", "MLB", "ROLB", "LB", "SAM", "WILL", "MIKE"},
    "DB": {"CB", "FS", "SS", "S", "DB"},
    "ST": {"K", "P", "LS"},
}


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


@dataclass
class SeasonStatsImportResult:
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


def _to_float(v: Optional[str]) -> Optional[float]:
    s = _clean_cell(v)
    if s is None:
        return None
    try:
        number = re.sub(r"[^0-9.\-]", "", s)
        return float(number) if number else None
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
    s = h.strip().lower()
    s = s.replace("▼", "")
    s = s.replace("%", "pct")
    s = s.replace("+", "plus")
    s = s.replace(":", "to")
    s = s.replace(".", "")
    s = s.replace(" ", "")
    return re.sub(r"[^a-z0-9]", "", s)


def _normalize_stat_pos(v: Optional[str]) -> Optional[str]:
    s = _clean_cell(v)
    if s is None:
        return None
    return STAT_POSITION_ALIASES.get(s.upper(), s.upper())


def _position_group(pos: Optional[str]) -> Optional[str]:
    if pos is None:
        return None
    normalized = pos.upper()
    for group, positions in POSITION_GROUPS.items():
        if normalized in positions:
            return group
    return None


def _coerce_stat_value(field: str, value: Optional[str]) -> Optional[int | float]:
    if field in STAT_FLOAT_FIELDS:
        return _to_float(value)
    return _to_int(value)


def parse_season_stats_text(raw_text: str) -> tuple[list[dict], list[str]]:
    warnings: list[str] = []
    rows: list[dict] = []
    lines = raw_text.splitlines()
    i = 0

    while i < len(lines):
        match = STAT_SECTION_RE.match(lines[i])
        if not match:
            i += 1
            continue

        section = match.group("section").lower()
        section_columns = STAT_SECTION_COLUMNS[section]
        line_no = i + 1
        i += 1

        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines):
            warnings.append(f"Section {section.upper()} at line {line_no} is missing a header row")
            break

        header_cells = next(csv.reader([lines[i]]))
        headers = [_normalize_header(h) for h in header_cells]
        i += 1

        unknown_headers = [h for h in headers if h not in section_columns]
        if unknown_headers:
            warnings.append(
                f"Section {section.upper()}: unknown columns will be ignored: {unknown_headers}"
            )

        while i < len(lines):
            if STAT_SECTION_RE.match(lines[i]):
                break
            if not lines[i].strip():
                i += 1
                continue

            raw_row = next(csv.reader([lines[i]]))
            cells = list(raw_row) + [""] * (len(headers) - len(raw_row))
            cells = cells[: len(headers)]
            row = dict(zip(headers, cells))

            name = _clean_cell(row.get("name"))
            if not name:
                warnings.append(f"Section {section.upper()} row {i + 1}: no NAME, skipped")
                i += 1
                continue

            parsed: dict = {"category": section, "name": name}
            pos = _normalize_stat_pos(row.get("pos"))
            if pos is not None:
                parsed["pos"] = pos

            for header, field in section_columns.items():
                if field in {"name", "pos"}:
                    continue
                if header not in row:
                    continue
                parsed[field] = _coerce_stat_value(field, row.get(header))

            rows.append(parsed)
            i += 1

    if not rows and not warnings:
        warnings.append("No season stat sections found")

    return rows, warnings


def import_season_stats(
    session: Session,
    dynasty_id: int,
    season_year: int,
    raw_text: str,
) -> SeasonStatsImportResult:
    rows, warnings = parse_season_stats_text(raw_text)
    result = SeasonStatsImportResult(
        created=0,
        updated=0,
        skipped=0,
        errors=list(warnings),
        total_rows=len(rows),
    )

    players = session.exec(select(Player).where(Player.dynasty_id == dynasty_id)).all()
    players_by_name: dict[str, list[Player]] = {}
    for player in players:
        players_by_name.setdefault(player.name.casefold(), []).append(player)

    stat_lookup: dict[tuple[int, int], PlayerSeasonStat] = {}

    for row in rows:
        name = row["name"]
        candidates = players_by_name.get(name.casefold(), [])
        if not candidates:
            result.skipped += 1
            result.errors.append(f"No player match for stats row: {name}")
            continue

        player = _resolve_stat_player(candidates, row.get("pos"))
        if player is None:
            result.skipped += 1
            result.errors.append(
                f"Ambiguous player match for stats row: {name}"
                + (f" ({row.get('pos')})" if row.get("pos") else "")
            )
            continue

        key = (player.id, season_year)
        stat = stat_lookup.get(key)
        if stat is None:
            stat = session.exec(
                select(PlayerSeasonStat).where(
                    PlayerSeasonStat.player_id == player.id,
                    PlayerSeasonStat.season_year == season_year,
                )
            ).first()
            if stat is not None:
                stat_lookup[key] = stat

        is_new = stat is None
        if stat is None:
            stat = PlayerSeasonStat(player_id=player.id, season_year=season_year)
            stat_lookup[key] = stat

        changed = False
        for field, value in row.items():
            if field in {"category", "name", "pos"} or value is None:
                continue
            if getattr(stat, field) != value:
                setattr(stat, field, value)
                changed = True

        if is_new:
            session.add(stat)
            result.created += 1
        elif changed:
            session.add(stat)
            result.updated += 1

    session.commit()
    return result


def _resolve_stat_player(candidates: list[Player], imported_pos: Optional[str]) -> Optional[Player]:
    if len(candidates) == 1:
        return candidates[0]
    if imported_pos is None:
        return None

    normalized_pos = imported_pos.upper()
    exact_matches = [
        player for player in candidates if (player.pos or "").upper() == normalized_pos
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]

    imported_group = _position_group(normalized_pos)
    if imported_group is None:
        return None

    grouped = [player for player in candidates if _position_group(player.pos) == imported_group]
    if len(grouped) == 1:
        return grouped[0]
    return None


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
    if headers[: len(CORE_COLUMNS)] != CORE_COLUMNS:
        warnings.append(
            f"Header does not start with canonical MaxPlaysCFB columns. "
            f"Got: {headers[: len(CORE_COLUMNS)]}"
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
