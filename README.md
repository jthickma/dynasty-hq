# Dynasty HQ
## A tool that I built with claude and codex, inspired heavily by maxplayscfb, and the awesome tools on his website, maxplayscfb.com
## Dude is a pillar of this community.
## I know zero about coding, security practices, audit this code at your discretion. There shouldn't really be a major attack surface if you run locally. You should only run this locally. Very willing to accept PRs and any changes. For the OCR, the API key used should belong to its own separate project in the openai platform, and should have a strict, <$1 usage limit. I make no promises about application security, so do not risk your main API keys with unlimited usage. 

A self-hosted CFB 26 dynasty tracker. FastAPI + SQLModel + SQLite backend with a React/Tailwind SPA, bundled into one container or runnable directly with `uv` + `npm`. Built around the [MaxPlaysCFB](https://www.reddit.com/r/NCAAFBseries/) roster screenshot prompt — paste the CSV (or drop the screenshot in directly via OpenAI vision) and the importer takes care of the rest.

> Status: pre-release / community preview. Built for personal homelab use, hardened for sharing. PRs welcome.

---

## Features

- **Multi-season dynasty state** — rosters, schedules, recruits, per-game and per-season stats
- **MaxPlaysCFB-compatible roster import** — paste the CSV (with the "Here are your results!" preamble) or upload the file. Preamble auto-stripped, RS icons preserved, `(RS)` year tags kept, unreadable cells left blank
- **Screenshot OCR via OpenAI vision** — drop in raw roster / season-stat screenshots; the model emits canonical CSV / text which is fed into the same importer. API key + model are managed in the **Settings** page (model list pulled from `/v1/models`). Details: [docs/vision-ocr.md](docs/vision-ocr.md)
- **Non-destructive upserts** — repeat imports update only the cells that are present, never clobbering ratings with blanks from a cropped screenshot. Match key: `(dynasty, name, position)`
- **Auto-rolling W-L records** — log a game's score and the parent season's wins / losses / conference record recompute automatically
- **Rating + stat leaders** — top N by OVR overall and per position group, plus per-category statistical leaders for any season
- **Recruiting board** — interest, hours-spent, weekly hours-budget tracker, commitment status
- **Mobile-first SPA** — sidebar collapses to a bottom nav under 768px; works one-handed in the browser
- **Single origin** — FastAPI serves both API and Web UI, so there's no CORS dance for self-hosters

---

## Quick start

Pick whichever path fits.

### Option A — Local dev (`uv` + `npm`)

For running on your laptop, sharing across the LAN, or hacking on the code.

**Prerequisites:** Python 3.12, [`uv`](https://docs.astral.sh/uv/), Node.js 20+, `npm`.

```bash
# 1. Clone
git clone https://github.com/<you>/dynasty-hq.git
cd dynasty-hq

# 2. Backend deps (creates .venv automatically)
uv sync

# 3. Build the frontend (one-time, or after frontend changes)
cd frontend && npm install && npm run build && cd ..

# 4. Run — API + UI on a single port, reachable across your LAN
mkdir -p data
DYNASTY_DB_PATH="$PWD/data/dynasty.db" \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then open:

- Same machine: http://localhost:8000
- LAN device: `http://<server-lan-ip>:8000`
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

`--host 0.0.0.0` is intentional. Uvicorn defaults to localhost-only, which blocks phones / tablets / other LAN devices. If you only want it on this machine, drop the `--host` flag.

> Don't have `uv` yet? `curl -LsSf https://astral.sh/uv/install.sh | sh` (macOS / Linux) or see the [install docs](https://docs.astral.sh/uv/getting-started/installation/).

#### Find your LAN IP

```bash
# macOS Wi-Fi
ipconfig getifaddr en0   # try en1 if blank
# Linux
hostname -I | awk '{print $1}'
```

#### LAN device can't connect?

- Server still running? (check the terminal)
- Same Wi-Fi / VLAN as the server?
- Firewall — macOS may prompt to allow incoming connections for Python; allow it
- Sanity-check: `http://<server-lan-ip>:8000/health` should return `{"status":"ok"}`

### Option B — Hot-reload dev mode

Two terminals, Vite hot reload on the frontend, auto-reload on the backend.

```bash
# Terminal 1 — backend
mkdir -p data
DYNASTY_DB_PATH="$PWD/data/dynasty.db" \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Vite dev server
cd frontend
npm install   # first run only
npm run dev -- --host 0.0.0.0
```

Vite serves the SPA at http://localhost:5173 (or `http://<lan-ip>:5173`) and proxies `/dynasties`, `/seasons`, `/settings`, `/health`, and `/docs` to the backend on port 8000 — no `VITE_API_BASE` needed.

### Option C — Docker Compose (production / homelab)

Single container. Builds the SPA, runs FastAPI, persists SQLite to `./data` outside the image.

```bash
git clone https://github.com/<you>/dynasty-hq.git
cd dynasty-hq
mkdir -p data
docker compose up -d --build
```

Web UI at http://localhost:8000 — same routes as Option A. The container:

- Stages the frontend build from `node:20-alpine`
- Installs Python deps from `pyproject.toml` via `uv pip install`
- Mounts host `./data` to `/data` so the database survives rebuilds
- Sets `DYNASTY_DB_PATH=/data/dynasty.db` and `DYNASTY_STATIC_DIR=/app/static`

Useful commands:

```bash
docker compose up -d --build       # build + start
docker compose logs -f dynasty-hq  # follow logs
docker compose ps                  # status
docker compose restart dynasty-hq  # restart
docker compose down                # stop + remove (data preserved)
```

> The bundled `compose.yml` includes labels for [GoDoxy](https://github.com/yusing/go-proxy) auto-discovery. Strip them if you use a different reverse proxy — they're harmless if ignored.

---

## How import works

```
iPhone screenshot
    │
    ├─── Claude / GPT vision → CSV  (OR Max's roster prompt → paste CSV)
    │
    ▼
POST /dynasties/{id}/import/roster/{text|file|image}
    │
    ▼
SQLite @ $DYNASTY_DB_PATH
```

Three import paths, all converging on the same parser + upsert rules:

| Path | Endpoint | Use when |
|---|---|---|
| Paste | `POST /dynasties/{id}/import/roster/text` | You have CSV text (Max's prompt, hand-edited, etc.) |
| File | `POST /dynasties/{id}/import/roster/file` | You have a `.csv` file |
| Image | `POST /dynasties/{id}/import/roster/image` | You only have a screenshot — uses OpenAI vision OCR |

`/preview` variants exist for paste and image — they parse and return rows + warnings without writing anything. Set `dry_run=true` on `/image` for the same.

### Importer rules

- **Match key**: `(dynasty_id, name, pos)`
- **Never clobber real values with blanks** — a cropped screenshot won't erase ratings from a previous import
- **Core columns required**: `RS, NAME, YEAR, POS, OVR, SPD, ACC, AGI, COD, STR, AWR, CAR, BCV`
- **Extended columns auto-detected** from the header (anything from `JMP` to `PRS`)
- **`STR` → `strength`** in the model (Python builtin clash)
- **All ratings nullable** — NULL means "not observed", never zero
- **Names with periods / commas** parsed correctly via real CSV quoting (`"T.J. O'Neil"`, `"Smith, Jr."`)

---

## API reference

JSON in, JSON out. Interactive docs at `/docs`, OpenAPI schema at `/openapi.json`.

### Dynasty

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/dynasties` | Create dynasty + season 0 |
| `GET` | `/dynasties` | List all |
| `GET` | `/dynasties/{id}` | Get one |
| `PATCH` | `/dynasties/{id}` | Partial update |
| `DELETE` | `/dynasties/{id}` | Cascade delete |
| `GET` | `/dynasties/{id}/seasons` | List seasons |
| `POST` | `/dynasties/{id}/seasons` | Add season |

### Import

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/dynasties/{id}/import/roster/text` | Paste CSV (preamble auto-stripped) |
| `POST` | `/dynasties/{id}/import/roster/file` | Upload CSV file |
| `POST` | `/dynasties/{id}/import/roster/preview` | Dry run — parsed rows + warnings, no writes |
| `POST` | `/dynasties/{id}/import/roster/image` | Multipart screenshots → vision OCR → import |
| `POST` | `/dynasties/{id}/import/season-stats/text` | Paste season-stats block |
| `POST` | `/dynasties/{id}/import/season-stats/file` | Upload season-stats text file |
| `POST` | `/dynasties/{id}/import/season-stats/preview` | Dry run for stats |
| `POST` | `/dynasties/{id}/import/season-stats/image` | Screenshots → vision OCR → import |

Roster paste body:

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
| `GET` | `/dynasties/{id}/players` | List; filters: `pos_group`, `pos`, `year`, `min_ovr`, `search` |
| `GET` | `/dynasties/{id}/players/{pid}` | Detail |
| `PATCH` | `/dynasties/{id}/players/{pid}` | Partial update (dev_trait, jersey, archetype, …) |
| `DELETE` | `/dynasties/{id}/players/{pid}` | Remove |
| `GET` | `/dynasties/{id}/players/{pid}/stats` | Career season stats |
| `POST` | `/dynasties/{id}/players/{pid}/stats` | Add season stat line |
| `PATCH` | `/dynasties/{id}/players/{pid}/stats/{sid}` | Update one season's stats |
| `DELETE` | `/dynasties/{id}/players/{pid}/stats/{sid}` | Remove |

`pos_group` values: `QB, RB, WR, TE, OL, DL, LB, DB, ST`.

### Games

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/seasons/{sid}/games` | Schedule |
| `POST` | `/seasons/{sid}/games` | Add game |
| `PATCH` | `/seasons/{sid}/games/{gid}` | Log result (auto-rolls season W-L + conference record) |
| `DELETE` | `/seasons/{sid}/games/{gid}` | Remove |

Setting `team_score` + `opp_score` derives `played=true` and `result=W/L`, then recomputes the parent season's record.

### Recruits

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/dynasties/{id}/recruits` | List; filters: `pos`, `committed`, `min_stars` |
| `POST` | `/dynasties/{id}/recruits` | Add target |
| `PATCH` | `/dynasties/{id}/recruits/{rid}` | Update (hours, interest, commit status) |
| `DELETE` | `/dynasties/{id}/recruits/{rid}` | Remove |
| `GET` | `/dynasties/{id}/recruits/budget/weekly?cap=50` | Weekly hours budget tracker |

### Stats

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/dynasties/{id}/stats/roster/summary` | Counts by pos group, class year, dev trait + avg OVR |
| `GET` | `/dynasties/{id}/stats/leaders/ratings?limit=10` | Top N by OVR overall + per group |
| `GET` | `/dynasties/{id}/stats/leaders/stats?season_year=2026` | Stat category leaders |

### Settings

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/settings` | Whether OpenAI key is set + which source (env / db / unset) |
| `PUT` | `/settings` | Save OpenAI API key + vision model |
| `GET` | `/settings/openai/models` | Proxy to OpenAI `/v1/models`, flagged with vision-capable hint |
| `POST` | `/settings/openai/test` | Connectivity check for the saved (or supplied) key |

The API key is write-only over the wire — `GET /settings` never returns the plaintext value.

---

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `DYNASTY_DB_PATH` | `/data/dynasty.db` | SQLite file path |
| `DYNASTY_STATIC_DIR` | `/app/static` (Docker), `./frontend/dist` (local fallback) | SPA build directory |
| `OPENAI_API_KEY` | unset | Optional — takes precedence over the key saved in Settings |
| `OPENAI_VISION_MODEL` | `gpt-4o` | Optional — same precedence rule |
| `OPENAI_VISION_TIMEOUT` | `90` | Per-request timeout (seconds) |
| `TZ` | system | Timezone for timestamps |

Env vars always win over DB-stored values, so existing self-hosters can keep their setups. New users can configure everything from the Settings page in the Web UI — no shell access required.

---

## Schema

Core tables, all in [app/models/__init__.py](app/models/__init__.py):

- `dynasty` — top-level container
- `season` — one per year per dynasty, holds W-L record
- `game` — schedule + per-game result, team stats, quarterly scoring
- `player` — 54 rating columns + bio, unique per `(dynasty, name, pos)`
- `player_season_stat` — per-season stat lines for the progression graph
- `recruit` — recruiting board entries with interest level + weekly hours
- `setting` — singleton key/value store (API key, vision model)

All ratings are nullable — a missing value means "not observed yet", never zero.

> No migrations yet. Schema changes require manual ALTER or a wipe of `data/dynasty.db`. If you're contributing a schema change, call it out clearly in the PR.

---

## Tests + checks

```bash
uv run pytest                                          # full suite
uv run pytest tests/test_importer.py::test_name -x     # single test
uv run ruff check .                                    # lint
uv run ruff format .                                   # format
cd frontend && npm run build                           # type-check + build SPA
```

CI hasn't shipped yet. Until then, run the four commands above before opening a PR.

---

## Frontend stack

React 18 + TypeScript + Vite + Tailwind + TanStack Query. Single SPA bundled to `frontend/dist/`, served as static files by FastAPI in production.

Pages: Dashboard, Roster (filter / search), Player detail (full ratings + season stats), Schedule (per-season games, score entry auto-rolls W-L), Recruits (board + weekly hours budget), Stats (rating + stat leaders), Import (paste / file / image), Settings (OpenAI key + model picker), Dynasties (manage + switch).

The active dynasty lives in `localStorage`. The dynasty's `accent_color` drives the UI accent via a CSS variable.

---

## Contributing

PRs welcome — bug fixes, new features, docs, examples. Before opening a PR:

1. `uv run pytest` passes
2. `uv run ruff check .` is clean
3. `cd frontend && npm run build` succeeds
4. New backend behavior has a test in `tests/`
5. If the schema changes, note it in the PR (no migrations yet)

Issues / discussion: please use GitHub issues. For bugs, include the dynasty action you took, the request payload (if relevant), and the response or error.

---

## License

TBD — pending release.
