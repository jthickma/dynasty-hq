# Screenshot OCR (OpenAI vision)

Dynasty HQ can take screenshots of CFB 26 / MaxPlaysCFB roster and season-stats
screens, run them through an OpenAI vision model, and feed the extracted text
into the same importer used for paste/CSV uploads. No new parser path — the
model just produces the canonical formats the importer already accepts, then
the existing upsert rules apply (`(dynasty_id, name, pos)` match key, NULL
ratings never overwrite stored values).

## Architecture

```
┌────────────┐  multipart   ┌────────────────────────────┐  HTTPS  ┌──────────┐
│ Web UI     │ ───────────▶ │ POST /dynasties/{id}/import │ ──────▶ │ OpenAI   │
│ Import tab │              │      /roster/image          │         │ /chat/   │
└────────────┘              │      /season-stats/image    │         │ comp.    │
                            └─────────────┬───────────────┘         └────┬─────┘
                                          │                              │
                                  extracted CSV / text                   │
                                          ▼                              │
                            ┌─────────────────────────────┐               │
                            │ app.importer (parse + upsert)│               │
                            └─────────────┬───────────────┘               │
                                          ▼                              │
                                    SQLite (dynasty.db) ◀────────────────┘
                                                         (key + model from
                                                          Setting table)
```

Files:

| File                              | Purpose                                              |
|-----------------------------------|------------------------------------------------------|
| `app/vision.py`                   | Prompt definitions, OpenAI HTTP client, model lister |
| `app/settings_store.py`           | Tiny KV wrapper over the `Setting` table             |
| `app/routers/settings.py`         | `/settings` GET/PUT, `/settings/openai/models`       |
| `app/routers/importer.py`         | Image upload endpoints (`/...image`)                 |
| `frontend/src/pages/Settings.tsx` | API key + model picker UI                            |
| `frontend/src/pages/Import.tsx`   | "Screenshots (OCR)" tab                              |

## Configuring credentials

Three precedence levels — first hit wins:

1. **Per-call argument** (only used internally by the routers).
2. **Env var** — `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`. Set in `compose.yml`
   if you want secrets baked into the deployment and never user-editable.
3. **`Setting` table** — written by the web UI Settings page. Persisted in
   `DYNASTY_DB_PATH` (default `/data/dynasty.db`, mounted volume).

Env var values mask the DB row but don't delete it.

### Setting via the UI

1. Open `/settings` in the web app.
2. Paste your `sk-...` key, hit **Test connection**.
3. Hit **Save settings**.
4. The model picker now populates from `GET /v1/models`. Pick one
   (default filter: vision-capable only). Save again.

The UI never reads the saved key back — only `openai_api_key_set: true|false`
plus the source (`env|db|unset`).

### Setting via env (Docker)

```yaml
# compose.yml
services:
  dynasty-hq:
    environment:
      OPENAI_API_KEY: sk-...
      OPENAI_VISION_MODEL: gpt-4o          # optional, default gpt-4o
      OPENAI_VISION_TIMEOUT: "90"          # seconds, optional
```

## API reference

All paths are relative to the app root.

### `GET /settings`

```json
{
  "openai_api_key_set": true,
  "openai_api_key_source": "db",
  "openai_vision_model": "gpt-4o",
  "openai_vision_model_source": "db",
  "default_model": "gpt-4o"
}
```

### `PUT /settings`

```json
{
  "openai_api_key": "sk-...",          // optional; "" clears the DB row
  "openai_vision_model": "gpt-4o-mini" // optional; "" clears the DB row
}
```

Returns the same shape as `GET /settings`.

### `GET /settings/openai/models?api_key=sk-...`

Proxies `GET https://api.openai.com/v1/models`. The `api_key` query param is
optional — when omitted the resolved key is used. Useful for testing a key
before saving it.

```json
{
  "default": "gpt-4o",
  "models": [
    { "id": "gpt-4o",       "created": 1715367049, "owned_by": "system", "vision": true  },
    { "id": "gpt-4o-mini",  "created": 1721172741, "owned_by": "system", "vision": true  },
    { "id": "gpt-3.5-turbo","created": 1677610602, "owned_by": "openai", "vision": false }
  ]
}
```

`vision` is a heuristic from `vision.VISION_MODEL_PREFIXES`
(`gpt-4o`, `gpt-4.1`, `gpt-5`, `o1`, `o3`, `o4`, `chatgpt-4o`). OpenAI does
not return capability metadata, so update the prefix list when new vision
families ship.

