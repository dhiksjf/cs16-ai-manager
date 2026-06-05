# CS 1.6 AI Manager — OMEGA

A web app that lets you **manage a Counter-Strike 1.6 dedicated server through an AI chat agent**. Type a task like *"reload server.cfg"*, *"add admin with Steam ID X"*, or even *"create a plugin that kills players who type 'noob' in chat"* — and the agent (OMEGA) does it, using SFTP for files, RCON for in-game commands, and a **bundled AMX Mod X compiler** for writing and deploying custom plugins.

- **Backend:** Python (FastAPI + uvicorn) — single `cs16-manager.py` with SFTP (paramiko), GoldSrc RCON (raw UDP), an LLM agent loop, and an in-container `amxxpc` compiler + AMX Mod X SDK.
- **Frontend:** React 19 + Vite + Tailwind v4 — chat UI, file tree, in-browser editor, live tool-call cards.
- **LLM providers:** OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, OpenRouter, or OpenCode (free).
- **Web tools:** the agent can search the web (DuckDuckGo), fetch URLs, download files, and `git clone` repos to the server.
- **Plugin dev:** the agent can write `.sma` sources, read the bundled `.inc` API headers, compile with `amxxpc`, iterate on errors, upload the `.amxx` to the server, enable it in `plugins.ini`, and reload via RCON.

---

## Features

### Server management (chat-driven)
- File ops: `ls`, `read`, `write`, `edit`, `delete`, `mkdir`, `move`, `copy`, `rename`, `chmod`
- Search: filename glob, content regex, batch read
- RCON: `status`, `changelevel`, `kick`, `banid`, `cvarlist`, etc.
- Questions: OMEGA only asks when it literally cannot proceed without your input

### Plugin development
- **In-container AMX Mod X compiler** (`amxxpc`) — built from source in the Docker image
- **Bundled SDK** — 140 `.inc` API headers at `/app/amxx/include/` (amxmodx, fakemeta, hamsandwich, cstrike, reapi, …)
- **Testsuite** — 25 reference plugins at `/app/amxx/testsuite/` the agent reads for patterns
- **Compile + upload** in one call — the agent writes the `.sma`, compiles, uploads the `.amxx` to the server, edits `plugins.ini`, and reloads via RCON
- **Iterate on errors** — when `amxxpc` reports `file.sma:line: error`, the agent reads the relevant `.inc` to learn the correct API and recompiles

### Web access
- `web_search` — DuckDuckGo search for docs / examples / solutions
- `web_fetch` — fetch a URL and return its text content
- `download_file` — download a file from a URL directly to the server
- `git_clone` — shallow-clone a git repo to the server (great for grabbing example plugins from GitHub)

---

## Deploy to Koyeb

### 1. Push to a Git repo

```bash
git init && git add . && git commit -m "init"
# create a new GitHub/GitLab repo, then:
git remote add origin <your-repo-url>
git push -u origin main
```

**Important:** `cs16-config.json` is committed with empty fields. Set your real values in Koyeb's environment variables (see below) — **do not** commit credentials.

### 2. Create a Koyeb service

1. Koyeb dashboard → **Create service** → **GitHub** (or GitLab).
2. Select your repo.
3. **Builder:** Docker (Koyeb auto-detects the `Dockerfile`).
4. **Instance type:** `free` (nano) works for a single user; `small` recommended for real use.
5. **Region:** pick one close to your CS 1.6 server to minimise SFTP/RCON latency.
6. **Port:** Koyeb auto-exposes `8000` (the default in the Dockerfile). Override only if you set a custom `PORT`.
7. **Health check path:** `/api/healthz`
8. **Deploy.**

First build takes 4–7 minutes (downloading base images + building frontend + installing Python deps + **building the AMX Mod X compiler from source**). Subsequent builds use Docker layer cache — only the frontend and Python stages rebuild, the compiler is cached.

### 3. Set environment variables

In the Koyeb service → **Environment variables**, add any of these (all optional — the UI lets you connect on first run too):

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the app listens on (Koyeb sets this automatically) | `8000` |
| `STATIC_DIR` | Where the built frontend lives | `/app/static` |
| `CS16_SFTP_HOST` | SFTP server hostname | — |
| `CS16_SFTP_PORT` | SFTP port | `2022` |
| `CS16_SFTP_USER` | SFTP username | — |
| `CS16_SFTP_PASSWORD` | SFTP password | — |
| `CS16_RCON_HOST` | CS 1.6 game server IP | — |
| `CS16_RCON_PASSWORD` | RCON password (`rcon_password` cvar) | — |
| `CS16_GAME_PORT` | CS 1.6 game port (UDP) | `27015` |
| `AMXXPC_BIN` | Path to the amxxpc compiler binary | `/usr/local/bin/amxxpc` |
| `AMXX_INCLUDE_DIR` | Path to the .inc SDK headers | `/app/amxx/include` |
| `AMXX_TESTSUITE_DIR` | Path to the reference test plugins | `/app/amxx/testsuite` |
| `AMXX_WORK_DIR` | Where the agent writes .sma sources | `/tmp/amxx_work` |

