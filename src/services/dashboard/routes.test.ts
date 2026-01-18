import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

vi.mock('../queue/queue.js', () => {
    return {
        downloadQueue: {
            getStats: () => ({
                pending: 2,
                downloading: 1,
                completed: 5,
                failed: 0,
                total: 8
            }),
            getItems: () => [
                { id: '1', type: 'track', status: 'pending', title: 'Test Track' },
                { id: '2', type: 'album', status: 'downloading', title: 'Test Album' }
            ],
            add: (_type: string, _id: string, _quality: number, opts: any) => ({
                id: 'new-id',
                type: _type,
                contentId: _id,
                quality: _quality,
                status: 'pending',
                title: opts?.title || 'New Item'
            }),
            getAll: () => [
                { id: '1', type: 'track', status: 'pending', title: 'Test Track' },
                { id: '2', type: 'album', status: 'downloading', title: 'Test Album' }
            ],
            pause: vi.fn(),
            resume: vi.fn(),
            clear: vi.fn(),
            cancel: vi.fn().mockReturnValue(true),
            remove: vi.fn().mockReturnValue(true),
            clearCompleted: vi.fn().mockReturnValue(1)
        }
    };
});

vi.mock('../history.js', () => {
    return {
        historyService: {
            getAll: () => ({
                '123': {
                    title: 'Downloaded Track',
                    quality: 27,
                    filename: '/path/to/file.flac',
                    downloadedAt: '2024-01-01T00:00:00Z'
                }
            }),
            get: (id: string) => {
                if (id === '123') {
                    return {
                        title: 'Downloaded Track',
                        quality: 27,
                        filename: '/path/to/file.flac',
                        downloadedAt: '2024-01-01T00:00:00Z'
                    };
                }
                return undefined;
            },
            clearAll: vi.fn()
        }
    };
});

vi.mock('../../utils/validator.js', () => {
    return {
        inputValidator: {
            validateUrl: (url: string) => {
                if (url?.includes('qobuz.com/album')) {
                    return { valid: true, type: 'album', id: '12345' };
                }
                if (url?.includes('qobuz.com/track')) {
                    return { valid: true, type: 'track', id: '67890' };
                }
                return { valid: false, error: 'Invalid URL' };
            }
        }
    };
});

vi.mock('../../api/qobuz.js', () => {
    return {
        default: class MockQobuzAPI {
            getTrack() {
                return Promise.resolve({
                    success: true,
                    data: { id: '67890', title: 'Test Track', performer: { name: 'Artist' } }
                });
            }
            getAlbum() {
                return Promise.resolve({
                    success: true,
                    data: { id: '12345', title: 'Test Album', artist: { name: 'Artist' } }
                });
            }
            search() {
                return Promise.resolve({
                    success: true,
                    data: { albums: { items: [{ id: '1', title: 'Album 1' }] } }
                });
            }
            getArtist() {
                return Promise.resolve({
                    success: true,
                    data: { id: '1', name: 'Artist', albums: { items: [] } }
                });
            }
            getUserInfo() {
                return Promise.resolve({
                    success: true,
                    data: { id: '12345', subscription: { offer: 'Studio' } }
                });
            }
        }
    };
});

vi.mock('../database/index.js', () => ({
    databaseService: {
        resetStatistics: vi.fn(),
        addTrack: vi.fn(),
        addLibraryFile: vi.fn(),
        getAlbum: vi.fn().mockReturnValue(null),
        hasTrack: vi.fn().mockReturnValue(false)
    }
}));

vi.mock('../../constants.js', () => ({
    APP_VERSION: '2.0.0'
}));

vi.mock('../../config.js', () => ({
    CONFIG: {
        credentials: {
            appId: 'test-app-id',
            appSecret: 'test-secret',
            token: 'test-token',
            userId: '12345'
        },
        download: {
            outputDir: './downloads',
            folderStructure: '{artist}/{album}',
            fileNaming: '{track_number}. {title}',
            concurrent: 2
        },
        dashboard: {
            port: 3000,
            password: ''
        }
    }
}));

import { registerRoutes } from './routes.js';

describe('Dashboard API Routes', () => {
    let app: Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        registerRoutes(app);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/status', () => {
        it('should return online status and version', async () => {
            const res = await request(app).get('/api/status');

            expect(res.status).toBe(200);
            expect(res.body.online).toBe(true);
            expect(res.body.version).toBe('2.0.0');
            expect(res.body.stats).toBeDefined();
        });
    });

    describe('GET /api/credentials/status', () => {
        it('should return credentials configuration status', async () => {
            const res = await request(app).get('/api/credentials/status');

            expect(res.status).toBe(200);
            expect(res.body.allConfigured).toBe(true);
            expect(res.body.configured.appId).toBe(true);
        });
    });

    describe('GET /api/onboarding', () => {
        it('should return onboarding status', async () => {
            const res = await request(app).get('/api/onboarding');

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.steps).toBeInstanceOf(Array);
        });
    });

    describe('GET /api/queue', () => {
        it('should return queue items', async () => {
            const res = await request(app).get('/api/queue');

            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBe(2);
        });
    });

    describe('GET /api/settings', () => {
        it('should return masked settings', async () => {
            const res = await request(app).get('/api/settings');

            expect(res.status).toBe(200);
            expect(res.body.QOBUZ_APP_ID).toBe('test-app-id');
            expect(res.body.QOBUZ_APP_SECRET).toContain('••••');
            expect(res.body.DOWNLOADS_PATH).toBe('./downloads');
        });
    });

    describe('POST /api/queue/add', () => {
        it('should add album to queue with valid URL', async () => {
            const res = await request(app)
                .post('/api/queue/add')
                .send({ type: 'album', id: '12345', quality: 27 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBeUndefined();
            expect(res.body.id).toBe('new-id');
        });

        it('should return error for invalid payload', async () => {
            const res = await request(app).post('/api/queue/add').send({ quality: 27 });

            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });

    describe('POST /api/queue/action', () => {
        it('should handle pause action', async () => {
            const res = await request(app).post('/api/queue/action').send({ action: 'pause' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should handle resume action', async () => {
            const res = await request(app).post('/api/queue/action').send({ action: 'resume' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should reject invalid action', async () => {
            const res = await request(app).post('/api/queue/action').send({ action: 'invalid' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/item/:id/:action', () => {
        it('should cancel/remove item', async () => {
            const res = await request(app).post('/api/item/test-id/cancel');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/history', () => {
        it('should return download history', async () => {
            const res = await request(app).get('/api/history');

            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body[0].id).toBe('123');
        });
    });

    describe('POST /api/history/clear', () => {
        it('should clear history', async () => {
            const res = await request(app).post('/api/history/clear');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/search', () => {
        it('should search with query', async () => {
            const res = await request(app)
                .get('/api/search')
                .query({ query: 'test', type: 'albums' });

            expect(res.status).toBe(200);
            expect(res.body.albums).toBeDefined();
        });

        it('should return error without query', async () => {
            const res = await request(app).get('/api/search');

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Query');
        });
    });

    describe('GET /api/album/:id', () => {
        it('should return album info', async () => {
            const res = await request(app).get('/api/album/12345');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('12345');
        });
    });

    describe('GET /api/artist/:id', () => {
        it('should return artist info', async () => {
            const res = await request(app).get('/api/artist/1');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('1');
        });
    });

    describe('GET /api/download/:id', () => {
        it('should return 404 for unknown id', async () => {
            const res = await request(app).get('/api/download/unknown-id');

            expect(res.status).toBe(404);
        });
    });
});
