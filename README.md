# Dynasty HQ

CFB 26 Dynasty tracker — FastAPI + SQLModel + SQLite backend with a React/Tailwind SPA frontend bundled into the same container. Compatible with MaxPlaysCFB roster CSV output from the screenshot-to-CSV prompt.

## What it does

- Stores multi-season dynasty state (rosters, schedules, recruits, game results)
- Imports roster CSVs directly from Max's screenshot prompt output — preamble stripped, RS icons preserved, `(RS)` year tags kept, unreadable cells left blank
- **Screenshot OCR via OpenAI vision** — drop in raw roster / season-stats screenshots; the model emits the canonical CSV / text block which is then run through the same importer. API key + model are managed in the Settings page (model list pulled from `/v1/models`). See [docs/vision-ocr.md](docs/vision-ocr.md).
- Second import updates only cells that are present — never clobbers existing ratings with blanks from a cropped screenshot
- Auto-rolls season W-L / conference record when games are logged
- Rating leaders, stat leaders, roster summary by position group and class year
- Recruiting board with weekly hours budget tracker

## Deploy

Single-line deploy onto the homelab:

```zsh
mkdir -p /opt/stacks/dynasty-hq && cd /opt/stacks/dynasty-hq
# copy project files here (git clone / scp / rsync)
mkdir -p data
docker compose up -d --build
```

GoDoxy discovers it via the compose labels; it's live at `https://dynasty.jickman.cc`.

Logs: `docker compose logs -f dynasty-hq`
Rebuild after code changes: `docker compose up -d --build`

## Dev

Backend:
```zsh
uv venv
uv pip install -e ".[dev]"
uv run pytest
uv run uvicorn app.main:app --reload      # http://localhost:8000
```

Frontend (separate process during development; Vite proxies API to :8000):
```zsh
cd frontend
npm install
npm run dev                                # http://localhost:5173
```

Production / single-container:
```zsh
cd frontend && npm run build               # writes frontend/dist/
cd .. && uv run uvicorn app.main:app       # serves SPA + API on :8000
```

The Docker build does both stages automatically.

## Data flow

```
iPhone screenshot
    ↓
Claude + Max's roster prompt (your existing prompt)
    ↓
CSV block pasted into mobile app
    ↓
POST /dynasties/{id}/import/roster/text
    ↓
SQLite @ /data/dynasty.db
```

## API

All endpoints return JSON. Interactive docs at `/docs`.

### Dynasty
| Method | Path | Purpose |
|---|---|---|
| POST | `/dynasties` | Create dynasty + season 0 |
| GET | `/dynasties` | List all |
| GET | `/dynasties/{id}` | Get one |
| PATCH | `/dynasties/{id}` | Partial update |
| DELETE | `/dynasties/{id}` | Cascade delete |
| GET | `/dynasties/{id}/seasons` | List seasons |
| POST | `/dynasties/{id}/seasons` | Add season |

### Import
| Method | Path | Purpose |
|---|---|---|
| POST | `/dynasties/{id}/import/roster/text` | Paste Max's CSV output (preamble auto-stripped) |
| POST | `/dynasties/{id}/import/roster/file` | Upload CSV file |
| POST | `/dynasties/{id}/import/roster/preview` | Dry-run — returns parsed rows + warnings, writes nothing |
| POST | `/dynasties/{id}/import/roster/image` | Multipart upload of screenshots; OpenAI vision extracts CSV then imports |
| POST | `/dynasties/{id}/import/season-stats/image` | Same idea for season-stats leader screens |

Request body for `text` / `preview`:
```json
{ "csv": "RS,NAME,YEAR,POS,OVR,...", "update_existing": true }
```

Response:
```json
{ "created": 4, "updated": 0, "skipped": 0, "errors": [], "total_rows": 4 }
```

### Players
| Method | Path | Purpose |
|---|---|---|
| GET | `/dynasties/{id}/players` | List; query params: `pos_group`, `pos`, `year`, `min_ovr`, `search` |
| GET | `/dynasties/{id}/players/{pid}` | Detail |
| PATCH | `/dynasties/{id}/players/{pid}` | Partial update (dev_trait, jersey, archetype, etc.) |
| DELETE | `/dynasties/{id}/players/{pid}` | Remove |
| GET | `/dynasties/{id}/players/{pid}/stats` | Career season stats |
| POST | `/dynasties/{id}/players/{pid}/stats` | Add season stat line |

