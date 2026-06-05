#!/usr/bin/env python3
"""
CS 1.6 AI Agent Manager
An intelligent AI agent for managing CS 1.6 dedicated servers with full tool control,
real-time reasoning, planning, action verification, memory, and question-asking capabilities.
"""

import asyncio, json, os, socket, stat, sys, traceback, uuid, hashlib, time, re, fnmatch, threading, subprocess, shutil, tempfile, html
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

try:
    import paramiko, httpx
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import HTMLResponse, StreamingResponse
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install: pip install paramiko httpx fastapi uvicorn pydantic")
    sys.exit(1)

HERE = Path(__file__).parent
CONFIG_FILE = HERE / 'cs16-config.json'
STATIC_DIR = Path(os.environ.get('STATIC_DIR', HERE / 'static'))
HTML_FILE = STATIC_DIR / 'index.html'
DEFAULT_PORT = 8000

# ─── AMX Mod X Compiler Paths ───
# These are populated by the Docker image. The compiler is a 32-bit ELF
# pulled from the official alliedmodders/amxmodx release and wrapped in a
# qemu-i386-static shell script so it works on x86_64 hosts whose kernel
# has CONFIG_IA32_EMULATION disabled (e.g. Koyeb free tier).
AMXXPC_BIN = Path(os.environ.get('AMXXPC_BIN', '/usr/local/lib/amxx/amxxpc'))
AMXX_INCLUDE_DIR = Path(os.environ.get('AMXX_INCLUDE_DIR', '/app/amxx/include'))
AMXX_TESTSUITE_DIR = Path(os.environ.get('AMXX_TESTSUITE_DIR', '/app/amxx/testsuite'))
AMXX_WORK_DIR = Path(os.environ.get('AMXX_WORK_DIR', '/tmp/amxx_work'))

# Cache for /api/compiler/status — avoid spawning qemu on every 30s poll.
_compiler_invocable_cache: dict | None = None

def _check_amxxpc_runs(bin_path: Path) -> dict:
    """Run amxxpc with no args and report whether it actually executed.

    Returns {'runs': bool, 'detail': str}. A 'runs' result means the wrapper
    reached the real 32-bit binary, loaded the 32-bit libs, and printed the
    expected usage line — i.e. the compile_plugin tool will work end-to-end.
    """
    if not bin_path.exists():
        return {'runs': False, 'detail': f'{bin_path} not found'}
    try:
        proc = subprocess.run(
            [str(bin_path)],
            capture_output=True, text=True, timeout=10,
            cwd=str(bin_path.parent),
        )
        combined = (proc.stdout or '') + (proc.stderr or '')
        lower = combined.lower()
        if 'exec format error' in lower:
            return {'runs': False, 'detail': 'kernel rejected 32-bit ELF (CONFIG_IA32_EMULATION=n?)'}
        if 'no such file' in lower or 'cannot open shared object' in lower:
            return {'runs': False, 'detail': f'missing 32-bit library: {combined.strip()[:200]}'}
        if proc.returncode != 0 and not combined.strip():
            return {'runs': False, 'detail': f'exit code {proc.returncode} with no output'}
        first_line = combined.strip().splitlines()[0] if combined.strip() else '(no output)'
        return {'runs': True, 'detail': first_line[:120]}
    except subprocess.TimeoutExpired:
        return {'runs': False, 'detail': 'invocation timed out (qemu may be hanging)'}
    except FileNotFoundError as e:
        return {'runs': False, 'detail': f'wrapper not executable: {e}'}
    except Exception as e:
        return {'runs': False, 'detail': f'{type(e).__name__}: {e}'}

# ─── Configuration ───

cfg = {
    'host': '', 'port': 2022, 'user': '', 'password': '',
    'rconPass': '', 'rconHost': '', 'gamePort': 27015
}
_transport: Optional[paramiko.Transport] = None
_sftp: Optional[paramiko.SFTPClient] = None
_sftp_lock = threading.RLock()  # reentrant — sftp_copy calls sftp_read/write internally
chat_history: list[dict[str, Any]] = []
task_memory: list[dict[str, Any]] = []  # Last 5 task contexts for continuity

# ─── Pydantic Models ───

class SetupTestReq(BaseModel):
    host: str; port: int = 2022; user: str; password: str = ''
    rconPass: str = ''; rconHost: str = ''; gamePort: int = 27015

class ConfigSaveReq(BaseModel):
    host: str = ''; port: int = 2022; user: str = ''; password: str = ''
    rconPass: str = ''; rconHost: str = ''; gamePort: int = 27015

class SFTPLsReq(BaseModel): path: str = '.'
class SFTPReadReq(BaseModel): path: str
class SFTPWriteReq(BaseModel): path: str; content: str
class SFTPDeleteReq(BaseModel): path: str
class SFTPMkdirReq(BaseModel): path: str
class SFTPMoveReq(BaseModel): source: str; destination: str
class SFTPCopyReq(BaseModel): source: str; destination: str
class SFTPRenameReq(BaseModel): old_path: str; new_path: str
class SFTPChmodReq(BaseModel): path: str; mode: int = 0o644
class RCONReq(BaseModel): command: str
class SearchReq(BaseModel): pattern: str; path: str = '.'
class SearchContentReq(BaseModel): pattern: str; path: str = '.'
class AppendReq(BaseModel): path: str; content: str
class BatchReadReq(BaseModel): paths: list[str]
class VerifyReq(BaseModel): action: str; path: str; expected: str = ''
class AgentReq(BaseModel):
    apiKey: str; task: str; host: str; port: int = 2022; user: str; password: str = ''
    rconPass: str = ''; rconHost: str = ''; gamePort: int = 27015
    provider: str = 'opencode'; model: str = 'big-pickle'
class AnswerReq(BaseModel):
    session_id: str; answer: str

# ─── Session Management ───

pending_questions: dict[str, dict[str, Any]] = {}  # session_id -> {task, messages, callback}

# ─── SFTP Functions ───

def sftp_connect(host, port, user, password):
    global _transport, _sftp
    sftp_close()
    sock = socket.create_connection((host, int(port)), timeout=15)
    sock.settimeout(30)
    _transport = paramiko.Transport(sock)
    _transport.connect(username=user, password=password)
    _sftp = paramiko.SFTPClient.from_transport(_transport)

def sftp_close():
    global _transport, _sftp
    if _sftp:
        try: _sftp.close()
        except: pass
        _sftp = None
    if _transport:
        try: _transport.close()
        except: pass
        _transport = None

def sftp_check() -> None:
    """Raise 400 if no SFTP connection is active. Also narrows _sftp for type checkers."""
    if _sftp is None:
        raise HTTPException(400, 'SFTP not connected')
    assert _sftp is not None  # noqa: F823 — narrows the module-level optional for pyright/basedpyright

def sftp_ls(path='.'):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        files = _sftp.listdir_attr(path)
        r = []
        for f in files:
            r.append({
                'name': f.filename,
                'dir': stat.S_ISDIR(f.st_mode or 0),
                'size': f.st_size,
                'mtime': getattr(f, 'st_mtime', 0)
            })
        return sorted(r, key=lambda x: (not x['dir'], x['name'].lower()))

def sftp_read(path_str: str) -> str:
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        with _sftp.open(path_str, 'r') as f:
            return f.read().decode('utf-8', errors='replace')

def sftp_write(path_str: str, content: str):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        with _sftp.open(path_str, 'w') as f:
            f.write(content.encode('utf-8'))

def sftp_write_binary(path_str: str, content: bytes) -> None:
    """Write raw bytes to a file via SFTP (for compiled .amxx binaries, etc.)."""
    with _sftp_lock:
        sftp_check()
        sftp = _sftp
        assert sftp is not None
        parent = str(Path(path_str).parent).replace('\\', '/')
        if parent and parent != '.':
            parts = parent.split('/') if parent.startswith('/') else parent.split('/')
            cur = '/' if parent.startswith('/') else ''
            for p in parts:
                if not p:
                    continue
                cur = cur + p if cur == '/' else f'{cur}/{p}'
                try:
                    sftp.stat(cur)
                except Exception:
                    try:
                        sftp.mkdir(cur)
                    except Exception:
                        pass
        with sftp.open(path_str, 'wb') as f:
            f.write(content)

def sftp_read_binary(path_str: str) -> bytes:
    """Read raw bytes from a file via SFTP."""
    with _sftp_lock:
        sftp_check()
        sftp = _sftp
        assert sftp is not None
        with sftp.open(path_str, 'rb') as f:
            return f.read()

def sftp_delete(path_str: str):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        try:
            _sftp.remove(path_str)
        except:
            _sftp.rmdir(path_str)

def sftp_mkdir(path_str: str):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        _sftp.mkdir(path_str)

def sftp_move(source: str, destination: str):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        _sftp.rename(source, destination)

def sftp_copy(source: str, destination: str):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        with _sftp.open(source, 'r') as f:
            content = f.read()
        with _sftp.open(destination, 'w') as f:
            f.write(content)

def sftp_rename(old_path: str, new_path: str):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        _sftp.rename(old_path, new_path)

def sftp_chmod(path_str: str, mode: int):
    with _sftp_lock:
        sftp_check()
        assert _sftp is not None
        _sftp.chmod(path_str, mode)

def sftp_search(root: str, pattern: str, max_results: int = 60, max_depth: int = 3) -> list:
    with _sftp_lock:
        sftp_check()
        sftp = _sftp
        assert sftp is not None
        r = []
        deadline = time.time() + 15.0
        def _walk(p, depth=0):
            if depth > max_depth or len(r) >= max_results or time.time() > deadline:
                return
            try:
                entries = sftp.listdir_attr(p)
                for f in entries:
                    if len(r) >= max_results or time.time() > deadline:
                        break
                    fp = (p.rstrip('/') + '/' + f.filename) if p != '.' else f.filename
                    if stat.S_ISDIR(f.st_mode or 0):
                        _walk(fp, depth + 1)
                    elif fnmatch.fnmatch(f.filename.lower(), pattern.lower()):
                        r.append({'path': fp, 'size': f.st_size})
            except:
                pass
        _walk(root)
        return r

