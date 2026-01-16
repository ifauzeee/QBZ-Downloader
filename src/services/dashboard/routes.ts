import { Express, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { downloadQueue } from '../queue/queue.js';
import { inputValidator } from '../../utils/validator.js';
import { historyService } from '../history.js';
import QobuzAPI from '../../api/qobuz.js';
import { APP_VERSION } from '../../constants.js';
import { CONFIG } from '../../config.js';
import { tokenManager } from '../../utils/token.js';

const api = new QobuzAPI();

let credentialsCache: {
    valid: boolean;
    message: string;
    checkedAt: number;
    subscription?: string;
} | null = null;

const getParam = (param: string | string[] | undefined): string => {
    if (Array.isArray(param)) return param[0] || '';
    return param || '';
};

export function registerRoutes(app: Express): void {
    app.get('/api/status', (req: Request, res: Response) => {
        const stats = downloadQueue.getStats();
        res.json({
            online: true,
            version: APP_VERSION,
            stats
        });
    });

    app.get('/api/credentials/validate', async (req: Request, res: Response) => {
        const forceRefresh = req.query.refresh === 'true';
        const cacheMaxAge = 5 * 60 * 1000;

        if (
            !forceRefresh &&
            credentialsCache &&
            Date.now() - credentialsCache.checkedAt < cacheMaxAge
        ) {
            res.json(credentialsCache);
            return;
        }

        const creds = CONFIG.credentials;

        if (!creds.appId || !creds.appSecret || !creds.token || !creds.userId) {
            const missing: string[] = [];
            if (!creds.appId) missing.push('QOBUZ_APP_ID');
            if (!creds.appSecret) missing.push('QOBUZ_APP_SECRET');
            if (!creds.token) missing.push('QOBUZ_USER_AUTH_TOKEN');
            if (!creds.userId) missing.push('QOBUZ_USER_ID');

            credentialsCache = {
                valid: false,
                message: `Missing credentials: ${missing.join(', ')}`,
                checkedAt: Date.now()
            };
            res.json(credentialsCache);
            return;
        }

        try {
            const userInfo = await api.getUserInfo();

            if (userInfo.success && userInfo.data) {
                credentialsCache = {
                    valid: true,
                    message: 'Credentials are valid',
                    subscription: userInfo.data.subscription?.offer || 'Unknown',
                    checkedAt: Date.now()
                };
            } else {
                credentialsCache = {
                    valid: false,
                    message: 'API returned error - credentials may be invalid',
                    checkedAt: Date.now()
                };
            }
        } catch (error: any) {
            const statusCode = error?.statusCode || error?.response?.status;

            if (statusCode === 401 || statusCode === 403) {
                credentialsCache = {
                    valid: false,
                    message: 'Token expired or invalid - please update QOBUZ_USER_AUTH_TOKEN',
                    checkedAt: Date.now()
                };
            } else {
                credentialsCache = {
                    valid: false,
                    message: `API error: ${error.message}`,
                    checkedAt: Date.now()
                };
            }
        }

        res.json(credentialsCache);
    });

    app.get('/api/credentials/status', (req: Request, res: Response) => {
        const creds = CONFIG.credentials;

        res.json({
            configured: {
                appId: !!creds.appId,
                appSecret: !!creds.appSecret,
                token: !!creds.token,
                userId: !!creds.userId
            },
            allConfigured: !!(creds.appId && creds.appSecret && creds.token && creds.userId),
            lastValidation: credentialsCache
                ? {
                      valid: credentialsCache.valid,
                      message: credentialsCache.message,
                      subscription: credentialsCache.subscription,
                      checkedAt: new Date(credentialsCache.checkedAt).toISOString()
                  }
                : null
        });
    });

    app.get('/api/onboarding', (req: Request, res: Response) => {
        const creds = CONFIG.credentials;
        const isConfigured = !!(creds.appId && creds.appSecret && creds.token && creds.userId);

        const steps = [
            {
                id: 'credentials',
                title: 'Qobuz Credentials',
                description: 'App ID, Secret, Token, dan User ID',
                completed: isConfigured,
                required: true
            },
            {
                id: 'download_path',
                title: 'Download Path',
                description: 'Folder untuk menyimpan file',
                completed: !!CONFIG.download.outputDir,
                required: false
            }
        ];

        res.json({
            configured: isConfigured,
            steps,
            nextStep: steps.find((s) => s.required && !s.completed)?.id || null,
            tips: [
                'Konfigurasi dikelola melalui file .env',
                'Bookmark URL ini untuk akses cepat ke dashboard'
            ]
        });
    });

    app.post('/api/system/reset', async (req: Request, res: Response) => {
        try {
            logger.warn('System Reset initiated by user', 'SYSTEM');

            downloadQueue.clear();

            historyService.clearAll();

            try {
                const { databaseService } = await import('../../services/database/index.js');
                databaseService.resetStatistics();
            } catch (e) {
                logger.error('Failed to reset database: ' + e);
            }

            res.json({ success: true, message: 'System reset complete' });
        } catch (error: any) {
            logger.error(`Reset failed: ${error.message}`);
            res.status(500).json({ error: 'System reset failed' });
        }
    });

    const maskSensitiveValue = (value: string): string => {
        if (!value || typeof value !== 'string') return '';
        if (value.length <= 8) return '••••••••';
        return '••••••••' + value.slice(-4);
    };

    const getMaskedSettings = () => {
        const creds = CONFIG.credentials;
        return {
            QOBUZ_APP_ID: creds.appId,
            QOBUZ_APP_SECRET: maskSensitiveValue(creds.appSecret),
            QOBUZ_USER_AUTH_TOKEN: maskSensitiveValue(creds.token),
            QOBUZ_USER_ID: creds.userId,
            DOWNLOADS_PATH: CONFIG.download.outputDir,
            FOLDER_TEMPLATE: CONFIG.download.folderStructure,
            FILE_TEMPLATE: CONFIG.download.fileNaming,
            MAX_CONCURRENCY: CONFIG.download.concurrent,
            DASHBOARD_PORT: CONFIG.dashboard.port,
            DASHBOARD_PASSWORD: CONFIG.dashboard.password ? '••••••••' : ''
        };
    };

    app.get('/api/queue', (req: Request, res: Response) => {
        const items = downloadQueue.getItems();
        res.json(items);
    });

    app.get('/api/settings', (req: Request, res: Response) => {
        res.json(getMaskedSettings());
    });

    app.post('/api/settings', (req: Request, res: Response) => {
        res.status(400).json({
            error: 'Settings are managed via .env file. Please edit .env and restart the server.'
        });
    });

    app.post('/api/queue/add', async (req: Request, res: Response): Promise<void> => {
        const { url, quality } = req.body;

        const validation = inputValidator.validateUrl(url);
        if (!validation.valid) {
            res.status(400).json({ error: validation.error });
            return;
        }

        if (validation.type && validation.id) {
            try {
                let displayTitle = `Pending ${validation.type}...`;

                if (validation.type === 'track') {
                    const trackData = await api.getTrack(parseInt(validation.id));
                    if (trackData.success && trackData.data) {
                        displayTitle = `${trackData.data.performer?.name || 'Unknown'} - ${trackData.data.title}`;
                    }
                } else if (validation.type === 'album') {
                    const albumData = await api.getAlbum(parseInt(validation.id));
                    if (albumData.success && albumData.data) {
                        displayTitle = `${albumData.data.artist?.name || 'Unknown'} - ${albumData.data.title}`;
                    }
                }

                if (
                    validation.type !== 'track' &&
                    validation.type !== 'album' &&
                    validation.type !== 'playlist' &&
                    validation.type !== 'artist'
                ) {
                    res.status(400).json({ error: 'Invalid download type' });
                    return;
                }

                const item = downloadQueue.add(
                    validation.type,
                    validation.id,
                    parseInt(quality) || 27,
                    {
                        title: displayTitle,
                        metadata: { source: 'dashboard' }
                    }
                );
                res.json({ success: true, item });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        } else {
            res.status(400).json({ error: 'Could not parse ID from URL' });
        }
    });

    app.post('/api/queue/action', (req: Request, res: Response) => {
        const { action } = req.body;

        switch (action) {
            case 'pause':
                downloadQueue.pause();
                break;
            case 'resume':
                downloadQueue.resume();
                break;
            case 'clear':
                downloadQueue.clear();
                break;
            default:
                res.status(400).json({ error: 'Invalid action' });
                return;
        }

        res.json({ success: true, action });
    });

    app.post('/api/item/:id/:action', (req: Request, res: Response) => {
        const { id, action } = req.params;

        if (action === 'remove' || action === 'cancel') {
            downloadQueue.cancel(id as string);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid item action' });
        }
    });

    app.get('/api/history', (req: Request, res: Response) => {
        const history = historyService.getAll();
        const list = Object.entries(history)
            .map(([id, entry]) => ({
                id,
                ...entry
            }))
            .sort(
                (a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
            );

        res.json(list);
    });

    app.post('/api/history/clear', async (req: Request, res: Response) => {
        historyService.clearAll();

        try {
            const { databaseService } = await import('../database/index.js');
            databaseService.resetStatistics();
        } catch (error: any) {
            logger.error(`Failed to clear database stats: ${error.message}`);
        }

        res.json({ success: true });
    });

    app.delete('/api/history/:id', (req: Request, res: Response) => {
        const id = req.params.id as string;
        const success = historyService.remove(id);

        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'History item not found' });
        }
    });

    app.get('/api/search', async (req: Request, res: Response) => {
        const { query, type, limit, offset } = req.query;
        if (!query) {
            res.status(400).json({ error: 'Query is required' });
            return;
        }

        const result = await api.search(
            query as string,
            (type as string) || 'albums',
            parseInt(limit as string) || 20,
            parseInt(offset as string) || 0
        );

        if (result.success) {
            if (type === 'artists' && result.data?.artists?.items) {
                const updates = result.data.artists.items.map(async (item: any) => {
                    if (!item.image && !item.picture) {
                        try {
                            const detail = await api.getArtist(item.id, 0, 1);
                            if (
                                detail.success &&
                                detail.data &&
                                (detail.data as any).albums?.items?.length > 0
                            ) {
                                const latestAlbum = (detail.data as any).albums.items[0];
                                item.image = latestAlbum.image;
                                item.picture = latestAlbum.image;
                            }
                        } catch {}
                    }
                    return item;
                });
                await Promise.all(updates);
            }

            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    });

    app.get('/api/album/:id', async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await api.getAlbum(id);

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    });

    app.get('/api/artist/:id', async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const { offset, limit, type } = req.query;

        const off = parseInt(offset as string) || 0;
        const lim = parseInt(limit as string) || 20;

        logger.debug(`[Artist] Fetching ${id} | Type: ${type} | Offset: ${off} | Limit: ${lim}`);

        const result = await api.getArtist(
            id,
            type === 'tracks' ? 0 : off,
            type === 'tracks' ? 20 : lim,
            type === 'tracks' ? off : 0,
            type === 'tracks' ? lim : 25
        );

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    });

    const getStreamUrl = async (id: string) => {
        const preferredQuality = CONFIG.quality.streaming;
        let result = await api.getFileUrl(id, preferredQuality);

        if (
            (!result.success || !result.data || !(result.data as any).url) &&
            preferredQuality !== 5
        ) {
            result = await api.getFileUrl(id, 5);
        }

        if (
            (!result.success || !result.data || !(result.data as any).url) &&
            preferredQuality !== 6
        ) {
            logger.warn(`[Stream] Fallback to CD (6) for ${id}`);
            result = await api.getFileUrl(id, 6);
        }

        if (result.success && result.data) {
            const d = result.data as any;
            logger.info(
                `[Stream] Serving ${id} | Format: ${d.format_id} | ${d.bit_depth}bit/${d.sampling_rate}kHz | MIME: ${d.mime_type}`
            );
        } else {
            logger.error(
                `[Stream] Failed to get URL for ${id}: ${result.error || 'Unknown error'}`
            );
        }

        return result;
    };

    app.get('/api/stream/:id', async (req: Request, res: Response) => {
        const id = req.params.id as string;
        try {
            const result = await getStreamUrl(id);
            if (result.success && result.data && (result.data as any).url) {
                res.redirect((result.data as any).url);
            } else {
                res.status(404).json({ error: 'Stream URL not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/stream/info/:id', async (req: Request, res: Response) => {
        const id = req.params.id as string;
        try {
            const result = await getStreamUrl(id);
            if (result.success && result.data && (result.data as any).url) {
                const formatId = (result.data as any).format_id;
                const { getQualityName, getQualityEmoji } = await import('../../config.js');
                res.json({
                    url: (result.data as any).url,
                    formatId: formatId,
                    qualityLabel: getQualityName(formatId),
                    qualityEmoji: getQualityEmoji(formatId)
                });
            } else {
                res.status(404).json({ error: 'Stream info not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/download/:id', (req: Request, res: Response) => {
        const id = req.params.id as string;
        const entry = historyService.get(id);

        if (!entry || !entry.filename) {
            res.status(404).json({ error: 'File not found in history' });
            return;
        }

        const filePath = path.resolve(entry.filename);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                import('archiver')
                    .then((archiverModule) => {
                        const archiver = archiverModule.default;
                        const archive = archiver('zip', { zlib: { level: 9 } });

                        res.attachment(`${sanitizeFilename(entry.title)}.zip`);
                        archive.pipe(res);
                        archive.directory(filePath, false);
                        archive.finalize();
                    })
                    .catch((err) => {
                        res.status(500).json({ error: `Failed to create archive: ${err.message}` });
                    });
            } else {
                res.download(filePath, path.basename(filePath));
            }
        } else {
            res.status(404).json({ error: 'Physical file missing from server' });
        }
    });

    app.get('/api/playlists/watched', (req: Request, res: Response) => {
        res.json([]);
    });

    app.post('/api/playlists/watch', async (req: Request, res: Response) => {
        res.status(400).json({
            error: 'Playlist watching is disabled in env-only mode (no database).'
        });
    });

    app.delete('/api/playlists/watch/:id', (req: Request, res: Response) => {
        res.status(400).json({
            error: 'Playlist watching is disabled in env-only mode (no database).'
        });
    });

    app.get('/api/statistics', async (req: Request, res: Response) => {
        try {
            const { statisticsService } = await import('../statistics.js');
            res.json(statisticsService.getAll());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/statistics/summary', async (req: Request, res: Response) => {
        try {
            const { statisticsService } = await import('../statistics.js');
            res.json(statisticsService.getSummary());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/notifications', async (req: Request, res: Response) => {
        try {
            const { notificationService } = await import('../notifications.js');
            res.json({
                notifications: notificationService.getRecent(50),
                unreadCount: notificationService.getUnreadCount()
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/notifications/:id/read', async (req: Request, res: Response) => {
        try {
            const { notificationService } = await import('../notifications.js');
            const success = notificationService.markAsRead(req.params.id as string);
            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/notifications/read-all', async (req: Request, res: Response) => {
        try {
            const { notificationService } = await import('../notifications.js');
            const count = notificationService.markAllAsRead();
            res.json({ success: true, count });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/batch/import', async (req: Request, res: Response) => {
        try {
            const { batchImportService } = await import('../batch.js');
            const { urls, quality } = req.body;

            if (!urls || !Array.isArray(urls)) {
                res.status(400).json({ error: 'urls must be an array' });
                return;
            }

            const result = await batchImportService.importUrls(urls, quality || 27);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/i18n/locales', async (req: Request, res: Response) => {
        try {
            const { i18n } = await import('../i18n.js');
            res.json({
                current: i18n.getLocale(),
                available: i18n.getAvailableLocales()
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/i18n/translations', async (req: Request, res: Response) => {
        try {
            const { i18n } = await import('../i18n.js');
            res.json(i18n.getAll());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/i18n/locale', async (req: Request, res: Response) => {
        try {
            const { i18n } = await import('../i18n.js');
            const { locale } = req.body;
            i18n.setLocale(locale);
            res.json({ success: true, locale: i18n.getLocale() });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/token/update', async (req: Request, res: Response) => {
        try {
            const { tokenManager } = await import('../../utils/token.js');
            const { token } = req.body;

            if (!token) {
                res.status(400).json({ error: 'Token is required' });
                return;
            }

            const success = await tokenManager.updateToken(token);
            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/token/status', async (req: Request, res: Response) => {
        try {
            const { tokenManager } = await import('../../utils/token.js');
            res.json(tokenManager.getStatus());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/settings/update', async (req: Request, res: Response) => {
        const { app_id, app_secret, token, user_id } = req.body;

        try {
            let updated = 0;
            if (app_id) {
                await tokenManager.updateConfig('QOBUZ_APP_ID', app_id);
                updated++;
            }
            if (app_secret) {
                await tokenManager.updateConfig('QOBUZ_APP_SECRET', app_secret);
                updated++;
            }
            if (token) {
                await tokenManager.updateConfig('QOBUZ_USER_AUTH_TOKEN', token);
                updated++;
            }
            if (user_id) {
                await tokenManager.updateConfig('QOBUZ_USER_ID', user_id);
                updated++;
            }

            if (updated > 0) {
                credentialsCache = null;
                res.json({ success: true, message: `Updated ${updated} settings` });
            } else {
                res.status(400).json({ success: false, error: 'No settings provided' });
            }
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/history/export', async (req: Request, res: Response) => {
        const format = (req.query.format as string) || 'json';
        const history = historyService.getAll();
        const entries = Object.entries(history).map(([id, entry]) => ({
            id,
            ...entry
        }));

        if (format === 'csv') {
            const headers = [
                'id',
                'title',
                'artist',
                'album',
                'quality',
                'filename',
                'downloadedAt'
            ];
            const csv = [
                headers.join(','),
                ...entries.map((e) =>
                    headers
                        .map((h) => {
                            const val = (e as any)[h] || '';
                            return `"${String(val).replace(/"/g, '""')}"`;
                        })
                        .join(',')
                )
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=history.csv');
            res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=history.json');
            res.json(entries);
        }
    });

    app.get('/api/preferences', (req: Request, res: Response) => {
        res.json({
            theme: 'system',
            quality: 27,
            language: 'en'
        });
    });

    app.get('/api/preview/:id', async (req: Request, res: Response) => {
        try {
            const { audioPreviewService } = await import('../audio-preview/index.js');
            const info = await audioPreviewService.getPreviewInfo(getParam(req.params.id));

            if (info) {
                res.json(info);
            } else {
                res.status(404).json({ error: 'Preview not available' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/preview/:id/stream', async (req: Request, res: Response) => {
        try {
            const { audioPreviewService } = await import('../audio-preview/index.js');
            const quality = parseInt(req.query.quality as string) || undefined;
            const url = await audioPreviewService.getStreamUrl(getParam(req.params.id), quality);

            if (url) {
                res.redirect(url);
            } else {
                res.status(404).json({ error: 'Stream not available' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/preview/:id/waveform', async (req: Request, res: Response) => {
        try {
            const { audioPreviewService } = await import('../audio-preview/index.js');
            const info = await audioPreviewService.getPreviewInfo(getParam(req.params.id));

            if (info) {
                const samples = parseInt(req.query.samples as string) || 100;
                const waveform = audioPreviewService.generateWaveform(info.duration, samples);
                res.json({ waveform });
            } else {
                res.status(404).json({ error: 'Track not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/preview/batch', async (req: Request, res: Response) => {
        try {
            const { audioPreviewService } = await import('../audio-preview/index.js');
            const { trackIds } = req.body;

            if (!Array.isArray(trackIds)) {
                res.status(400).json({ error: 'trackIds must be an array' });
                return;
            }

            const results = await audioPreviewService.getBatchPreviewInfo(trackIds);
            res.json(Object.fromEntries(results));
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/dashboard', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            res.json(advancedAnalyticsService.getDashboard());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/trends', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            const dashboard = advancedAnalyticsService.getDashboard();
            res.json(dashboard.trends);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/quality', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            const dashboard = advancedAnalyticsService.getDashboard();
            res.json(dashboard.qualityDistribution);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/genres', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            const dashboard = advancedAnalyticsService.getDashboard();
            res.json(dashboard.genreBreakdown);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/artists', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            const dashboard = advancedAnalyticsService.getDashboard();
            res.json(dashboard.topArtists);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/storage', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            const dashboard = advancedAnalyticsService.getDashboard();
            res.json(dashboard.storage);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/analytics/insights', async (req: Request, res: Response) => {
        try {
            const { advancedAnalyticsService } = await import('../analytics/index.js');
            const dashboard = advancedAnalyticsService.getDashboard();
            res.json(dashboard.insights);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/library/scan', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');

            if (libraryScannerService.isScanInProgress()) {
                res.status(409).json({ error: 'Scan already in progress' });
                return;
            }

            const { directory, detectDuplicates, checkUpgrades } = req.body;

            libraryScannerService
                .scanLibrary(directory, {
                    detectDuplicates: detectDuplicates !== false,
                    checkUpgrades: checkUpgrades !== false
                })
                .catch((err) => {
                    logger.error(`Library scan failed: ${err.message}`, 'SCANNER');
                });

            res.json({ message: 'Scan started', status: 'scanning' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/library/scan/status', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            res.json({
                scanning: libraryScannerService.isScanInProgress(),
                stats: libraryScannerService.getScanStats()
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/library/scan/abort', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            libraryScannerService.abortScan();
            res.json({ message: 'Scan abort requested' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/library/duplicates', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            res.json(libraryScannerService.getDuplicates());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/library/duplicates/:id/resolve', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            await libraryScannerService.resolveDuplicate(parseInt(getParam(req.params.id)));
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/library/upgradeable', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            res.json(libraryScannerService.getUpgradeableFiles());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/library/file', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            const { filePath } = req.body;

            if (!filePath) {
                res.status(400).json({ error: 'filePath is required' });
                return;
            }

            const success = await libraryScannerService.deleteFile(filePath);
            res.json({ success });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/database/stats', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            res.json(databaseService.getOverallStats());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/database/tracks', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            const limit = parseInt(req.query.limit as string) || 100;
            const offset = parseInt(req.query.offset as string) || 0;
            res.json(databaseService.getAllTracks(limit, offset));
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/database/albums', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;
            res.json(databaseService.getAllAlbums(limit, offset));
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/database/search', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            const query = req.query.q as string;

            if (!query) {
                res.status(400).json({ error: 'Query parameter "q" is required' });
                return;
            }

            res.json(databaseService.searchTracks(query));
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });
}

function sanitizeFilename(name: string) {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
}