`pos_group` values: `QB`, `RB`, `WR`, `TE`, `OL`, `DL`, `LB`, `DB`, `ST`.

### Games
| Method | Path | Purpose |
|---|---|---|
| GET | `/seasons/{sid}/games` | List schedule |
| POST | `/seasons/{sid}/games` | Add game |
| PATCH | `/seasons/{sid}/games/{gid}` | Log result (auto-rolls season record) |
| DELETE | `/seasons/{sid}/games/{gid}` | Remove |

Setting `team_score` + `opp_score` on a game auto-derives `played=true` and `result=W/L`, then recomputes the parent season's W-L / conference record.

### Recruits
| Method | Path | Purpose |
|---|---|---|
| GET | `/dynasties/{id}/recruits` | List; filters: `pos`, `committed`, `min_stars` |
| POST | `/dynasties/{id}/recruits` | Add target |
| PATCH | `/dynasties/{id}/recruits/{rid}` | Update (hours, interest, commit status) |
| DELETE | `/dynasties/{id}/recruits/{rid}` | Remove |
| GET | `/dynasties/{id}/recruits/budget/weekly?cap=50` | Weekly hours budget tracker |

### Stats
| Method | Path | Purpose |
|---|---|---|
| GET | `/dynasties/{id}/stats/roster/summary` | Counts by pos group, class year, dev trait + avg OVR |
| GET | `/dynasties/{id}/stats/leaders/ratings?limit=10` | Top N by OVR overall + per position group |
| GET | `/dynasties/{id}/stats/leaders/stats?season_year=2026` | Stat category leaders for a given season |

## CSV import rules (matching Max's prompt)

- **RS column** — only populated when the far-left redshirt icon column is visible. `yes` → active RS. Blank = not active or column cropped.
- **YEAR** — kept as-is including `(RS)` suffix. Parsed into `FR`, `SO`, `JR`, `SR` with optional `(RS)` marker.
- **Names with periods** — `T.J. O'Neil`, `A.J. Green` parsed correctly via real CSV quoting, not split on the period.
- **Blank cells** — left as NULL in the DB, never 0. A cropped BCV from one screenshot won't erase an earlier full row.
- **Extended columns** — JMP through PRS auto-detected from header; anything beyond BCV only imported if present in the header row.
- **Preamble line** — "Here are your results! ..." line from Max's prompt is stripped automatically before parsing.
- **Match key** — (dynasty_id, name, pos). Second import updates in place, only overwriting columns that have real values.

## Schema

Core tables:
- `dynasty` — top-level container
- `season` — one per year per dynasty, holds W-L record
- `game` — schedule + per-game result / team stats / quarterly scoring
- `player` — 54 rating columns + bio, unique per (dynasty, name, pos)
- `player_season_stat` — per-season stat lines for the progression graph
- `recruit` — recruiting board targets with interest level + weekly hours

All ratings nullable — a missing value means "not observed yet", not zero.

## Frontend

React 18 + TypeScript + Vite + Tailwind + TanStack Query. Single SPA bundled to `frontend/dist/`, served as static files by FastAPI.

Pages: Dashboard, Roster (filter/search), Player detail (full ratings + season stats), Schedule (per-season games, score entry auto-rolls W-L), Recruits (board + weekly hours budget), Stats (rating + stat leaders), Import (paste CSV / file upload), Dynasties (manage and switch).

Mobile-first: sidebar collapses to a bottom nav under 768px; everything works one-handed.

The active dynasty is stored in `localStorage`. The dynasty's `accent_color` drives the UI accent via a CSS variable.

## Env vars

- `DYNASTY_DB_PATH` — SQLite file path, default `/data/dynasty.db`
- `DYNASTY_STATIC_DIR` — frontend dist path, default `/app/static` (Docker) or `./frontend/dist` (local fallback)
- `TZ` — timezone for timestamps
- `OPENAI_API_KEY` — optional; takes precedence over the value saved via the Settings page
- `OPENAI_VISION_MODEL` — optional; same precedence rule, default `gpt-4o`
- `OPENAI_VISION_TIMEOUT` — optional; per-request timeout in seconds, default `90`
