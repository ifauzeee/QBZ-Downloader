import { Router, Request, Response } from 'express';
import { advancedAnalyticsService } from '../../analytics/index.js';

const router = Router();

router.get('/analytics/dashboard', (_req: Request, res: Response) => {
    try {
        const dashboard = advancedAnalyticsService.getDashboard();
        res.json(dashboard);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
