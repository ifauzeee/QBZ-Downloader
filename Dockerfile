# --- [ 1. BASE IMAGE ] ---
FROM node:22-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_COLOR=false
ENV NPM_CONFIG_PROGRESS=false

# --- [ 2. PRODUCTION BACKEND DEPS ] ---
FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --ignore-scripts && \
    npm rebuild better-sqlite3

# --- [ 3. FRONTEND BUILD ] ---
FROM base AS client-builder
COPY client/package.json client/package-lock.json ./client/
RUN --mount=type=cache,target=/root/.npm \
    cd client && npm ci --prefer-offline --no-audit

COPY client/ ./client/
RUN cd client && npm run build

# --- [ 4. BACKEND BUILD ] ---
FROM base AS builder
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

COPY --from=client-builder /app/client/dist ./client/dist
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json ./

RUN node scripts/sync-ui.js && \
    npm run build

# --- [ 5. FINAL PRODUCTION IMAGE ] ---
FROM node:22-alpine AS production

LABEL maintainer="ifauzeee"
LABEL version="4.0.0"

RUN apk add --no-cache chromaprint

WORKDIR /app

RUN addgroup -g 1001 -S qbz && \
    adduser -S -u 1001 -G qbz qbz

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN mkdir -p /app/downloads /app/data /app/logs && \
    chown -R qbz:qbz /app

ENV NODE_ENV=production
ENV DOWNLOADS_PATH=/app/downloads
ENV DASHBOARD_PORT=3000

VOLUME ["/app/downloads", "/app/data"]
EXPOSE 3000

USER qbz

HEALTHCHECK --interval=60s --timeout=15s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${DASHBOARD_PORT}/api/status || exit 1

CMD ["node", "dist/index.js"]