def sftp_search_content(root: str, pattern: str, max_files: int = 50) -> list:
    with _sftp_lock:
        sftp_check()
        sftp = _sftp
        assert sftp is not None
        r = []
        files_checked = 0
        def _walk(p):
            nonlocal files_checked
            if files_checked >= max_files:
                return
            try:
                for f in sftp.listdir_attr(p):
                    if files_checked >= max_files:
                        return
                    fp = (p + '/' + f.filename) if p != '.' else f.filename
                    if stat.S_ISDIR(f.st_mode or 0):
                        _walk(fp)
                    elif (f.st_size or 0) < 1024 * 1024:
                        files_checked += 1
                        try:
                            with sftp.open(fp, 'r') as fh:
                                content = fh.read().decode('utf-8', errors='replace')
                            matches = re.findall(pattern, content, re.IGNORECASE)
                            if matches:
                                idx = content.lower().find(matches[0].lower())
                                r.append({
                                    'path': fp,
                                    'matches': len(matches),
                                    'preview': content[max(0, idx-50):idx+100]
                                })
                        except:
                            pass
            except:
                pass
        _walk(root)
        return r

def sftp_read_batch(paths: list[str]) -> list[dict]:
    sftp_check()
    assert _sftp is not None
    r = []
    for p in paths:
        try:
            c = sftp_read(p)
            r.append({'path': p, 'content': c, 'chars': len(c)})
        except Exception as e:
            r.append({'path': p, 'error': str(e)})
    return r

def sftp_exists(path_str: str) -> bool:
    sftp_check()
    assert _sftp is not None
    try:
        _sftp.stat(path_str)
        return True
    except:
        return False

def sftp_get_info(path_str: str) -> dict:
    sftp_check()
    assert _sftp is not None
    try:
        s = _sftp.stat(path_str)
        return {
            'exists': True,
            'size': s.st_size,
            'is_dir': stat.S_ISDIR(s.st_mode or 0),
            'permissions': oct(s.st_mode or 0)[-3:],
            'mtime': s.st_mtime
        }
    except Exception as e:
        return {'exists': False, 'error': str(e)}

def sftp_append(path_str: str, content: str):
    sftp_check()
    assert _sftp is not None
    try:
        existing = sftp_read(path_str)
        sftp_write(path_str, existing + content)
    except:
        sftp_write(path_str, content)

# ─── RCON ───

async def rcon_send(host, port, password, command):
    """GoldSrc challenge-response RCON (CS 1.6 / HLDS)."""
    loop = asyncio.get_event_loop()

    def _do_rcon():
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(5.0)
        try:
            # Step 1: request challenge
            sock.sendto(b'\xff\xff\xff\xffchallenge rcon\n', (host, port))
            data = sock.recv(2048).decode('utf-8', errors='replace')
            # response looks like: ....challenge rcon 12345678
            challenge = None
            for token in data.split():
                if token.isdigit():
                    challenge = token
                    break
            if not challenge:
                return f'[RCON error: could not parse challenge from: {data.strip()}]'

            # Step 2: send authenticated command
            cmd_pkt = (
                b'\xff\xff\xff\xffrcon '
                + challenge.encode()
                + b' "'
                + password.encode()
                + b'" '
                + command.encode()
                + b'\n'
            )
            sock.sendto(cmd_pkt, (host, port))

            # Step 3: collect response (may arrive in multiple packets)
            response_parts = []
            sock.settimeout(3.0)
            while True:
                try:
                    chunk = sock.recv(8192)
                    # GoldSrc responses start with \xff\xff\xff\xff\x6c (print header)
                    decoded = chunk[4:].decode('utf-8', errors='replace').strip('\x00').strip()
                    if decoded:
                        response_parts.append(decoded)
                except socket.timeout:
                    break
            return '\n'.join(response_parts) if response_parts else '(empty response)'
        except socket.timeout:
            return '[RCON timeout]'
        except Exception as e:
            return f'[RCON error: {e}]'
        finally:
            sock.close()

    return await loop.run_in_executor(None, _do_rcon)

# ─── Config Persistence ───

def load_config():
    global cfg
    # 1) Start with file-based config
    try:
        if CONFIG_FILE.exists():
            d = json.loads(CONFIG_FILE.read_text('utf-8'))
            for k in cfg:
                if k in d:
                    cfg[k] = d[k]
    except Exception:
        pass
    # 2) Override with environment variables (preferred in production)
    env_map = {
        'CS16_SFTP_HOST': ('host', str),
        'CS16_SFTP_PORT': ('port', int),
        'CS16_SFTP_USER': ('user', str),
        'CS16_SFTP_PASSWORD': ('password', str),
        'CS16_RCON_PASSWORD': ('rconPass', str),
        'CS16_RCON_HOST': ('rconHost', str),
        'CS16_GAME_PORT': ('gamePort', int),
    }
    for env_key, (cfg_key, cast) in env_map.items():
        val = os.environ.get(env_key)
        if val is not None and val != '':
            try:
                cfg[cfg_key] = cast(val)
            except (ValueError, TypeError):
                pass

def save_config(d: dict):
    global cfg
    for k in cfg:
        if k in d and d[k] not in (None, ''):
            cfg[k] = d[k]
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), 'utf-8')

load_config()

# ─── Tool Definitions ───

