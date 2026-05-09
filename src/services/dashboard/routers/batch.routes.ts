import { Router, Request, Response } from 'express';
import { downloadQueue } from '../../queue/queue.js';
import QobuzAPI from '../../../api/qobuz.js';
import { logger } from '../../../utils/logger.js';
import { CONFIG } from '../../../config.js';

const router = Router();
const api = new QobuzAPI();

router.post('/import/direct', async (req: Request, res: Response) => {
    try {
        const { urls, quality, createZip } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        const q = quality || CONFIG.quality.default || 27;
        let imported = 0;
        let failed = 0;

        for (const url of urls) {
            try {
                // Extract type and ID from Qobuz URL
                // Format: https://open.qobuz.com/album/xzy123 or https://www.qobuz.com/ie-en/album/name/id
                const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
                const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
                const artistMatch = url.match(/artist\/([a-zA-Z0-9]+)/);
                const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);

                if (trackMatch) {
                    downloadQueue.add('track', trackMatch[1], q);
                    imported++;
                } else if (albumMatch) {
                    downloadQueue.add('album', albumMatch[1], q);
                    imported++;
                } else if (artistMatch) {
                    downloadQueue.add('artist', artistMatch[1], q);
                    imported++;
                } else if (playlistMatch) {
                    downloadQueue.add('playlist', playlistMatch[1], q);
                    imported++;
                } else {
                    failed++;
                    logger.warn(`Failed to parse URL for batch import: ${url}`, 'BATCH');
                }
            } catch (err) {
                failed++;
                logger.error(`Error importing URL ${url}: ${err}`, 'BATCH');
            }
        }

        res.json({ 
            success: imported > 0, 
            imported, 
            failed,
            message: `Processed ${urls.length} URLs. ${imported} added to queue.`
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
