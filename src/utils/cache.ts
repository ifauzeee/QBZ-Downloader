import { LRUCache } from 'lru-cache';
import { logger } from './logger.js';

class CacheService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private cache: LRUCache<string, any>;

    constructor(maxSize: number = 1000) {
        this.cache = new LRUCache({
            max: maxSize,
            // TTL is handled per-entry in set(), or we can set a default here
            ttl: 1000 * 60 * 60, // 1 hour default
            updateAgeOnGet: true
        });
        logger.debug('Cache service initialized (LRU)');
    }

    get(key: string): unknown | null {
        const value = this.cache.get(key);
        return value !== undefined ? value : null;
    }

    set(key: string, value: unknown, ttlSeconds: number = 3600): void {
        this.cache.set(key, value, {
            ttl: ttlSeconds * 1000
        });
    }

    delete(key: string): boolean {
        const hadKey = this.cache.has(key);
        this.cache.delete(key);
        return hadKey;
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}

export const cacheService = new CacheService();

