import { Router, Request, Response } from 'express';
import { downloadQueue } from '../../queue/queue.js';
import { CONFIG } from '../../../config.js';
import { APP_VERSION } from '../../../constants.js';
import { settingsService } from '../../settings.js';
import { tokenManager } from '../../../utils/token.js';
import { AuthenticationError, APIError } from '../../../utils/errors.js';
import qobuzApi from '../../../api/qobuz.js';
import { databaseService } from '../../database/index.js';
import { historyService } from '../../history.js';
import { logger } from '../../../utils/logger.js';
import { formatConverterService } from '../../FormatConverterService.js';

const router = Router();
const api = qobuzApi;

const APP_SETTING_KEYS = new Set([
    'QOBUZ_APP_ID',
    'QOBUZ_APP_SECRET',
    'QOBUZ_USER_AUTH_TOKEN',
    'QOBUZ_USER_ID',
    'DOWNLOADS_PATH',
    'DEFAULT_QUALITY',
    'MAX_CONCURRENCY',
    'RETRY_ATTEMPTS',
    'RETRY_DELAY',
    'FOLDER_TEMPLATE',
    'FILE_TEMPLATE',
    'EMBED_COVER_ART',
    'SAVE_COVER_FILE',
    'COVER_SIZE',
    'DOWNLOAD_LYRICS',
    'EMBED_LYRICS',
    'SAVE_LRC_FILE',
    'LYRICS_TYPE',
    'DASHBOARD_PORT',
    'DASHBOARD_PASSWORD',
    'STREAMING_QUALITY',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'AI_REPAIR_ENABLED',
    'AI_PROVIDER',
    'AI_API_KEY',
    'AI_MODEL',
    'MEDIA_SERVER_ENABLED',
    'MEDIA_SERVER_TYPE',
    'MEDIA_SERVER_URL',
    'MEDIA_SERVER_TOKEN',
    'MEDIA_SERVER_LIBRARY_ID',
    'EXPORT_ENABLED',
    'EXPORT_FORMAT',
    'EXPORT_BITRATE',
    'EXPORT_KEEP_ORIGINAL',
    'EXPORT_PATH',
    'BANDWIDTH_LIMIT',
    'UI_BATCH_STAGING_URLS',
    'UI_LAST_TAB',
    'UI_ACTIVE_THEME_ID',
    'UI_LANGUAGE',
    'UI_THEME',
    'UI_ACCENT'
]);

router.get('/status', (_req: Request, res: Response) => {
    res.json({
        ok: true,
        status: 'running',
        version: APP_VERSION
    });
});

router.get('/system/status', async (_req: Request, res: Response) => {
    let qobuz_valid = false;
    let username = '';

    try {
        if (CONFIG.credentials.appId && CONFIG.credentials.token) {
            const user = await api.getUserInfo();
            if (user.success) {
                qobuz_valid = true;
                username = (user.data as any)?.credential?.username || '';
            }
        }
    } catch {
        qobuz_valid = false;
    }

    res.json({
        VERSION: APP_VERSION,
        QOBUZ_APP_ID_CONFIGURED: !!CONFIG.credentials.appId,
        QOBUZ_APP_SECRET_CONFIGURED: !!CONFIG.credentials.appSecret,
        QOBUZ_USER_AUTH_TOKEN_CONFIGURED: !!CONFIG.credentials.token,
        QOBUZ_USER_ID_CONFIGURED: !!CONFIG.credentials.userId,
        QOBUZ_CREDENTIALS_VALID: qobuz_valid,
        QOBUZ_USERNAME: username,
        SPOTIFY_CLIENT_ID_CONFIGURED: !!CONFIG.spotify.clientId,
        SPOTIFY_CLIENT_SECRET_CONFIGURED: !!CONFIG.spotify.clientSecret,
        DOWNLOADS_PATH: CONFIG.download.outputDir,
        DEFAULT_QUALITY: CONFIG.quality.default,
        MAX_CONCURRENCY: CONFIG.download.concurrent,
        RETRY_ATTEMPTS: CONFIG.download.retryAttempts,
        RETRY_DELAY: CONFIG.download.retryDelay,
        FOLDER_TEMPLATE: CONFIG.download.folderStructure,
        FILE_TEMPLATE: CONFIG.download.fileNaming,
        EMBED_COVER_ART: CONFIG.metadata.embedCover,
        SAVE_COVER_FILE: CONFIG.metadata.saveCoverFile,
        COVER_SIZE: CONFIG.metadata.coverSize,
        DOWNLOAD_LYRICS: CONFIG.metadata.downloadLyrics,
        EMBED_LYRICS: CONFIG.metadata.embedLyrics,
        SAVE_LRC_FILE: CONFIG.metadata.saveLrcFile,
        LYRICS_TYPE: CONFIG.metadata.lyricsType,
        DASHBOARD_PORT: CONFIG.dashboard.port,
        DASHBOARD_PASSWORD_CONFIGURED: !!CONFIG.dashboard.password,
        STREAMING_QUALITY: CONFIG.quality.streaming,
        AI_REPAIR_ENABLED: CONFIG.ai.enabled,
        AI_PROVIDER: CONFIG.ai.provider,
        AI_API_KEY_CONFIGURED: !!CONFIG.ai.apiKey,
        AI_MODEL: CONFIG.ai.model,
        MEDIA_SERVER_ENABLED: CONFIG.mediaServer.enabled,
        MEDIA_SERVER_TYPE: CONFIG.mediaServer.type,
        MEDIA_SERVER_URL: CONFIG.mediaServer.url,
        MEDIA_SERVER_TOKEN_CONFIGURED: !!CONFIG.mediaServer.token,
        MEDIA_SERVER_LIBRARY_ID: CONFIG.mediaServer.libraryId,
        EXPORT_ENABLED: CONFIG.export.enabled,
        EXPORT_FORMAT: CONFIG.export.format,
        EXPORT_BITRATE: CONFIG.export.bitrate,
        EXPORT_KEEP_ORIGINAL: CONFIG.export.keepOriginal,
        EXPORT_PATH: CONFIG.export.outputDir,
        BANDWIDTH_LIMIT: CONFIG.download.bandwidthLimit,
        FFMPEG_AVAILABLE: await formatConverterService.isAvailable(),
        UI_BATCH_STAGING_URLS: settingsService.get('UI_BATCH_STAGING_URLS') || '',
        UI_LAST_TAB: settingsService.get('UI_LAST_TAB') || 'search',
        UI_ACTIVE_THEME_ID: settingsService.get('UI_ACTIVE_THEME_ID') || 'default',
        UI_LANGUAGE: settingsService.get('UI_LANGUAGE') || 'id',
        UI_THEME: settingsService.get('UI_THEME') || 'dark',
        UI_ACCENT: settingsService.get('UI_ACCENT') || '#2dd4bf'
    });
});

