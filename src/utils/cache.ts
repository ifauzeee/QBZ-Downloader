import { createClient } from 'redis';
import { logger } from './logger.js';

class CacheService {
    private client: any;
    private isConnected: boolean = false;
    private memoryCache: Map<string, { value: any, expires: number }> = new Map();

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        this.client.on('error', (_err: any) => {
            if (this.isConnected) {
                logger.warn('Redis connection lost, falling back to memory cache.');
            }
            this.isConnected = false;
        });

        this.client.connect().then(() => {
            this.isConnected = true;
            logger.info('Redis connected successfully');
        }).catch(() => {
            logger.debug('Redis not available, using in-memory cache');
        });
    }

    async get(key: string): Promise<any | null> {
        if (this.isConnected) {
            try {
                const val = await this.client.get(key);
                return val ? JSON.parse(val) : null;
            } catch {
                return null;
            }
        } else {
            const item = this.memoryCache.get(key);
            if (!item) return null;
            if (Date.now() > item.expires) {
                this.memoryCache.delete(key);
                return null;
            }
            return item.value;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        if (this.isConnected) {
            try {
                await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
            } catch { }
        } else {
            this.memoryCache.set(key, {
                value,
                expires: Date.now() + (ttlSeconds * 1000)
            });
            if (this.memoryCache.size > 1000) {
                const firstKey = this.memoryCache.keys().next().value;
                if (firstKey) this.memoryCache.delete(firstKey);
            }
        }
    }
}

export const cacheService = new CacheService();
