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
import { DashboardService, dashboardService } from './index.js';
import { logger } from '../../utils/logger.js';

const services: DashboardService[] = [];

function waitForListening(service: DashboardService): Promise<void> {
    const server = (service as unknown as { httpServer: NodeJS.EventEmitter }).httpServer;
    return new Promise((resolve) => server.once('listening', () => resolve()));
}

function getPort(service: DashboardService): number {
    const server = (service as unknown as { httpServer: { address: () => AddressInfo } }).httpServer;
    return server.address().port;
}

afterEach(() => {
    for (const service of services.splice(0)) {
        service.stop();
    }
    dashboardService.stop();
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
