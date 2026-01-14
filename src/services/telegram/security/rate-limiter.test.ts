import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
        vi.useFakeTimers();
        limiter = new RateLimiter({
            maxRequests: 5,
            windowMs: 1000,
            blockDurationMs: 5000,
            maxWarnings: 3,
            enableLogging: false
        });
    });

    afterEach(() => {
        limiter.destroy();
        vi.useRealTimers();
    });

    describe('isAllowed', () => {
        it('should allow requests under limit', () => {
            expect(limiter.isAllowed('user1')).toBe(true);
            expect(limiter.isAllowed('user1')).toBe(true);
            expect(limiter.isAllowed('user1')).toBe(true);
        });

        it('should block after exceeding limit', () => {
            for (let i = 0; i < 5; i++) {
                expect(limiter.isAllowed('user1')).toBe(true);
            }
            expect(limiter.isAllowed('user1')).toBe(false);
        });

        it('should track users independently', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user1');
            }
            expect(limiter.isAllowed('user1')).toBe(false);

            expect(limiter.isAllowed('user2')).toBe(true);
        });

        it('should reset after window expires', () => {
            for (let i = 0; i < 4; i++) {
                limiter.isAllowed('user1');
            }
            expect(limiter.getRemaining('user1')).toBe(1);

            vi.advanceTimersByTime(1100);

            expect(limiter.isAllowed('user1')).toBe(true);
            expect(limiter.getRemaining('user1')).toBe(4);
        });

        it('should unblock after block duration', () => {
            for (let i = 0; i < 6; i++) {
                limiter.isAllowed('user1');
            }
            expect(limiter.isAllowed('user1')).toBe(false);

            vi.advanceTimersByTime(5100);

            expect(limiter.isAllowed('user1')).toBe(true);
        });
    });

    describe('getRemaining', () => {
        it('should return max for new user', () => {
            expect(limiter.getRemaining('user1')).toBe(5);
        });

        it('should decrease as requests are made', () => {
            limiter.isAllowed('user1');
            expect(limiter.getRemaining('user1')).toBe(4);

            limiter.isAllowed('user1');
            expect(limiter.getRemaining('user1')).toBe(3);
        });

        it('should return 0 for blocked user', () => {
            for (let i = 0; i < 6; i++) {
                limiter.isAllowed('user1');
            }
            expect(limiter.getRemaining('user1')).toBe(0);
        });
    });

    describe('getResetTime', () => {
        it('should return 0 for new user', () => {
            expect(limiter.getResetTime('user1')).toBe(0);
        });

        it('should return time until window resets', () => {
            limiter.isAllowed('user1');

            vi.advanceTimersByTime(300);

            expect(limiter.getResetTime('user1')).toBe(700);
        });
    });

    describe('blockUser', () => {
        it('should manually block a user', () => {
            limiter.blockUser('user1', 10000);
            expect(limiter.isAllowed('user1')).toBe(false);
        });

        it('should block for specified duration', () => {
            limiter.blockUser('user1', 3000);

            vi.advanceTimersByTime(2000);
            expect(limiter.isAllowed('user1')).toBe(false);

            vi.advanceTimersByTime(1100);
            expect(limiter.isAllowed('user1')).toBe(true);
        });
    });

    describe('unblockUser', () => {
        it('should unblock a blocked user', () => {
            limiter.blockUser('user1', 10000);
            expect(limiter.isAllowed('user1')).toBe(false);

            limiter.unblockUser('user1');
            expect(limiter.isAllowed('user1')).toBe(true);
        });
    });

    describe('reset', () => {
        it('should reset user limits', () => {
            for (let i = 0; i < 5; i++) {
                limiter.isAllowed('user1');
            }
            expect(limiter.getRemaining('user1')).toBe(0);

            limiter.reset('user1');
            expect(limiter.getRemaining('user1')).toBe(5);
        });
    });

    describe('getStats', () => {
        it('should return correct statistics', () => {
            limiter.isAllowed('user1');
            limiter.isAllowed('user2');
            limiter.blockUser('user3', 5000);

            const stats = limiter.getStats();
            expect(stats.totalUsers).toBe(3);
            expect(stats.blockedUsers).toBe(1);
        });
    });

    describe('clear', () => {
        it('should clear all entries', () => {
            limiter.isAllowed('user1');
            limiter.isAllowed('user2');

            limiter.clear();

            const stats = limiter.getStats();
            expect(stats.totalUsers).toBe(0);
        });
    });
});
