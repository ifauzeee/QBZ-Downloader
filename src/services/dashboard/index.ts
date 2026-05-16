import express, { Express, Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import { Server as HttpServer, createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { rateLimit } from 'express-rate-limit';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';
import { downloadQueue } from '../queue/queue.js';
import { registerRoutes } from './routes.js';
import { CONFIG } from '../../config.js';
import { libraryScannerService } from '../library-scanner/index.js';
import { notificationService } from '../notifications.js';
import { tokenManager } from '../../utils/token.js';
import { printBox } from '../../utils/ui.js';

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
        const allowedOrigins = ['http://localhost:' + this.port, 'http://127.0.0.1:' + this.port];
        
        this.io = new SocketServer(this.httpServer, {
            transports: ['websocket', 'polling'],
            allowEIO3: true
        });


        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocket();
    }

    private setupMiddleware(): void {
        this.app.use((_req: Request, res: Response, next: NextFunction) => {
            res.setHeader(
                'Content-Security-Policy',
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "img-src 'self' data: https: http: blob:; " +
                "media-src 'self' data: blob: https: http:; " +
                "connect-src 'self' ws://localhost:* http://localhost:* wss://*.qobuz.com https://*.qobuz.com https://www.qobuz.com; " +
                "font-src 'self' data: https: https://fonts.gstatic.com;"
            );
            next();
        });
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));


        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Limit each IP to 1000 requests per windowMs
            message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
            standardHeaders: true,
            legacyHeaders: false,
        });

        this.app.use('/api', limiter);


        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const password = CONFIG.dashboard.password;
            const isDesktop = process.env.QBZ_DESKTOP === '1';
            
            // Bypass password protection entirely in Desktop mode
            if (!password || isDesktop) return next();

            const excludedRoutes = [
                '/api/status',
                '/api/themes',
                '/api/onboarding',
                '/api/stream/',
                '/api/preview/'
            ];

            const isExcluded = excludedRoutes.some((route) => req.path.startsWith(route));
            if (isExcluded) return next();

            const isProtected = req.path.startsWith('/api') || req.path.startsWith('/downloads');
            if (!isProtected) return next();

            const providedPassword = req.headers['x-password'] || req.query.pw;

            if (providedPassword && typeof providedPassword === 'string' && password) {
                try {
                    // Check plaintext
                    const isPlainMatch = providedPassword.length === password.length && 
                                       crypto.timingSafeEqual(Buffer.from(providedPassword), Buffer.from(password));
                    
                    if (isPlainMatch) return next();

                    // Check SHA-256 hash (64 chars)
                    if (providedPassword.length === 64) {
                        const expectedHash = crypto.createHash('sha256').update(password).digest('hex');
                        if (crypto.timingSafeEqual(Buffer.from(providedPassword), Buffer.from(expectedHash))) {
                            return next();
                        }
                    }
                } catch (err) {
                    logger.error(`Auth check error: ${err}`, 'AUTH');
                }
            }

            res.status(401).json({ error: 'Unauthorized: Dashboard password required' });
        });

        this.app.use(express.static(path.join(__dirname, 'public')));

        let activeDownloadsDir = '';
        let activeDownloadsStatic: any = null;
        this.app.use('/downloads', (req: Request, res: Response, next: NextFunction) => {
            const currentDownloadsDir = path.resolve(CONFIG.download.outputDir || './downloads');
            if (!activeDownloadsStatic || activeDownloadsDir !== currentDownloadsDir) {
                activeDownloadsDir = currentDownloadsDir;
                activeDownloadsStatic = express.static(activeDownloadsDir);
                logger.info(`Downloads route updated: ${activeDownloadsDir}`, 'WEB');
            }

            return activeDownloadsStatic(req, res, next);
        });
    }

    private setupRoutes(): void {
        registerRoutes(this.app);

        this.app.get(/.*/, (req: Request, res: Response) => {
            const isProtected = req.path.startsWith('/api') || req.path.startsWith('/downloads');
            if (isProtected) {
                return res.status(404).json({ error: 'Endpoint not found' });
            }
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });
    }

    private setupSocket(): void {
        this.io.use((socket, next) => {
            const password = CONFIG.dashboard.password;
            const isDesktop = process.env.QBZ_DESKTOP === '1';

            // Bypass password protection entirely in Desktop mode
            if (!password || isDesktop) return next();

            const providedPassword = socket.handshake.auth?.password || socket.handshake.query?.pw;

            if (providedPassword && typeof providedPassword === 'string' && password) {
                try {
                    const isPlainMatch = providedPassword.length === password.length && 
                                       crypto.timingSafeEqual(Buffer.from(providedPassword), Buffer.from(password));
                    if (isPlainMatch) return next();

                    if (providedPassword.length === 64) {
                        const expectedHash = crypto.createHash('sha256').update(password).digest('hex');
                        if (crypto.timingSafeEqual(Buffer.from(providedPassword), Buffer.from(expectedHash))) {
                            return next();
                        }
                    }
                } catch {
                    return next(new Error('Internal authentication error'));
                }
            }

            next(new Error('Authentication failed'));
        });

        this.io.on('connection', (socket) => {
            logger.debug(`Client connection established: ${socket.id}`, 'WEB');
            
            socket.emit('notifications:history', notificationService.getRecent(50));
            socket.emit('notifications:unreadCount', notificationService.getUnreadCount());

            socket.emit('queue:update', downloadQueue.getStats());

            socket.on('disconnect', () => {
                logger.debug(`Client disconnected: ${socket.id}`, 'WEB');
            });
        });

        this.startBroadcasting();

        logger.setBroadcastCallback((log) => {
            this.io.emit('log:new', log);
        });
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

        libraryScannerService.on('scan:progress', (progress) => {
            this.io.emit('scan:progress', progress);
        });

        libraryScannerService.on('scan:complete', (result) => {
            this.io.emit('scan:complete', result);
        });

        libraryScannerService.on('scan:started', (data) => {
            this.io.emit('scan:started', data);
        });

        notificationService.on('notification', (notif) => {
            this.io.emit('notification:new', notif);
            this.io.emit('notifications:unreadCount', notificationService.getUnreadCount());
        });

        notificationService.on('notification:read', () => {
            this.io.emit('notifications:unreadCount', notificationService.getUnreadCount());
        });

        notificationService.on('notifications:allRead', () => {
            this.io.emit('notifications:unreadCount', 0);
        });

        notificationService.on('notifications:cleared', () => {
            this.io.emit('notifications:unreadCount', 0);
        });
        
        tokenManager.on('token:invalid', () => {
            this.io.emit('auth:token-invalid');
            notificationService.error(
                'Authentication Failed',
                'Your Qobuz token is invalid or expired. Please update it in Settings.',
                { source: 'QOBUZ' }
            );
        });
    }

    public start(port?: number): void {
        if (port) this.port = port;
        const host = CONFIG.dashboard.host || '127.0.0.1';
        try {
            this.httpServer.listen(this.port, host, async () => {

                try {
                    const message = `
${chalk.bold.green('Dashboard Active')}

Local:   ${chalk.cyan(`http://localhost:${this.port}`)}
Status:  ${chalk.green('Running')}
Mode:    ${CONFIG.dashboard.password ? chalk.red('Protected') : chalk.yellow('Public')}
`;
                    printBox(message, 'Server Info', 'success');
                } catch {
                    logger.success(
                        `Web Interface available at http://localhost:${this.port}`,
                        'WEB'
                    );
                }

                if (CONFIG.dashboard.password) {
                    logger.info('Access Control: Password protection enabled.', 'WEB');
                } else {
                    logger.warn('Access Control: Password protection disabled (Public)', 'WEB');
                    logger.warn('Dashboard password not set — access is unrestricted!', 'SECURITY');
                }
            });
        } catch (error) {
            logger.error(`Failed to initialize dashboard service: ${error}`, 'WEB');
        }
    }

    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.httpServer.close();
    }
}

export const dashboardService = new DashboardService();