### `POST /settings/openai/test`

Body (optional): `{ "api_key": "sk-..." }`. Returns:

```json
{ "ok": true, "model_count": 92 }
```

### `POST /dynasties/{dynasty_id}/import/roster/image`

`multipart/form-data` fields:

| Field             | Type        | Notes                                                |
|-------------------|-------------|------------------------------------------------------|
| `files`           | file[]      | One or more PNG/JPEG/WEBP/GIF, ≤12 MB each           |
| `update_existing` | bool        | Default `true`. NULL ratings never overwrite real values. |
| `dry_run`         | bool        | If `true`, return parsed rows without writing.       |
| `instructions`    | str         | Free-text appended to the user prompt.               |
| `model`           | str         | Override the saved/default model for this call.      |

Response when `dry_run=true`:

```json
{
  "dry_run": true,
  "extracted_csv": "RS,NAME,YEAR,POS,OVR,...",
  "rows": [...],
  "warnings": [...],
  "count": 85
}
```

Response when `dry_run=false`: standard `ImportResult` plus
`extracted_csv` for debugging:

```json
{
  "created": 12, "updated": 73, "skipped": 0,
  "errors": [], "total_rows": 85,
  "extracted_csv": "RS,NAME,YEAR,POS,..."
}
```

### `POST /dynasties/{dynasty_id}/import/season-stats/image`

Same shape, plus:

| Field         | Type | Notes                                                              |
|---------------|------|--------------------------------------------------------------------|
| `season_year` | int  | Defaults to dynasty's `current_season_year`.                       |
| `team_name`   | str  | Forced TEAM prefix on every section.                               |

The model emits the canonical block:

```
AQUINAS - RUSHING
NAME,POS,GP,CAR,YARDS,AVG,TD,AVG G,20+,BTK,YAC,LONG
T.Yancey,HB,2,59,317,5.4,5,158.5,4,8,113,35

AQUINAS - PASSING
NAME,POS,GP,COMP,ATT,COMP%,YARDS,TD,TD %,INT,INT %,TD:IN
L.Davis,QB,2,60,80,75%,686,5,6.3,0,0.0,5.0
```

…which is fed verbatim to `app.importer.import_season_stats`.

## Prompts

Defined in `app/vision.py`:

- `ROSTER_SYSTEM_PROMPT` — pins exact CSV header order, redshirt rules,
  blank-on-uncertainty, name quoting.
- `SEASON_STATS_SYSTEM_PROMPT` — pins per-section header order
  (RUSHING/PASSING/RECEIVING/DEFENSE), TEAM prefix rules.

Both prompts are strict about leaving cells **blank** when the model can't
read them — combined with the "NULL never overwrites real values" rule in
the importer, this makes cropped or partial screenshots safe.

## Adding a new screenshot type

1. Write a system prompt in `app/vision.py` mirroring the existing two —
   nail down the output schema and forbid prose.
2. Add an `extract_*_text` wrapper that calls `_call_openai`.
3. Add an importer parser for the canonical text format (or reuse one).
4. Add a router endpoint in `app/routers/importer.py` modeled on
   `import_roster_image`.
5. Add a target option to `ScreenshotPanel` in `frontend/src/pages/Import.tsx`.

## Error model

| HTTP | When                                                                    |
|------|-------------------------------------------------------------------------|
| 400  | Missing/empty/oversize/wrong-content-type files                         |
| 404  | Dynasty does not exist                                                  |
| 413  | Image exceeds `MAX_IMAGE_BYTES` (12 MB)                                 |
| 502  | OpenAI returned an error or unparseable response                        |
| 503  | API key not configured (env + DB both empty)                            |

`VisionConfigError` → 503, `VisionExtractionError` → 502. The 502 message
contains the OpenAI error text (truncated) for debugging.

## Cost / latency notes

- Each image ships base64-encoded inside the chat request. Crop tightly —
  full-screen 4K screenshots burn tokens for the surrounding chrome.
- `temperature=0`, no streaming. One round-trip per import.
- Default timeout 90 s (`OPENAI_VISION_TIMEOUT`). A full 85-row roster on
  `gpt-4o` typically returns in 15–30 s.
- The "Extract & preview" button in the UI is just `dry_run=true`; it still
  costs a model call.
