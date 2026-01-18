# ===========================================
# QBZ-Downloader - Optimized Multi-stage Build
# ===========================================

# Stage 1: Dependencies
# ------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files only (better layer caching)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    cp -R node_modules prod_modules

# Install all dependencies for build
RUN npm ci

# Stage 2: Build
# ------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./

# Build Client
COPY client ./client
RUN cd client && npm install && npm run build

# Build Backend
COPY scripts ./scripts
COPY src ./src
RUN node scripts/sync-ui.js
RUN npm run build

# Stage 3: Production
# ------------------------------------------------
FROM node:22-alpine AS production

LABEL maintainer="ifauzeee"
LABEL description="Premium Qobuz Downloader Web Dashboard"
LABEL version="4.0.0"
LABEL org.opencontainers.image.source="https://github.com/ifauzeee/QBZ-Downloader"

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S qbz && \
    adduser -S -u 1001 -G qbz qbz

# Copy production dependencies (smaller than full node_modules)
COPY --from=deps /app/prod_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Copy only necessary config files
COPY .env.example ./

# Create required directories
RUN mkdir -p /app/downloads /app/data /app/logs && \
    mkdir -p /app/client/dist && \
    chown -R qbz:qbz /app

# Install runtime dependencies (chromaprint for audio fingerprinting)
RUN apk add --no-cache chromaprint

# Environment
ENV NODE_ENV=production
ENV DOWNLOADS_PATH=/app/downloads
ENV DASHBOARD_PORT=3000

# Volumes for persistent data
VOLUME ["/app/downloads", "/app/data"]

# Expose dashboard port
EXPOSE 3000

# Switch to non-root user
USER qbz

# Health check using the API status endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${DASHBOARD_PORT}/api/status || exit 1

# Start the web dashboard
CMD ["node", "dist/index.js"]