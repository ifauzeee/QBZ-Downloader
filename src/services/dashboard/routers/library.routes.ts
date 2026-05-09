import { Router, Request, Response } from 'express';
import { databaseService } from '../../database/index.js';
import { libraryScannerService } from '../../library-scanner/index.js';
import { RecommendationService } from '../../RecommendationService.js';
import { historyService } from '../../history.js';
import QobuzAPI from '../../../api/qobuz.js';
import { libraryHealerService } from '../../LibraryHealerService.js';
import { libraryStatisticsService } from '../../LibraryStatisticsService.js';
import { CONFIG } from '../../../config.js';
import { formatConverterService } from '../../FormatConverterService.js';

const router = Router();

const getParam = (p: any) => (Array.isArray(p) ? p[0] : p);

router.get('/scan/status', async (req: Request, res: Response) => {
    const stats = libraryScannerService.getScanStats();
    res.json({
        ...stats,
        stats,
        scanning: libraryScannerService.isScanInProgress(),
        FFMPEG_AVAILABLE: await formatConverterService.isAvailable()
    });
});

router.post('/scan', (req: Request, res: Response) => {
    const { path } = req.body;
    libraryScannerService.scanLibrary(path);
    res.json({ success: true });
});

router.post('/scan/abort', (req: Request, res: Response) => {
    libraryScannerService.abortScan();
    res.json({ success: true });
});

router.post('/heal', async (req: Request, res: Response) => {
    try {
        const report = await libraryHealerService.performFullHeal();
        res.json(report);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/statistics', async (req: Request, res: Response) => {
    try {
        const stats = await libraryStatisticsService.getLibraryStats();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
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

router.get('/upgradeable', (req: Request, res: Response) => {
    try {
        res.json(libraryScannerService.getUpgradeableFiles());
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/missing-metadata', (req: Request, res: Response) => {
    try {
        res.json(libraryScannerService.getMissingMetadataFiles());
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
        const issues = databaseService.getDuplicates();
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
        const coverCandidates = metadataService.getCoverUrlCandidates(
            metadata.album?.image || metadata.image || {},
            CONFIG.metadata.coverSize,
            typeof imageUrl === 'string' ? imageUrl : metadata.coverUrl
        );
        if (coverCandidates.length > 0) {
            const axios = (await import('axios')).default;
            const { logger } = await import('../../../utils/logger.js');
            for (const candidate of coverCandidates) {
                try {
                    const response = await axios.get(candidate, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    });
                    coverBuffer = Buffer.from(response.data);
                    break;
                } catch (e: any) {
                    logger.debug(`Cover candidate failed (${candidate}): ${e.message}`, 'METADATA');
                }
            }

            if (!coverBuffer) {
                logger.warn('Failed to download cover art from all candidates', 'METADATA');
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

router.get('/health', async (req: Request, res: Response) => {
    try {
        res.json(databaseService.getLibraryHealth());
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

// Migrated to catalog.routes.ts for path consistency

// Moved to catalog.routes.ts for path consistency


export default router;
