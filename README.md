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

## Running Dynasty HQ

Dynasty HQ supports two normal run modes:

- **Docker Compose** — production / homelab mode. The image builds the React SPA, runs FastAPI with Uvicorn, stores SQLite data in `./data`, and exposes the combined API + Web UI on port `8000`.
- **uv without Docker** — local machine mode. You build the SPA once with `npm`, then run the same FastAPI app with `uv`. The recommended command binds to `0.0.0.0`, so the Web UI is available across your LAN by default instead of only on localhost.

In both modes, FastAPI serves the frontend and backend from the same origin:

- Web UI: `/`
- API docs: `/docs`
- Health check: `/health`
- API routes: `/dynasties`, `/seasons`, `/settings`, and related nested routes

### Run Locally With uv

Use this when you want to run the app directly on your Mac or Linux machine without Docker.

Prerequisites:

- Python `3.12`
- `uv`
- Node.js `20` or newer
- `npm`

Install the backend dependencies:

```zsh
cd /Users/jacksonhickman/dynasty-hq
uv venv
uv pip install -e ".[dev]"
```

Install and build the frontend:

```zsh
cd /Users/jacksonhickman/dynasty-hq/frontend
npm install
npm run build
```

Run the combined Web UI + API server:

```zsh
cd /Users/jacksonhickman/dynasty-hq
mkdir -p data
DYNASTY_DB_PATH="$PWD/data/dynasty.db" \
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open it on the same machine:

```text
http://localhost:8000
```

Open it from another device on the same LAN:

```text
http://<server-lan-ip>:8000
```

On macOS, find the Wi-Fi LAN IP with:

```zsh
ipconfig getifaddr en0
```

If `en0` returns nothing, try:

```zsh
ipconfig getifaddr en1
```

The important part is `--host 0.0.0.0`. Uvicorn's default host is localhost-only, which prevents phones, tablets, or other computers on the LAN from reaching the Web UI. The command above intentionally makes the app listen on all network interfaces.

If a LAN device cannot connect:

- Confirm the server is still running.
- Confirm the LAN IP is correct.
- Confirm the device is on the same network.
- Allow incoming connections for Python/Uvicorn in the local firewall if macOS prompts for it.
- Try `http://<server-lan-ip>:8000/health`; it should return `{"status":"ok"}`.

### uv Development Mode

For day-to-day frontend work, run the backend and Vite dev server separately. This gives you Vite hot reload while the backend still listens on the LAN.

Terminal 1:

```zsh
cd /Users/jacksonhickman/dynasty-hq
mkdir -p data
DYNASTY_DB_PATH="$PWD/data/dynasty.db" \
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2:

```zsh
cd /Users/jacksonhickman/dynasty-hq/frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open Vite locally:

```text
http://localhost:5173
```

Open Vite from another LAN device:

```text
http://<server-lan-ip>:5173
```

The Vite dev server proxies API calls for `/dynasties`, `/seasons`, and `/health` to `http://localhost:8000`, so the frontend can call the backend without a separate API base URL.

### Docker Compose

Use this for the homelab deployment or any machine where you want a single containerized service.

```zsh
mkdir -p /opt/stacks/dynasty-hq
cd /opt/stacks/dynasty-hq
# copy project files here with git clone, scp, or rsync
mkdir -p data
docker compose up -d --build
```

The Docker image:

- Builds the React frontend in a Node stage.
- Copies `frontend/dist` into the runtime image at `/app/static`.
- Runs Uvicorn with `--host 0.0.0.0 --port 8000`.
- Uses `DYNASTY_DB_PATH=/data/dynasty.db`.
- Mounts host `./data` to container `/data`, so the SQLite database survives rebuilds.

GoDoxy discovers the service through the labels in `compose.yml`; the homelab instance is available at:

```text
https://dynasty.jickman.cc
```

Useful Docker commands:

```zsh
docker compose up -d --build              # build and start
docker compose logs -f dynasty-hq         # follow logs
docker compose ps                         # show container status
docker compose restart dynasty-hq         # restart app
docker compose down                       # stop and remove container
```

After code changes, rebuild the image:

```zsh
docker compose up -d --build
```

Do not delete `./data` unless you intentionally want to remove the local SQLite database.

### Tests And Checks

Run the backend test suite:

```zsh
cd /Users/jacksonhickman/dynasty-hq
uv run pytest
```

Run a single importer test:

```zsh
uv run pytest tests/test_importer.py::test_name -x
```

Run lint and formatting:

```zsh
uv run ruff check .
uv run ruff format .
```

Build the frontend:

```zsh
cd /Users/jacksonhickman/dynasty-hq/frontend
npm run build
```

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
