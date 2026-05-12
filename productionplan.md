# Production Deployment Migration Plan

## Goal

Move Dynasty HQ from a local-first community preview into a safer production-ready architecture while preserving the current single-container, local-friendly deployment path.

Production here means:

- Runs reliably behind a reverse proxy.
- Handles upgrades without data loss.
- Protects settings and API keys.
- Has clear backup, restore, and observability paths.
- Can later support multi-user access without a full rewrite.

## Current Architecture

- FastAPI backend.
- SQLModel ORM.
- SQLite database at `DYNASTY_DB_PATH`, usually `/data/dynasty.db`.
- React SPA built by Vite and served by FastAPI.
- OpenAI OCR integration through backend routes.
- Wide-open CORS.
- No auth.
- No migrations.
- Minimal tests focused on importer and vision model filtering.

## Target Architecture

Near-term production target:

- FastAPI remains the backend.
- React SPA remains the frontend.
- SQLite remains supported for local/self-hosted deployments.
- Alembic handles schema migrations.
- Reverse proxy terminates TLS.
- App has basic auth or single-user login.
- CORS and trusted hosts are configurable.
- API request bodies are validated with explicit Pydantic schemas.
- Frontend API types are generated from OpenAPI.
- Backups and restore are documented.

Optional later target:

- PostgreSQL support for multi-user or hosted deployments.
- Background OCR job queue.
- Object storage for uploaded screenshots.
- Role-based access control.

## Guiding Principles

- Do not rewrite the stack unless a specific production requirement forces it.
- Keep local-only use easy.
- Make risky capabilities opt-in.
- Prefer incremental hardening over framework churn.
- Keep API contracts explicit and generated where possible.

## Phase 1: Schema and Upgrade Safety

Tasks:

- Implement Alembic migrations using `plan.md`.
- Add backup guidance before upgrades.
- Add drift checks for schema changes.
- Add a migration step to Docker startup or deployment docs.

Expected impact:

- Safe upgrades.
- Clear schema history.
- Reduced risk when adding model fields.

Risk:

- Existing databases need a careful baseline/stamp path.

Validation:

- Fresh install works.
- Existing database copy upgrades successfully.
- Full test suite passes.

## Phase 2: API Contract Hardening

Tasks:

- Replace raw `dict` patch payloads with explicit Pydantic models.
- Add create/update request schemas separate from database table models.
- For patch models, forbid unknown fields where practical.
- Add request size limits for text imports and image uploads.
- Standardize error responses for import, validation, and OCR failures.

Targets:

- `app/routers/dynasty.py`
- `app/routers/players.py`
- `app/routers/games.py`
- `app/routers/recruits.py`
- `app/routers/importer.py`
- `app/schemas.py`

Expected impact:

- Better API docs.
- Fewer accidental writes.
- Safer public-facing endpoints.

Risk:

- Frontend may rely on loose partial payload behavior.

Validation:

- Add FastAPI TestClient coverage for create/update/delete routes.
- Confirm frontend flows still work.

## Phase 3: Frontend/Backend Contract Generation

Tasks:

- Generate TypeScript types and API client from `/openapi.json`.
- Replace hand-maintained shared types in `frontend/src/lib/types.ts` where practical.
- Keep custom frontend-only display types separate.
- Integrate generated client with TanStack Query.

Recommended tool:

- Orval, configured for Fetch API or React Query hooks.

Expected impact:

- Less contract drift between Python and TypeScript.
- Safer frontend refactors.

Risk:

- Generated clients may require route naming and schema cleanup first.

Validation:

- Frontend build passes.
- Generated client can call the main CRUD and import endpoints.
- Existing pages still render and mutate data correctly.

## Phase 4: Security Baseline

Tasks:

- Add configurable CORS allowlist.
- Add TrustedHost middleware.
- Add optional basic auth or single-user password login.
- Store secrets outside the SQLite settings table when env vars are provided.
- Mask sensitive settings in logs and API responses.
- Add rate limiting for import and OCR endpoints.
- Add stricter upload validation and size limits.

Environment variables:

