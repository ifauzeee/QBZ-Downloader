import { Request, Response } from 'express';
import { downloadQueue } from '../queue/queue.js';
import { historyService } from '../history.js';
import { databaseService } from '../database/index.js';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../config.js';
import QobuzAPI from '../../api/qobuz.js';

import { tokenManager } from '../../utils/token.js';
import { APP_VERSION } from '../../constants.js';

const api = new QobuzAPI();

export function registerRoutes(app: any) {
    const getParam = (p: any) => (Array.isArray(p) ? p[0] : p);

    app.get('/api/status', (req: Request, res: Response) => {
        res.json({
            online: true,
            version: APP_VERSION,
            stats: downloadQueue.getStats()
        });
    });

    app.get('/api/credentials/status', (req: Request, res: Response) => {
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

    app.get('/api/onboarding', (req: Request, res: Response) => {
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

    app.get('/api/settings', (req: Request, res: Response) => {
        const mask = (s: string) => (s ? s.slice(0, 4) + '••••' + s.slice(-4) : '-');
        res.json({
            QOBUZ_APP_ID: CONFIG.credentials.appId,
            QOBUZ_APP_SECRET: mask(CONFIG.credentials.appSecret),
            QOBUZ_USER_AUTH_TOKEN: mask(CONFIG.credentials.token),
            QOBUZ_USER_ID: CONFIG.credentials.userId,
            DOWNLOADS_PATH: CONFIG.download.outputDir,
            FOLDER_TEMPLATE: CONFIG.download.folderStructure,
            FILE_TEMPLATE: CONFIG.download.fileNaming,
            MAX_CONCURRENCY: CONFIG.download.concurrent
        });
    });

    app.post('/api/settings/update', async (req: Request, res: Response) => {
        const { app_id, app_secret, token, user_id } = req.body;
        try {
            if (app_id) await tokenManager.updateConfig('QOBUZ_APP_ID', app_id);
            if (app_secret) await tokenManager.updateConfig('QOBUZ_APP_SECRET', app_secret);
            if (token) await tokenManager.updateConfig('QOBUZ_USER_AUTH_TOKEN', token);
            if (user_id) await tokenManager.updateConfig('QOBUZ_USER_ID', user_id);
            res.json({ success: true, message: 'Settings updated successfully' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/login', async (req: Request, res: Response) => {
        try {
            const result = await api.getUserInfo();
            if (result.success) {
                tokenManager.markValid();
                res.json({ success: true, user: result.data });
            } else {
                tokenManager.markInvalid();
                res.status(401).json({ error: 'Login failed' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/system/reset', async (req: Request, res: Response) => {
        try {
            databaseService.resetStatistics();
            historyService.clearAll();
            downloadQueue.clear();
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/queue', (req: Request, res: Response) => {
        res.json(downloadQueue.getAll());
    });

    app.post('/api/queue/add', async (req: Request, res: Response) => {
        const { type, id, quality, priority } = req.body;
        logger.debug(`Queue Add Request: ${JSON.stringify(req.body)}`, 'API');

        if (!type || !id) {
            res.status(400).json({ error: 'Type and ID are required' });
            return;
        }

        try {
            let title = `${type}: ${id}`;
            let artist = '';
            let album = '';

            if (type === 'track') {
                const trackRes = await api.getTrack(id);
                if (trackRes.success && trackRes.data) {
                    title = trackRes.data.title;
                    artist = trackRes.data.performer?.name || trackRes.data.artist?.name || '';
                    album = trackRes.data.album?.title || '';
                }
            } else if (type === 'album') {
                const albumRes = await api.getAlbum(id);
                if (albumRes.success && albumRes.data) {
                    title = albumRes.data.title;
                    artist = albumRes.data.artist?.name || '';
                }
            } else if (type === 'playlist') {
                const plRes = await api.getPlaylist(id);
                if (plRes.success && plRes.data) {
                    title = plRes.data.name;
                    artist = 'Various Artists';
                }
            }

            const item = downloadQueue.add(type, id, quality || 27, {
                title,
                priority,
                metadata: { artist, album }
            });

            res.json(item);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/queue/pause', (req: Request, res: Response) => {
        downloadQueue.pause();
        res.json({ success: true });
    });

    app.post('/api/queue/resume', (req: Request, res: Response) => {
        downloadQueue.resume();
        res.json({ success: true });
    });

    app.post('/api/queue/clear', (req: Request, res: Response) => {
        const count = downloadQueue.clearCompleted();
        res.json({ count });
    });

    app.post('/api/queue/action', (req: Request, res: Response) => {
        const { action } = req.body;
        if (action === 'pause') {
            downloadQueue.pause();
        } else if (action === 'resume') {
            downloadQueue.resume();
        } else if (action === 'clear') {
            downloadQueue.clearCompleted();
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true });
    });

    app.post('/api/queue/item/:id/:action', (req: Request, res: Response) => {
        const id = getParam(req.params.id);
        const action = getParam(req.params.action);

        if (action === 'cancel') {
            const success = downloadQueue.cancel(id);
            res.json({ success });
        } else if (action === 'remove') {
            const success = downloadQueue.remove(id);
            res.json({ success });
        } else {
            res.status(400).json({ error: 'Invalid item action' });
        }
    });

    app.post('/api/item/:id/:action', (req: Request, res: Response) => {
        const id = getParam(req.params.id);
        const action = getParam(req.params.action);

        if (action === 'cancel') {
            const success = downloadQueue.cancel(id);
            res.json({ success });
        } else if (action === 'remove') {
            const success = downloadQueue.remove(id);
            res.json({ success });
        } else {
            res.status(400).json({ error: 'Invalid action' });
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

    app.post('/api/library/verify', async (req: Request, res: Response) => {
        const filePath = getParam(req.body.filePath);
        if (filePath) {
            const result = await databaseService.verifyFileIntegrity(filePath);
            res.json(result);
        } else {
            res.status(400).json({ error: 'filePath is required' });
        }
    });

    app.get('/api/search', async (req: Request, res: Response) => {
        const query = getParam(req.query.query || req.query.q);
        const type = getParam(req.query.type) || 'albums';
        const limit = parseInt(getParam(req.query.limit)) || 20;
        const offset = parseInt(getParam(req.query.offset)) || 0;

        if (!query) {
            res.status(400).json({ error: 'Query is required' });
            return;
        }

        const result = await api.search(query, type, limit, offset);

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
                        } catch { }
                    }
                    return item;
                });
                await Promise.all(updates);
            }

            if (result.data) {
                const data = result.data as any;
                if (data.tracks?.items) {
                    data.tracks.items.forEach((item: any) => {
                        item.already_downloaded = databaseService.hasTrack(String(item.id));
                    });
                }
                if (data.albums?.items) {
                    data.albums.items.forEach((item: any) => {
                        const dbAlbum = databaseService.getAlbum(String(item.id));
                        item.already_downloaded = !!dbAlbum;
                    });
                }
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
            const data = result.data as any;
            const dbAlbum = databaseService.getAlbum(String(data.id));
            data.already_downloaded = !!dbAlbum;

            if (data.tracks?.items) {
                data.tracks.items.forEach((item: any) => {
                    item.already_downloaded = databaseService.hasTrack(String(item.id));
                });
            }
            res.json(data);
        } else {
            res.status(500).json({ error: result.error });
        }
    });

    app.get('/api/artist/:id', async (req: Request, res: Response) => {
        const id = getParam(req.params.id);
        const offset = getParam(req.query.offset);
        const limit = getParam(req.query.limit);
        const type = getParam(req.query.type);

        const off = parseInt(offset) || 0;
        const lim = parseInt(limit) || 20;

        if (type === 'albums') {
            const result = await api.getArtistAlbums(id, lim, off);
            if (result.success) {
                const data = result.data as any;
                if (data.items) {
                    data.items.forEach((item: any) => {
                        const dbAlbum = databaseService.getAlbum(String(item.id));
                        item.already_downloaded = !!dbAlbum;
                    });
                }
                res.json(data);
            } else {
                res.status(500).json({ error: result.error });
            }
        } else {
            const result = await api.getArtist(id, off, lim);
            if (result.success) {
                const data = result.data as any;
                if (data.tracks?.items) {
                    data.tracks.items.forEach((item: any) => {
                        item.already_downloaded = databaseService.hasTrack(String(item.id));
                    });
                }
                if (data.albums?.items) {
                    data.albums.items.forEach((item: any) => {
                        const dbAlbum = databaseService.getAlbum(String(item.id));
                        item.already_downloaded = !!dbAlbum;
                    });
                }
                res.json(data);
            } else {
                res.status(500).json({ error: result.error });
            }
        }
    });

    app.get('/api/playlist/:id', async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await api.getPlaylist(id);

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    });

    app.get('/api/track/:id', async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const result = await api.getTrack(id);

        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
    });

    app.get('/api/genres', async (req: Request, res: Response) => {
        const result = await api.getGenres();
        if (result.success) {
            res.json(result.data);
        } else {
            res.status(500).json({ error: result.error });
        }
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
            console.error('Library Scan Route Error:', error);
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

    app.get('/api/library/missing-metadata', async (req: Request, res: Response) => {
        try {
            const { libraryScannerService } = await import('../library-scanner/index.js');
            res.json(libraryScannerService.getMissingMetadataFiles());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/tools/identify', async (req: Request, res: Response) => {
        try {
            const { filePath } = req.body;
            const path = await import('path');

            if (!filePath) return res.status(400).json({ error: 'filePath is required' });

            const ext = path.extname(filePath).toLowerCase();
            const filename = path.basename(filePath, ext);
            const parentDir = path.basename(path.dirname(filePath));
            const artistDir = path.basename(path.dirname(path.dirname(filePath)));

            let title = filename;
            let artist = 'Unknown';

            if (artistDir && artistDir !== 'downloads') {
                artist = artistDir;
            }

            const patterns = [/^(.+?)\s*-\s*(.+)$/, /^\d+\.\s*(.+)$/, /^\d+\s*-\s*(.+)$/];
            for (const pattern of patterns) {
                const match = filename.match(pattern);
                if (match) {
                    if (match.length === 3) {
                        artist = match[1].trim();
                        title = match[2].trim();
                    } else {
                        title = match[1].trim();
                    }
                    break;
                }
            }

            const levenshteinDistance = (str1: string, str2: string): number => {
                const matrix: number[][] = [];
                for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
                for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
                for (let i = 1; i <= str2.length; i++) {
                    for (let j = 1; j <= str1.length; j++) {
                        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                            matrix[i][j] = matrix[i - 1][j - 1];
                        } else {
                            matrix[i][j] = Math.min(
                                matrix[i - 1][j - 1] + 1,
                                matrix[i][j - 1] + 1,
                                matrix[i - 1][j] + 1
                            );
                        }
                    }
                }
                return matrix[str2.length][str1.length];
            };

            const similarity = (str1: string, str2: string): number => {
                if (!str1 || !str2) return 0;
                const s1 = str1
                    .toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .trim();
                const s2 = str2
                    .toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .trim();
                if (s1 === s2) return 1;
                const longer = s1.length > s2.length ? s1 : s2;
                const shorter = s1.length > s2.length ? s2 : s1;
                if (longer.length === 0) return 1;
                if (longer.includes(shorter)) return 0.9;
                const editDistance = levenshteinDistance(s1, s2);
                return (longer.length - editDistance) / longer.length;
            };

            const searchQuery = `${artist !== 'Unknown' ? artist : ''} ${title}`.trim();
            logger.debug(`Identifying via Search: ${searchQuery}`, 'API');

            const searchRes = await api.search(searchQuery, 'tracks', 5);

            let bestMatch: any = null;
            let highestScore = 0;

            if (
                searchRes.success &&
                searchRes.data &&
                searchRes.data.tracks &&
                searchRes.data.tracks.items.length > 0
            ) {
                for (const item of searchRes.data.tracks.items) {
                    const itemArtist = item.performer?.name || item.artist?.name || '';
                    const itemTitle = item.title || '';

                    const titleScore = similarity(title, itemTitle);
                    const artistScore = artist !== 'Unknown' ? similarity(artist, itemArtist) : 1.0;

                    const totalScore = titleScore * 0.6 + artistScore * 0.4;

                    if (artist === 'Unknown') {
                        if (titleScore > 0.8 && titleScore > highestScore) {
                            highestScore = titleScore;
                            bestMatch = item;
                        }
                    } else {
                        if (titleScore > 0.5 && artistScore > 0.4 && totalScore > highestScore) {
                            highestScore = totalScore;
                            bestMatch = item;
                        }
                    }
                }
            }

            if (bestMatch) {
                const trackId = (bestMatch as any).id;

                let fullMetadata = null;
                try {
                    const fullTrackRes = await api.getTrack(trackId);
                    if (fullTrackRes.success && fullTrackRes.data) {
                        const { default: MetadataService } = await import('../metadata.js');
                        const metadataService = new MetadataService();
                        const fullTrack = fullTrackRes.data as any;
                        fullMetadata = await metadataService.extractMetadata(
                            fullTrack,
                            fullTrack.album
                        );
                    }
                } catch (e: any) {
                    logger.warn(`Failed to fetch full track details: ${e.message}`, 'METADATA');
                }

                const track = bestMatch as any;

                let lyrics = null;
                try {
                    const { downloadService } = await import('../../index.js');
                    lyrics = await downloadService.lyricsProvider.getLyrics(
                        track.title,
                        track.performer?.name || track.artist?.name,
                        track.album?.title,
                        track.duration
                    );
                } catch (e: any) {
                    logger.warn(
                        `Failed to fetch lyrics during identification: ${e.message}`,
                        'METADATA'
                    );
                }

                if (fullMetadata) {
                    res.json({
                        success: true,
                        data: {
                            ...fullMetadata,
                            image: fullMetadata.coverUrl,
                            lyrics: lyrics
                        }
                    });
                } else {
                    const result = {
                        title: track.title,
                        artist: track.performer?.name || track.artist?.name,
                        album: track.album?.title,
                        year: track.album?.release_date_original?.split('-')[0],
                        genre: track.genre?.name,
                        trackNumber: track.track_number,
                        image: track.album?.image?.large,
                        releaseDate: track.album?.release_date_original,
                        lyrics: lyrics
                    };
                    res.json({ success: true, data: result });
                }
            } else {
                res.status(404).json({ error: 'No matching metadata found on Qobuz' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/tools/scan-directory', async (req: Request, res: Response) => {
        try {
            const { dirPath } = req.body;
            if (!dirPath) return res.status(400).json({ error: 'dirPath is required' });

            const { readdir } = await import('fs/promises');
            const { join, extname } = await import('path');

            const files: string[] = [];

            const scan = async (dir: string) => {
                const entries = await readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await scan(fullPath);
                    } else if (entry.isFile()) {
                        const ext = extname(entry.name).toLowerCase();
                        if (['.flac', '.mp3', '.m4a'].includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            };

            await scan(dirPath);
            res.json({ success: true, files });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/tools/apply-metadata', async (req: Request, res: Response) => {
        try {
            const { filePath, metadata } = req.body;
            if (!filePath || !metadata)
                return res.status(400).json({ error: 'Missing parameters' });

            const { default: MetadataService } = await import('../metadata.js');
            const metadataService = new MetadataService();

            const targetMeta: any = {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                trackNumber: metadata.trackNumber || 0,
                totalTracks: metadata.totalTracks || 0,
                discNumber: metadata.discNumber || 1,
                totalDiscs: metadata.totalDiscs || 1,
                year: metadata.year || '',
                genre: metadata.genre || '',
                albumArtist: metadata.albumArtist || metadata.artist,
                label: metadata.label || '',
                copyright: metadata.copyright || '',
                releaseDate: metadata.releaseDate || '',
                originalReleaseDate: metadata.originalReleaseDate || '',

                composer: metadata.composer || '',
                conductor: metadata.conductor || '',
                producer: metadata.producer || '',
                mixer: metadata.mixer || '',
                remixer: metadata.remixer || '',
                lyricist: metadata.lyricist || '',
                writer: metadata.writer || '',
                arranger: metadata.arranger || '',
                engineer: metadata.engineer || '',

                isrc: metadata.isrc || '',
                upc: metadata.upc || '',
                barcode: metadata.barcode || metadata.upc || '',
                catalogNumber: metadata.catalogNumber || '',
                releaseType: metadata.releaseType || 'album',
                version: metadata.version || '',
                comment:
                    metadata.comment ||
                    'downloader by qbz-dl https://github.com/ifauzeee/QBZ-Downloader'
            };

            let coverBuffer: Buffer | null = null;
            const imageUrl = metadata.image || metadata.coverUrl;
            if (imageUrl) {
                try {
                    const axios = (await import('axios')).default;
                    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    coverBuffer = Buffer.from(response.data);
                } catch (e: any) {
                    logger.warn(`Failed to download cover art: ${e.message}`, 'METADATA');
                }
            }

            const lyrics = metadata.lyrics || null;

            await metadataService.writeMetadata(filePath, targetMeta, 0, lyrics, coverBuffer);
            res.json({ success: true });
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

    app.post('/api/batch/import/file', async (req: Request, res: Response) => {
        try {
            const { batchImportService } = await import('../batch.js');
            const { filePath, quality } = req.body;
            if (!filePath) return res.status(400).json({ error: 'filePath is required' });
            const result = await batchImportService.importFromFile(filePath, quality);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/batch/import/m3u8', async (req: Request, res: Response) => {
        try {
            const { batchImportService } = await import('../batch.js');
            const { filePath, quality } = req.body;
            if (!filePath) return res.status(400).json({ error: 'filePath is required' });
            const result = await batchImportService.importFromM3u8(filePath, quality);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/batch/import/csv', async (req: Request, res: Response) => {
        try {
            const { batchImportService } = await import('../batch.js');
            const { filePath, quality } = req.body;
            if (!filePath) return res.status(400).json({ error: 'filePath is required' });
            const result = await batchImportService.importFromCsv(filePath, quality);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/batch/import/direct', async (req: Request, res: Response) => {
        try {
            const { batchImportService } = await import('../batch.js');
            const { urls, quality, createZip } = req.body;
            if (!Array.isArray(urls))
                return res.status(400).json({ error: 'urls must be an array' });
            const result = await batchImportService.importUrls(urls, quality, createZip);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/logs', (req: Request, res: Response) => {
        res.json(logger.getLogs());
    });

    app.get('/api/search/suggestions', async (req: Request, res: Response) => {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
            res.json({ artists: [], albums: [], tracks: [] });
            return;
        }

        try {
            const [artists, albums, tracks] = await Promise.all([
                api.search(query, 'artists', 3),
                api.search(query, 'albums', 3),
                api.search(query, 'tracks', 3)
            ]);

            res.json({
                artists: artists.success
                    ? (artists.data as any)?.artists?.items.slice(0, 3) || []
                    : [],
                albums: albums.success ? (albums.data as any)?.albums?.items.slice(0, 3) || [] : [],
                tracks: tracks.success ? (tracks.data as any)?.tracks?.items.slice(0, 3) || [] : []
            });
        } catch {
            res.json({ artists: [], albums: [], tracks: [] });
        }
    });

    app.get('/api/lyrics/:id', async (req: Request, res: Response) => {
        try {
            const { downloadService } = await import('../../index.js');
            const id = getParam(req.params.id);

            const historyItem = historyService.get(id);
            if (historyItem) {
                const { existsSync, readFileSync } = await import('fs');
                const lrcPath = historyItem.filename.replace(/\.[^.]+$/, '.lrc');

                if (existsSync(lrcPath)) {
                    const content = readFileSync(lrcPath, 'utf8');
                    res.json({
                        success: true,
                        source: 'Local File',
                        syncedLyrics: content,
                        parsedLyrics: downloadService.lyricsProvider.parseLrc(content)
                    });
                    return;
                }
            }

            const trackRes = await api.getTrack(id);
            if (!trackRes.success || !trackRes.data) {
                res.status(404).json({ error: 'Track not found' });
                return;
            }

            const track = trackRes.data;
            const lyrics = await downloadService.lyricsProvider.getLyrics(
                track.title,
                track.performer?.name || track.artist?.name || 'Unknown',
                track.album?.title,
                track.duration
            );

            res.json(lyrics);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/lyrics/:id/save', async (req: Request, res: Response) => {
        try {
            const id = getParam(req.params.id);
            const { content } = req.body;

            if (!content) {
                res.status(400).json({ error: 'No content provided' });
                return;
            }

            const historyItem = historyService.get(id);
            if (!historyItem) {
                res.status(404).json({
                    error: 'Track not found in history (must be downloaded to save lyrics)'
                });
                return;
            }

            const { writeFileSync, existsSync } = await import('fs');
            const lrcPath = historyItem.filename.replace(/\.[^.]+$/, '.lrc');

            const { dirname } = await import('path');
            const dir = dirname(lrcPath);
            if (!existsSync(dir)) {
                res.status(404).json({ error: 'Directory does not exist' });
                return;
            }

            writeFileSync(lrcPath, content, 'utf8');
            logger.info(`Lyrics manually updated for track ${id}`, 'LYRICS');

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/lyrics/download', async (req: Request, res: Response) => {
        try {
            const { downloadService } = await import('../../index.js');
            const { trackId } = req.body;
            if (!trackId) return res.status(400).json({ error: 'trackId is required' });

            const result = await downloadService.downloadLyrics(trackId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/lyrics/download-album-zip', async (req: Request, res: Response) => {
        try {
            const { downloadService } = await import('../../index.js');
            const { albumId } = req.body;
            if (!albumId) return res.status(400).json({ error: 'albumId is required' });

            const result = await downloadService.downloadAlbumLyricsZip(albumId);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/stream/:id', async (req: Request, res: Response) => {
        try {
            const { audioPreviewService } = await import('../audio-preview/index.js');
            const trackId = getParam(req.params.id);
            const url = await audioPreviewService.getStreamUrl(trackId);

            if (url) {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.redirect(url);
            } else {
                res.status(404).json({ error: 'Stream URL not found' });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/playlists/watched', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            res.json(databaseService.getWatchedPlaylists());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/playlists/watch', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            const { playlistId, quality, intervalHours } = req.body;

            if (!playlistId) return res.status(400).json({ error: 'playlistId is required' });

            const result = await api.getPlaylist(playlistId);
            if (!result.success || !result.data) {
                return res.status(404).json({ error: 'Playlist not found on Qobuz' });
            }

            const playlist = result.data as any;
            databaseService.addWatchedPlaylist({
                id: playlistId,
                playlistId,
                title: playlist.title,
                quality: quality || 27,
                intervalHours: intervalHours || 24
            });

            res.json({ success: true, message: 'Playlist added to watch list' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/playlists/watch/:id', async (req: Request, res: Response) => {
        try {
            const { databaseService } = await import('../database/index.js');
            databaseService.removeWatchedPlaylist(getParam(req.params.id));
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/api/themes', async (req: Request, res: Response) => {
        try {
            const { themeService } = await import('../../services/ThemeService.js');
            res.json(await themeService.getAll());
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/themes', async (req: Request, res: Response) => {
        try {
            const { themeService } = await import('../../services/ThemeService.js');
            const { name, isDark, colors } = req.body;
            if (!name || typeof isDark !== 'boolean' || !colors)
                return res.status(400).json({ error: 'Missing parameters' });
            res.json(await themeService.create(name, isDark, colors));
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/themes/:id', async (req: Request, res: Response) => {
        try {
            const { themeService } = await import('../../services/ThemeService.js');
            res.json({ success: await themeService.delete(req.params.id as string) });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });
}
