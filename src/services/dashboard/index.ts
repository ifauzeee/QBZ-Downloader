import express, { Express, Request, Response, NextFunction } from 'express';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';
import { downloadQueue } from '../queue/queue.js';
import { registerRoutes } from './routes.js';
import { CONFIG } from '../../config.js';
import { dashboardCleaner } from './cleaner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DashboardConfig {
    port: number;
    enabled: boolean;
}

export class DashboardService {
    private app: Express;
    private httpServer: HttpServer;
    private io: SocketServer;
    private port: number;
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(port: number = CONFIG.dashboard.port || 3000) {
        this.port = port;
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new SocketServer(this.httpServer, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST']
            }
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
    }

    private setupMiddleware(): void {
        this.app.use(cors());
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many requests'
        });

        this.app.use('/api', limiter);
        this.app.use(express.json());

        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const password = CONFIG.dashboard.password;
            if (!password) return next();

            const isProtected = req.path.startsWith('/api') || req.path.startsWith('/downloads');
            if (!isProtected) return next();

            const providedPassword = req.headers['x-password'] || req.query.pw;

            if (
                providedPassword &&
                typeof providedPassword === 'string' &&
                password &&
                providedPassword.length === password.length
            ) {
                const a = Buffer.from(providedPassword);
                const b = Buffer.from(password);
                if (crypto.timingSafeEqual(a, b)) {
                    return next();
                }
            }

            res.status(401).json({ error: 'Unauthorized: Dashboard password required' });
        });

        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use('/downloads', express.static(path.resolve(CONFIG.download.outputDir)));
    }

    private setupRoutes(): void {
        registerRoutes(this.app);
    }

    private setupSocket(): void {
        this.io.use((socket, next) => {
            const password = CONFIG.dashboard.password;
            if (!password) return next();

            const providedPassword = socket.handshake.auth?.password || socket.handshake.query?.pw;

            if (
                providedPassword &&
                typeof providedPassword === 'string' &&
                password &&
                providedPassword.length === password.length
            ) {
                const a = Buffer.from(providedPassword);
                const b = Buffer.from(password);
                if (crypto.timingSafeEqual(a, b)) {
                    return next();
                }
            }

            next(new Error('Authentication failed'));
        });

        this.io.on('connection', (socket) => {
            logger.debug(`Client connection established: ${socket.id}`, 'WEB');

            socket.emit('queue:update', downloadQueue.getStats());

            socket.on('disconnect', () => {
                logger.debug(`Client disconnected: ${socket.id}`, 'WEB');
            });
        });

        this.startBroadcasting();
    }

    private startBroadcasting(): void {
        this.checkInterval = setInterval(() => {
            const stats = downloadQueue.getStats();
            this.io.emit('queue:stats', stats);
        }, 1000);

        downloadQueue.on('item:added', (item) => this.io.emit('item:added', item));
        downloadQueue.on('item:completed', (item) => this.io.emit('item:completed', item));
        downloadQueue.on('item:failed', (item, error) =>
            this.io.emit('item:failed', { item, error })
        );
        downloadQueue.on('item:progress', (item, _progress) => {
            this.io.emit('item:progress', {
                id: item.id,
                progress: item.progress,
                title: item.title,
                quality: item.quality,
                status: item.status,
                artist: item.artist,
                album: item.album,
                speed: 0
            });
        });
    }

    public start(port?: number): void {
        if (port) this.port = port;
        try {
            dashboardCleaner.start();
            this.httpServer.listen(this.port, () => {
                logger.success(`Web Interface available at http://localhost:${this.port}`, 'WEB');
                if (CONFIG.dashboard.password) {
                    logger.info('Access Control: Password protection enabled.', 'WEB');
                } else {
                    logger.warn('Access Control: Password protection disabled (Public)', 'WEB');
                }
            });
        } catch (error) {
            logger.error(`Failed to initialize dashboard service: ${error}`, 'WEB');
        }
    }

    public stop(): void {
        dashboardCleaner.stop();
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.httpServer.close();
    }
}

export const dashboardService = new DashboardService();