Mark secrets (`CS16_SFTP_PASSWORD`, `CS16_RCON_PASSWORD`) as **secret** so Koyeb encrypts them at rest.

The API key (OpenAI/Anthropic/etc.) is **not** an env var — the user pastes it into the UI on first connect. This keeps the key out of server logs and lets different users use different providers.

### 4. Open the app

Koyeb gives you a public URL like `https://cs16-manager-<your-name>.koyeb.app`. Open it, fill in the setup screen with your SFTP/RCON details, paste an LLM API key, and you're in. The header shows an **`amxxpc` badge** when the compiler is present and ready.

---

## Local development

```bash
# Frontend (terminal 1)
cd frontend
pnpm install
pnpm dev          # http://localhost:5173

# Backend (terminal 2) — reads API requests from the Vite dev server via CORS
pip install -r requirements.txt
python cs16-manager.py   # http://localhost:8000
```

Or build the frontend and serve it from FastAPI (matches production):

```bash
cd frontend && pnpm install && pnpm build && cd ..
python cs16-manager.py   # http://localhost:8000  (serves UI + API)
```

**Note:** the `compile_plugin`, `read_local`, `write_local`, `list_local` tools require `amxxpc` at `/usr/local/bin/amxxpc` and the SDK at `/app/amxx/include/`. For local development outside Docker, you'll need to:
1. Build/install `amxxpc` for your platform
2. Copy `compiler/include/*.inc` to `/app/amxx/include/` (or set `AMXX_INCLUDE_DIR`)

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/healthz` | Health check (used by Koyeb) |
| GET | `/api/config` | Get saved SFTP/RCON config |
| POST | `/api/config` | Save SFTP/RCON config |
| POST | `/api/setup/test` | Test SFTP + RCON connectivity |
| GET | `/api/compiler/status` | Check `amxxpc` binary + SDK + testsuite presence |
| POST | `/api/sftp/{ls,read,write,delete,mkdir,move,copy,rename,chmod,info}` | File operations |
| POST | `/api/search` / `/api/search_content` / `/api/append` / `/api/batch_read` | Search + bulk |
| POST | `/api/rcon` | Send an RCON command |
| POST | `/api/web/search` | DuckDuckGo search |
| POST | `/api/web/fetch` | Fetch a URL's text content |
| POST | `/api/agent/stream` | SSE stream of an agent run |
| POST | `/api/agent/answer` | Answer a question the agent asked mid-run |

---

## Security notes

- The bundled `cs16-config.json` has **empty** credential fields. Set them via Koyeb env vars or in the UI.
- The Python process runs as a non-root user (`app`, uid 1001) inside the container.
- SFTP passwords and RCON passwords are sent over the wire only to your CS 1.6 server, not to Koyeb.
- The agent's `ask_user` tool surfaces questions to the human in the UI — no silent data exfiltration.
- `web_search` and `web_fetch` reach out to DuckDuckGo and arbitrary URLs — review the agent's reasoning before approving web-tool calls in production.
- Consider putting Koyeb behind Cloudflare Access if you don't want the UI public.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite)                              │
│  └─ chat UI, file tree, editor, live tool cards         │
│  └─ header shows "amxxpc" badge when compiler is ready  │
└──────────────────────────┬──────────────────────────────┘
                           │ fetch + SSE
┌──────────────────────────▼──────────────────────────────┐
│  FastAPI (cs16-manager.py)                              │
│  ├─ /api/sftp/*         → paramiko SFTP                 │
│  ├─ /api/rcon           → raw UDP GoldSrc challenge-resp│
│  ├─ /api/web/{search,fetch} → DuckDuckGo / httpx        │
│  ├─ /api/agent/stream   → LLM loop (max 20 iters)       │
│  │                       ├─ file tools: ls/read/write/  │
│  │                       │  edit/delete/mkdir/move/copy/│
│  │                       │  rename/chmod/search/info/  │
│  │                       │  append/batch_read/verify   │
│  │                       ├─ compile tools: read_local/  │
│  │                       │  write_local/list_local/     │
│  │                       │  compile_plugin              │
│  │                       ├─ web tools: web_search/      │
│  │                       │  web_fetch/download_file/    │
│  │                       │  git_clone                   │
│  │                       ├─ server: rcon/ask_user       │
│  │                       └─ providers: OpenAI/          │
│  │                          Anthropic/Gemini/DeepSeek/ │
│  │                          Groq/Mistral/OpenRouter     │
│  └─ in-process: amxxpc subprocess (built in Docker)     │
└──────────────────────────┬──────────────────────────────┘
                           │ SFTP/RCON
┌──────────────────────────▼──────────────────────────────┐
│  CS 1.6 dedicated server (HLDS / GoldSrc)               │
│  cstrike/addons/amxmodx/plugins/*.amxx                   │
└─────────────────────────────────────────────────────────┘

Docker image contents:
  /usr/local/bin/amxxpc            ← built from alliedmodders/amxmodx
  /app/amxx/include/*.inc          ← AMX Mod X SDK (140 headers)
  /app/amxx/testsuite/*.sma        ← reference plugins (25 sources)
  /app/static/                     ← built React UI
  /app/cs16-manager.py             ← FastAPI backend
```
