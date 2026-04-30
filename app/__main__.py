"""Executable entrypoint for bundled Dynasty HQ binaries."""

from __future__ import annotations

import argparse
import os

import uvicorn


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="dynasty-hq",
        description="Run the Dynasty HQ API server.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind.")
    parser.add_argument(
        "--db-path",
        default=None,
        help="Optional DYNASTY_DB_PATH value. Overrides environment variable for this run.",
    )
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["critical", "error", "warning", "info", "debug", "trace"],
        help="Server log level.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.db_path:
        os.environ["DYNASTY_DB_PATH"] = args.db_path

    uvicorn.run("app.main:app", host=args.host, port=args.port, log_level=args.log_level)


if __name__ == "__main__":
    main()
