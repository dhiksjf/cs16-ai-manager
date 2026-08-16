"""
uacapp web service — drag & drop payload converter.
Routes:
  GET  /api/uac/info              service status + supported extensions
  POST /api/uac/convert           multipart "payload" -> converted exe bytes
  GET  /uac (or /uacapp)          drag & drop UI
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from . import uac_convert as conv

HERE = Path(__file__).parent
BASE_EXE = Path(os.environ.get("UACAPP_BASE", HERE / "uacapp.exe"))
WEB_DIR = Path(os.environ.get("UACAPP_WEB_DIR", HERE / "web"))

ALLOWED = {".exe", ".bat", ".cmd", ".ps1", ".vbs", ".msi"}


def register(app: FastAPI) -> None:
    if not BASE_EXE.exists():
        return

    @app.get("/api/uac/info")
    async def uac_info():
        return {
            "ok": True,
            "base_size": BASE_EXE.stat().st_size,
            "base_size_kb": round(BASE_EXE.stat().st_size / 1024),
            "extensions": sorted(e.lstrip(".") for e in ALLOWED),
        }

    @app.post("/api/uac/convert")
    async def uac_convert(payload: UploadFile):
        ext = Path(payload.filename or "p.exe").suffix.lower()
        if ext not in ALLOWED:
            raise HTTPException(
                status_code=415,
                detail=f"unsupported type '{ext}' — allowed: {', '.join(sorted(ALLOWED))}",
            )
        data = await payload.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail="empty payload")
        if len(data) > conv.MAX_PAYLOAD:
            raise HTTPException(
                status_code=413,
                detail=f"payload too large ({len(data)} bytes, max {conv.MAX_PAYLOAD})",
            )
        out = conv.convert_payload(BASE_EXE, data, ext.lstrip("."))
        out_name = Path(payload.filename).stem + "_uac.exe"
        return Response(
            content=out,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{out_name}"',
                "Content-Length": str(len(out)),
                "X-Converted-Size": str(len(out)),
            },
        )

    if WEB_DIR.exists():
        @app.get("/uac")
        @app.get("/uacapp")
        async def uac_page():
            return HTMLResponse((WEB_DIR / "index.html").read_text("utf-8"))

        @app.get("/uac/sample.whoami.bat")
        async def uac_sample():
            content = "@echo off\r\nwhoami /groups\r\n"
            return Response(
                content=content,
                media_type="text/plain",
                headers={"Content-Disposition": 'attachment; filename="whoami_high.bat"'},
            )

        app.mount("/uac", StaticFiles(directory=str(WEB_DIR), html=True), name="uac")