router.post('/settings/update', async (req: Request, res: Response) => {
    try {
        const body = (req.body || {}) as Record<string, unknown>;
        const updates: Record<string, string> = {};

        const setIfDefined = (key: string, value: unknown) => {
            if (value === undefined || value === null) return;
            if (!APP_SETTING_KEYS.has(key)) return;

            const normalized =
                typeof value === 'boolean' ? String(value) : String(value).trim();
            if (normalized === '' && key !== 'DASHBOARD_PASSWORD') return;
            updates[key] = normalized;
        };

        setIfDefined('QOBUZ_APP_ID', body.app_id);
        setIfDefined('QOBUZ_APP_SECRET', body.app_secret);
        setIfDefined('QOBUZ_USER_AUTH_TOKEN', body.user_auth_token);
        setIfDefined('QOBUZ_USER_ID', body.user_id);
        setIfDefined('DOWNLOADS_PATH', body.downloads_path);
        setIfDefined('DEFAULT_QUALITY', body.default_quality);
        setIfDefined('MAX_CONCURRENCY', body.max_concurrency);
        setIfDefined('RETRY_ATTEMPTS', body.retry_attempts);
        setIfDefined('RETRY_DELAY', body.retry_delay);
        setIfDefined('FOLDER_TEMPLATE', body.folder_template);
        setIfDefined('FILE_TEMPLATE', body.file_template);
        setIfDefined('EMBED_COVER_ART', body.embed_cover_art);
        setIfDefined('SAVE_COVER_FILE', body.save_cover_file);
        setIfDefined('COVER_SIZE', body.cover_size);
        setIfDefined('DOWNLOAD_LYRICS', body.download_lyrics);
        setIfDefined('EMBED_LYRICS', body.embed_lyrics);
        setIfDefined('SAVE_LRC_FILE', body.save_lrc_file);
        setIfDefined('LYRICS_TYPE', body.lyrics_type);
        setIfDefined('DASHBOARD_PORT', body.dashboard_port);
        setIfDefined('DASHBOARD_PASSWORD', body.dashboard_password);
        setIfDefined('STREAMING_QUALITY', body.streaming_quality);
        setIfDefined('SPOTIFY_CLIENT_ID', body.spotify_client_id);
        setIfDefined('SPOTIFY_CLIENT_SECRET', body.spotify_client_secret);
        setIfDefined('AI_REPAIR_ENABLED', body.ai_repair_enabled);
        setIfDefined('AI_PROVIDER', body.ai_provider);
        setIfDefined('AI_API_KEY', body.ai_api_key);
        setIfDefined('AI_MODEL', body.ai_model);
        setIfDefined('MEDIA_SERVER_ENABLED', body.media_server_enabled);
        setIfDefined('MEDIA_SERVER_TYPE', body.media_server_type);
        setIfDefined('MEDIA_SERVER_URL', body.media_server_url);
        setIfDefined('MEDIA_SERVER_TOKEN', body.media_server_token);
        setIfDefined('MEDIA_SERVER_LIBRARY_ID', body.media_server_library_id);
        setIfDefined('EXPORT_ENABLED', body.export_enabled);
        setIfDefined('EXPORT_FORMAT', body.export_format);
        setIfDefined('EXPORT_BITRATE', body.export_bitrate);
        setIfDefined('EXPORT_KEEP_ORIGINAL', body.export_keep_original);
        setIfDefined('EXPORT_PATH', body.export_path);
        setIfDefined('BANDWIDTH_LIMIT', body.bandwidth_limit);
        setIfDefined('UI_BATCH_STAGING_URLS', body.ui_batch_staging_urls);
        setIfDefined('UI_LAST_TAB', body.ui_last_tab);
        setIfDefined('UI_ACTIVE_THEME_ID', body.ui_active_theme_id);
        setIfDefined('UI_LANGUAGE', body.ui_language);
        setIfDefined('UI_THEME', body.ui_theme);
        setIfDefined('UI_ACCENT', body.ui_accent);

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No valid settings provided' });
            return;
        }

        settingsService.setMany(updates);

        if (updates.QOBUZ_USER_AUTH_TOKEN) {
            tokenManager.markInvalid();
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    const creds = CONFIG.credentials;
    const missing: string[] = [];
    if (!creds.appId)     missing.push('App ID');
    if (!creds.appSecret) missing.push('App Secret');
    if (!creds.token)     missing.push('Auth Token');
    if (!creds.userId)    missing.push('User ID');
    if (missing.length > 0) {
        return res.status(400).json({
            error: `Missing required credentials: ${missing.join(', ')}. Please complete setup first.`
        });
    }

    try {
        const result = await api.getUserInfo();
        if (result.success) {
            // Test signature by attempting a getFileUrl for a dummy track
            // This ensures App Secret is valid (which isn't checked by getUserInfo)
            try {
                // Test signature with a real-looking track ID (e.g. 184511252)
                const sigTest = await api.getFileUrl('184511252', 5);
                if (!sigTest.success) {
                    const isSigError = sigTest.error?.toLowerCase().includes('request_sig') || 
                                     sigTest.error?.toLowerCase().includes('signature');
                    
                    if (isSigError) {
                        tokenManager.markInvalid();
                        return res.status(401).json({ 
                            error: 'Invalid App Secret: Signature verification failed. Please check your App Secret.' 
                        });
                    }
                }
            } catch (e: unknown) {
                const message = (e as Error).message || '';
                if (message.toLowerCase().includes('signature') || message.toLowerCase().includes('auth')) {
                    tokenManager.markInvalid();
                    return res.status(401).json({ error: 'Authentication failed during signature test: ' + message });
                }
            }

            tokenManager.markValid();
            res.json({ success: true, user: result.data });
        } else {
            tokenManager.markInvalid();
            res.status(401).json({ error: 'Login failed' });
        }
    } catch (error: unknown) {
        tokenManager.markInvalid();
        if (error instanceof AuthenticationError) {
            res.status(401).json({ error: 'Account not found or invalid credentials' });
        } else if (error instanceof APIError) {
            res.status(error.statusCode || 500).json({ error: error.message });
        } else {
            res.status(500).json({ error: (error as Error).message });
        }
    }
});

router.post('/system/reset', async (req: Request, res: Response) => {
    try {
        databaseService.resetStatistics();
        databaseService.clearAllSettings();
        historyService.clearAll();
        downloadQueue.clear();
        res.json({ success: true, message: 'All data and settings have been cleared.' });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/media-server/test', async (req: Request, res: Response) => {
    try {
        const { type, url, token, libraryId } = req.body;
        const { mediaServerService } = await import('../../MediaServerService.js');
        const result = await mediaServerService.testConnection(
            String(type || ''),
            String(url || ''),
            String(token || ''),
            String(libraryId || '')
        );
        res.json(result);
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/logs', (_req: Request, res: Response) => {
    res.json(logger.getLogs());
});

router.get('/themes', async (_req: Request, res: Response) => {
    try {
        const { themeService } = await import('../../ThemeService.js');
        res.json(await themeService.getAll());
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/themes', async (req: Request, res: Response) => {
    try {
        const { themeService } = await import('../../ThemeService.js');
        const { name, isDark, colors } = req.body;
        if (!name || typeof isDark !== 'boolean' || !colors)
            return res.status(400).json({ error: 'Missing parameters' });
        res.json(await themeService.create(String(name), isDark, colors as Record<string, string>));
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/themes/:id', async (req: Request, res: Response) => {
    try {
        const { themeService } = await import('../../ThemeService.js');
        res.json({ success: await themeService.delete(req.params.id as string) });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
