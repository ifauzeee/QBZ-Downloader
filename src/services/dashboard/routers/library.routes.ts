import { Router, Request, Response } from 'express';
import { databaseService } from '../../database/index.js';
import { libraryScannerService } from '../../library-scanner/index.js';
import { libraryStatisticsService } from '../../LibraryStatisticsService.js';
import { CONFIG } from '../../../config.js';
import { formatConverterService } from '../../FormatConverterService.js';
import { logger } from '../../../utils/logger.js';
import { isPathWithinManagedRoots } from '../../../utils/paths.js';
import { isPublicHttpUrl, MAX_IMAGE_BYTES, MAX_IMAGE_REDIRECTS } from '../../../utils/net.js';

const router = Router();

const getParam = (p: unknown): string => (Array.isArray(p) ? String(p[0]) : String(p ?? ''));

/**
 * Pagination values reach SQLite's LIMIT/OFFSET directly, and SQLite reads a
 * negative LIMIT as "no limit" — so `?limit=-1` dumped whole tables.
 */
const getPageParam = (raw: unknown, fallback: number, max: number): number => {
    const parsed = parseInt(getParam(raw), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, max);
};

const MAX_PAGE_SIZE = 1000;

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

    // Without this the caller picks any directory and the scanner walks it into
    // the database, which the /api/library/files route then reads back.
    if (path !== undefined && !isPathWithinManagedRoots(path)) {
        logger.warn(`Refused library scan outside the library: ${path}`, 'LIBRARY');
        res.status(403).json({ error: 'Path is outside the library directory' });
        return;
    }

    // scanLibrary rejects with 'Scan already in progress'; unhandled, that
    // rejection terminates the process on Node 20+.
    libraryScannerService
        .scanLibrary(path)
        .catch((error: unknown) =>
            logger.error(`Library scan failed: ${(error as Error).message}`, 'LIBRARY')
        );

    res.json({ success: true });
});

router.post('/scan/abort', (req: Request, res: Response) => {
    libraryScannerService.abortScan();
    res.json({ success: true });
});

router.get('/statistics', async (req: Request, res: Response) => {
    try {
        const stats = await libraryStatisticsService.getLibraryStats();
        res.json(stats);
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/files', (req: Request, res: Response) => {
    try {
        const limit = getPageParam(req.query.limit, 100, MAX_PAGE_SIZE);
        const offset = getPageParam(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
        const files = databaseService.getLibraryFiles(limit, offset);
        res.json(files);
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/upgradeable', (req: Request, res: Response) => {
    try {
        res.json(libraryScannerService.getUpgradeableFiles());
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/missing-metadata', (req: Request, res: Response) => {
    try {
        res.json(libraryScannerService.getMissingMetadataFiles());
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/duplicates', (req: Request, res: Response) => {
    try {
        const duplicates = databaseService.getDuplicates();
        res.json(duplicates);
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/duplicates/:id/resolve', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ error: 'Valid duplicate id is required' });
            return;
        }

        const result = await libraryScannerService.resolveDuplicate(id);
        if (!result.resolved) {
            res.status(404).json({ success: false, error: result.reason || 'Duplicate not found' });
            return;
        }

        res.json({ success: true, ...result });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/integrity', (req: Request, res: Response) => {
    try {
        const issues = databaseService.getDuplicates();
        res.json(issues);
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/metadata/edit', async (req: Request, res: Response) => {
    try {
        const { filePath, metadata } = req.body;
        if (!filePath || !metadata) {
            res.status(400).json({ error: 'filePath and metadata are required' });
            return;
        }

        if (!isPathWithinManagedRoots(filePath)) {
            logger.warn(`Refused metadata write outside the library: ${filePath}`, 'LIBRARY');
            res.status(403).json({ error: 'Path is outside the library directory' });
            return;
        }

        const { default: MetadataService } = await import('../../metadata.js');
        const metadataService = new MetadataService();

        const targetMeta = {
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
                // The URL comes from the request body, so it must not be used
                // to reach the host's own network.
                if (!isPublicHttpUrl(candidate)) {
                    logger.warn(`Refused cover fetch for non-public URL: ${candidate}`, 'METADATA');
                    continue;
                }

                try {
                    const response = await axios.get(candidate, {
                        responseType: 'arraybuffer',
                        timeout: 15000,
                        maxContentLength: MAX_IMAGE_BYTES,
                        maxRedirects: MAX_IMAGE_REDIRECTS,
                        beforeRedirect: (options) => {
                            if (!isPublicHttpUrl(options.href)) {
                                throw new Error('redirect to a non-public host');
                            }
                        }
                    });
                    coverBuffer = Buffer.from(response.data);
                    break;
                } catch (e: unknown) {
                    logger.debug(`Cover candidate failed (${candidate}): ${(e as Error).message}`, 'METADATA');
                }
            }

            if (!coverBuffer) {
                logger.warn('Failed to download cover art from all candidates', 'METADATA');
            }
        }

        const lyrics = metadata.lyrics || null;

        await metadataService.writeMetadata(filePath, targetMeta as any, 0, lyrics, coverBuffer);
        res.json({ success: true });
    } catch (error: unknown) {
        logger.error(
            `Failed to write metadata to ${req.body?.filePath}: ${(error as Error).message}`,
            'LIBRARY'
        );
        res.status(500).json({ error: (error as Error).message });
    }
});

router.delete('/file', async (req: Request, res: Response) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            res.status(400).json({ error: 'filePath is required' });
            return;
        }

        if (!isPathWithinManagedRoots(filePath)) {
            logger.warn(`Refused delete outside the library: ${filePath}`, 'LIBRARY');
            res.status(403).json({ error: 'Path is outside the library directory' });
            return;
        }

        const success = await libraryScannerService.deleteFile(filePath);
        res.json({ success });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/database/stats', async (req: Request, res: Response) => {
    try {
        res.json(databaseService.getOverallStats());
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/database/tracks', async (req: Request, res: Response) => {
    try {
        const limit = getPageParam(req.query.limit, 100, MAX_PAGE_SIZE);
        const offset = getPageParam(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
        res.json(databaseService.getAllTracks(limit, offset));
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/database/albums', async (req: Request, res: Response) => {
    try {
        const limit = getPageParam(req.query.limit, 50, MAX_PAGE_SIZE);
        const offset = getPageParam(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
        res.json(databaseService.getAllAlbums(limit, offset));
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
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
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
