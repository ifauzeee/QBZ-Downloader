import { Express } from 'express';
import systemRouter from './routers/system.routes.js';
import catalogRouter from './routers/catalog.routes.js';
import downloadRouter from './routers/download.routes.js';
import libraryRouter from './routers/library.routes.js';
import analyticsRouter from './routers/analytics.routes.js';
import notificationsRouter from './routers/notifications.routes.js';

export function registerRoutes(app: Express) {
    app.use('/api', systemRouter);
    app.use('/api', catalogRouter);
    app.use('/api', downloadRouter);
    app.use('/api', analyticsRouter);
    app.use('/api/library', libraryRouter);
    app.use('/api/notifications', notificationsRouter);
}


