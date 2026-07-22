# Cloudflare Container image for the canopticon-video renderer.
#
# Phase 0 target: a 60-75s 1080×1920 Remotion render at standard-4
# (4 vCPU / 12 GiB / CPU-only) inside the 5-min wall-clock budget. The
# image installs the Node + Remotion + ffmpeg stack plus WhisperX +
# librosa (pre-installed even though Phase 0 doesn't call them — the
# image is the same one Phase 2 runs, no rebuild needed).

FROM node:22-slim AS base

# System deps. Chromium replaces a separate Chrome download — Remotion
# can use the system browser via CHROME_EXECUTABLE_PATH.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    yt-dlp \
    python3 \
    python3-pip \
    fonts-inter \
    fonts-noto-color-emoji \
    chromium \
    chromium-driver \
    libnss3 \
    libatk-bridge2.0-0 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# WhisperX + librosa for Phase 2's word-level transcript alignment +
# beat-synced cutting. Phase 0 doesn't call these; installing now means
# the image doesn't need a rebuild when Phase 2 ships. The
# --break-system-packages flag is required on bookworm's Python; we're
# isolating in the Container anyway.
RUN pip3 install --break-system-packages --no-cache-dir \
    whisperx==3.* \
    librosa==0.10.*

WORKDIR /app

# Install pnpm via corepack so we use the same package manager as the
# rest of the monorepo.
RUN corepack enable

# Copy the workspace manifests for the renderer + shared. The Dockerfile
# is expected to be built with the BUILD CONTEXT at packages/video-renderer/
# (which is how Cloudflare's `wrangler containers push` does it by
# default), so paths are relative to that directory.
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src

RUN pnpm install --prod=false --no-frozen-lockfile && pnpm build

# Remotion expects a Chrome browser path. The Debian package is at
# /usr/bin/chromium; we tell Remotion explicitly and disable GPU because
# Cloudflare Containers don't expose one.
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_CHROMIUM_DISABLE_GPU=true
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "dist/server.js"]
