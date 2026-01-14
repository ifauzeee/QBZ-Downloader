import { logger } from '../../../utils/logger.js';

interface RateLimitEntry {
    count: number;

    windowStart: number;

    warnings: number;

    blocked: boolean;

    blockedUntil?: number;
}

export interface RateLimiterConfig {
    maxRequests: number;

    windowMs: number;

    blockDurationMs: number;

    maxWarnings: number;

    enableLogging: boolean;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
    maxRequests: 30,
    windowMs: 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
    maxWarnings: 3,
    enableLogging: true
};

export class RateLimiter {
    private entries: Map<string, RateLimitEntry> = new Map();
    private config: RateLimiterConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<RateLimiterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.startCleanupInterval();
    }

    isAllowed(userId: string): boolean {
        const now = Date.now();
        let entry = this.entries.get(userId);

        if (entry?.blocked) {
            if (entry.blockedUntil && now >= entry.blockedUntil) {
                entry.blocked = false;
                entry.blockedUntil = undefined;
            } else {
                if (this.config.enableLogging) {
                    logger.debug(`Rate limiter: User ${userId} is blocked`);
                }
                return false;
            }
        }

        if (!entry || now - entry.windowStart >= this.config.windowMs) {
            entry = {
                count: 1,
                windowStart: now,
                warnings: entry?.warnings || 0,
                blocked: false
            };
            this.entries.set(userId, entry);
            return true;
        }

        entry.count++;

        if (entry.count > this.config.maxRequests) {
            entry.warnings++;

            const blockMultiplier = Math.min(entry.warnings, 5);
            const blockDuration = this.config.blockDurationMs * blockMultiplier;

            entry.blocked = true;
            entry.blockedUntil = now + blockDuration;

            if (this.config.enableLogging) {
                logger.warn(
                    `Rate limiter: User ${userId} blocked for ${blockDuration / 1000}s ` +
                        `(warning ${entry.warnings})`
                );
            }

            return false;
        }

        return true;
    }

    getRemaining(userId: string): number {
        const entry = this.entries.get(userId);

        if (!entry) return this.config.maxRequests;
        if (entry.blocked) return 0;

        const now = Date.now();
        if (now - entry.windowStart >= this.config.windowMs) {
            return this.config.maxRequests;
        }

        return Math.max(0, this.config.maxRequests - entry.count);
    }

    getResetTime(userId: string): number {
        const entry = this.entries.get(userId);

        if (!entry) return 0;

        if (entry.blocked && entry.blockedUntil) {
            return Math.max(0, entry.blockedUntil - Date.now());
        }

        const windowEnd = entry.windowStart + this.config.windowMs;
        return Math.max(0, windowEnd - Date.now());
    }

    blockUser(userId: string, durationMs: number): void {
        const entry = this.entries.get(userId) || {
            count: 0,
            windowStart: Date.now(),
            warnings: 0,
            blocked: false
        };

        entry.blocked = true;
        entry.blockedUntil = Date.now() + durationMs;
        this.entries.set(userId, entry);

        if (this.config.enableLogging) {
            logger.warn(`Rate limiter: User ${userId} manually blocked for ${durationMs / 1000}s`);
        }
    }

    unblockUser(userId: string): void {
        const entry = this.entries.get(userId);
        if (entry) {
            entry.blocked = false;
            entry.blockedUntil = undefined;
            entry.warnings = 0;

            if (this.config.enableLogging) {
                logger.info(`Rate limiter: User ${userId} unblocked`);
            }
        }
    }

    reset(userId: string): void {
        this.entries.delete(userId);
    }

    clear(): void {
        this.entries.clear();
    }

    getStats(): { totalUsers: number; blockedUsers: number } {
        let blockedUsers = 0;
        for (const entry of this.entries.values()) {
            if (entry.blocked) blockedUsers++;
        }
        return {
            totalUsers: this.entries.size,
            blockedUsers
        };
    }

    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(
            () => {
                const now = Date.now();
                const expireThreshold = this.config.windowMs * 2;

                for (const [userId, entry] of this.entries) {
                    if (!entry.blocked && now - entry.windowStart > expireThreshold) {
                        this.entries.delete(userId);
                    }
                    if (entry.blocked && entry.blockedUntil && now >= entry.blockedUntil) {
                        entry.blocked = false;
                        entry.blockedUntil = undefined;
                    }
                }
            },
            5 * 60 * 1000
        );
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

export const rateLimiter = new RateLimiter();