TOOL_DEFS = [
    {'type': 'function', 'function': {
        'name': 'ls',
        'description': 'List files and directories. Shows [DIR] for directories and file size for files.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'Directory path to list. Use "." for root.'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'read',
        'description': 'Read the full content of a file. Always read before editing.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'File path to read'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'write',
        'description': 'Write content to a file (OVERWRITES existing content). Use edit for small changes.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'File path'},
            'content': {'type': 'string', 'description': 'Full file content to write'}
        }, 'required': ['path', 'content']}
    }},
    {'type': 'function', 'function': {
        'name': 'edit',
        'description': 'Find and replace text in a file. Quote EXACT text for find. Read file first.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'File path'},
            'find': {'type': 'string', 'description': 'EXACT text to find (must match literally)'},
            'replace': {'type': 'string', 'description': 'Replacement text'},
            'line': {'type': 'integer', 'description': 'Optional: specific line number to replace on'}
        }, 'required': ['path', 'find', 'replace']}
    }},
    {'type': 'function', 'function': {
        'name': 'delete',
        'description': 'Delete a file or empty directory. Use with caution.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'Path to delete'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'mkdir',
        'description': 'Create a new directory (including parent directories if needed).',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'Directory path to create'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'move',
        'description': 'Move/rename a file or directory from source to destination.',
        'parameters': {'type': 'object', 'properties': {
            'source': {'type': 'string', 'description': 'Source path'},
            'destination': {'type': 'string', 'description': 'Destination path'}
        }, 'required': ['source', 'destination']}
    }},
    {'type': 'function', 'function': {
        'name': 'copy',
        'description': 'Copy a file from source to destination.',
        'parameters': {'type': 'object', 'properties': {
            'source': {'type': 'string', 'description': 'Source file path'},
            'destination': {'type': 'string', 'description': 'Destination file path'}
        }, 'required': ['source', 'destination']}
    }},
    {'type': 'function', 'function': {
        'name': 'rename',
        'description': 'Rename a file or directory.',
        'parameters': {'type': 'object', 'properties': {
            'old_path': {'type': 'string', 'description': 'Current path'},
            'new_path': {'type': 'string', 'description': 'New path/name'}
        }, 'required': ['old_path', 'new_path']}
    }},
    {'type': 'function', 'function': {
        'name': 'chmod',
        'description': 'Change file permissions (e.g., 644 for files, 755 for executables).',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'File path'},
            'mode': {'type': 'integer', 'description': 'Permission mode in octal (e.g., 0o644)'}
        }, 'required': ['path', 'mode']}
    }},
    {'type': 'function', 'function': {
        'name': 'search',
        'description': 'Search for files by name pattern (wildcard * and ? supported). IMPORTANT: Always specify a specific subdirectory in "path" (e.g. "cstrike" or "cstrike/addons") — never search from root "." as it will time out on large servers. Searches 3 levels deep, returns up to 60 results.',
        'parameters': {'type': 'object', 'properties': {
            'pattern': {'type': 'string', 'description': 'Search pattern like *.cfg or server*'},
            'path': {'type': 'string', 'description': 'Specific subdirectory to search in, e.g. "cstrike" or "cstrike/addons". Do NOT use "." (root).', 'default': 'cstrike'}
        }, 'required': ['pattern']}
    }},
    {'type': 'function', 'function': {
        'name': 'search_content',
        'description': 'Search INSIDE file contents using regex pattern. Returns matching files with previews. IMPORTANT: Always specify a specific subdirectory in "path" (e.g. "cstrike" or "cstrike/addons") — NEVER use "." (root) as it will time out.',
        'parameters': {'type': 'object', 'properties': {
            'pattern': {'type': 'string', 'description': 'Regex pattern to search for'},
            'path': {'type': 'string', 'description': 'Specific subdirectory to search in, e.g. "cstrike". Do NOT use "." (root).', 'default': 'cstrike'}
        }, 'required': ['pattern']}
    }},
    {'type': 'function', 'function': {
        'name': 'append',
        'description': 'Append content to the end of a file. Creates file if not exists.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'File path'},
            'content': {'type': 'string', 'description': 'Content to append'}
        }, 'required': ['path', 'content']}
    }},
    {'type': 'function', 'function': {
        'name': 'batch_read',
        'description': 'Read multiple files at once. More efficient than multiple read calls.',
        'parameters': {'type': 'object', 'properties': {
            'paths': {'type': 'array', 'items': {'type': 'string'}, 'description': 'List of file paths'}
        }, 'required': ['paths']}
    }},
    {'type': 'function', 'function': {
        'name': 'info',
        'description': 'Get detailed information about a file or directory (size, permissions, modified time).',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'File or directory path'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'rcon',
        'description': 'Send RCON command to the CS 1.6 game server. Use for status, maps, players, config changes.',
        'parameters': {'type': 'object', 'properties': {
            'command': {'type': 'string', 'description': 'RCON command (e.g., "status", "changelevel de_dust2", "sv_restart 1")'}
        }, 'required': ['command']}
    }},
    {'type': 'function', 'function': {
        'name': 'ask_user',
        'description': 'Ask the user a question when you need clarification, confirmation, or a decision. The UI always shows a text input so the user can type freely — options are only for when distinct named choices exist. RULES: (1) Only provide options when there are real distinct choices (e.g. "Steam ID", "Name+password", "Name only"). (2) NEVER add a "Custom", "Other", or "I will type it myself" option — the text box already does this. (3) Leave options empty [] when the answer must be typed (e.g. a Steam ID, a map name, a password, a file path).',
        'parameters': {'type': 'object', 'properties': {
            'question': {'type': 'string', 'description': 'The question to ask the user'},
            'options': {'type': 'array', 'items': {'type': 'string'}, 'description': 'Distinct named choices only (2-4 max). Omit or leave empty [] when the answer is a value the user must type (Steam ID, name, path, password, etc). NEVER include "Custom" or "Other" as an option.'},
            'context': {'type': 'string', 'description': 'Why you are asking this - explain your reasoning'}
        }, 'required': ['question', 'options', 'context']}
    }},
    {'type': 'function', 'function': {
        'name': 'verify',
        'description': 'Verify that a previous action produced the expected result. Re-read the file or re-check the state.',
        'parameters': {'type': 'object', 'properties': {
            'action': {'type': 'string', 'description': 'The action that was performed (e.g., "write", "edit")'},
            'path': {'type': 'string', 'description': 'The file or resource to verify'},
            'expected': {'type': 'string', 'description': 'What you expect to find (optional)'}
        }, 'required': ['action', 'path']}
    }},
    {'type': 'function', 'function': {
        'name': 'read_local',
        'description': 'Read a file from the local container filesystem. Use this to read AMX Mod X .inc API headers (e.g. /app/amxx/include/amxmodx.inc) to learn available natives, stocks, and constants before writing a plugin. Also use to read reference plugins in the testsuite.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'Absolute local path, e.g. /app/amxx/include/amxmodx.inc or /tmp/work/myserver.sma'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'write_local',
        'description': 'Write a file to the local container filesystem. Use this to create .sma source files for compilation (in /tmp/amxx_work/). Text content.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'Absolute local path, e.g. /tmp/amxx_work/myserver.sma'},
            'content': {'type': 'string', 'description': 'Full file content to write'}
        }, 'required': ['path', 'content']}
    }},
    {'type': 'function', 'function': {
        'name': 'list_local',
        'description': 'List files in a local container directory. Use to browse /app/amxx/include/ for available API headers, or /app/amxx/testsuite/ for reference plugins.',
        'parameters': {'type': 'object', 'properties': {
            'path': {'type': 'string', 'description': 'Absolute local directory, e.g. /app/amxx/include or /app/amxx/testsuite'}
        }, 'required': ['path']}
    }},
    {'type': 'function', 'function': {
        'name': 'compile_plugin',
        'description': 'Compile a .sma (Pawn) source file using the bundled amxxpc compiler. The .sma must already exist on the local filesystem (use write_local first). Reads include headers from /app/amxx/include/. If upload_path is given, the resulting .amxx binary is uploaded to that path on the game server. Returns the full compiler output including errors and warnings — use them to debug. Iterate: read error -> read_local the relevant .inc -> write_local the fix -> compile_plugin again until 0 errors.',
        'parameters': {'type': 'object', 'properties': {
            'local_path': {'type': 'string', 'description': 'Absolute local path to the .sma file, e.g. /tmp/amxx_work/myserver.sma'},
            'upload_path': {'type': 'string', 'description': 'Optional: remote SFTP path to upload the compiled .amxx, e.g. cstrike/addons/amxmodx/plugins/myserver.amxx'}
        }, 'required': ['local_path']}
    }},
    {'type': 'function', 'function': {
        'name': 'web_search',
        'description': 'Search the web via DuckDuckGo. Use to find AMX Mod X plugin examples, API documentation, forum threads, or solutions to compile errors. Returns titles, URLs, and snippets.',
        'parameters': {'type': 'object', 'properties': {
            'query': {'type': 'string', 'description': 'Search query, e.g. "amxmodx message_begin example" or "pawn register_plugin syntax"'},
            'num_results': {'type': 'integer', 'description': 'Number of results to return (default 8, max 20)', 'default': 8}
        }, 'required': ['query']}
    }},
    {'type': 'function', 'function': {
        'name': 'web_fetch',
        'description': 'Fetch the content of a URL and return it as text. Use to read documentation pages, GitHub READMEs, AMX Mod X wiki articles, or forum posts. Output is truncated to 12K characters.',
        'parameters': {'type': 'object', 'properties': {
            'url': {'type': 'string', 'description': 'Full URL to fetch, e.g. https://www.amxmodx.org/api/amxmodx/'}
        }, 'required': ['url']}
    }},
    {'type': 'function', 'function': {
        'name': 'download_file',
        'description': 'Download a file from a URL directly to the game server via SFTP. Use to grab .amxx binaries, .sma sources, or config files from the web.',
        'parameters': {'type': 'object', 'properties': {
            'url': {'type': 'string', 'description': 'Full URL to download from'},
            'dest': {'type': 'string', 'description': 'Destination path on the game server, e.g. cstrike/addons/amxmodx/plugins/myplugin.amxx'}
        }, 'required': ['url', 'dest']}
    }},
    {'type': 'function', 'function': {
        'name': 'git_clone',
        'description': 'Shallow-clone a git repository and upload all files to the game server via SFTP. Use to pull example plugin collections, configs, or whole plugins from GitHub.',
        'parameters': {'type': 'object', 'properties': {
            'url': {'type': 'string', 'description': 'Git URL, e.g. https://github.com/alliedmodders/amxmodx-plugins.git'},
            'dest': {'type': 'string', 'description': 'Destination directory on the game server, e.g. cstrike/addons/amxmodx/plugins/custom'},
            'depth': {'type': 'integer', 'description': 'Clone depth (default 1 for shallow)', 'default': 1}
        }, 'required': ['url', 'dest']}
    }},
]

# ═══════════════════════════════════════════════════════════════
# OMEGA SYSTEM PROMPT
# ═══════════════════════════════════════════════════════════════

