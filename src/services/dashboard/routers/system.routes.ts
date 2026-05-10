import { Router, Request, Response } from 'express';
import { downloadQueue } from '../../queue/queue.js';
import { CONFIG } from '../../../config.js';
import { APP_VERSION } from '../../../constants.js';
import { settingsService } from '../../settings.js';
import { tokenManager } from '../../../utils/token.js';
import { AuthenticationError, APIError } from '../../../utils/errors.js';
import QobuzAPI from '../../../api/qobuz.js';
import { databaseService } from '../../database/index.js';
import { historyService } from '../../history.js';
import { logger } from '../../../utils/logger.js';
import { formatConverterService } from '../../FormatConverterService.js';

const router = Router();
const api = new QobuzAPI();

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
    'BANDWIDTH_LIMIT'
]);

router.get('/status', (req: Request, res: Response) => {
    res.json({
        online: true,
        version: APP_VERSION,
        stats: downloadQueue.getStats()
    });
});

router.get('/auth/verify', (req: Request, res: Response) => {
    res.json({ success: true, message: 'Authenticated' });
});

router.get('/credentials/status', (req: Request, res: Response) => {
    const creds = CONFIG.credentials;
    res.json({
        allConfigured: !!(creds.appId && creds.appSecret && creds.token && creds.userId),
        configured: {
            appId: !!creds.appId,
            appSecret: !!creds.appSecret,
            token: !!creds.token,
            userId: !!creds.userId
        }
    });
});

router.get('/onboarding', (req: Request, res: Response) => {
    const creds = CONFIG.credentials;
    const isConfigured = !!(creds.appId && creds.appSecret && creds.token && creds.userId);
    res.json({
        configured: isConfigured,
        steps: [
            { id: 'app_id', completed: !!creds.appId },
            { id: 'app_secret', completed: !!creds.appSecret },
            { id: 'token', completed: !!creds.token },
            { id: 'user_id', completed: !!creds.userId }
        ]
    });
});

router.get('/settings', async (req: Request, res: Response) => {
    const mask = (s: string) => (s ? s.slice(0, 4) + '****' + s.slice(-4) : '-');
    res.json({
        QOBUZ_APP_ID: CONFIG.credentials.appId,
        QOBUZ_APP_SECRET: mask(CONFIG.credentials.appSecret),
        QOBUZ_USER_AUTH_TOKEN: mask(CONFIG.credentials.token),
        QOBUZ_USER_ID: CONFIG.credentials.userId,
        DOWNLOADS_PATH: CONFIG.download.outputDir,
        FOLDER_TEMPLATE: CONFIG.download.folderStructure,
        FILE_TEMPLATE: CONFIG.download.fileNaming,
        MAX_CONCURRENCY: CONFIG.download.concurrent,
        DEFAULT_QUALITY: CONFIG.quality.default,
        STREAMING_QUALITY: CONFIG.quality.streaming,
        RETRY_ATTEMPTS: CONFIG.download.retryAttempts,
        RETRY_DELAY: CONFIG.download.retryDelay,
        EMBED_COVER_ART: CONFIG.metadata.embedCover,
        SAVE_COVER_FILE: CONFIG.metadata.saveCoverFile,
        COVER_SIZE: CONFIG.metadata.coverSize,
        DOWNLOAD_LYRICS: CONFIG.metadata.downloadLyrics,
        EMBED_LYRICS: CONFIG.metadata.embedLyrics,
        SAVE_LRC_FILE: CONFIG.metadata.saveLrcFile,
        LYRICS_TYPE: CONFIG.metadata.lyricsType,
        DASHBOARD_PORT: CONFIG.dashboard.port,
        DASHBOARD_PASSWORD_CONFIGURED: !!CONFIG.dashboard.password,
        SPOTIFY_CLIENT_ID: CONFIG.spotify.clientId,
        SPOTIFY_CLIENT_SECRET_CONFIGURED: !!CONFIG.spotify.clientSecret,
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
        FFMPEG_AVAILABLE: await formatConverterService.isAvailable()
    });
});

