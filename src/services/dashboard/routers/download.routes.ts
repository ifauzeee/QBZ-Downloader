import { Router, Request, Response } from 'express';
import { downloadQueue } from '../../queue/queue.js';
import { historyService } from '../../history.js';
import { databaseService } from '../../database/index.js';
import { createMigrationService } from '../../migration.js';
import QobuzAPI from '../../../api/qobuz.js';
import { logger } from '../../../utils/logger.js';
import { CONFIG, normalizeDownloadQuality } from '../../../config.js';

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

    const q = normalizeDownloadQuality(quality, CONFIG.quality.default);
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
            const trackId = getParam(id);
            const success = downloadQueue.remove(trackId) || downloadQueue.cancel(trackId);
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
    const q = normalizeDownloadQuality(quality, CONFIG.quality.default);
    downloadQueue.add('track', id, q);
    res.json({ success: true });
});

router.post('/download/album', async (req: Request, res: Response) => {
    const { id, quality, indices } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const q = normalizeDownloadQuality(quality, CONFIG.quality.default);

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

router.post('/download/artist', async (req: Request, res: Response) => {
    const { id, quality } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const q = normalizeDownloadQuality(quality, CONFIG.quality.default);

    const { downloadService } = await import('../../queue-processor.js');
    const result = await downloadService.downloadArtist(id, q);

    if (result.success) {
        res.json({ success: true, count: result.completedTracks });
    } else {
        res.status(500).json({ error: result.error || 'Failed to download artist discography' });
    }
});


router.get('/history', (req: Request, res: Response) => {
    res.json(Object.entries(historyService.getAll()).map(([id, data]) => ({ id, ...data })));
});

router.post('/history/clear', (req: Request, res: Response) => {
    historyService.clearAll();
    res.json({ success: true });
});

router.get('/history/export', (req: Request, res: Response) => {
    const format = req.query.format as string;
    const history = historyService.getSorted();

    if (format === 'csv') {
        const headers = ['ID', 'Downloaded At', 'Title', 'Artist', 'Album', 'Quality', 'Filename'];
        const rows = history.map((item) => [
            item.id,
            item.downloadedAt,
            item.title,
            item.artist || '',
            item.album || '',
            item.quality,
            item.filename
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=qbz_history.csv');
        return res.send(csvContent);
    }

    // Default to JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=qbz_history.json');
    res.json(history);
});

router.delete('/history', (req: Request, res: Response) => {
    historyService.clearAll();
    res.json({ success: true });
});

router.get('/download/:id', (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const historyItem = historyService.get(id);
    const queueItem = downloadQueue.get(id);
    
    if (historyItem || queueItem) {
        res.json({ id, inHistory: !!historyItem, inQueue: !!queueItem, status: queueItem?.status || 'completed' });
    } else {
        res.status(404).json({ error: 'Item not found' });
    }
});


router.get('/preview/:id', async (req: Request, res: Response) => {
    try {
        const { audioPreviewService } = await import('../../audio-preview/index.js');
        const id = getParam(req.params.id);
        const info = await audioPreviewService.getPreviewInfo(id);
        
        if (info) {
            res.json(info);
        } else {
            res.status(404).json({ error: 'Preview info not found' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/lyrics/:id', async (req: Request, res: Response) => {
    try {
        const { downloadService } = await import('../../queue-processor.js');
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

router.post('/lyrics/download', async (req: Request, res: Response) => {
    try {
        const { trackId } = req.body;
        if (!trackId) return res.status(400).json({ error: 'trackId is required' });

            const { downloadService } = await import('../../queue-processor.js');
        const trackRes = await api.getTrack(trackId);
        if (!trackRes.success || !trackRes.data) return res.status(404).json({ error: 'Track not found' });

        const track = trackRes.data;
        const lyrics = await downloadService.lyricsProvider.getLyrics(
            track.title,
            track.performer?.name || track.artist?.name || 'Unknown',
            track.album?.title,
            track.duration
        );

        if (lyrics.success) {
            const historyItem = historyService.get(trackId);
            if (historyItem && (lyrics.syncedLyrics || lyrics.plainLyrics)) {
                const { writeFileSync } = await import('fs');
                const lrcPath = historyItem.filename.replace(/\.[^.]+$/, '.lrc');
                writeFileSync(lrcPath, lyrics.syncedLyrics || lyrics.plainLyrics || '', 'utf8');
            }
            res.json(lyrics);
        } else {
            res.status(404).json({ error: 'Lyrics not found' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/lyrics/download-album-zip', async (req: Request, res: Response) => {
    try {
        const { albumId } = req.body;
        if (!albumId) return res.status(400).json({ error: 'albumId is required' });

        const albumRes = await api.getAlbum(albumId);
        if (!albumRes.success || !albumRes.data) return res.status(404).json({ error: 'Album not found' });

        const album = albumRes.data;
        const tracks = album.tracks?.items || [];
        if (tracks.length === 0) return res.status(404).json({ error: 'No tracks found for this album' });

            const { downloadService } = await import('../../queue-processor.js');
        const { existsSync, mkdirSync, createWriteStream } = await import('fs');
        const { default: archiver } = await import('archiver');
        const path = await import('path');

        const zipDir = path.join(CONFIG.download.outputDir || './downloads', '_lyrics');
        if (!existsSync(zipDir)) mkdirSync(zipDir, { recursive: true });

        const zipName = `${album.artist.name} - ${album.title} - Lyrics.zip`.replace(/[\\/:*?"<>|]/g, '_');
        const zipPath = path.join(zipDir, zipName);

        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            logger.info(`Lyrics ZIP created: ${zipName}`, 'LYRICS');
        });

        archive.pipe(output);

        for (const track of tracks) {
            try {
                const lyrics = await downloadService.lyricsProvider.getLyrics(
                    track.title,
                    track.performer?.name || track.artist?.name || album.artist.name,
                    album.title,
                    track.duration
                );

                if (lyrics.success && (lyrics.syncedLyrics || lyrics.plainLyrics)) {
                    const content = lyrics.syncedLyrics || lyrics.plainLyrics || '';
                    const filename = `${track.track_number.toString().padStart(2, '0')}. ${track.title}.lrc`.replace(/[\\/:*?"<>|]/g, '_');
                    archive.append(content, { name: filename });
                }
            } catch (e) {
                logger.warn(`Failed to fetch lyrics for ZIP: ${track.title}`, 'LYRICS');
            }
        }

        await archive.finalize();
        res.json({ success: true, filePath: zipPath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});


router.post('/migrate/spotify', async (req: Request, res: Response) => {
    try {
        const { url, quality, download } = req.body;
        const q = normalizeDownloadQuality(quality, CONFIG.quality.default);
        const migrationService = createMigrationService(api);
        const results = await migrationService.migrateFromSpotify(url, q);
        
        if (download && results.results.length > 0) {
            const count = await migrationService.startMigrationDownload(results.results, q);
            return res.json({ ...results, enqueued: count });
        }
        
        res.json(results);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/analytics/overview', (req: Request, res: Response) => {
    res.json(databaseService.getOverallStats() || {});
});

export default router;
