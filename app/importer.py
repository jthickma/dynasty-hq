from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, col, select

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
# Section header tolerates: "AQUINAS - RUSHING", "Aquinas-Rushing",
# bare "RUSHING", "DEFENSIVE" variant, optional trailing "STATS".
STAT_SECTION_RE = re.compile(
    r"^\s*(?:.+?\s*[-–:]\s*)?"
    r"(?P<section>RUSHING|PASSING|RECEIVING|DEFENSE|DEFENSIVE)"
    r"(?:\s+STATS?)?\s*$",
    re.IGNORECASE,
)

# Header alias → canonical model field. Each section may map several normalized
# headers to the same field so the parser tolerates CFB 26 layout drift.
STAT_SECTION_COLUMNS = {
    "rushing": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "g": "games_played",
        "games": "games_played",
        "car": "rush_att",
        "att": "rush_att",
        "atts": "rush_att",
        "rushatt": "rush_att",
        "yards": "rush_yds",
        "yds": "rush_yds",
        "rushyds": "rush_yds",
        "avg": "rush_avg",
        "ypc": "rush_avg",
        "td": "rush_td",
        "tds": "rush_td",
        "rushtd": "rush_td",
        "avgg": "rush_yds_per_game",
        "ypg": "rush_yds_per_game",
        "20plus": "rush_20_plus",
        "20yds": "rush_20_plus",
        "btk": "rush_broken_tackles",
        "brk": "rush_broken_tackles",
        "btks": "rush_broken_tackles",
        "yac": "rush_yac",
        "long": "rush_long",
        "lng": "rush_long",
    },
    "passing": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "g": "games_played",
        "games": "games_played",
        "comp": "pass_comp",
        "cmp": "pass_comp",
        "att": "pass_att",
        "atts": "pass_att",
        "comppct": "pass_pct",
        "cmppct": "pass_pct",
        "pct": "pass_pct",
        "yards": "pass_yds",
        "yds": "pass_yds",
        "passyds": "pass_yds",
        "td": "pass_td",
        "tds": "pass_td",
        "passtd": "pass_td",
        "tdpct": "pass_td_pct",
        "int": "pass_int",
        "ints": "pass_int",
        "intpct": "pass_int_pct",
        "tdtoin": "pass_td_int_ratio",
        "tdtoint": "pass_td_int_ratio",
        "tdint": "pass_td_int_ratio",
        "tdintratio": "pass_td_int_ratio",
    },
    "receiving": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "g": "games_played",
        "games": "games_played",
        "rec": "receptions",
        "recs": "receptions",
        "yards": "rec_yds",
        "yds": "rec_yds",
        "recyds": "rec_yds",
        "avg": "rec_avg",
        "ypr": "rec_avg",
        "td": "rec_td",
        "tds": "rec_td",
        "rectd": "rec_td",
        "avgg": "rec_yds_per_game",
        "ypg": "rec_yds_per_game",
        "long": "rec_long",
        "lng": "rec_long",
        "rac": "rec_rac",
        "yac": "rec_rac",
        "racavg": "rec_rac_avg",
        "yacavg": "rec_rac_avg",
        "drop": "rec_drop",
        "drops": "rec_drop",
    },
    "defense": {
        "name": "name",
        "pos": "pos",
        "gp": "games_played",
        "g": "games_played",
        "games": "games_played",
        "solo": "solo_tackles",
        "solos": "solo_tackles",
        "assists": "assisted_tackles",
        "ast": "assisted_tackles",
        "asts": "assisted_tackles",
        "tak": "tackles",
        "tackles": "tackles",
        "tkl": "tackles",
        "tot": "tackles",
        "total": "tackles",
        "tfl": "tfl",
        "tfls": "tfl",
        "sack": "sacks",
        "sacks": "sacks",
        "sk": "sacks",
        "int": "interceptions",
        "ints": "interceptions",
        "intyds": "interception_yards",
        "intyards": "interception_yards",
        "intavg": "interception_avg",
        "intl": "interception_long",
        "intlong": "interception_long",
        "intlng": "interception_long",
        "ff": "ff",
        "fum": "ff",
        "fumf": "ff",
        "fr": "fr",
        "fumr": "fr",
        "fumrec": "fr",
    },
}

# "DEFENSIVE" is just an alias for the defense section.
SECTION_ALIASES = {"defensive": "defense"}

