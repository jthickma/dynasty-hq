# Dynasty HQ Agents Guide

This guide is for AI agents and contributors who need a fast, accurate mental
model of the codebase. It focuses on architecture, data flow, key functions,
and safe extension points. Use it as a map before making changes.

## 1. System overview

Dynasty HQ is a single-origin web app:

- FastAPI backend with SQLModel + SQLite
- React SPA bundled and served by the backend
- Optional OpenAI vision OCR for roster and season stat screenshots

High-level flow:

```
Browser (SPA)
  |  REST (JSON / multipart)
  v
FastAPI app
  |  SQLModel session
  v
SQLite (dynasty.db)

Optional OCR path:
Images -> OpenAI vision -> text/CSV -> importer -> SQLite
```

Key entry points:

- API server bootstrapping: [app/main.py](app/main.py)
- Database engine and session: [app/db.py](app/db.py)
- Data models: [app/models/**init**.py](app/models/__init__.py)
- Importer logic (roster + season stats): [app/importer.py](app/importer.py)
- Vision OCR client and prompts: [app/vision.py](app/vision.py)
- Settings persistence (OpenAI key/model): [app/settings_store.py](app/settings_store.py)
- Router groups: [app/routers/dynasty.py](app/routers/dynasty.py), [app/routers/players.py](app/routers/players.py),
  [app/routers/games.py](app/routers/games.py), [app/routers/recruits.py](app/routers/recruits.py),
  [app/routers/stats.py](app/routers/stats.py), [app/routers/importer.py](app/routers/importer.py),
  [app/routers/settings.py](app/routers/settings.py)
- Frontend entry and routes: [frontend/src/main.tsx](frontend/src/main.tsx), [frontend/src/App.tsx](frontend/src/App.tsx)
- Frontend API client: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)

## 2. Backend architecture

### 2.1 App lifecycle and routing

- [app/main.py](app/main.py) builds the FastAPI app and registers all routers.
- `lifespan()` calls `init_db()` at startup to create tables if missing.
- Static assets are served when available; otherwise FastAPI returns API 404 for
  reserved prefixes. The SPA fallback serves `index.html` for client-side routes.

Important design choices:

- CORS is currently wide-open (allow all origins, headers, methods). This is
  convenient for local dev but should be restricted for public hosting.
- The app is single-origin in production: the SPA is served by the same process.

### 2.2 Database, models, and invariants

- Database config: [app/db.py](app/db.py)
  - `DYNASTY_DB_PATH` controls the SQLite file location (default /data/dynasty.db).
  - The engine uses `check_same_thread=False` for SQLite concurrency.

- Core data model: [app/models/**init**.py](app/models/__init__.py)
  - `Dynasty` is the root entity. Everything else hangs off its id.
  - `Season` stores year and W-L record.
  - `Game` stores schedule and results. Score update recomputes W-L.
  - `Player` stores ratings and metadata. All ratings are nullable.
  - `PlayerSeasonStat` stores per-season stat lines.
  - `Recruit` stores recruiting board data.
  - `Setting` is a simple key/value store for app-wide config.

Key invariants:

- Player uniqueness is by `(dynasty_id, name, pos)`.
- Ratings are nullable. Missing values mean "not observed", not zero.
- `Player.strength` is the model field for roster CSV column `STR`.

### 2.3 Importer (core parsing and upsert rules)

- Parser and importer: [app/importer.py](app/importer.py)

Main functions and their roles:

- `parse_roster_csv()`
  - Accepts player ratings -style CSV.
  - Normalizes headers and rows.
  - Returns rows + warnings, but never writes to DB.
- `import_roster()`
  - Upserts players by `(dynasty_id, name, pos)`.
  - Non-destructive: it never overwrites a non-null value with null.
  - Used by all roster import paths (text, file, image OCR).
- `parse_season_stats_text()`
  - Parses the season stats text block and maps headers to model fields.
  - Skips aggregate rows (TEAM, TOTAL).
- `import_season_stats()`
  - Upserts `PlayerSeasonStat` for a given season.
  - Attempts to disambiguate players by position and position group.

The importer is the stable "contract" of the system. OCR, CSV paste, and file
upload all feed into the same parse and upsert functions.

### 2.4 Vision OCR pipeline

- OCR client and prompts: [app/vision.py](app/vision.py)
- HTTP endpoints: [app/routers/importer.py](app/routers/importer.py)
- Settings source: [app/settings_store.py](app/settings_store.py)

Key functions:

- `extract_roster_csv()` uses a strict system prompt that returns CSV only.
- `extract_season_stats_text()` returns the text block expected by
  `parse_season_stats_text()`.
- `list_openai_models()` fetches models and filters to GPT-5-family or newer.

Model and credential precedence:

1. Per-call override (router level)
2. Environment variables (`OPENAI_API_KEY`, `OPENAI_VISION_MODEL`)
3. `Setting` table (via Settings page)

### 2.5 Settings subsystem

- `Setting` table: [app/models/**init**.py](app/models/__init__.py)
- Store helpers: [app/settings_store.py](app/settings_store.py)
- API surface: [app/routers/settings.py](app/routers/settings.py)

Behavior notes:

- The API never returns the plaintext OpenAI key.
- Env vars override the DB value.
- Settings are used for OpenAI API key and OCR model selection.

### 2.6 Games and auto-record logic

- Game routes: [app/routers/games.py](app/routers/games.py)
- When `team_score` and `opp_score` are set, `played` and `result` are derived.
- Season W-L and conference record are recomputed from played games.

## 3. Frontend architecture

The frontend is a Vite + React SPA that talks to the backend through a small
API wrapper. It is served by FastAPI in production.

Key files:

- Vite config: [frontend/vite.config.ts](frontend/vite.config.ts)
- App entry: [frontend/src/main.tsx](frontend/src/main.tsx)
- App routes: [frontend/src/App.tsx](frontend/src/App.tsx)
- Layout and navigation: [frontend/src/components/Layout.tsx](frontend/src/components/Layout.tsx)
- API client: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
- Global styles: [frontend/src/styles.css](frontend/src/styles.css)

Frontend behavior notes:

- Vite dev server proxies `/dynasties`, `/seasons`, `/settings`, and OpenAPI
  paths to the backend.
- The active dynasty is stored in localStorage (via hooks not shown here).
- UI accent color is driven by `Dynasty.accent_color` and set as a CSS variable.

## 4. API surface map (by router)

- Dynasty and seasons:
  - [app/routers/dynasty.py](app/routers/dynasty.py)
  - Create dynasty, list dynasties, add seasons.

- Players:
  - [app/routers/players.py](app/routers/players.py)
  - Player list with filters, detail, partial update, delete.
  - Player season stats CRUD.

- Games:
  - [app/routers/games.py](app/routers/games.py)
  - Schedule list, create game, update (with record recompute), delete.

- Recruits:
  - [app/routers/recruits.py](app/routers/recruits.py)
  - Recruit list, CRUD, weekly hours budget endpoint.

- Stats:
  - [app/routers/stats.py](app/routers/stats.py)
  - Rating leaders, stat leaders, roster summary.

- Importer:
  - [app/routers/importer.py](app/routers/importer.py)
  - Roster and season stats import via text, file, image OCR.

- Settings:
  - [app/routers/settings.py](app/routers/settings.py)
  - OpenAI key/model storage and model discovery proxy.

## 5. Tests and quality gates

Tests live in [tests/test_importer.py](tests/test_importer.py) and
[tests/test_vision.py](tests/test_vision.py). Coverage focuses on:

- CSV parsing edge cases and warnings
- Non-destructive upsert behavior
- Season stats parsing across format variations
- Vision model filtering

Lint and format are configured in [pyproject.toml](pyproject.toml).

## 6. Deployment model

- Docker build and runtime: [Dockerfile](Dockerfile)
  - Stage 1 builds the SPA and copies `dist` into `/app/static`.
  - Stage 2 installs Python deps and serves FastAPI.

- Compose defaults: [compose.yml](compose.yml)
  - Mounts `./data` to `/data` for persistent SQLite storage.

- CLI entry point for binaries: [app/**main**.py](app/__main__.py)

## 7. Design decisions and their implications

- Single origin: simplifies local hosting and avoids CORS headaches.
- SQLite: great for a self-hosted, single-user app; no migrations yet.
- Importer-centric architecture: OCR and CSV paths converge, so quality
  improvements should focus on parser reliability and warnings.
- Non-destructive updates: safe for cropped screenshots, but it can hide
  removal of data (it never clears a field unless explicitly patched).

## 8. How to add features safely

### 8.1 Add a new API endpoint

1. Add model fields or a new model in [app/models/**init**.py](app/models/__init__.py).
2. Update read schemas if needed in [app/schemas.py](app/schemas.py).
3. Add router handler in a new or existing router file.
4. Register router in [app/main.py](app/main.py).
5. Add frontend API methods in [frontend/src/lib/api.ts](frontend/src/lib/api.ts).
6. Add UI in a page or component and wire it into [frontend/src/App.tsx](frontend/src/App.tsx).

### 8.2 Add a new import format

1. Create a parser function in [app/importer.py](app/importer.py).
2. Keep output consistent with model fields.
3. Reuse the existing upsert functions if possible.
4. Add a preview endpoint to validate the parser before writing.

### 8.3 Add a new model field

1. Update the SQLModel in [app/models/**init**.py](app/models/__init__.py).
2. Update relevant read schema in [app/schemas.py](app/schemas.py).
3. Update frontend types and API usage in [frontend/src/lib/types.ts](frontend/src/lib/types.ts) if present.
4. Consider data migration impact (currently manual).

## 9. Known gaps and improvement opportunities

Architecture and reliability:

- Add database migrations (Alembic) and a schema version table.
- Add request validation models instead of raw `dict` patch payloads.
- Restrict CORS and add basic auth for non-local deployments.
- Add per-request timeouts and retry logic for OCR calls.

Importer and OCR:

- Add structured logging for parse warnings and OCR failures.
- Add a deterministic "dry-run only" mode for all import endpoints.
- Expand OCR prompts to include a confidence score per row.

Frontend and UX:

- Add optimistic updates for CRUD actions.
- Add error boundary and user-friendly error toasts.
- Provide export to CSV and JSON from roster and stats pages.

Testing and CI:

- Add API-level tests for each router (FastAPI TestClient).
- Add a minimal UI test suite for critical paths.
- Add CI workflows to run lint, tests, and frontend build.

Security:

- Add basic rate limiting on import endpoints.
- Add a stricter maximum payload size for CSV text.
- Document and enforce safe defaults for `OPENAI_API_KEY` usage.

## 10. Feature roadmap ideas

Data and analytics:

- Player progression graphs over multiple seasons.
- Team-level summaries for offense/defense by season.
- Schedule importer from a CSV template.

Recruiting:

- Pipeline bonuses and dealbreaker visualization.
- Recruit class summary by position and star count.

Sharing and collaboration:

- Read-only share links for roster or stats pages.
- Multi-user support with basic auth and per-dynasty access control.

Integrations:

- Import from additional roster sources besides MaxPlaysCFB.
- Optional cloud storage for screenshots and backups.

OCR workflow:

- Queue OCR jobs for large batches and show progress in the UI.
- Let users correct OCR output before commit with a diff view.

## 11. Quick troubleshooting map

- Importer bugs: [app/importer.py](app/importer.py)
- OCR issues or model selection: [app/vision.py](app/vision.py)
- Settings persistence: [app/settings_store.py](app/settings_store.py)
- API route wiring: [app/main.py](app/main.py)
- Frontend API errors: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)

## 12. Notes for AI agents

- Always preserve the non-destructive import rule unless explicitly asked to
  change it. It is a core UX guarantee.
- Avoid changing model defaults without syncing documentation.
- Keep any new feature compatible with local-only deployments by default.
- When adding new tables, document manual migration steps until migrations
  exist.
