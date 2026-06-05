# CS 1.6 AI Manager — OMEGA

A web app that lets you **manage a Counter-Strike 1.6 dedicated server through an AI chat agent**. Type a task like *"reload server.cfg"* or *"add admin with Steam ID X"* and the agent (OMEGA) does it — using SFTP for files and RCON for in-game commands.

- **Backend:** Python (FastAPI + uvicorn) — single `cs16-manager.py` with SFTP (paramiko), GoldSrc RCON (raw UDP), and an LLM agent loop with 17 tools.
- **Frontend:** React 19 + Vite + Tailwind v4 — chat UI, file tree, in-browser editor, live tool-call cards.
- **LLM providers:** OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, OpenRouter, or OpenCode (free).

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

First build takes 2–4 minutes (downloading base images + building frontend + installing Python deps). Subsequent builds use Docker layer cache and are much faster.

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

Mark secrets (`CS16_SFTP_PASSWORD`, `CS16_RCON_PASSWORD`) as **secret** so Koyeb encrypts them at rest.

The API key (OpenAI/Anthropic/etc.) is **not** an env var — the user pastes it into the UI on first connect. This keeps the key out of server logs and lets different users use different providers.

### 4. Open the app

Koyeb gives you a public URL like `https://cs16-manager-<your-name>.koyeb.app`. Open it, fill in the setup screen with your SFTP/RCON details, paste an LLM API key, and you're in.

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

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/healthz` | Health check (used by Koyeb) |
| GET | `/api/config` | Get saved SFTP/RCON config |
| POST | `/api/config` | Save SFTP/RCON config |
| POST | `/api/setup/test` | Test SFTP + RCON connectivity |
| POST | `/api/sftp/{ls,read,write,delete,mkdir,move,copy,rename,chmod,info}` | File operations |
| POST | `/api/search` / `/api/search_content` / `/api/append` / `/api/batch_read` | Search + bulk |
| POST | `/api/rcon` | Send an RCON command |
| POST | `/api/agent/stream` | SSE stream of an agent run |
| POST | `/api/agent/answer` | Answer a question the agent asked mid-run |

---

## Security notes

- The bundled `cs16-config.json` has **empty** credential fields. Set them via Koyeb env vars or in the UI.
- The Python process runs as a non-root user (`app`, uid 1001) inside the container.
- SFTP passwords and RCON passwords are sent over the wire only to your CS 1.6 server, not to Koyeb.
- The agent's `ask_user` tool surfaces questions to the human in the UI — no silent data exfiltration.
- Consider putting Koyeb behind Cloudflare Access if you don't want the UI public.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite)                              │
│  └─ chat UI, file tree, editor, live tool cards         │
└──────────────────────────┬──────────────────────────────┘
                           │ fetch + SSE
┌──────────────────────────▼──────────────────────────────┐
│  FastAPI (cs16-manager.py)                              │
│  ├─ /api/sftp/*      → paramiko SFTP                   │
│  ├─ /api/rcon        → raw UDP GoldSrc challenge-resp  │
│  └─ /api/agent/stream → LLM loop (max 20 iters)        │
│                          ├─ tools: ls/read/write/edit/  │
│                          │  delete/mkdir/move/copy/    │
│                          │  rename/chmod/search/info/  │
│                          │  append/batch_read/rcon/    │
│                          │  ask_user/verify             │
│                          └─ providers: OpenAI / Anthropic│
│                             / Gemini / DeepSeek / Groq  │
│                             / Mistral / OpenRouter      │
└──────────────────────────┬──────────────────────────────┘
                           │ SFTP/RCON
┌──────────────────────────▼──────────────────────────────┐
│  CS 1.6 dedicated server (HLDS / GoldSrc)               │
└─────────────────────────────────────────────────────────┘
```