SYSTEM_PROMPT = '''You are OMEGA — an elite AI systems architect managing Counter-Strike 1.6 dedicated servers. You possess deep expertise in server administration, Source/GoldSrc engine configuration, competitive gaming server management, and systems engineering.

═══════════════════════════════════════════════════════════════
DECISION AUTHORITY — READ THIS FIRST
═══════════════════════════════════════════════════════════════

You are a CS 1.6 expert. You make decisions. You do not ask for permission.

NEVER ask the user about:
- Which format to use for a config line (you know CS 1.6 syntax)
- Whether to backup a file (do it silently if needed, or skip — don't ask)
- Whether to proceed with an obvious task ("reload" = just reload)
- Which RCON command to use (you know them all)
- Whether to use edit() vs write() (your decision)
- "Are you sure?" for any non-destructive task
- Anything you can figure out by reading a file first (read it, then decide)
- Authentication method for admins (Steam ID is always best practice — just use it)
- How to format a ban entry, plugin line, cvar — you know these
- "Do you want me to restart/reload/fix X?" — if they asked you to, do it

ONLY ask the user when you literally cannot continue without their input:
  ✓ You need a specific value they haven't provided: Steam ID, IP, map name, password, player name
  ✓ A destructive action affects data that cannot be recovered: deleting configs, wiping ban lists
  ✓ Two mutually exclusive outcomes and you cannot determine intent from context

SMART DECISION EXAMPLES:
  "add admin" → ask for their Steam ID (you need it). Pick Steam ID auth (best practice). Done.
  "fix plugins" → read plugins.ini, identify issues, fix them. No questions.
  "set sv_password" → ask for the new password (you need it). Nothing else.
  "reload" → exec server.cfg via RCON. Done. No questions.
  "kick player" → ask for their name/SteamID (you need it). That's it.
  "ban X" → ban via RCON + add to banned.cfg. No questions about format.
  "secure the server" → set sv_password, rcon_password to strong values, ask user only for what password they want.

═══════════════════════════════════════════════════════════════
OPERATIONAL RULES
═══════════════════════════════════════════════════════════════

- CS slang: sv=server, cfg=config, map=changelevel, pw/pass=password, sv_pw=sv_password
- READ before WRITE. Always read a file before editing it.
- Use edit() for surgical changes, write() only for new files or full rewrites.
- Verify critical changes: re-read the file or run an RCON check after editing.
- CRITICAL: When you ask anything, use ask_user() tool — NEVER plain text questions.
  A plain text question is invisible and will never be answered.

═══════════════════════════════════════════════════════════════
TOOL CATALOG
═══════════════════════════════════════════════════════════════

FILE OPERATIONS:
  ls(path) — list directory. read(path) — read file (always before editing).
  write(path, content) — overwrite. edit(path, find, replace) — surgical edit.
  delete(path) — delete (confirm if irreversible). mkdir/move/copy/rename/chmod — self-explanatory.

SEARCH:
  search(pattern, path) — find files by name. search_content(pattern, path) — grep inside files.
  info(path) — file size/perms/mtime. batch_read(paths) — read multiple files at once.

LOCAL CONTAINER (read .inc headers, write .sma sources, compile):
  read_local(path) — read a file from the local container. Use to read AMX Mod X
    .inc API headers at /app/amxx/include/ (amxmodx.inc, fakemeta.inc,
    hamsandwich.inc, cstrike.inc, etc.) before writing a plugin.
  write_local(path, content) — write a file to the local container. Use to
    create .sma sources in /tmp/amxx_work/.
  list_local(path) — list a local directory. Use to browse /app/amxx/include/
    or /app/amxx/testsuite/.
  compile_plugin(local_path, upload_path?) — compile a .sma using the bundled
    amxxpc compiler. If upload_path is given, the .amxx is uploaded to the
    game server. Returns compiler output including errors/warnings.

WEB (look up docs, download files, clone repos):
  web_search(query, num_results=8) — DuckDuckGo search. Use to find AMX Mod X
    plugin examples, API docs, or solutions to compile errors.
  web_fetch(url) — fetch a URL's content as text (truncated to 12K chars).
  download_file(url, dest) — download a file from a URL directly to the server.
  git_clone(url, dest, depth=1) — shallow-clone a git repo to the server.

SERVER:
  rcon(command) — send RCON to CS 1.6 server. append(path, content) — add to end of file.
  verify(action, path, expected) — confirm an action worked.

ASK:
  ask_user(question, options, context) — ask only when you truly cannot proceed without input.

═══════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════

- CS 1.6 config syntax: cvar_name "value" — one per line. No semicolons needed.
- AMX Mod X: plugins.ini is at cstrike/addons/amxmodx/configs/plugins.ini
- Admin auth: STEAM_0:X:XXXXXXXX format in users.ini — always prefer Steam ID.
- RCON failing: check sv_rcon_password matches, server may need -rcon flag on start.
- If RCON works, always verify config changes live with RCON status/cvarlist.

═══════════════════════════════════════════════════════════════
PLUGIN DEVELOPMENT (AMX Mod X / Pawn)
═══════════════════════════════════════════════════════════════

You can create, compile, debug, and deploy AMX Mod X plugins from a blank prompt.

COMPILER ENVIRONMENT (inside the container):
  amxxpc binary:   /usr/local/bin/amxxpc
  AMX Mod X SDK:   /app/amxx/include/  (140 .inc files: amxmodx.inc, fakemeta.inc,
                                         hamsandwich.inc, cstrike.inc, reapi.inc,
                                         engine.inc, nvault.inc, sqlx.inc, json.inc,
                                         xs.inc, and many more)
  Reference tests: /app/amxx/testsuite/  (25 sample plugins you can read for patterns)
  Work dir:        /tmp/amxx_work/       (write your .sma sources here)

PAWN / AMX MOD X SYNTAX QUICK REFERENCE:
  - Every plugin starts with: #include <amxmodx> then #include <amxmodx_sock> (etc. as needed)
  - Register: public plugin_init() { register_plugin("Name", "Version", "Author") }
  - Main: public plugin_cfg() or use register_menuid / register_event / register_logevent
  - Client command: public client_command(id) { if (equali(read_argv(1), "say") ...) }
  - Chat: register_clcmd("say", "handle_say")
  - Player info: get_user_name(id), get_user_userid(id), get_user_authid(id)
  - For non-stock plugins you may need specific includes (e.g. <cstrike> for CS natives,
    <fakemeta> for FM_*, <hamsandwich> for RegisterHam, <reapi> for ReGameDll API)

COMMON AMX MOD X API (use these signatures directly — do NOT spend iterations
searching the .inc files for them; only read_local an .inc if you need a
niche/uncommon function or its exact constant values):

  CLIENT OUTPUT:
    client_print(id, type, const msg[], any:...)  // types: print_chat, print_console, print_center
    client_print(0, print_chat, "global chat msg")  // id=0 broadcasts to all
    set_hudmessage(r, g, b, x, y, effects, fadein, fadeout, holdtime, fx=0, ...)
    show_hudmessage(id, const msg[], any:...)
    show_motd(id, const file[], const header[]="")
    ColorMessage(id, _index, const msg[], any:...)  // from colorchat.inc
    ColorSelection(...)                              // for menu choices

  PLAYER QUERIES:
    is_user_connected(id)  is_user_alive(id)  is_user_bot(id)  is_user_hltv(id)
    get_user_name(id, name[], len)   get_user_authid(id, auth[], len)
    get_user_userid(id)  get_user_team(id)  get_user_health(id)  get_user_armor(id)
    get_user_weapon(id)  get_user_origin(id, origin[3], lorigin=0)
    get_user_maxspeed(id)  get_user_flags(id)  get_user_aiming(id)  get_user_no_retry()
    get_user_msglevel(id)  get_user_time(id)  get_user_frametime(id)

  PLAYER ACTIONS:
    set_user_health(id, hp)  set_user_armor(id, arm)  set_user_team(id, team)
    set_user_godmode(id, 1)  set_user_noclip(id, 1)   set_user_gravity(id, Float:grav)
    set_user_maxspeed(id, Float:speed)  set_user_origin(id, origin[3])
    user_slap(id, dmg, dmgtype=0)  user_kill(id)  drop_weapons(id, dropwhat=0)
    give_item(id, const item[])  cs_set_user_money(id, money, flash=0)  // from cstrike
    cs_set_user_bpammo(id, weapon, ammount)  cs_set_user_plant(id, 1)    // from cstrike

  ADMIN:
    cmd_access(id, level, flags=0, needhost=0)  // returns 1 if allowed
    get_user_flags(id)  set_user_flags(id, flags)
    access(id, level)  // simpler, no flag check

  CVARS:
    register_cvar("name", "default", flags=0, description[]="")
    get_cvar_pointer("name")  // returns cvar handle (0 if missing)
    get_pcvar_num(handle)  get_pcvar_string(handle, buf[], len)  get_pcvar_float(handle)
    set_pcvar_num(handle, val)  set_pcvar_string(handle, val)  set_pcvar_float(handle, Float:val)

  TASKS / TIMERS:
    set_task(Float:time, const task[], id=0, parameter="", len=0, flags=0)
    remove_task(id=0, const task[]="")  // either id OR task name
    change_task(id, task[], Float:new_time, param_change=0)

  EVENTS (use register_event with these names):
    "DeathMsg"  (kills)              "TextMsg"   (server text)
    "CurWeapon" (weapon switch)      "ResetHUD"  (round reset / spawn)
    "HLTV"      (round start)        "SayText"   (chat)
    "TeamInfo"  (team change)        "SetFOV"    (zoom)
    "SpecHealth"                      "Money"     (CS money)
    "BarTime"   (progress bars)      "StatusValue" (HUD icons)

  FORWARDS (use these as public function names — AMXX calls them automatically):
    plugin_init()  plugin_cfg()  plugin_precache()  plugin_end()  plugin_pause()  plugin_unpause()
    client_connect(id)  client_connectex(id, const name[], const ip[], reason[128])
    client_putinserver(id)  client_authorized(id, const authid[])
    client_disconnect(id)  client_disconnected(id, bool:drop, message[], maxlen)
    client_command(id)  client_infochanged(id)
    server_changelevel(const map[])

  MESSAGES (low-level — for custom effects/sounds):
    message_begin(MSG_ONE, gmsgSayText, _, id)  message_end()  // chat
    message_begin(MSG_ALL, gmsgDeathMsg, ...)                // death notice
    Full list of gmsg* in messages_const.inc / get_user_msgid("SayText")

TEMPLATES (these are 100% correct; copy and adapt):

  Welcome plugin (chat + HUD on join):
    #include <amxmodx>
    public plugin_init() { register_plugin("Welcome", "1.0", "OMEGA") }
    public client_putinserver(id) {
      new name[32]; get_user_name(id, name, charsmax(name))
      client_print(id, print_chat, "Welcome to the server, %s!", name)
      set_hudmessage(0, 255, 0, -1.0, 0.30, 0, 6.0, 5.0, 0.1, 0.2)
      show_hudmessage(id, "Have fun and play fair!")
    }

  DeathMsg logger:
    #include <amxmodx>
    public plugin_init() { register_plugin("DeathLog", "1.0", "OMEGA")
      register_event("DeathMsg", "hook_death", "a") }
    public hook_death() {
      new victim = read_data(2); new killer = read_data(1)
      new vn[32], kn[32]
      get_user_name(victim, vn, charsmax(vn))
      get_user_name(killer, kn, charsmax(kn))
      client_print(0, print_chat, "* %s killed %s", kn, vn)
    }

  Say command (e.g. /hello):
    #include <amxmodx>
    public plugin_init() { register_plugin("Hello", "1.0", "OMEGA")
      register_clcmd("say /hello", "cmd_hello") }
    public cmd_hello(id) { client_print(id, print_chat, "Hello!") }

STANDARD PLUGIN CREATION WORKFLOW:
  1. PLAN: State the plugin's behavior and which natives/modules it needs.
  2. RESEARCH: If you're unsure about a native, read the .inc file:
       read_local("/app/amxx/include/amxmodx.inc")  -> search for the function
       read_local("/app/amxx/include/fakemeta.inc")  -> FM_*
       read_local("/app/amxx/include/hamsandwich.inc")  -> RegisterHam
     Or use web_search / web_fetch to look up "amxmodx <topic>" or
     "alliedmodders <topic>".
     You can also read examples: list_local("/app/amxx/testsuite") then
     batch_read the relevant .sma files.
  3. WRITE THE SOURCE:
       write_local("/tmp/amxx_work/myserver.sma", <full source code>)
  4. COMPILE + UPLOAD:
       compile_plugin(
         local_path = "/tmp/amxx_work/myserver.sma",
         upload_path = "cstrike/addons/amxmodx/plugins/myserver.amxx"
       )
     If success=false, parse the errors (file:line: error message), read the
     relevant .inc, fix with write_local, and compile_plugin again. Iterate
     until success=true.
  5. ENABLE THE PLUGIN:
       read("cstrike/addons/amxmodx/configs/plugins.ini")
       edit( ... add "myserver.amxx" on its own line, no semicolon, no quotes ... )
  6. ACTIVATE LIVE:
       rcon("amxx plugins reload")   // or "restart" for a hard restart
     Verify with: rcon("amxx plugins") to see the plugin loaded.

EXAMPLES OF PLUGIN REQUESTS YOU CAN HANDLE:
  - "Create a plugin that announces headshots"        -> register_event("DeathMsg", ...)
  - "Make a plugin giving a /menu command"            -> register_menuid + register_menucmd
  - "Build a VIP plugin that gives extra money"       -> cs_set_user_money
  - "Anti-flood chat plugin"                          -> client_command + set_task

DOWNLOADING EXISTING PLUGINS:
  - To grab a known plugin from GitHub: git_clone("https://github.com/.../plugin.git",
    "cstrike/addons/amxmodx/plugins/customplugin")
  - To fetch a single .amxx: download_file(url, "cstrike/addons/amxmodx/plugins/x.amxx")
  - For source: download_file(sma_url, "cstrike/addons/amxmodx/plugins-custom/x.sma"),
    then compile_plugin(local_path_of_downloaded_file, "cstrike/.../x.amxx")

═══════════════════════════════════════════════════════════════
RCON COMMAND REFERENCE
═══════════════════════════════════════════════════════════════

Common commands: status, stats, users, sv_password, hostname,
sv_gravity, mp_timelimit, mp_maxrounds, changelevel <map>,
rcon_password, sv_restart <sec>, kick <name>, banid <time> <id>,
sv_cheats 0/1, mp_friendlyfire 0/1, mp_autoteambalance 0/1,
sv_alltalk 0/1, mp_limitteams <n>, mp_freezetime <sec>,
sv_maxrate, sv_minrate, sv_maxupdaterate, sv_region

═══════════════════════════════════════════════════════════════
RESPONSE STYLE
═══════════════════════════════════════════════════════════════

You are a silent operator. Respond like a senior sysadmin, not a chatbot.

RULES:
- No "Got it!", "Sure!", "Let me...", "I'll now...", "Great!" — ever.
- No emojis. No ✅ ⚠️ 🔧 or any other symbols.
- No markdown tables. Use plain text with dashes if structure is needed.
- No "Want me to investigate?" follow-ups — just do it if relevant, or don't.
- Never repeat yourself. Say a thing once.
- Keep final summaries SHORT: 3-5 lines max. What ran, what the result was, anything critical.
- If RCON succeeds, just say the command and its output. No fanfare.
- If a file was edited, say what changed in one line.
- If an error is found (like a missing plugin), fix it or flag it once — no hand-holding.

EXAMPLE (bad):
  "Got it! I'll reload the server config now. Let me start by reading server.cfg first..."
  [table of results]
  "Want me to also check the plugins?"

EXAMPLE (good):
  "exec server.cfg — OK. changelevel de_airstrip — OK.
  Note: amxmodx.amxx missing from plugins folder."

═══════════════════════════════════════════════════════════════

You are OMEGA. Act. Verify. Report.'''