router.post('/settings/update', async (req: Request, res: Response) => {
    try {
        const body = req.body || {};
        const updates: Record<string, string> = {};

        const setIfDefined = (key: string, value: any) => {
            if (value === undefined || value === null) return;
            if (!APP_SETTING_KEYS.has(key)) return;

            const normalized =
                typeof value === 'boolean' ? String(value) : String(value).trim();
            if (normalized === '' && key !== 'DASHBOARD_PASSWORD') return;
            updates[key] = normalized;
        };

        setIfDefined('QOBUZ_APP_ID', body.app_id);
        setIfDefined('QOBUZ_APP_SECRET', body.app_secret);
        setIfDefined('QOBUZ_USER_AUTH_TOKEN', body.token);
        setIfDefined('QOBUZ_USER_ID', body.user_id);

        setIfDefined('DOWNLOADS_PATH', body.downloads_path);
        setIfDefined('FOLDER_TEMPLATE', body.folder_template);
        setIfDefined('FILE_TEMPLATE', body.file_template);
        setIfDefined('MAX_CONCURRENCY', body.max_concurrency);
        setIfDefined('DEFAULT_QUALITY', body.default_quality);
        setIfDefined('STREAMING_QUALITY', body.streaming_quality);
        setIfDefined('RETRY_ATTEMPTS', body.retry_attempts);
        setIfDefined('RETRY_DELAY', body.retry_delay);
        setIfDefined('EMBED_COVER_ART', body.embed_cover_art);
        setIfDefined('SAVE_COVER_FILE', body.save_cover_file);
        setIfDefined('COVER_SIZE', body.cover_size);
        setIfDefined('DOWNLOAD_LYRICS', body.download_lyrics);
        setIfDefined('EMBED_LYRICS', body.embed_lyrics);
        setIfDefined('SAVE_LRC_FILE', body.save_lrc_file);
        setIfDefined('LYRICS_TYPE', body.lyrics_type);
        setIfDefined('DASHBOARD_PORT', body.dashboard_port);
        setIfDefined('DASHBOARD_PASSWORD', body.dashboard_password);
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

        if (body.settings && typeof body.settings === 'object') {
            for (const [key, value] of Object.entries(body.settings)) {
                setIfDefined(key, value);
            }
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No valid settings provided' });
            return;
        }

        settingsService.setMany(updates);

        if (updates.QOBUZ_USER_AUTH_TOKEN) {
            tokenManager.markInvalid();
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
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
            } catch (e: any) {
                if (e.message?.toLowerCase().includes('signature') || e.message?.toLowerCase().includes('auth')) {
                    tokenManager.markInvalid();
                    return res.status(401).json({ error: 'Authentication failed during signature test: ' + e.message });
                }
            }

            tokenManager.markValid();
            res.json({ success: true, user: result.data });
        } else {
            tokenManager.markInvalid();
            res.status(401).json({ error: 'Login failed' });
        }
    } catch (error: any) {
        tokenManager.markInvalid();
        if (error instanceof AuthenticationError) {
            res.status(401).json({ error: 'Account not found or invalid credentials' });
        } else if (error instanceof APIError) {
            res.status(error.statusCode || 500).json({ error: error.message });
        } else {
            res.status(500).json({ error: error.message });
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
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/media-server/test', async (req: Request, res: Response) => {
    try {
        const { type, url, token, libraryId } = req.body;
        const { mediaServerService } = await import('../../MediaServerService.js');
        const result = await mediaServerService.testConnection(type, url, token, libraryId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/logs', (req: Request, res: Response) => {
    res.json(logger.getLogs());
});

router.get('/themes', async (req: Request, res: Response) => {
    try {
        const { themeService } = await import('../../ThemeService.js');
        res.json(await themeService.getAll());
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/themes', async (req: Request, res: Response) => {
    try {
        const { themeService } = await import('../../ThemeService.js');
        const { name, isDark, colors } = req.body;
        if (!name || typeof isDark !== 'boolean' || !colors)
            return res.status(400).json({ error: 'Missing parameters' });
        res.json(await themeService.create(name, isDark, colors));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/themes/:id', async (req: Request, res: Response) => {
    try {
        const { themeService } = await import('../../ThemeService.js');
        res.json({ success: await themeService.delete(req.params.id as string) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
