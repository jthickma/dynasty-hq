from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import dynasty, games, importer, players, recruits, settings, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Dynasty HQ",
    description="CFB 26 Dynasty tracker backend — MaxPlaysCFB CSV compatible",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dynasty.router)
app.include_router(players.router)
app.include_router(games.router)
app.include_router(recruits.router)
app.include_router(stats.router)
app.include_router(importer.router)
app.include_router(settings.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ---- SPA static serving ----
# Frontend is built into /app/static (Docker) or ./frontend/dist (local dev).
_STATIC_DIR = Path(os.environ.get("DYNASTY_STATIC_DIR", "/app/static"))
if not _STATIC_DIR.is_dir():
    _alt = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if _alt.is_dir():
        _STATIC_DIR = _alt

if _STATIC_DIR.is_dir():
    _ASSETS_DIR = _STATIC_DIR / "assets"
    if _ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")

    _INDEX = _STATIC_DIR / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        # Reserved API prefixes — let FastAPI 404 handle if matched but missed.
        if full_path.startswith(
            ("dynasties", "seasons", "settings", "health", "docs", "openapi.json", "redoc")
        ):
            raise HTTPException(status_code=404)
        # Serve real static files (favicon, robots, etc.) if present.
        candidate = _STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        if _INDEX.is_file():
            return FileResponse(_INDEX)
        raise HTTPException(status_code=404)
