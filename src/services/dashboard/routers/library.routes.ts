import { Router, Request, Response } from 'express';
import { databaseService } from '../../database/index.js';
import { libraryScannerService } from '../../library-scanner/index.js';

const router = Router();

const getParam = (p: any) => (Array.isArray(p) ? p[0] : p);

router.get('/scan/status', (req: Request, res: Response) => {
    res.json(libraryScannerService.getStatus());
});

router.post('/scan/start', (req: Request, res: Response) => {
    const { path } = req.body;
    libraryScannerService.startScan(path);
    res.json({ success: true });
});

router.post('/scan/stop', (req: Request, res: Response) => {
    libraryScannerService.stopScan();
    res.json({ success: true });
});

router.get('/files', (req: Request, res: Response) => {
    try {
        const limit = parseInt(getParam(req.query.limit)) || 100;
        const offset = parseInt(getParam(req.query.offset)) || 0;
        const files = databaseService.getLibraryFiles(limit, offset);
        res.json(files);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/duplicates', (req: Request, res: Response) => {
    try {
        const duplicates = databaseService.getDuplicates();
        res.json(duplicates);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/integrity', (req: Request, res: Response) => {
    try {
        const issues = databaseService.getIntegrityIssues();
        res.json(issues);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/metadata/edit', async (req: Request, res: Response) => {
    try {
        const { filePath, metadata } = req.body;
        if (!filePath || !metadata) {
            res.status(400).json({ error: 'filePath and metadata are required' });
            return;
        }

        const { default: MetadataService } = await import('../../metadata.js');
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
                const { logger } = await import('../../../utils/logger.js');
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

router.delete('/file', async (req: Request, res: Response) => {
    try {
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

router.get('/database/stats', async (req: Request, res: Response) => {
    try {
        res.json(databaseService.getOverallStats());
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/database/tracks', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        res.json(databaseService.getAllTracks(limit, offset));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/database/albums', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        res.json(databaseService.getAllAlbums(limit, offset));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/database/search', async (req: Request, res: Response) => {
    try {
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

router.get('/playlists/watched', async (req: Request, res: Response) => {
    try {
        res.json(databaseService.getWatchedPlaylists());
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/playlists/watch', async (req: Request, res: Response) => {
    try {
        const { playlistId, quality, intervalHours } = req.body;

        if (!playlistId) return res.status(400).json({ error: 'playlistId is required' });

        const QobuzAPI = (await import('../../../api/qobuz.js')).default;
        const api = new QobuzAPI();
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

router.delete('/playlists/watch/:id', async (req: Request, res: Response) => {
    try {
        databaseService.removeWatchedPlaylist(getParam(req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
