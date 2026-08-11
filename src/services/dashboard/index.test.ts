import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', () => ({
    CONFIG: {
        dashboard: {
            port: 0,
            password: '',
            host: '127.0.0.1'
        },
        download: {
            outputDir: './downloads'
        }
    }
}));

vi.mock('../../utils/logger.js', () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        setBroadcastCallback: vi.fn()
    }
}));

vi.mock('../../utils/ui.js', () => ({
    printBox: vi.fn()
}));

vi.mock('../queue/queue.js', () => ({
    downloadQueue: {
        getStats: vi.fn(() => ({ pending: 0, downloading: 0, completed: 0, failed: 0, total: 0 })),
        on: vi.fn()
    }
}));

vi.mock('../library-scanner/index.js', () => ({
    libraryScannerService: {
        on: vi.fn()
    }
}));

vi.mock('../notifications.js', () => ({
    notificationService: {
        getRecent: vi.fn(() => []),
        getUnreadCount: vi.fn(() => 0),
        on: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../utils/token.js', () => ({
    tokenManager: {
        on: vi.fn()
    }
}));

vi.mock('./routes.js', () => ({
    registerRoutes: vi.fn()
}));

import { AddressInfo } from 'net';
import { Server } from 'http';
import request from 'supertest';
import { DashboardService, dashboardService } from './index.js';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../config.js';

const services: DashboardService[] = [];

function waitForListening(service: DashboardService): Promise<void> {
    const server = (service as unknown as { httpServer: NodeJS.EventEmitter }).httpServer;
    return new Promise((resolve) => server.once('listening', () => resolve()));
}

function getPort(service: DashboardService): number {
    const server = (service as unknown as { httpServer: { address: () => AddressInfo } }).httpServer;
    return server.address().port;
}

function getServer(service: DashboardService): Server {
    return (service as unknown as { httpServer: Server }).httpServer;
}

async function startService(): Promise<DashboardService> {
    const service = new DashboardService(0);
    services.push(service);
    const listening = waitForListening(service);
    service.start();
    await listening;
    return service;
}

afterEach(() => {
    for (const service of services.splice(0)) {
        service.stop();
    }
    dashboardService.stop();
    CONFIG.dashboard.password = '';
    delete process.env.QBZ_DESKTOP;
    vi.clearAllMocks();
});

describe('DashboardService', () => {
    it('logs listen errors instead of allowing an unhandled server error', async () => {
        const first = new DashboardService(0);
        services.push(first);

        const firstListening = waitForListening(first);
        first.start();
        await firstListening;

        const second = new DashboardService(getPort(first));
        services.push(second);

        second.start();
        await vi.waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to initialize dashboard service'),
                'WEB'
            );
        });
    });
});

describe('DashboardService password guard', () => {
    /**
     * Express matches routes case-insensitively by default. The guard compared
     * the raw path, so `/API/...` failed the "is this protected?" test, fell
     * through unauthenticated, and was then dispatched to the very router the
     * guard existed to protect.
     */
    it.each(['/api/logs', '/API/logs', '/Api/logs', '/aPi/logs', '/DOWNLOADS/x.flac'])(
        'refuses %s without the password',
        async (routePath) => {
            CONFIG.dashboard.password = 'hunter2';
            const service = await startService();

            const response = await request(getServer(service)).get(routePath);

            expect(response.status).toBe(401);
        }
    );

    it('accepts the password in the x-password header', async () => {
        CONFIG.dashboard.password = 'hunter2';
        const service = await startService();

        // registerRoutes is mocked out, so a permitted request falls through to
        // the catch-all, which answers 404 for /api paths. Anything other than
        // 401 proves the guard let it past.
        const response = await request(getServer(service))
            .get('/api/logs')
            .set('x-password', 'hunter2');

        expect(response.status).toBe(404);
    });

    it('no longer accepts the password in the query string', async () => {
        CONFIG.dashboard.password = 'hunter2';
        const service = await startService();

        const response = await request(getServer(service)).get('/api/logs?pw=hunter2');

        expect(response.status).toBe(401);
    });

    it('leaves theme reads unauthenticated but not theme writes', async () => {
        CONFIG.dashboard.password = 'hunter2';
        const service = await startService();

        const read = await request(getServer(service)).get('/api/themes');
        expect(read.status).toBe(404); // past the guard, no route registered

        const write = await request(getServer(service)).post('/api/themes').send({});
        expect(write.status).toBe(401);
    });

    it('rejects a cross-origin state-changing request', async () => {
        CONFIG.dashboard.password = 'hunter2';
        const service = await startService();

        const response = await request(getServer(service))
            .post('/api/settings')
            .set('x-password', 'hunter2')
            .set('Origin', 'https://evil.example')
            .send({});

        expect(response.status).toBe(403);
    });

    it('rejects a non-loopback Host header when nothing else authenticates', async () => {
        CONFIG.dashboard.password = '';
        const service = await startService();

        const rebound = await request(getServer(service))
            .get('/api/status')
            .set('Host', 'evil.example');
        expect(rebound.status).toBe(403);

        const local = await request(getServer(service)).get('/api/status');
        expect(local.status).not.toBe(403);
    });
});
