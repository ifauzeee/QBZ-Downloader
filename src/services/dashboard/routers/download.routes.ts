import { Router, Request, Response } from 'express';
import { downloadQueue } from '../../queue/queue.js';
import { historyService } from '../../history.js';
import { databaseService } from '../../database/index.js';
import { createMigrationService } from '../../migration.js';
import QobuzAPI from '../../../api/qobuz.js';
import { logger } from '../../../utils/logger.js';
import { CONFIG } from '../../../config.js';

const router = Router();
const api = new QobuzAPI();

const getParam = (p: any) => (Array.isArray(p) ? p[0] : p);


router.get('/queue', (req: Request, res: Response) => {
    res.json(downloadQueue.getAll());
});

router.post('/queue/add', async (req: Request, res: Response) => {
    const { type, id, quality, title, priority, metadata } = req.body;
    if (!type || !id) {
        res.status(400).json({ error: 'type and id are required' });
        return;
    }

    const q = quality || CONFIG.quality.default || 27;
    const item = downloadQueue.add(type, id, q, { title, priority, metadata });
    res.json(item);
});

router.post('/queue/action', (req: Request, res: Response) => {
    const { action } = req.body;
    switch (action) {
        case 'pause':
            downloadQueue.pause();
            res.json({ success: true });
            break;
        case 'resume':
            downloadQueue.resume();
            res.json({ success: true });
            break;
        case 'clear':
            downloadQueue.clear();
            res.json({ success: true });
            break;
        case 'clear-completed': {
            const count = downloadQueue.clearCompleted();
            res.json({ success: true, count });
            break;
        }
        default:
            res.status(400).json({ error: 'Invalid action' });
    }
});

router.post('/item/:id/:action', (req: Request, res: Response) => {
    const { id, action } = req.params;
    switch (action) {
        case 'cancel':
        case 'remove': {
            const success = downloadQueue.remove(id) || downloadQueue.cancel(id);
            res.json({ success });
            break;
        }
        default:
            res.status(400).json({ error: 'Invalid action' });
    }
});


router.post('/download/track', (req: Request, res: Response) => {
    const { id, quality } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const q = quality || CONFIG.quality.default || 27;
    downloadQueue.add('track', id, q);
    res.json({ success: true });
});

router.post('/download/album', async (req: Request, res: Response) => {
    const { id, quality, indices } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const q = quality || CONFIG.quality.default || 27;

    const result = await api.getAlbum(id);
    if (result.success && result.data) {
        const album = result.data as any;
        const tracks = album.tracks.items;
        const toDownload = indices
            ? tracks.filter((_: any, i: number) => indices.includes(i))
            : tracks;

        toDownload.forEach((track: any) => {
            downloadQueue.add('track', track.id, q, { metadata: { album } });
        });

        res.json({ success: true, count: toDownload.length });
    } else {
        res.status(500).json({ error: result.error });
    }
});


router.get('/history', (req: Request, res: Response) => {
    res.json(Object.entries(historyService.getAll()).map(([id, data]) => ({ id, ...data })));
});

router.post('/history/clear', (req: Request, res: Response) => {
    historyService.clearAll();
    res.json({ success: true });
});

router.delete('/history', (req: Request, res: Response) => {
    historyService.clearAll();
    res.json({ success: true });
});

router.get('/download/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const historyItem = historyService.get(id);
    const queueItem = downloadQueue.get(id);
    
    if (historyItem || queueItem) {
        res.json({ id, inHistory: !!historyItem, inQueue: !!queueItem, status: queueItem?.status || 'completed' });
    } else {
        res.status(404).json({ error: 'Item not found' });
    }
});


router.get('/preview/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const result = await api.getFileUrl(id, 5);
    if (result.success) {
        res.json(result.data);
    } else {
        res.status(500).json({ error: result.error });
    }
});

router.get('/lyrics/:id', async (req: Request, res: Response) => {
    try {
        const { downloadService } = await import('../../../index.js');
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

router.post('/lyrics/:id/save', async (req: Request, res: Response) => {
    try {
        const id = getParam(req.params.id);
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'No content provided' });

        const historyItem = historyService.get(id);
        if (!historyItem) return res.status(404).json({ error: 'Track not found in history' });

        const { writeFileSync } = await import('fs');
        const lrcPath = historyItem.filename.replace(/\.[^.]+$/, '.lrc');

        writeFileSync(lrcPath, content, 'utf8');
        logger.info(`Lyrics manually updated for track ${id}`, 'LYRICS');
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});


router.post('/migrate/spotify', async (req: Request, res: Response) => {
    try {
        const migrationService = createMigrationService();
        const results = await migrationService.migrateSpotifyPlaylist(req.body.url);
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/analytics/overview', (req: Request, res: Response) => {
    res.json(databaseService.getOverview?.() || {});
});

export default router;
