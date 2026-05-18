import { Router, Request, Response } from 'express';
import qobuzApi from '../../../api/qobuz.js';
import { databaseService } from '../../database/index.js';
import { normalizeDownloadQuality } from '../../../config.js';
import { historyService } from '../../history.js';

const router = Router();
const api = qobuzApi;

const getParam = (p: unknown): string => (Array.isArray(p) ? String(p[0]) : String(p ?? ''));

router.get('/search', async (req: Request, res: Response) => {
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
            const updates = result.data.artists.items.map(async (item: Record<string, unknown>) => {
                if (!item.image && !item.picture) {
                    try {
                        const detail = await api.getArtist(String(item.id), 0, 1);
                        const detailData = detail.data as any;
                        if (
                            detail.success &&
                            detailData &&
                            detailData.albums &&
                            Array.isArray(detailData.albums.items) &&
                            detailData.albums.items.length > 0
                        ) {
                            const latestAlbum = detailData.albums.items[0];
                            item.image = latestAlbum?.image;
                            item.picture = latestAlbum?.image;
                        }
                    } catch { }
                }
                return item;
            });
            await Promise.all(updates);
        }

        if (result.data) {
            const data = result.data as Record<string, unknown>;
            const tracks = data.tracks as { items: Record<string, unknown>[] } | undefined;
            if (tracks?.items) {
                tracks.items.forEach((item) => {
                    item.already_downloaded = databaseService.hasTrack(String(item.id));
                });
            }
            const albums = data.albums as { items: Record<string, unknown>[] } | undefined;
            if (albums?.items) {
                albums.items.forEach((item) => {
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

router.get('/album/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await api.getAlbum(id);

    if (result.success) {
        const data = result.data as Record<string, unknown>;
        const dbAlbum = databaseService.getAlbum(String(data.id));
        data.already_downloaded = !!dbAlbum;

        const tracks = data.tracks as { items: Record<string, unknown>[] } | undefined;
        if (tracks?.items) {
            tracks.items.forEach((item) => {
                item.already_downloaded = databaseService.hasTrack(String(item.id));
            });
        }
        res.json(data);
    } else {
        res.status(500).json({ error: result.error });
    }
});

router.get('/artist/:id', async (req: Request, res: Response) => {
    const id = getParam(req.params.id);
    const offset = getParam(req.query.offset);
    const limit = getParam(req.query.limit);
    const type = getParam(req.query.type);

    const off = parseInt(offset) || 0;
    const lim = parseInt(limit) || 20;

    if (type === 'albums') {
        const result = await api.getArtistAlbums(id, lim, off);
        if (result.success) {
            const data = result.data as Record<string, unknown>;
            const items = data.items as Record<string, unknown>[] | undefined;
            if (items) {
                items.forEach((item) => {
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
            const data = result.data as Record<string, unknown>;
            const tracks = data.tracks as { items: Record<string, unknown>[] } | undefined;
            if (tracks?.items) {
                tracks.items.forEach((item) => {
                    item.already_downloaded = databaseService.hasTrack(String(item.id));
                });
            }
            const albums = data.albums as { items: Record<string, unknown>[] } | undefined;
            if (albums?.items) {
                albums.items.forEach((item) => {
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

router.get('/playlist/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await api.getPlaylist(id);

    if (result.success) {
        res.json(result.data);
    } else {
        res.status(500).json({ error: result.error });
    }
});

router.get('/track/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await api.getTrack(id);

    if (result.success) {
        res.json(result.data);
    } else {
        res.status(500).json({ error: result.error });
    }
});

router.get('/genres', async (req: Request, res: Response) => {
    const result = await api.getGenres();
    if (result.success) {
        res.json(result.data);
    } else {
        res.status(500).json({ error: result.error });
    }
});

router.get('/search/suggestions', async (req: Request, res: Response) => {
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
                ? (artists.data as any)?.artists?.items?.slice(0, 3) || []
                : [],
            albums: albums.success ? (albums.data as any)?.albums?.items?.slice(0, 3) || [] : [],
            tracks: tracks.success ? (tracks.data as any)?.tracks?.items?.slice(0, 3) || [] : []
        });
    } catch {
        res.json({ artists: [], albums: [], tracks: [] });
    }
});

router.get('/preview/:id', async (req: Request, res: Response) => {
    try {
        const { audioPreviewService } = await import('../../audio-preview/index.js');
        const trackId = getParam(req.params.id);
        const info = await audioPreviewService.getPreviewInfo(trackId);

        if (info) {
            res.json(info);
        } else {
            res.status(404).json({ error: 'Preview info not found' });
        }
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/stream/:id', async (req: Request, res: Response) => {
    try {
        const { audioPreviewService } = await import('../../audio-preview/index.js');
        const trackId = getParam(req.params.id);
        const url = await audioPreviewService.getStreamUrl(trackId);

        if (url) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.redirect(url);
        } else {
            res.status(404).json({ error: 'Stream URL not found' });
        }
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/playlists/watched', async (req: Request, res: Response) => {
    try {
        res.json(databaseService.getWatchedPlaylists());
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/playlists/watch', async (req: Request, res: Response) => {
    try {
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
            title: String(playlist.title || playlist.name || ''),
            quality: normalizeDownloadQuality(quality, 27),
            intervalHours: intervalHours || 24
        });

        res.json({ success: true, message: 'Playlist added to watch list' });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/playlists/watch/:id', async (req: Request, res: Response) => {
    try {
        databaseService.removeWatchedPlaylist(getParam(req.params.id));
        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/quality-stats', (req: Request, res: Response) => {
    try {
        const history = historyService.getAll();
        const stats = {
            totalScanned: 0,
            trueLossless: 0,
            fakeLossless: 0,
            issues: [] as Record<string, unknown>[]
        };

        Object.values(history).forEach((entry) => {
            if (entry.qualityScan) {
                stats.totalScanned++;
                if (entry.qualityScan.isTrueLossless) {
                    stats.trueLossless++;
                } else {
                    stats.fakeLossless++;
                    stats.issues.push({
                        title: entry.title,
                        artist: entry.artist,
                        details: entry.qualityScan.details,
                        confidence: entry.qualityScan.confidence
                    });
                }
            }
        });

        res.json(stats);
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
