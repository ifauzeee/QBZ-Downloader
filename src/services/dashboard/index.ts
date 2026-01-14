import express, { Express } from 'express';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';
import { downloadQueue } from '../telegram/queue.js';
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
        this.app.use(express.json());

        this.app.use((req, res, next) => {
            const password = CONFIG.dashboard.password;
            if (!password) return next();

            const isProtected = req.path.startsWith('/api') || req.path.startsWith('/downloads');
            if (!isProtected) return next();

            const providedPassword = req.headers['x-password'] || req.query.pw;
            if (providedPassword === password) {
                return next();
            }

            res.status(401).json({ error: 'Unauthorized: Dashboard password required' });
        });

        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use('/downloads', express.static(path.resolve(process.cwd(), 'downloads')));
    }

    private setupRoutes(): void {
        registerRoutes(this.app);
    }

    private setupSocket(): void {
        this.io.use((socket, next) => {
            const password = CONFIG.dashboard.password;
            if (!password) return next();

            const providedPassword = socket.handshake.auth?.password || socket.handshake.query?.pw;
            if (providedPassword === password) {
                return next();
            }

            next(new Error('Authentication failed'));
        });

        this.io.on('connection', (socket) => {
            logger.debug(`Dashboard: Client connected (${socket.id})`);

            socket.emit('queue:update', downloadQueue.getStats());

            socket.on('disconnect', () => {
                logger.debug(`Dashboard: Client disconnected (${socket.id})`);
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
        downloadQueue.on('item:progress', (item, progress) => {
            this.io.emit('item:progress', {
                id: item.id,
                progress,
                title: item.title,
                speed: item.progress
            });
        });
    }

    public start(port?: number): void {
        if (port) this.port = port;
        try {
            dashboardCleaner.start();
            this.httpServer.listen(this.port, () => {
                logger.success(`Web Dashboard running at http://localhost:${this.port}`);
                if (CONFIG.dashboard.password) {
                    logger.info('Dashboard is protected by password');
                }
            });
        } catch (error) {
            logger.error(`Failed to start dashboard: ${error}`);
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
