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
#            official base Linux tarball. This is a 4 MB download (vs. a 5+
#            minute multilib/NASM/AMBuild source compile) and ships:
#              - amxxpc          (32-bit i386 ELF compiler frontend, ~208 KB)
#              - amxxpc32.so     (32-bit Pawn compiler library, ~214 KB)
#              - include/        (66 .inc AMX Mod X SDK headers)
#              - testsuite/      (28 reference test plugins)
#            Our repo's compiler/extras/ (74 third-party .inc files like
#            reapi.inc, shop.inc, skills.inc, etc.) is overlaid on top.
#
#            URL NOTE: the release tag (1.9.0.5303) and the asset filename's
#            product version (1.9.0-git5303) use DIFFERENT formats — the
#            "git" suffix in the filename is NOT a typo. To avoid hardcoding
#            the brittle version/filename pair, we look the URL up from the
#            GitHub Releases API and fall back to a pinned version if the
#            API is rate-limited or unavailable.
# ============================================================================
FROM debian:bookworm-slim AS amxx-extract

# Pinned fallback if the GitHub API call fails (rate limit / outage).
# Release tag: 1.9.0.5303  ->  Product version: 1.9.0-git5303
ARG AMXX_FALLBACK_URL=https://github.com/alliedmodders/amxmodx/releases/download/1.9.0.5303/amxmodx-1.9.0-git5303-base-linux.tar.gz

# curl is needed to download the tarball. ca-certificates for HTTPS.
# jq is used to parse the GitHub API JSON response.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp/amxx

# Download the latest base-linux tarball. Uses the GitHub API to find the
# current asset URL (so a new amxmodx release is picked up automatically).
# Falls back to AMXX_FALLBACK_URL if the API call fails for any reason.
RUN set -eux; \
    AMXX_URL=$(curl -fsSL --max-time 20 \
        -H 'Accept: application/vnd.github+json' \
        -H 'User-Agent: cs16-ai-manager-docker' \
        https://api.github.com/repos/alliedmodders/amxmodx/releases/latest \
        | jq -r '.assets[] | select(.name | endswith("base-linux.tar.gz")) | .browser_download_url' \
        | head -n1); \
    if [ -z "$AMXX_URL" ] || [ "$AMXX_URL" = "null" ]; then \
        echo "WARN: GitHub API lookup failed, using pinned fallback URL"; \
        AMXX_URL="${AMXX_FALLBACK_URL}"; \
    fi; \
    echo "Downloading AMX Mod X from: $AMXX_URL"; \
    curl -fsSL --retry 3 --max-time 120 \
        -o /tmp/amxx/base.tar.gz "$AMXX_URL"; \
    ls -la /tmp/amxx/base.tar.gz; \
    echo "Verifying tarball contents..."; \
    tar -tzf /tmp/amxx/base.tar.gz | grep -E '(amxxpc$|amxxpc32\.so$|include/|testsuite/)' | head -5

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
# We keep the real binary as amxxpc.bin and install a wrapper at amxxpc
# that runs it via qemu-i386-static (added in the runtime stage). This
# is needed because many cloud kernels (including Koyeb's) ship with
# CONFIG_IA32_EMULATION disabled, so 32-bit ELFs cannot run natively.
RUN mkdir -p /usr/local/lib/amxx && \
    install -m 0755 /tmp/amxx/extracted/amxxpc     /usr/local/lib/amxx/amxxpc.bin && \
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
# ELF executables. qemu-user-static is required to actually RUN them on cloud
# hosts (like Koyeb) whose kernels ship with CONFIG_IA32_EMULATION disabled.
# The wrapper script at /usr/local/lib/amxx/amxxpc invokes qemu-i386-static
# so the compiler works regardless of the host kernel's 32-bit support.
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
        qemu-user-static \
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
COPY --chown=app:app nexus_broker.py ./
COPY --chown=app:app cs16-config.json ./
COPY --chown=app:app entrypoint.sh ./
COPY --chown=app:app source-resolver/ ./source-resolver/

# Copy the amxxpc binary + amxxpc32.so from the extract stage
COPY --from=amxx-extract --chown=root:root /usr/local/lib/amxx/ /usr/local/lib/amxx/

# Wrap amxxpc with qemu-i386-static. Many cloud kernels (Koyeb free tier
# included) ship with CONFIG_IA32_EMULATION=n, so 32-bit x86 ELFs cannot
# be exec()'d directly. qemu-i386-static emulates a 32-bit CPU + kernel
# in userspace and works on any x86_64 host. The wrapper is checked in
# to compiler/amxxpc-wrapper.sh — Dockerfile heredocs inside RUN break
# the parser, so we COPY the file in instead.
COPY --chown=root:root --chmod=0755 compiler/amxxpc-wrapper.sh /usr/local/lib/amxx/amxxpc

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

EXPOSE 8000 8080

# Koyeb health check — hits the same endpoint the platform probes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT}/api/healthz || exit 1

# tini handles PID 1 and signal forwarding (clean shutdown on Koyeb)
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
