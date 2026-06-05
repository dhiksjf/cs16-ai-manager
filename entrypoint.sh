#!/bin/sh
# Entrypoint for the CS 1.6 AI Manager container.
# - Validates that the frontend bundle is present
# - Validates required Python deps
# - Starts uvicorn on $PORT (default 8000)

set -eu

echo "──────────────────────────────────────────────"
echo "  CS 1.6 AI Manager — OMEGA"
echo "──────────────────────────────────────────────"
echo "  PORT      : ${PORT:-8000}"
echo "  STATIC_DIR: ${STATIC_DIR:-/app/static}"
echo "  Python    : $(python --version 2>&1)"
echo "──────────────────────────────────────────────"

# 1) Verify the frontend bundle exists
if [ ! -f "${STATIC_DIR:-/app/static}/index.html" ]; then
    echo "WARNING: frontend bundle not found at ${STATIC_DIR:-/app/static}/index.html"
    echo "         The API will still work, but the UI won't load."
fi

# 2) Verify Python deps import correctly
python - <<'PY'
import importlib, sys
missing = []
for mod in ("fastapi", "uvicorn", "paramiko", "httpx", "pydantic"):
    try:
        importlib.import_module(mod)
    except Exception as e:
        missing.append(f"{mod}: {e}")
if missing:
    print("ERROR: missing Python modules:", file=sys.stderr)
    for m in missing:
        print("  -", m, file=sys.stderr)
    sys.exit(1)
print("Python deps: OK")
PY

# 3) Quick SFTP / RCON self-test (non-fatal — just logs status)
python - <<'PY' 2>/dev/null || true
import os
host = os.environ.get("CS16_SFTP_HOST")
if host:
    print(f"SFTP target: {host}:{os.environ.get('CS16_SFTP_PORT', '2022')}")
    rhost = os.environ.get("CS16_RCON_HOST")
    if rhost:
        print(f"RCON target: {rhost}:{os.environ.get('CS16_GAME_PORT', '27015')}")
    else:
        print("RCON not configured (set CS16_RCON_HOST + CS16_RCON_PASSWORD to enable)")
else:
    print("SFTP not pre-configured. Connect via the UI setup screen.")
PY

# 4) Hand off to the Python app
exec python cs16-manager.py
