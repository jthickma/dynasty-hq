#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
BUILD_DIR="${ROOT_DIR}/build"

rm -rf "${DIST_DIR}" "${BUILD_DIR}"

uv run pyinstaller \
  --name dynasty-hq \
  --onefile \
  --collect-all uvicorn \
  --collect-all sqlmodel \
  --hidden-import=pydantic \
  -m app

printf 'Built binary at %s\n' "${DIST_DIR}/dynasty-hq"
