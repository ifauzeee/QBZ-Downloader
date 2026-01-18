import { logger } from './logger.js';

class CacheService {
    private cache: Map<string, { value: any; expires: number }> = new Map();
    private maxSize: number = 1000;

    constructor() {
        logger.debug('Cache service initialized (in-memory)');
    }

    async get(key: string): Promise<any | null> {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expires) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expires: Date.now() + ttlSeconds * 1000
        });
    }

    async delete(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }

    async clear(): Promise<void> {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

export const cacheService = new CacheService();
