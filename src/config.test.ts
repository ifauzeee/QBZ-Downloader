import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadConfigWithSettings(settings: Record<string, string | undefined>) {
    vi.resetModules();
    const get = vi.fn((key: string) => settings[key]);
    vi.doMock('./services/settings.js', () => ({
        settingsService: {
            get
        }
    }));

    return {
        ...(await import('./config.js')),
        settingsGet: get
    };
}

describe('CONFIG dashboard runtime overrides', () => {
    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
        vi.doUnmock('./services/settings.js');
    });

    it('uses Electron runtime port and host in desktop mode', async () => {
        process.env.QBZ_DESKTOP = '1';
        process.env.DASHBOARD_PORT = '3210';
        process.env.DASHBOARD_HOST = '127.0.0.1';

        const { CONFIG } = await loadConfigWithSettings({
            DASHBOARD_PORT: '3000',
            DASHBOARD_HOST: '0.0.0.0'
        });

        expect(CONFIG.dashboard.port).toBe(3210);
        expect(CONFIG.dashboard.host).toBe('127.0.0.1');
    });

    it('keeps stored dashboard settings outside desktop mode', async () => {
        process.env.DASHBOARD_PORT = '3210';
        process.env.DASHBOARD_HOST = '127.0.0.1';

        const { CONFIG } = await loadConfigWithSettings({
            DASHBOARD_PORT: '3000',
            DASHBOARD_HOST: '0.0.0.0'
        });

        expect(CONFIG.dashboard.port).toBe(3000);
        expect(CONFIG.dashboard.host).toBe('0.0.0.0');
    });

    it('caches config sections until settings are updated', async () => {
        const { CONFIG, settingsGet } = await loadConfigWithSettings({
            RETRY_DELAY: '1000'
        });
        const { eventBus, EVENTS } = await import('./utils/events.js');

        expect(CONFIG.download.retryDelay).toBe(1000);
        expect(CONFIG.download.retryDelay).toBe(1000);
        expect(settingsGet).toHaveBeenCalledTimes(7);

        eventBus.emit(EVENTS.SETTINGS.UPDATED, { keys: ['RETRY_DELAY'] });
        expect(CONFIG.download.retryDelay).toBe(1000);
        expect(settingsGet).toHaveBeenCalledTimes(14);
    });
});
