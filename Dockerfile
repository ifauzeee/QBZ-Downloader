# syntax=docker/dockerfile:1

# ---------- build ----------
# better-sqlite3 is a native module, so the build stage needs a toolchain that
# the runtime image does not have to carry.
FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# better-sqlite3 ships prebuilt binaries linked against a newer glibc than this
# base provides, and `npm rebuild` fetches those prebuilds rather than compiling.
# Build it from source so it matches the runtime image, and drop the prebuilds so
# there is nothing else for node-gyp-build to pick up.
ENV npm_config_build_from_source=true

COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --ignore-scripts \
    && npm rebuild better-sqlite3 --build-from-source \
    && rm -rf node_modules/better-sqlite3/prebuilds \
    && npm ci --prefix client --ignore-scripts

COPY . .

# Builds the dashboard bundle into src/services/dashboard/public, then compiles
# the server to dist/. sync-version is skipped: it rewrites tracked files.
RUN npm run build --prefix client && npm run build

RUN npm prune --omit=dev \
    && npm rebuild better-sqlite3 --build-from-source \
    && rm -rf node_modules/better-sqlite3/prebuilds

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime

# ffmpeg does the tagging and format conversion; fpcalc (libchromaprint-tools)
# does the audio fingerprinting used by the duplicate scanner. resolveBinaryPath
# falls back to PATH, so installing them here is all that is needed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libchromaprint-tools ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# The database and the encryption key live in ./data relative to the working
# directory, and downloads default to /music. Mount both.
ENV DASHBOARD_HOST=0.0.0.0 \
    DASHBOARD_PORT=3000 \
    DOWNLOADS_PATH=/music

RUN mkdir -p /app/data /music
VOLUME ["/app/data", "/music"]
EXPOSE 3000

# tini reaps the ffmpeg/fpcalc children this app spawns per track.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
