# syntax=docker/dockerfile:1.7
# ============================================================================
# Stage 1: Build the React frontend
# ============================================================================
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /build/frontend

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy only the manifest first for better layer caching
COPY frontend/package.json ./
# Use a cache mount so pnpm store survives across builds
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prefer-offline

# Now copy the rest of the frontend source
COPY frontend/ ./

# Build the production bundle → /build/frontend/dist
RUN pnpm build

# ============================================================================
# Stage 2: Python runtime
# ============================================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    STATIC_DIR=/app/static

# System dependencies: paramiko needs libffi + libssl + build tools for cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libffi8 \
        libssl3 \
        curl \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user and the app directory
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home /app --shell /sbin/nologin app \
    && mkdir -p /app/static \
    && chown -R app:app /app

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY --chown=app:app requirements.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip \
    && pip install -r requirements.txt

# Copy the Python app
COPY --chown=app:app cs16-manager.py ./
COPY --chown=app:app cs16-config.json ./
COPY --chown=app:app entrypoint.sh ./

# Copy the built frontend (output of stage 1) and make it readable by app user
COPY --from=frontend-builder --chown=app:app /build/frontend/dist /app/static

# Make the entrypoint executable
RUN chmod +x /app/entrypoint.sh

USER app

EXPOSE 8000

# Koyeb health check — hits the same endpoint the platform probes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/api/healthz || exit 1

# tini handles PID 1 and signal forwarding (clean shutdown on Koyeb)
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
