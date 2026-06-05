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
# Stage 1.5: Build the AMX Mod X Pawn compiler (amxxpc) for Linux
# ============================================================================
FROM python:3.12-slim AS amxx-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        git \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Shallow-clone AMX Mod X source with submodules (hlsdk + amtl)
RUN git clone --depth 1 --recursive https://github.com/alliedmodders/amxmodx.git

WORKDIR /build/amxmodx

# Configure & build only the amxxpc target — modules/test are off
RUN mkdir build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release \
          -DBUILD_AMXXPC=ON \
          -DBUILD_MODULES=OFF \
          -DBUILD_TESTING=OFF \
          .. \
    && make -j"$(nproc)" amxxpc

# ============================================================================
# Stage 2: Python runtime
# ============================================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    STATIC_DIR=/app/static \
    AMXXPC_BIN=/usr/local/bin/amxxpc \
    AMXX_INCLUDE_DIR=/app/amxx/include \
    AMXX_TESTSUITE_DIR=/app/amxx/testsuite \
    AMXX_WORK_DIR=/tmp/amxx_work

# System dependencies: paramiko needs libffi + libssl + build tools for cryptography;
# git is needed for the git_clone agent tool.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libffi8 \
        libssl3 \
        curl \
        tini \
        git \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user and the app directory
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --home /app --shell /sbin/nologin app \
    && mkdir -p /app/static \
             /app/amxx/include \
             /app/amxx/testsuite \
             /tmp/amxx_work \
    && chown -R app:app /app /tmp/amxx_work

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

# Copy the bundled amxxpc binary from the builder stage
COPY --from=amxx-builder /build/amxmodx/build/amxxpc /usr/local/bin/amxxpc

# Copy the AMX Mod X SDK (.inc API headers) and reference test plugins
COPY --chown=app:app compiler/include/  /app/amxx/include/
COPY --chown=app:app compiler/testsuite/ /app/amxx/testsuite/

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
