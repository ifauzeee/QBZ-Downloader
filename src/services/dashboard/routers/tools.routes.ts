import { Router, Request, Response } from 'express';
import QobuzAPI from '../../../api/qobuz.js';
import path from 'path';
import axios from 'axios';
import { logger } from '../../../utils/logger.js';
import { CONFIG } from '../../../config.js';

const router = Router();
const api = new QobuzAPI();

router.post('/identify', async (req: Request, res: Response) => {
    try {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'filePath is required' });

        const filename = path.basename(filePath, path.extname(filePath));
        const parts = filePath.split(path.sep);
        
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
                    (track as any).lyrics = lyricsRes; // Use any to bypass strict Track.lyrics typing
                }
            } catch {
                // Ignore lyrics errors
            }

            res.json({ success: true, data: track });
        } else {
            res.status(404).json({ error: 'No match found' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
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
        const targetMeta = await metadataService.extractMetadata(metadata, metadata.album || {});
        
        let coverBuffer: Buffer | null = null;
        const coverCandidates = metadataService.getCoverUrlCandidates(
            metadata.album?.image || metadata.image || {},
            CONFIG.metadata.coverSize,
            typeof metadata.image === 'string' ? metadata.image : metadata.coverUrl
        );

        for (const imageUrl of coverCandidates) {
            try {
                const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000
                });
                coverBuffer = Buffer.from(response.data);
                break;
            } catch (e: any) {
                logger.debug(`Cover candidate failed for heal (${imageUrl}): ${e.message}`, 'TOOLS');
            }
        }

        if (!coverBuffer && coverCandidates.length > 0) {
            logger.warn('Failed to fetch cover art for heal from all candidates', 'TOOLS');
        }

        // Pass lyrics if found
        const lyrics = metadata.lyrics || null;

        await metadataService.writeMetadata(filePath, targetMeta, 0, lyrics, coverBuffer);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