# ─── SSE Helpers ───

def sse(t, **kw):
    return f'data: {json.dumps({"type": t, **kw})}\n\n'

def tool_result_text(action, fn_args, result, error):
    if error:
        return f'Error: {error}'
    if action == 'ls':
        lines = []
        for f in result:
            tag = '[DIR]' if f.get('dir') else str(f.get('size', '0'))
            lines.append(f'{tag} {f["name"]}')
        return '\n'.join(lines)
    if action == 'rcon':
        return str(result)
    if action == 'batch_read':
        parts = []
        for f in result:
            parts.append(f"=== {f['path']} ===\n{f.get('content', '(not found)')}")
        return '\n\n'.join(parts)
    if action == 'info':
        if result.get('exists'):
            return f"Size: {result['size']} bytes | Dir: {result.get('is_dir', False)} | Perms: {result.get('permissions', '?')} | Modified: {datetime.fromtimestamp(result.get('mtime', 0)).strftime('%Y-%m-%d %H:%M:%S')}"
        return f"Does not exist"
    if action == 'search':
        if not result:
            return 'No files found matching the pattern.'
        lines = [f"{f['path']} ({f['size']} bytes)" for f in result[:80]]
        suffix = f'\n... and {len(result) - 80} more' if len(result) > 80 else ''
        return f"Found {len(result)} file(s):\n" + '\n'.join(lines) + suffix
    if action == 'search_content':
        lines = []
        for f in result:
            lines.append(f"{f['path']}: {f['matches']} matches\n{f.get('preview', '')}")
        return '\n---\n'.join(lines)
    if action == 'verify':
        return str(result)
    if action == 'ask_user':
        return f"Question asked: {fn_args.get('question', '')}"
    if action == 'compile_plugin':
        if isinstance(result, dict):
            if result.get('success'):
                out = f"Compiled OK ({result.get('amxx_size', '?')} bytes)"
                if result.get('uploaded_to'):
                    out += f" — uploaded to {result['uploaded_to']}"
                if result.get('output'):
                    out += f"\n{result['output']}"
                return out
            parts = [f"Compile FAILED (rc={result.get('return_code', '?')})"]
            if result.get('errors'):
                parts.append(f"stderr: {result['errors']}")
            if result.get('output'):
                parts.append(f"stdout: {result['output']}")
            if result.get('upload_error'):
                parts.append(f"upload: {result['upload_error']}")
            return '\n'.join(parts)
    if action in ('read_local', 'write_local', 'list_local', 'web_search', 'web_fetch', 'download_file', 'git_clone'):
        return str(result)
    if isinstance(result, str):
        return result
    return str(result)

# ─── Anthropic Format Helpers ───

def _tools_to_anthropic(oai_tools: list) -> list:
    """Convert OpenAI-format tools → Anthropic input_schema format."""
    out = []
    for t in oai_tools:
        fn = t.get('function', t)
        out.append({
            'name': fn['name'],
            'description': fn.get('description', ''),
            'input_schema': fn.get('parameters', {'type': 'object', 'properties': {}}),
        })
    return out

def _msgs_to_anthropic(oai_messages: list) -> tuple[str, list]:
    """Convert OpenAI-format message list → (system_str, anthropic_messages).
    Handles: system extraction, tool results → tool_result blocks,
    assistant tool_calls → tool_use content blocks.
    """
    system_parts = []
    out = []
    for m in oai_messages:
        role = m.get('role', '')
        if role == 'system':
            c = m.get('content', '')
            if c:
                system_parts.append(c)
            continue
        if role == 'tool':
            blk = {
                'type': 'tool_result',
                'tool_use_id': m.get('tool_call_id', ''),
                'content': str(m.get('content', '')),
            }
            if out and out[-1]['role'] == 'user' and isinstance(out[-1]['content'], list):
                out[-1]['content'].append(blk)
            else:
                out.append({'role': 'user', 'content': [blk]})
            continue
        if role == 'assistant':
            parts = []
            text = m.get('content') or ''
            if text:
                parts.append({'type': 'text', 'text': text})
            for tc in m.get('tool_calls', []):
                fn = tc.get('function', {})
                try:
                    inp = json.loads(fn.get('arguments', '{}') or '{}')
                except Exception:
                    inp = {}
                parts.append({
                    'type': 'tool_use',
                    'id': tc.get('id', str(uuid.uuid4())[:12]),
                    'name': fn.get('name', ''),
                    'input': inp,
                })
            out.append({'role': 'assistant', 'content': parts if parts else (text or '')})
            continue
        if role == 'user':
            content = m.get('content', '')
            if isinstance(content, list):
                out.append({'role': 'user', 'content': content})
            else:
                # Merge consecutive user messages if last is also user
                if out and out[-1]['role'] == 'user' and isinstance(out[-1]['content'], str):
                    out[-1]['content'] += '\n' + content
                else:
                    out.append({'role': 'user', 'content': content})
    return '\n\n'.join(system_parts), out

# ─── Main Agent Stream ───

