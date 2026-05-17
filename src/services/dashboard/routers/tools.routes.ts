import { Router, Request, Response } from 'express';
import qobuzApi from '../../../api/qobuz.js';
import path from 'path';
import axios from 'axios';
import { logger } from '../../../utils/logger.js';
import { CONFIG } from '../../../config.js';

const router = Router();
const api = qobuzApi;

router.post('/identify', async (req: Request, res: Response) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'filePath is required' });

        const filename = path.basename(filePath as string, path.extname(filePath as string));
        const parts = (filePath as string).split(path.sep);
        
        // Extract context from folder structure (e.g., downloads/Artist/Album/File)
        const artistFromFolder = parts.length >= 3 ? parts[parts.length - 3] : '';
        const _albumFromFolder = parts.length >= 2 ? parts[parts.length - 2] : '';

        // Improved cleaning: remove track numbers like "01. ", "01 - ", "01 ", etc.
        const cleanFilename = filename
            .replace(/^(\d+[.\s-]*)+/g, '') // Remove track numbers at start
            .replace(/\(.*?\)|\[.*?\]/g, '') // Remove (Explicit), [FLAC]
            .trim();

        // Build a strong query: "Artist - Title"
        let query = cleanFilename;
        if (artistFromFolder && artistFromFolder !== 'downloads') {
            query = `${artistFromFolder} - ${cleanFilename}`;
        } else {
            // If no artist folder, try to split filename if it's "Artist - Title"
            if (cleanFilename.includes(' - ')) {
                query = cleanFilename;
            }
        }

        logger.debug(`Identifying: "${query}" (Original: ${filename})`, 'TOOLS');

        const result = await api.search(query, 'tracks', 5);
        if (result.success && result.data?.tracks?.items?.length) {
            const track = result.data.tracks.items[0];
            
            // Intelligence Boost: Fetch full album to get Genre, Label, and accurate Year
            if (track.album?.id) {
                const albumRes = await api.getAlbum(track.album.id);
                if (albumRes.success) {
                    track.album = albumRes.data;
                }
            }

            // Intelligence Boost: Try to fetch high-quality lyrics from LRCLIB/Genius
            try {
                const { default: LyricsProvider } = await import('../../../api/lyrics.js');
                const lyricsProvider = new LyricsProvider();
                const lyricsRes = await lyricsProvider.getLyrics(
                    track.title,
                    track.performer?.name || track.artist?.name || 'Unknown',
                    track.album?.title || '',
                    track.duration
                );
                if (lyricsRes.success) {
                    Object.assign(track, { lyrics: lyricsRes });
                }
            } catch {
                // Ignore lyrics errors
            }

            res.json({ success: true, data: track });
        } else {
            res.status(404).json({ error: 'No match found' });
        }
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/apply-metadata', async (req: Request, res: Response) => {
    try {
        const { filePath, metadata } = req.body;
        if (!filePath || !metadata) {
            return res.status(400).json({ error: 'filePath and metadata are required' });
        }

        const { default: MetadataService } = await import('../../metadata.js');
        const metadataService = new MetadataService();

        // Use the centralized extraction logic for perfect consistency
        const targetMeta = await metadataService.extractMetadata(
            metadata as any,
            (metadata as any).album || {}
        );
        
        let coverBuffer: Buffer | null = null;
        const coverCandidates = metadataService.getCoverUrlCandidates(
            ((metadata as any).album)?.image || (metadata as any).image || {} as any,
            CONFIG.metadata.coverSize,
            typeof (metadata as Record<string, unknown>).image === 'string'
                ? ((metadata as Record<string, unknown>).image as string)
                : ((metadata as Record<string, unknown>).coverUrl as string)
        );

        for (const imageUrl of coverCandidates) {
            try {
                const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000
                });
                coverBuffer = Buffer.from(response.data);
                break;
            } catch (e: unknown) {
                logger.debug(`Cover candidate failed for heal (${imageUrl}): ${(e as Error).message}`, 'TOOLS');
            }
        }

        if (!coverBuffer && coverCandidates.length > 0) {
            logger.warn('Failed to fetch cover art for heal from all candidates', 'TOOLS');
        }

        // Pass lyrics if found
        const lyrics = (metadata as Record<string, unknown>).lyrics || null;

        await metadataService.writeMetadata(filePath as string, targetMeta as any, 0, lyrics as any, coverBuffer);
        res.json({ success: true });
    } catch (error: unknown) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
