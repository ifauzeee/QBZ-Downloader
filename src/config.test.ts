import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadConfigWithSettings(settings: Record<string, string | undefined>) {
    vi.resetModules();
    vi.doMock('./services/settings.js', () => ({
        settingsService: {
            get: (key: string) => settings[key]
        }
    }));

    return import('./config.js');
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
});
