import { Router, Request, Response } from 'express';
import { downloadQueue } from '../../queue/queue.js';
import QobuzAPI from '../../../api/qobuz.js';
import { logger } from '../../../utils/logger.js';
import { CONFIG, normalizeDownloadQuality } from '../../../config.js';

const router = Router();
const api = new QobuzAPI();

router.post('/import/direct', async (req: Request, res: Response) => {
    try {
        const { urls, quality, createZip } = req.body;
        
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'URLs array is required' });
        }

        const q = normalizeDownloadQuality(quality, CONFIG.quality.default);
        
        const { batchImportService } = await import('../../batch.js');
        const result = await batchImportService.importUrls(urls, q, !!createZip);

        res.json({ 
            success: result.imported > 0, 
            imported: result.imported, 
            failed: result.failed,
            message: `Processed ${urls.length} URLs. ${result.imported} added to queue.`
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