# Rows whose NAME column matches one of these are aggregate totals — skip them.
TOTAL_NAMES = {"team", "total", "totals", "teamtotal", "teamtotals"}

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
    # Parse via float so "5.4", "1,234", and "75%" all behave (float gets
    # truncated toward zero — matches displayed integer in CFB stat screens).
    f = _to_float(v)
    if f is None:
        return None
    return int(f)


def _to_float(v: Optional[str]) -> Optional[float]:
    s = _clean_cell(v)
    if s is None:
        return None
    # Drop thousands separators, percent signs, stray symbols. Keep digits,
    # one decimal point, leading minus.
    cleaned = s.replace(",", "")
    number = re.sub(r"[^0-9.\-]", "", cleaned)
    # Guard against multiple dots/dashes from OCR noise.
    if number.count(".") > 1:
        head, _, tail = number.partition(".")
        number = head + "." + tail.replace(".", "")
    if number in {"", "-", ".", "-."}:
        return None
    try:
        return float(number)
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
    # Strip BOM, NBSP, sort arrows, zero-width chars often pasted from web UI.
    for ch in ("﻿", " ", "​", "▼", "▲", "↑", "↓"):
        s = s.replace(ch, "")
    s = s.replace("%", "pct")
    s = s.replace("+", "plus")
    s = s.replace(":", "to")
    s = s.replace("/", "to")
    s = s.replace(".", "")
    s = s.replace(" ", "")
    return re.sub(r"[^a-z0-9]", "", s)


def _normalize_text(text: str) -> str:
    """Normalize a pasted block: strip BOM, NBSP, normalize newlines."""
    text = text.replace("﻿", "")
    text = text.replace(" ", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text


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
    lines = _normalize_text(raw_text).splitlines()
    i = 0

    while i < len(lines):
        match = STAT_SECTION_RE.match(lines[i])
        if not match:
            i += 1
            continue

        section = match.group("section").lower()
        section = SECTION_ALIASES.get(section, section)
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

            # Aggregate / total rows ("TEAM", "TOTAL") leak into pasted blocks.
            normalized_name = re.sub(r"[^a-z]", "", name.lower())
            if normalized_name in TOTAL_NAMES:
                i += 1
                continue

            parsed: dict = {"category": section, "name": name}
            pos = _normalize_stat_pos(row.get("pos"))
            if pos is not None:
                parsed["pos"] = pos

            # Resolve each header to a field. Multiple headers can map to the
            # same field (e.g., "att" and "atts") — first non-None wins.
            for header, field in section_columns.items():
                if field in {"name", "pos"}:
                    continue
                if header not in row:
                    continue
                value = _coerce_stat_value(field, row.get(header))
                if value is None:
                    continue
                if parsed.get(field) is None:
                    parsed[field] = value

            # Drop rows that have NO real stat data — they're noise lines that
            # happened to slot under the header (e.g., separator rules).
            stat_fields_present = any(
                k for k in parsed if k not in {"category", "name", "pos"}
            )
            if not stat_fields_present:
                i += 1
                continue

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

    # Preload all existing stat rows for this season — one query instead of N.
    player_ids = [p.id for p in players if p.id is not None]
    stat_lookup: dict[tuple[int, int], PlayerSeasonStat] = {}
    if player_ids:
        existing_stats = session.exec(
            select(PlayerSeasonStat).where(
                PlayerSeasonStat.season_year == season_year,
                col(PlayerSeasonStat.player_id).in_(player_ids),
            )
        ).all()
        for s in existing_stats:
            stat_lookup[(s.player_id, season_year)] = s

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
    reader = csv.reader(io.StringIO(_normalize_text(raw_csv).strip()))
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
        for header in headers:
            if header in {"rs", "name", "year", "pos", "ovr"} or header not in ALL_KNOWN:
                continue
            field = FIELD_RENAMES.get(header, header)
            parsed[field] = _to_int(row.get(header))

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

    # Single query for all existing players in this dynasty — avoids N+1 lookups.
    existing_index: dict[tuple[str, Optional[str]], Player] = {
        (p.name, p.pos): p
        for p in session.exec(select(Player).where(Player.dynasty_id == dynasty_id)).all()
    }

    for row in rows:
        key = (row["name"], row.get("pos"))
        existing = existing_index.get(key)

        if existing is None:
            player = Player(dynasty_id=dynasty_id, **row)
            session.add(player)
            existing_index[key] = player
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
