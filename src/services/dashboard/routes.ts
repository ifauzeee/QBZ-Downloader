import { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { downloadQueue } from '../telegram/queue.js';
import { inputValidator } from '../telegram/security/validator.js';
import { historyService } from '../history.js';
import { settingsService } from '../settings.js';
import QobuzAPI from '../../api/qobuz.js';

const api = new QobuzAPI();

export function registerRoutes(app: Express): void {
    app.get('/api/status', (req: Request, res: Response) => {
        const stats = downloadQueue.getStats();
        res.json({
            online: true,
            version: '2.0.0',
            stats
        });
    });

    app.get('/api/queue', (req: Request, res: Response) => {
        const items = (downloadQueue as any).getItems ? (downloadQueue as any).getItems() : [];
        res.json(items);
    });

    app.get('/api/settings', (req: Request, res: Response) => {
        res.json(settingsService.settings);
    });

    app.post('/api/settings', (req: Request, res: Response) => {
        const newSettings = req.body;
        settingsService.settings = { ...settingsService.settings, ...newSettings };
        settingsService.saveSettings();
        res.json({ success: true, settings: settingsService.settings });
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
                    const trackData = await api.getTrack(validation.id);
                    if (trackData.success && trackData.data) {
                        displayTitle = `${trackData.data.performer?.name || 'Unknown'} - ${trackData.data.title}`;
                    }
                } else if (validation.type === 'album') {
                    const albumData = await api.getAlbum(validation.id);
                    if (albumData.success && albumData.data) {
                        displayTitle = `${albumData.data.artist?.name || 'Unknown'} - ${albumData.data.title}`;
                    }
                }

                const item = downloadQueue.add(
                    validation.type as any,
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

    app.post('/api/history/clear', (req: Request, res: Response) => {
        historyService.clearAll();
        res.json({ success: true });
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
}

function sanitizeFilename(name: string) {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
}