async def agent_stream(req: AgentReq):
    global chat_history, task_memory
    d = req.model_dump()
    host = d['host']; port = d['port']; user = d['user']; password = d['password']
    rcon_pass = d['rconPass']; rcon_host = d['rconHost']; game_port = d['gamePort']
    api_key = d['apiKey']; task = d['task']

    session_id = str(uuid.uuid4())[:12]
    _done_sent = False

    try:
        sftp_connect(host, port, user, password)
    except Exception as e:
        yield sse('error', content=f'SFTP connection failed: {str(e)}')
        _done_sent = True
        yield sse('done')
        return

    try:
        # Build message context
        messages: list[dict[str, Any]] = [{'role': 'system', 'content': SYSTEM_PROMPT}]

        # Add task memory (last 5 tasks for context continuity)
        if task_memory:
            memory_text = "RECENT TASK HISTORY (for context - these were previous operations):\n"
            for i, mem in enumerate(task_memory[-5:], 1):
                memory_text += f"\n[{i}] Task: {mem.get('task', 'unknown')[:80]}"
                if mem.get('summary'):
                    memory_text += f"\n    Result: {mem['summary'][:100]}"
            messages.append({'role': 'system', 'content': memory_text})

        # Add chat history (last 5 exchanges)
        for h in chat_history[-5:]:
            messages.append({'role': 'user', 'content': h['user']})
            if h.get('assistant'):
                messages.append({'role': 'assistant', 'content': h['assistant']})

        messages.append({'role': 'user', 'content': task})

        # Map provider → API URL (all use OpenAI-compatible chat completions)
        provider = d.get('provider', 'opencode')
        model = d.get('model', 'big-pickle') or 'big-pickle'
        provider_urls = {
            'opencode':   'https://opencode.ai/zen/v1/chat/completions',
            'openai':     'https://api.openai.com/v1/chat/completions',
            'deepseek':   'https://api.deepseek.com/v1/chat/completions',
            'groq':       'https://api.groq.com/openai/v1/chat/completions',
            'openrouter': 'https://openrouter.ai/api/v1/chat/completions',
            'gemini':     'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            'mistral':    'https://api.mistral.ai/v1/chat/completions',
            # anthropic handled separately — does not use api_url
        }
        api_url = provider_urls.get(provider, provider_urls['opencode'])
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
        if provider == 'openrouter':
            headers['HTTP-Referer'] = 'https://cs16-manager.replit.app'
            headers['X-Title'] = 'CS 1.6 AI Manager'

        max_iter = 30
        reasoning_text = ''
        tool_seq = 0
        task_results = []
        current_task_summary = {'task': task, 'steps': []}
        iteration = 0  # ensure bound for the post-loop check

        for iteration in range(max_iter):
            assistant_content = ''
            tool_calls = []
            waiting_for_answer = False

            # ── Anthropic branch ──────────────────────────────────────────────
            if provider == 'anthropic':
                ant_system, ant_msgs = _msgs_to_anthropic(messages)
                ant_tools = _tools_to_anthropic(TOOL_DEFS)
                ant_payload = {
                    'model': model,
                    'max_tokens': 4096,
                    'system': ant_system,
                    'messages': ant_msgs,
                    'tools': ant_tools,
                    'stream': True,
                }
                ant_headers = {
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                }
                try:
                    async with httpx.AsyncClient(timeout=120) as client:
                        async with client.stream(
                            'POST', 'https://api.anthropic.com/v1/messages',
                            json=ant_payload, headers=ant_headers
                        ) as resp:
                            if resp.status_code != 200:
                                err = await resp.aread()
                                yield sse('error', content=f'Anthropic error {resp.status_code}: {err.decode()[:300]}')
                                _done_sent = True
                                yield sse('done')
                                return

                            buffer = ''
                            async for chunk in resp.aiter_bytes():
                                buffer += chunk.decode('utf-8', errors='replace')
                                while '\n' in buffer:
                                    line, buffer = buffer.split('\n', 1)
                                    line = line.rstrip()
                                    if not line.startswith('data: '):
                                        continue
                                    try:
                                        j = json.loads(line[6:])
                                    except Exception:
                                        continue
                                    t = j.get('type', '')
                                    if t == 'content_block_start':
                                        idx = j.get('index', 0)
                                        block = j.get('content_block', {})
                                        if block.get('type') == 'tool_use':
                                            while len(tool_calls) <= idx:
                                                tool_calls.append({'name': '', 'args': '', 'id': ''})
                                            tool_calls[idx]['id'] = block.get('id', str(uuid.uuid4())[:12])
                                            tool_calls[idx]['name'] = block.get('name', '')
                                    elif t == 'content_block_delta':
                                        idx = j.get('index', 0)
                                        delta = j.get('delta', {})
                                        dt = delta.get('type', '')
                                        if dt == 'text_delta':
                                            txt = delta.get('text', '')
                                            if txt:
                                                assistant_content += txt
                                                yield sse('content', content=txt)
                                        elif dt == 'input_json_delta':
                                            partial = delta.get('partial_json', '')
                                            if idx < len(tool_calls):
                                                tool_calls[idx]['args'] += partial
                except httpx.TimeoutException:
                    yield sse('error', content='Anthropic request timed out after 120 seconds')
                    _done_sent = True
                    yield sse('done')
                    return
                except Exception as e:
                    yield sse('error', content=f'Anthropic connection error: {str(e)}')
                    _done_sent = True
                    yield sse('done')
                    return

            # ── OpenAI-compatible branch (all other providers) ────────────────
            else:
                payload = {
                    'model': model,
                    'messages': messages,
                    'stream': True,
                    'tools': TOOL_DEFS,
                    'temperature': 0.2,
                    'max_tokens': 4096,
                }
                try:
                    async with httpx.AsyncClient(timeout=120) as client:
                        async with client.stream('POST', api_url, json=payload, headers=headers) as resp:
                            if resp.status_code != 200:
                                err = await resp.aread()
                                yield sse('error', content=f'API error {resp.status_code}: {err.decode()[:200]}')
                                _done_sent = True
                                yield sse('done')
                                return

                            buffer = ''
                            async for chunk in resp.aiter_bytes():
                                buffer += chunk.decode('utf-8', errors='replace')
                                while '\n' in buffer:
                                    line, buffer = buffer.split('\n', 1)
                                    line = line.strip()
                                    if not line or line == 'data: [DONE]':
                                        continue
                                    if not line.startswith('data: '):
                                        continue
                                    try:
                                        j = json.loads(line[6:])
                                    except Exception:
                                        continue

                                    choices = j.get('choices') or [{}]
                                    delta = choices[0].get('delta', {})

                                    # Handle reasoning (DeepSeek-style)
                                    r = delta.get('reasoning_content', '') or ''
                                    if r:
                                        reasoning_text += r
                                        yield sse('reasoning', reasoning=r)

                                    # Handle content
                                    c = delta.get('content', '') or ''
                                    if c:
                                        assistant_content += c
                                        yield sse('content', content=c)

                                    # Handle tool calls
                                    tc = delta.get('tool_calls', [])
                                    for t in tc:
                                        idx = t.get('index', 0)
                                        while len(tool_calls) <= idx:
                                            tool_calls.append({'name': '', 'args': '', 'id': ''})
                                        if t.get('id'):
                                            tool_calls[idx]['id'] = t['id']
                                        if t.get('function', {}).get('name'):
                                            tool_calls[idx]['name'] = t['function']['name']
                                        if t.get('function', {}).get('arguments'):
                                            tool_calls[idx]['args'] += t['function']['arguments']
                except httpx.TimeoutException:
                    yield sse('error', content='API request timed out after 120 seconds')
                    _done_sent = True
                    yield sse('done')
                    return
                except Exception as e:
                    yield sse('error', content=f'API connection error: {str(e)}')
                    _done_sent = True
                    yield sse('done')
                    return

            yield sse('reasoning_end', reasoning=reasoning_text)

            # Check if any tool calls
            valid_tc = [t for t in tool_calls if t.get('name')]

            if not valid_tc:
                # No tool calls — task complete
                chat_history.append({'user': task, 'assistant': assistant_content[:2000]})
                if len(chat_history) > 10:
                    chat_history = chat_history[-10:]

                current_task_summary['summary'] = assistant_content[:200]
                task_memory.append(current_task_summary)
                if len(task_memory) > 5:
                    task_memory = task_memory[-5:]

                _done_sent = True
                yield sse('done')
                return

            # Send plan overview
            plan_steps = []
            for tc in valid_tc:
                name = tc['name']
                try:
                    args = json.loads(tc['args']) if tc['args'] else {}
                except:
                    args = {}
                path_val = str(args.get('path') or args.get('command') or args.get('source') or 'unknown')
                content_preview = ''
                if 'content' in args:
                    content_preview = str(args['content'])[:50]
                elif 'find' in args:
                    content_preview = f"find: {str(args['find'])[:40]}"
                elif 'pattern' in args:
                    content_preview = f"pattern: {str(args['pattern'])[:40]}"
                elif 'question' in args:
                    content_preview = f"Q: {str(args['question'])[:40]}"
                plan_steps.append({
                    'action': name,
                    'path': str(path_val)[:60],
                    'content': content_preview
                })
            yield sse('plan', steps=plan_steps)

            # Execute tool calls
            tool_msgs = []
            for tc in valid_tc:
                name = tc['name']
                try:
                    args = json.loads(tc['args']) if tc['args'] else {}
                except:
                    args = {}
                if not tc.get('id'):
                    tc['id'] = str(uuid.uuid4())[:12]

                path_val = str(args.get('path') or args.get('command') or args.get('source') or '')[:60]
                tool_seq += 1
                yield sse('tool_start', id=tc['id'], action=name, path=path_val, seq=tool_seq)

                result_val = None
                err_text = None
                rcon_resp = None
                question_data = None
                start_time = time.time()

                try:
                    if name == 'ls':
                        p = args.get('path', '.')
                        result_val = sftp_ls(p)

                    elif name == 'read':
                        result_val = sftp_read(args['path'])

                    elif name == 'write':
                        sftp_write(args['path'], args['content'])
                        result_val = f"Written {len(args['content'])} chars to {args['path']}"

                    elif name == 'edit':
                        full = sftp_read(args['path'])
                        find = args.get('find', '')
                        replace = args.get('replace', '')
                        if full and find in full:
                            full = full.replace(find, replace, 1)
                            sftp_write(args['path'], full)
                            result_val = f"Replaced in {args['path']}"
                        else:
                            result_val = 'Text not found'
                            line = args.get('line')
                            if line:
                                lines = full.split('\n')
                                if 1 <= line <= len(lines):
                                    lines[line - 1] = lines[line - 1].replace(find, replace, 1)
                                    sftp_write(args['path'], '\n'.join(lines))
                                    result_val = f'Replaced OK (line {line})'

                    elif name == 'delete':
                        sftp_delete(args['path'])
                        result_val = f"Deleted {args['path']}"

                    elif name == 'mkdir':
                        sftp_mkdir(args['path'])
                        result_val = f"Created directory {args['path']}"

                    elif name == 'move':
                        sftp_move(args['source'], args['destination'])
                        result_val = f"Moved {args['source']} to {args['destination']}"

                    elif name == 'copy':
                        sftp_copy(args['source'], args['destination'])
                        result_val = f"Copied {args['source']} to {args['destination']}"

                    elif name == 'rename':
                        sftp_rename(args['old_path'], args['new_path'])
                        result_val = f"Renamed {args['old_path']} to {args['new_path']}"

                    elif name == 'chmod':
                        sftp_chmod(args['path'], args['mode'])
                        result_val = f"Changed permissions of {args['path']} to {oct(args['mode'])}"

                    elif name == 'search':
                        p = args.get('path', '.')
                        loop = asyncio.get_event_loop()
                        try:
                            result_val = await asyncio.wait_for(
                                loop.run_in_executor(None, sftp_search, p, args['pattern']),
                                timeout=20.0
                            )
                        except asyncio.TimeoutError:
                            result_val = []
                            err_text = 'Search timed out after 20s — try a more specific path or pattern'

                    elif name == 'search_content':
                        p = args.get('path', '.')
                        loop = asyncio.get_event_loop()
                        try:
                            result_val = await asyncio.wait_for(
                                loop.run_in_executor(None, sftp_search_content, p, args['pattern']),
                                timeout=25.0
                            )
                        except asyncio.TimeoutError:
                            result_val = []
                            err_text = 'Content search timed out after 25s — try a narrower path'

                    elif name == 'append':
                        sftp_append(args['path'], args['content'])
                        result_val = f"Appended {len(args['content'])} chars to {args['path']}"

                    elif name == 'batch_read':
                        ps = args.get('paths', [])
                        result_val = sftp_read_batch(ps)

                    elif name == 'info':
                        result_val = sftp_get_info(args['path'])

                    elif name == 'rcon':
                        rh = rcon_host or host
                        r = await rcon_send(rh, game_port, rcon_pass, args.get('command', ''))
                        rcon_resp = r
                        result_val = r[:500] if r else 'No response'

                    elif name == 'verify':
                        action = args.get('action', '')
                        path = args.get('path', '')
                        if action in ('write', 'edit', 'append'):
                            content = sftp_read(path)
                            result_val = {
                                'verified': True,
                                'path': path,
                                'size': len(content),
                                'preview': content[:200]
                            }
                        elif action == 'mkdir':
                            info = sftp_get_info(path)
                            result_val = {
                                'verified': info.get('exists', False) and info.get('is_dir', False),
                                'path': path,
                                'details': info
                            }
                        elif action == 'delete':
                            exists = sftp_exists(path)
                            result_val = {
                                'verified': not exists,
                                'path': path,
                                'still_exists': exists
                            }
                        else:
                            result_val = {'verified': True, 'action': action, 'path': path}

                    elif name == 'ask_user':
                        question_data = {
                            'question': args.get('question', ''),
                            'options': args.get('options', []),
                            'context': args.get('context', ''),
                            'session_id': session_id
                        }
                        pending_questions[session_id] = question_data
                        result_val = f"Waiting for user answer: {args.get('question', '')}"
                        waiting_for_answer = True

                    elif name == 'read_local':
                        p = Path(args['path'])
                        if not p.exists():
                            result_val = f"File not found: {p}"
                        else:
                            try:
                                content = p.read_text(encoding='utf-8', errors='replace')
                            except Exception as e:
                                content = p.read_bytes().decode('utf-8', errors='replace')
                            if len(content) > 12000:
                                content = content[:12000] + f"\n\n[Truncated at 12K of {p.stat().st_size} bytes total]"
                            result_val = content

                    elif name == 'write_local':
                        p = Path(args['path'])
                        p.parent.mkdir(parents=True, exist_ok=True)
                        p.write_text(args['content'], encoding='utf-8')
                        result_val = f"Written {len(args['content'])} chars to {p}"

                    elif name == 'list_local':
                        p = Path(args['path'])
                        if not p.exists():
                            result_val = f"Directory not found: {p}"
                        elif not p.is_dir():
                            result_val = f"Not a directory: {p}"
                        else:
                            entries = []
                            for child in sorted(p.iterdir()):
                                kind = '[DIR]' if child.is_dir() else str(child.stat().st_size)
                                entries.append(f"{kind} {child.name}")
                            if len(entries) > 200:
                                entries = entries[:200] + [f'... and {len(entries) - 200} more']
                            result_val = '\n'.join(entries) if entries else '(empty directory)'

                    elif name == 'compile_plugin':
                        sma_path = Path(args['local_path'])
                        upload_path = args.get('upload_path')

                        if not AMXXPC_BIN.exists():
                            err_text = f"Compiler not found at {AMXXPC_BIN} — Docker image missing amxxpc binary"
                        elif not sma_path.exists():
                            err_text = f"Source file not found: {sma_path}"
                        else:
                            include_arg = f'-i{AMXX_INCLUDE_DIR}'
                            try:
                                proc_result = subprocess.run(
                                    [str(AMXXPC_BIN), include_arg, str(sma_path)],
                                    capture_output=True, text=True, timeout=30,
                                    cwd=str(sma_path.parent)
                                )
                            except subprocess.TimeoutExpired:
                                err_text = "Compilation timed out after 30s"
                                proc_result = None

                            if proc_result is not None:
                                amxx_path = sma_path.with_suffix('.amxx')
                                response_obj: dict[str, Any] = {
                                    'success': proc_result.returncode == 0 and amxx_path.exists(),
                                    'return_code': proc_result.returncode,
                                    'output': proc_result.stdout,
                                    'errors': proc_result.stderr,
                                }
                                if response_obj['success']:
                                    response_obj['amxx_size'] = amxx_path.stat().st_size
                                    response_obj['amxx_path'] = str(amxx_path)
                                    if upload_path:
                                        try:
                                            binary_content = amxx_path.read_bytes()
                                            sftp_write_binary(upload_path, binary_content)
                                            response_obj['uploaded_to'] = upload_path
                                        except Exception as up_e:
                                            response_obj['upload_error'] = str(up_e)
                                            response_obj['success'] = False
                                result_val = response_obj

                    elif name == 'web_search':
                        query = args['query']
                        num = int(args.get('num_results', 8))
                        num = max(1, min(num, 20))
                        try:
                            async with httpx.AsyncClient(timeout=20) as client:
                                resp = await client.get(
                                    'https://html.duckduckgo.com/html/',
                                    params={'q': query},
                                    headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}
                                )
                            html_body = resp.text
                            pat = re.compile(
                                r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
                                r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
                                re.DOTALL
                            )
                            results: list[str] = []
                            for m in pat.finditer(html_body):
                                url_h, title_h, snippet_h = m.groups()
                                title = re.sub(r'<[^>]+>', '', title_h).strip()
                                snippet = re.sub(r'<[^>]+>', '', snippet_h).strip()
                                title = html.unescape(title)
                                snippet = html.unescape(snippet)
                                url_h = html.unescape(url_h)
                                results.append(f"**{title}**\n{url_h}\n{snippet}")
                                if len(results) >= num:
                                    break
                            if not results:
                                result_val = f"No results found for: {query}"
                            else:
                                result_val = f"Search results for '{query}':\n\n" + '\n\n---\n\n'.join(results)
                        except Exception as se:
                            err_text = f"Web search failed: {se}"

                    elif name == 'web_fetch':
                        url = args['url']
                        try:
                            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                                resp = await client.get(
                                    url,
                                    headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'}
                                )
                            text = resp.text
                            if len(text) > 12000:
                                text = text[:12000] + f"\n\n[Truncated at 12K chars of {len(resp.text)} total]"
                            result_val = f"HTTP {resp.status_code} — {url}\n\n{text}"
                        except Exception as fe:
                            err_text = f"Fetch failed: {fe}"

                    elif name == 'download_file':
                        url = args['url']
                        dest = args['dest']
                        try:
                            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                                resp = await client.get(url)
                            content_bytes = resp.content
                            sftp_write_binary(dest, content_bytes)
                            result_val = f"Downloaded {len(content_bytes)} bytes ({resp.status_code}) from {url} to {dest}"
                        except Exception as de:
                            err_text = f"Download failed: {de}"

                    elif name == 'git_clone':
                        url = args['url']
                        dest = args['dest']
                        depth = int(args.get('depth', 1))
                        try:
                            with tempfile.TemporaryDirectory() as tmpdir:
                                proc = subprocess.run(
                                    ['git', 'clone', '--depth', str(depth), url, tmpdir],
                                    capture_output=True, text=True, timeout=120
                                )
                                if proc.returncode != 0:
                                    err_text = f"Git clone failed: {proc.stderr.strip()[:300]}"
                                else:
                                    count = 0
                                    for root, _dirs, files in os.walk(tmpdir):
                                        for fname in files:
                                            local_f = Path(root) / fname
                                            rel = local_f.relative_to(tmpdir)
                                            remote_f = str(Path(dest) / rel).replace('\\', '/')
                                            data = local_f.read_bytes()
                                            sftp_write_binary(remote_f, data)
                                            count += 1
                                    result_val = f"Cloned {count} files from {url} to {dest}"
                        except subprocess.TimeoutExpired:
                            err_text = "Git clone timed out after 120s"
                        except Exception as ge:
                            err_text = f"Git clone error: {ge}"

                    else:
                        err_text = f'Unknown tool: {name}'

                except Exception as e:
                    err_text = str(e)
                    traceback.print_exc()

                elapsed = round(time.time() - start_time, 2)
                status = 'error' if err_text else ('question' if waiting_for_answer else 'done')
                display_result = tool_result_text(name, args, result_val, err_text) if not err_text else err_text

                yield sse('tool_end',
                          id=tc['id'],
                          status=status,
                          data=display_result,
                          error=err_text,
                          rconResponse=rcon_resp,
                          elapsed=elapsed)

                if waiting_for_answer and question_data:
                    yield sse('question', **question_data)
                    # Wait for user answer
                    for _ in range(600):  # Wait up to 10 minutes
                        await asyncio.sleep(1)
                        if session_id not in pending_questions:
                            break
                        ans = pending_questions.get(session_id, {}).get('answer')
                        if ans:
                            result_val = f"User answered: {ans}"
                            question_data = None
                            waiting_for_answer = False
                            del pending_questions[session_id]
                            # Update display_result now that we have the real answer
                            display_result = result_val
                            # Tell frontend to flip the tool card from question → done
                            yield sse('tool_end',
                                      id=tc['id'],
                                      status='done',
                                      data=display_result,
                                      elapsed=round(time.time() - start_time, 2))
                            break
                    else:
                        yield sse('error', content='Question timed out waiting for user response')
                        _done_sent = True
                        yield sse('done')
                        return

                tool_content = str(result_val) if result_val is not None else display_result
                tool_msgs.append({
                    'role': 'tool',
                    'tool_call_id': tc['id'],
                    'content': str(tool_content)[:4000]
                })

                current_task_summary['steps'].append({
                    'action': name,
                    'path': str(path_val),
                    'status': status,
                    'elapsed': elapsed
                })

            # Add assistant + tool messages — format depends on provider
            if provider == 'anthropic':
                # Anthropic: assistant message uses content blocks
                ant_content = []
                if assistant_content:
                    ant_content.append({'type': 'text', 'text': assistant_content})
                for t in valid_tc:
                    try:
                        inp = json.loads(t['args']) if t['args'] else {}
                    except Exception:
                        inp = {}
                    ant_content.append({
                        'type': 'tool_use',
                        'id': t['id'],
                        'name': t['name'],
                        'input': inp,
                    })
                messages.append({'role': 'assistant', 'content': ant_content})
                # Tool results as a single user message
                tool_result_blocks = [
                    {
                        'type': 'tool_result',
                        'tool_use_id': m['tool_call_id'],
                        'content': m['content'],
                    }
                    for m in tool_msgs
                ]
                messages.append({'role': 'user', 'content': tool_result_blocks})
            else:
                # OpenAI: standard tool_calls + tool messages
                asm = {'role': 'assistant', 'content': assistant_content or None}
                asm['tool_calls'] = [{
                    'id': t['id'],
                    'type': 'function',
                    'function': {'name': t['name'], 'arguments': t['args']}
                } for t in valid_tc]
                messages.append(asm)
                messages.extend(tool_msgs)

        if iteration >= max_iter - 1:
            _done_sent = True
            yield sse('done', explanation='Maximum iterations reached. Task may be incomplete.')

    except asyncio.CancelledError:
        pass  # client disconnected — stream closed cleanly
    except Exception as e:
        if not _done_sent:
            yield sse('error', content=f'Agent error: {str(e)}')
        traceback.print_exc()
    finally:
        if not _done_sent:
            yield sse('done')

