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
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prefer-offline

# Now copy the rest of the frontend source
COPY frontend/ ./

# Build the production bundle → /build/frontend/dist
RUN pnpm build

# ============================================================================
# Stage 1.5: Download the prebuilt AMX Mod X compiler + SDK from the
#            official 1.9.0.5303 base Linux tarball. This is a 4 MB download
#            (vs. a 5+ minute multilib/NASM/AMBuild source compile) and ships:
#              - amxxpc          (32-bit i386 ELF compiler frontend, ~208 KB)
#              - amxxpc32.so     (32-bit Pawn compiler library, ~214 KB)
#              - include/        (66 .inc AMX Mod X SDK headers)
#              - testsuite/      (28 reference test plugins)
#            Our repo's compiler/extras/ (74 third-party .inc files like
#            reapi.inc, shop.inc, skills.inc, etc.) is overlaid on top.
# ============================================================================
FROM debian:bookworm-slim AS amxx-extract

ARG AMXX_VERSION=1.9.0.5303
ARG AMXX_TARBALL_URL=https://github.com/alliedmodders/amxmodx/releases/download/${AMXX_VERSION}/amxmodx-${AMXX_VERSION}-base-linux.tar.gz

# curl is needed to download the tarball. ca-certificates for HTTPS.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp/amxx

# Download the base tarball. This is a 4 MB file and takes < 10 seconds.
RUN curl -fsSL --retry 3 -o /tmp/amxx/base.tar.gz "${AMXX_TARBALL_URL}" && \
    ls -la /tmp/amxx/base.tar.gz

# Extract only the compiler + SDK + testsuite (skip the runtime MOD).
# --strip-components=3 removes "addons/amxmodx/scripting/" from the file paths.
RUN mkdir -p extracted && \
    tar --extract \
        --gunzip \
        --file=/tmp/amxx/base.tar.gz \
        --directory=/tmp/amxx/extracted \
        --strip-components=3 \
        addons/amxmodx/scripting/amxxpc \
        addons/amxmodx/scripting/amxxpc32.so \
        addons/amxmodx/scripting/include \
        addons/amxmodx/scripting/testsuite

# Install the 32-bit ELF binaries into /usr/local/lib/amxx/ so the runtime
# dynamic linker can find amxxpc32.so when amxxpc dlopen()s it.
RUN mkdir -p /usr/local/lib/amxx && \
    install -m 0755 /tmp/amxx/extracted/amxxpc     /usr/local/lib/amxx/amxxpc && \
    install -m 0755 /tmp/amxx/extracted/amxxpc32.so /usr/local/lib/amxx/amxxpc32.so

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
    AMXXPC_BIN=/usr/local/lib/amxx/amxxpc \
    AMXX_INCLUDE_DIR=/app/amxx/include \
    AMXX_TESTSUITE_DIR=/app/amxx/testsuite \
    AMXX_WORK_DIR=/tmp/amxx_work \
    LD_LIBRARY_PATH=/usr/local/lib/amxx

# 32-bit (i386) libraries are required because amxxpc + amxxpc32.so are 32-bit
# ELF executables. Without these the compiler fails with "Exec format error"
# or "libstdc++.so.6: cannot open shared object file".
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libffi8 \
        libssl3 \
        curl \
        tini \
        git \
        libc6:i386 \
        libstdc++6:i386 \
        zlib1g:i386 \
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

# Copy the amxxpc binary + amxxpc32.so from the extract stage
COPY --from=amxx-extract --chown=root:root /usr/local/lib/amxx/ /usr/local/lib/amxx/

# Copy the AMX Mod X SDK (.inc headers) and reference test plugins
COPY --from=amxx-extract --chown=app:app /tmp/amxx/extracted/include/   /app/amxx/include/
COPY --from=amxx-extract --chown=app:app /tmp/amxx/extracted/testsuite/ /app/amxx/testsuite/

# Overlay our plugin-specific .inc extras (reapi, shop, skills, ze_levels, etc.)
# — these are 74 third-party headers that the upstream tarball doesn't include.
COPY --chown=app:app compiler/extras/ /app/amxx/include/extras/

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
