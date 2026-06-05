#!/usr/bin/env python3
"""
CS 1.6 AI Agent Manager
An intelligent AI agent for managing CS 1.6 dedicated servers with full tool control,
real-time reasoning, planning, action verification, memory, and question-asking capabilities.
"""

import asyncio, json, os, socket, stat, sys, traceback, uuid, hashlib, time, re, fnmatch, threading
from pathlib import Path
from typing import Optional, Any
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

# ─── Configuration ───

cfg = {
    'host': '', 'port': 2022, 'user': '', 'password': '',
    'rconPass': '', 'rconHost': '', 'gamePort': 27015
}
_transport = None
_sftp = None
_sftp_lock = threading.RLock()  # reentrant — sftp_copy calls sftp_read/write internally
chat_history = []
task_memory = []  # Last 5 task contexts for continuity

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

pending_questions = {}  # session_id -> {task, messages, callback}

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

def sftp_check():
    if not _sftp:
        raise HTTPException(400, 'SFTP not connected')

def sftp_ls(path='.'):
    with _sftp_lock:
        sftp_check()
        files = _sftp.listdir_attr(path)
        r = []
        for f in files:
            r.append({
                'name': f.filename,
                'dir': stat.S_ISDIR(f.st_mode),
                'size': f.st_size,
                'mtime': getattr(f, 'st_mtime', 0)
            })
        return sorted(r, key=lambda x: (not x['dir'], x['name'].lower()))

def sftp_read(path_str: str) -> str:
    with _sftp_lock:
        sftp_check()
        with _sftp.open(path_str, 'r') as f:
            return f.read().decode('utf-8', errors='replace')

def sftp_write(path_str: str, content: str):
    with _sftp_lock:
        sftp_check()
        with _sftp.open(path_str, 'w') as f:
            f.write(content.encode('utf-8'))

def sftp_delete(path_str: str):
    with _sftp_lock:
        sftp_check()
        try:
            _sftp.remove(path_str)
        except:
            _sftp.rmdir(path_str)

def sftp_mkdir(path_str: str):
    with _sftp_lock:
        sftp_check()
        _sftp.mkdir(path_str)

def sftp_move(source: str, destination: str):
    with _sftp_lock:
        sftp_check()
        _sftp.rename(source, destination)

def sftp_copy(source: str, destination: str):
    with _sftp_lock:
        sftp_check()
        with _sftp.open(source, 'r') as f:
            content = f.read()
        with _sftp.open(destination, 'w') as f:
            f.write(content)

def sftp_rename(old_path: str, new_path: str):
    with _sftp_lock:
        sftp_check()
        _sftp.rename(old_path, new_path)

def sftp_chmod(path_str: str, mode: int):
    with _sftp_lock:
        sftp_check()
        _sftp.chmod(path_str, mode)

def sftp_search(root: str, pattern: str, max_results: int = 60, max_depth: int = 3) -> list:
    with _sftp_lock:
        sftp_check()
        r = []
        deadline = time.time() + 15.0
        def _walk(p, depth=0):
            if depth > max_depth or len(r) >= max_results or time.time() > deadline:
                return
            try:
                entries = _sftp.listdir_attr(p)
                for f in entries:
                    if len(r) >= max_results or time.time() > deadline:
                        break
                    fp = (p.rstrip('/') + '/' + f.filename) if p != '.' else f.filename
                    if stat.S_ISDIR(f.st_mode):
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
        r = []
        files_checked = 0
        def _walk(p):
            nonlocal files_checked
            if files_checked >= max_files:
                return
            try:
                for f in _sftp.listdir_attr(p):
                    if files_checked >= max_files:
                        return
                    fp = (p + '/' + f.filename) if p != '.' else f.filename
                    if stat.S_ISDIR(f.st_mode):
                        _walk(fp)
                    elif f.st_size < 1024 * 1024:
                        files_checked += 1
                        try:
                            with _sftp.open(fp, 'r') as fh:
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
    try:
        _sftp.stat(path_str)
        return True
    except:
        return False

def sftp_get_info(path_str: str) -> dict:
    sftp_check()
    try:
        s = _sftp.stat(path_str)
        return {
            'exists': True,
            'size': s.st_size,
            'is_dir': stat.S_ISDIR(s.st_mode),
            'permissions': oct(s.st_mode)[-3:],
            'mtime': s.st_mtime
        }
    except Exception as e:
        return {'exists': False, 'error': str(e)}

def sftp_append(path_str: str, content: str):
    sftp_check()
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
        messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]

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

        max_iter = 20
        reasoning_text = ''
        tool_seq = 0
        task_results = []
        current_task_summary = {'task': task, 'steps': []}

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

app.add_middleware(
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