# ─── FastAPI App ───

app = FastAPI(title='CS 1.6 AI Manager - OMEGA Agent')

app.add_middleware(  # type: ignore[arg-type]
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.get('/api/healthz')
async def healthz():
    return {'status': 'ok'}

@app.get('/')
async def serve_html():
    if HTML_FILE.exists():
        return HTMLResponse(HTML_FILE.read_text('utf-8'))
    return HTMLResponse(
        '<h1>CS 1.6 AI Manager</h1>'
        '<p>Frontend bundle not found. The backend is running.</p>'
        '<p>Set STATIC_DIR or build the frontend (<code>cd frontend && pnpm build</code>).</p>',
        status_code=200,
    )

# Serve static assets (JS, CSS, favicon, etc.) under /assets/* from the Vite build
if STATIC_DIR.exists():
    app.mount('/assets', StaticFiles(directory=STATIC_DIR / 'assets'), name='assets')
    if (STATIC_DIR / 'favicon.svg').exists():
        app.mount('/favicon.svg', StaticFiles(directory=STATIC_DIR, html=False), name='favicon')

@app.get('/api/config')
async def get_config():
    return {**cfg}

@app.post('/api/config')
async def save_config_ep(req: ConfigSaveReq):
    save_config(req.model_dump())
    return {'ok': True}

@app.post('/api/setup/test')
async def api_setup_test(req: SetupTestReq):
    d = req.model_dump()
    r = {'ok': True, 'sftp': False, 'rcon': False, 'rconResponse': ''}
    try:
        sftp_connect(d['host'], d['port'], d['user'], d['password'])
        assert _sftp is not None
        _sftp.listdir('.')
        r['sftp'] = True
    except Exception as e:
        r['sftp'] = str(e)
        r['ok'] = False
    if d.get('rconHost') and d.get('rconPass'):
        try:
            rr = await rcon_send(d['rconHost'], d['gamePort'], d['rconPass'], 'echo test')
            r['rcon'] = True
            r['rconResponse'] = rr
        except Exception as e:
            r['rcon'] = str(e)
    return r

# ─── SFTP API Endpoints ───

@app.post('/api/sftp/ls')
async def api_ls(req: SFTPLsReq):
    try:
        return {'ok': True, 'files': sftp_ls(req.path)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/read')
async def api_read(req: SFTPReadReq):
    try:
        return {'ok': True, 'content': sftp_read(req.path)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/write')
async def api_write(req: SFTPWriteReq):
    try:
        sftp_write(req.path, req.content)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/delete')
async def api_delete(req: SFTPDeleteReq):
    try:
        sftp_delete(req.path)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/mkdir')
async def api_mkdir(req: SFTPMkdirReq):
    try:
        sftp_mkdir(req.path)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/move')
async def api_move(req: SFTPMoveReq):
    try:
        sftp_move(req.source, req.destination)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/copy')
async def api_copy(req: SFTPCopyReq):
    try:
        sftp_copy(req.source, req.destination)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/rename')
async def api_rename(req: SFTPRenameReq):
    try:
        sftp_rename(req.old_path, req.new_path)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/chmod')
async def api_chmod(req: SFTPChmodReq):
    try:
        sftp_chmod(req.path, req.mode)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/sftp/info')
async def api_info(req: SFTPReadReq):
    try:
        return {'ok': True, 'info': sftp_get_info(req.path)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/search')
async def api_search(req: SearchReq):
    try:
        return {'ok': True, 'files': sftp_search(req.path, req.pattern)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/search_content')
async def api_search_content(req: SearchContentReq):
    try:
        return {'ok': True, 'results': sftp_search_content(req.path, req.pattern)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/append')
async def api_append(req: AppendReq):
    try:
        sftp_append(req.path, req.content)
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/batch_read')
async def api_batch_read(req: BatchReadReq):
    try:
        return {'ok': True, 'files': sftp_read_batch(req.paths)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/rcon')
async def api_rcon(req: RCONReq):
    rh = cfg.get('rconHost', '')
    rp = cfg.get('rconPass', '')
    gp = cfg.get('gamePort', 27015)
    if not rh:
        return {'ok': False, 'error': 'RCON host not configured'}
    try:
        resp = await rcon_send(rh, gp, rp, req.command)
        return {'ok': True, 'response': resp}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.get('/api/compiler/status')
async def api_compiler_status():
    # Cached "does amxxpc actually run?" check. The compiler is wrapped in
    # qemu-i386-static and we don't want to spawn qemu on every 30s poll,
    # so cache the result for 5 minutes (or until the binary changes).
    invocable: Optional[dict] = _compiler_invocable_cache
    if invocable is None or invocable.get('checked_at', 0) < time.time() - 300:
        invocable = _check_amxxpc_runs(AMXXPC_BIN)
        invocable['checked_at'] = time.time()
        globals()['_compiler_invocable_cache'] = invocable
    assert invocable is not None  # narrowed by the branch above
    return {
        'ok': True,
        'amxxpc': str(AMXXPC_BIN),
        'amxxpc_exists': AMXXPC_BIN.exists(),
        'amxxpc_runs': invocable.get('runs', False),
        'amxxpc_runs_detail': invocable.get('detail', ''),
        'include_dir': str(AMXX_INCLUDE_DIR),
        'include_exists': AMXX_INCLUDE_DIR.exists(),
        'include_count': len(list(AMXX_INCLUDE_DIR.glob('*.inc'))) if AMXX_INCLUDE_DIR.exists() else 0,
        'testsuite_dir': str(AMXX_TESTSUITE_DIR),
        'testsuite_exists': AMXX_TESTSUITE_DIR.exists(),
        'testsuite_count': len(list(AMXX_TESTSUITE_DIR.glob('*.sma'))) if AMXX_TESTSUITE_DIR.exists() else 0,
        'work_dir': str(AMXX_WORK_DIR),
    }

class WebSearchReq(BaseModel):
    query: str
    num_results: int = 8

class WebFetchReq(BaseModel):
    url: str

@app.post('/api/web/search')
async def api_web_search(req: WebSearchReq):
    try:
        num = max(1, min(req.num_results, 20))
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                'https://html.duckduckgo.com/html/',
                params={'q': req.query},
                headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}
            )
        pat = re.compile(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
            r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
            re.DOTALL
        )
        out: list[dict[str, str]] = []
        for m in pat.finditer(resp.text):
            url_h, title_h, snippet_h = m.groups()
            out.append({
                'title': html.unescape(re.sub(r'<[^>]+>', '', title_h).strip()),
                'url': html.unescape(url_h),
                'snippet': html.unescape(re.sub(r'<[^>]+>', '', snippet_h).strip()),
            })
            if len(out) >= num:
                break
        return {'ok': True, 'results': out}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/web/fetch')
async def api_web_fetch(req: WebFetchReq):
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(
                req.url,
                headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}
            )
        text = resp.text
        truncated = False
        if len(text) > 15000:
            text = text[:15000]
            truncated = True
        return {'ok': True, 'status': resp.status_code, 'content': text, 'truncated': truncated}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

# ─── Agent Stream ───

@app.post('/api/agent/stream')
async def api_agent_stream(req: AgentReq):
    return StreamingResponse(agent_stream(req), media_type='text/event-stream')

@app.post('/api/agent/answer')
async def api_agent_answer(req: AnswerReq):
    """Submit an answer to a pending question."""
    session_id = req.session_id
    if session_id in pending_questions:
        pending_questions[session_id]['answer'] = req.answer
        return {'ok': True, 'message': 'Answer received'}
    return {'ok': False, 'error': 'No pending question found'}

# ─── Main ───

if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('PORT', DEFAULT_PORT))
    print(f'CS 1.6 AI Manager (OMEGA Agent) listening on 0.0.0.0:{port}')
    print(f'Static dir: {STATIC_DIR} ({"ok" if STATIC_DIR.exists() else "NOT FOUND — UI will not load"})')
    uvicorn.run(app, host='0.0.0.0', port=port, log_level='info')
