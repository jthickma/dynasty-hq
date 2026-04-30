# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Dynasty HQ — FastAPI + SQLModel + SQLite backend tracking CFB 26 dynasty state (rosters, schedules, recruits, stats). Consumes MaxPlaysCFB CSV roster output. Runs locally via `uv` + `npm` or in a single Docker Compose container; reverse-proxy labels in `compose.yml` are written for GoDoxy but harmless under any other proxy.

## Commands

Dev (uv-based, Python 3.12):

```zsh
uv venv
uv pip install -e ".[dev]"
uv run uvicorn app.main:app --reload      # local server, /docs for Swagger
uv run pytest                              # full test suite
uv run pytest tests/test_importer.py::test_name -x   # single test
uv run ruff check .                        # lint
uv run ruff format .                       # format
```

Deploy:

```zsh
docker compose up -d --build
docker compose logs -f dynasty-hq
```

Env: `DYNASTY_DB_PATH` (default `/data/dynasty.db`). Container mounts `./data:/data` — DB lives outside image.

## Architecture

Single FastAPI app, lifespan-init creates SQLite tables via `SQLModel.metadata.create_all` ([app/db.py](app/db.py), [app/main.py](app/main.py)). No migrations — schema changes require manual DB handling or wipe.

**Module layout:**
- [app/models/__init__.py](app/models/__init__.py) — all SQLModel tables in one file: `Dynasty`, `Season`, `Game`, `Player` (54 nullable rating cols), `PlayerSeasonStat`, `Recruit`. Relationships use `cascade="all, delete-orphan"` from Dynasty down.
- [app/schemas.py](app/schemas.py) — Pydantic request/response DTOs (separate from table models).
- [app/routers/](app/routers/) — one router per resource (`dynasty`, `players`, `games`, `recruits`, `stats`, `importer`), all mounted in [app/main.py](app/main.py).
- [app/importer.py](app/importer.py) — CSV parser + upsert logic, called by `routers/importer.py`.

**Importer is the load-bearing piece.** Read [app/importer.py](app/importer.py) before changing CSV handling. Key invariants:
- Match key for upsert: `(dynasty_id, name, pos)`.
- `update_existing=True` upsert NEVER overwrites a real value with `None`. Cropped screenshots must not erase prior ratings — the `if v is not None` guard at [app/importer.py:203](app/importer.py#L203) is the rule.
- Core columns (RS,NAME,YEAR,POS,OVR,SPD,ACC,AGI,COD,STR,AWR,CAR,BCV) required; extended (JMP…PRS) auto-detected from header.
- `STR` column → model field `strength` (Python builtin clash) via `FIELD_RENAMES`.
- All ratings nullable — NULL means "not observed", never 0.
- Preamble line from Max's prompt stripped before parse; `csv.reader` handles names with periods/commas via real quoting.

**Game → Season auto-roll:** PATCH on a game with `team_score`+`opp_score` set derives `played`/`result` and recomputes the parent season's W-L + conference record. Logic lives in `routers/games.py`.

**Position groups** (used by stats + filters): `QB, RB, WR, TE, OL, DL, LB, DB, ST` — mapping from `pos` to group is in `routers/stats.py` / `routers/players.py`.

## Conventions

- All endpoints return JSON; interactive docs at `/docs`.
- CORS wide-open (`allow_origins=["*"]`) — backend assumed to be behind reverse proxy.
- SQLite engine uses `check_same_thread=False`; sessions per-request via `get_session` dep.
- Ruff: line-length 100, target py312.
- Tests in [tests/](tests/), `pythonpath=["."]` set in pyproject.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **dynasty-hq** (1241 symbols, 2036 relationships, 46 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/dynasty-hq/context` | Codebase overview, check index freshness |
| `gitnexus://repo/dynasty-hq/clusters` | All functional areas |
| `gitnexus://repo/dynasty-hq/processes` | All execution flows |
| `gitnexus://repo/dynasty-hq/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