- `DYNASTY_ALLOWED_ORIGINS`
- `DYNASTY_TRUSTED_HOSTS`
- `DYNASTY_AUTH_ENABLED`
- `DYNASTY_AUTH_USERNAME`
- `DYNASTY_AUTH_PASSWORD_HASH`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL`

Expected impact:

- Safer LAN and reverse-proxy deployment.
- Reduced risk from exposed OCR endpoints.

Risk:

- Auth can break simple local flows if defaults are not conservative.

Recommended default:

- Auth disabled for explicit local dev.
- Auth enabled in documented production compose examples.

Validation:

- Unauthenticated users cannot access protected routes when auth is enabled.
- Local dev remains simple when auth is disabled.
- CORS rejects unexpected origins when configured.

## Phase 5: Deployment Model

Tasks:

- Add a production compose example.
- Add a reverse-proxy example for Caddy, Traefik, or Nginx.
- Add healthcheck and readiness guidance.
- Add migration-before-start behavior.
- Add volume backup guidance.
- Pin Docker base image versions more tightly.
- Replace `npm install` in Docker with `npm ci`.

Suggested production services:

- `dynasty-hq`: app container.
- `backup`: optional scheduled SQLite backup sidecar.
- `reverse-proxy`: user-provided or documented example.

Expected impact:

- Repeatable deployments.
- Safer upgrades.
- Less ambiguity for homelab users.

Validation:

- `docker compose up -d --build` works.
- App survives container restart with data intact.
- Healthcheck reports healthy.
- Backup file can restore into a new deployment.

## Phase 6: Observability and Operations

Tasks:

- Add structured logging for API errors, imports, OCR calls, and migration startup.
- Add request IDs.
- Add basic metrics endpoint if needed.
- Add clear user-facing import warnings and server-side parse logs.
- Document operational runbooks.

Runbooks:

- Backup database.
- Restore database.
- Rotate OpenAI key.
- Upgrade app image.
- Recover from failed migration.
- Diagnose OCR failures.

Expected impact:

- Easier support and debugging.
- Better confidence before exposing beyond localhost.

Validation:

- Logs contain useful failure context without leaking secrets.
- Import failures include warnings and request IDs.

## Phase 7: Optional Production Scale Path

Only pursue this if the app needs multi-user hosted deployments or heavier OCR workloads.

Potential migrations:

- SQLite to PostgreSQL.
- Synchronous OCR calls to background jobs.
- Local image handling to object storage.
- Single-user auth to user accounts and roles.
- Single container to separate frontend/backend hosting.

Recommended triggers:

- Multiple concurrent users.
- Public internet exposure.
- OCR jobs taking long enough to time out HTTP requests.
- Need for audit logs or per-user access controls.
- Need for automated cloud backups and point-in-time recovery.

Risk:

- These changes add operational complexity and should not be done just for polish.

## Testing Strategy

Backend:

- Add API router tests with FastAPI TestClient.
- Add auth tests.
- Add migration tests against SQLite.
- Keep importer tests comprehensive.

Frontend:

- Add smoke tests for major pages.
- Add import workflow tests.
- Add generated-client type checks.

Deployment:

- Add Docker build test.
- Add migration-on-start smoke test.
- Add backup/restore smoke test.

Quality gates:

```bash
uv run pytest
uv run ruff check app tests
cd frontend && npm run build
```

After Alembic:

```bash
uv run alembic upgrade head
uv run alembic check
```

## Recommended Implementation Order

1. Alembic migrations.
2. API request schemas.
3. OpenAPI-generated frontend client/types.
4. Configurable CORS and trusted hosts.
5. Optional auth.
6. Production compose and reverse-proxy docs.
7. Backup/restore runbooks.
8. Observability improvements.
9. Optional PostgreSQL/background jobs only when justified.

## Non-Goals For Initial Production Migration

- Full SaaS multi-tenant architecture.
- Replacing FastAPI.
- Replacing React.
- Replacing SQLite by default.
- Server-side rendering.
- Kubernetes deployment.
- Complex role-based permissions.

## Acceptance Criteria

- App can be deployed with Docker behind a reverse proxy.
- Schema upgrades are migration-driven and documented.
- Production config can restrict CORS and host headers.
- Protected mode exists for non-local deployments.
- OpenAI API key handling is documented and does not leak through APIs.
- Backup and restore instructions are tested.
- Frontend and backend contracts are generated or validated.
- Full backend test suite and frontend build pass before release.

