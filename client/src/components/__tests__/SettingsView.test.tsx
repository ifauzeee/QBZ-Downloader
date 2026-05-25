import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../SettingsView';

const mocks = vi.hoisted(() => ({
    smartFetch: vi.fn(),
    showToast: vi.fn(),
    saveTheme: vi.fn(),
    deleteTheme: vi.fn(),
    applyTheme: vi.fn(),
    resetTheme: vi.fn(),
    sha256: vi.fn()
}));

vi.mock('../../utils/api', () => ({
    smartFetch: mocks.smartFetch
}));

vi.mock('../../utils/crypto', () => ({
    sha256: mocks.sha256
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: mocks.showToast })
}));

vi.mock('../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}));

vi.mock('../../contexts/ThemeContext', () => ({
    useTheme: () => ({
        themes: [],
        currentTheme: {
            id: 'default',
            name: 'Default Dark',
            is_dark: true,
            colors: {
                '--bg-dark': '#000000',
                '--bg-card': '#111111',
                '--text-primary': '#ffffff',
                '--accent-rgb': '99, 102, 241'
            }
        },
        saveTheme: mocks.saveTheme,
        deleteTheme: mocks.deleteTheme,
        applyTheme: mocks.applyTheme,
        resetTheme: mocks.resetTheme
    })
}));

const settingsResponse = {
    QOBUZ_APP_ID: '',
    QOBUZ_APP_SECRET: '',
    QOBUZ_USER_AUTH_TOKEN: '',
    QOBUZ_USER_ID: '',
    DOWNLOADS_PATH: 'D:/Music',
    FOLDER_TEMPLATE: '{albumArtist}/{album}',
    FILE_TEMPLATE: '{track_number}. {title}',
    MAX_CONCURRENCY: 3,
    DEFAULT_QUALITY: 27,
    STREAMING_QUALITY: 5,
    RETRY_ATTEMPTS: 4,
    RETRY_DELAY: 1500,
    EMBED_COVER_ART: true,
    SAVE_COVER_FILE: true,
    COVER_SIZE: 'max',
    DOWNLOAD_LYRICS: true,
    EMBED_LYRICS: true,
    SAVE_LRC_FILE: true,
    LYRICS_TYPE: 'both',
    DASHBOARD_PORT: 3210,
    DASHBOARD_PASSWORD_CONFIGURED: false,
    AI_REPAIR_ENABLED: false,
    AI_PROVIDER: 'none',
    AI_API_KEY_CONFIGURED: false,
    AI_MODEL: 'gemini-1.5-flash',
    MEDIA_SERVER_ENABLED: false,
    MEDIA_SERVER_TYPE: 'none',
    MEDIA_SERVER_URL: '',
    MEDIA_SERVER_TOKEN_CONFIGURED: false,
    MEDIA_SERVER_LIBRARY_ID: '',
    EXPORT_ENABLED: false,
    EXPORT_FORMAT: 'mp3',
    EXPORT_BITRATE: '320k',
    EXPORT_KEEP_ORIGINAL: true,
    EXPORT_PATH: '',
    BANDWIDTH_LIMIT: 0,
    SPOTIFY_CLIENT_ID: '',
    SPOTIFY_CLIENT_SECRET_CONFIGURED: false,
    FFMPEG_AVAILABLE: true
};

const credentialsResponse = {
    configured: {
        appId: true,
        appSecret: false,
        token: true,
        userId: false
    }
};

function response(data: unknown, ok = true) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(data)
    };
}

function mockSettingsApi() {
    mocks.smartFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/settings') return Promise.resolve(response(settingsResponse));
        if (url === '/api/credentials/status') return Promise.resolve(response(credentialsResponse));
        if (url === '/api/settings/update') {
            return Promise.resolve(response({ success: true, message: 'Updated!' }));
        }
        if (url === '/api/login') {
            return Promise.resolve(response({ success: true, user: { id: 'user-1' } }));
        }
        return Promise.resolve(response({ url, options }));
    });
}

describe('SettingsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sha256.mockResolvedValue('hashed-password');
        sessionStorage.clear();
        mockSettingsApi();
    });

    it('loads persisted settings and credential status', async () => {
        render(<SettingsView />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('D:/Music')).toBeInTheDocument();
            expect(screen.getByDisplayValue('3210')).toBeInTheDocument();
        });
        expect(screen.getAllByText(/Configured|Missing/).length).toBeGreaterThanOrEqual(4);
        expect(mocks.smartFetch).toHaveBeenCalledWith('/api/settings');
        expect(mocks.smartFetch).toHaveBeenCalledWith('/api/credentials/status');
    });

    it('submits credential updates with the backend key aliases', async () => {
        render(<SettingsView />);

        fireEvent.change(await screen.findByPlaceholderText('Enter new App ID...'), {
            target: { value: 'app-id' }
        });
        fireEvent.change(screen.getByPlaceholderText('Enter new Secret...'), {
            target: { value: 'secret' }
        });
        fireEvent.change(screen.getByPlaceholderText('Enter new Token...'), {
            target: { value: 'token' }
        });
        fireEvent.change(screen.getByPlaceholderText('Enter new User ID...'), {
            target: { value: 'user-id' }
        });
        fireEvent.click(screen.getByText('action_update_creds'));

        await waitFor(() => {
            expect(mocks.smartFetch).toHaveBeenCalledWith('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: 'app-id',
                    app_secret: 'secret',
                    token: 'token',
                    user_id: 'user-id'
                })
            });
        });
        expect(mocks.showToast).toHaveBeenCalledWith('Updated!', 'success');
    });

    it('submits changed application settings and hashes a new dashboard password', async () => {
        render(<SettingsView />);

        const downloadsPath = await screen.findByDisplayValue('D:/Music');
        fireEvent.change(downloadsPath, { target: { value: 'E:/QBZ' } });
        fireEvent.change(screen.getByPlaceholderText('Leave empty for public dashboard'), {
            target: { value: 'new-pass' }
        });
        fireEvent.click(screen.getAllByText('action_save_settings')[0]);

        await waitFor(() => {
            const updateCall = mocks.smartFetch.mock.calls.find(
                ([url, options]) =>
                    url === '/api/settings/update' &&
                    String((options as RequestInit).body).includes('"downloads_path":"E:/QBZ"')
            );

            expect(updateCall).toBeTruthy();
            expect(String((updateCall?.[1] as RequestInit).body)).toContain(
                '"dashboard_password":"new-pass"'
            );
        });
        expect(mocks.sha256).toHaveBeenCalledWith('new-pass');
        expect(sessionStorage.getItem('dashboard_password')).toBe('hashed-password');
    });
});
