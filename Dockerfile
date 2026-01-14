# Multi-stage Dockerfile for QBZ-Downloader
# Optimized for production use

# ==========================================
# Stage 1: Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ==========================================
# Stage 2: Production
# ==========================================
FROM node:20-alpine AS production

LABEL maintainer="ifauzeee"
LABEL description="Premium Qobuz Downloader CLI with Hi-Res Audio"
LABEL version="2.0.0"

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S qbzgroup && \
    adduser -S qbzuser -u 1001 -G qbzgroup

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create directories with proper permissions
RUN mkdir -p /app/downloads /app/logs && \
    chown -R qbzuser:qbzgroup /app

# Environment variables
ENV NODE_ENV=production
ENV DOWNLOADS_PATH=/app/downloads

# Volume for downloads and configuration
VOLUME ["/app/downloads", "/app/config"]

# Switch to non-root user
USER qbzuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Default command (can be overridden)
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
