import crypto from 'crypto';
import { z } from 'zod';
import { settingsService } from './settings.js';
import { databaseService } from './database/index.js';
import { downloadQueue } from './queue/queue.js';

const BACKUP_FORMAT = 'qbz-config-backup';
const BACKUP_VERSION = 1;
const KDF_ITERATIONS = 210_000;

const encryptedBackupSchema = z.object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_VERSION),
    kdf: z.literal('pbkdf2-sha256'),
    iterations: z.number().int().positive(),
    salt: z.string().min(1),
    iv: z.string().min(1),
    tag: z.string().min(1),
    ciphertext: z.string().min(1)
});

const backupPayloadSchema = z.object({
    version: z.literal(BACKUP_VERSION),
    exportedAt: z.string(),
    data: z.object({
        settings: z.record(z.string(), z.string()),
        watchedPlaylists: z.array(z.record(z.string(), z.unknown())),
        queue: z.array(z.record(z.string(), z.unknown()))
    })
});

export type EncryptedConfigBackup = z.infer<typeof encryptedBackupSchema>;

export interface ConfigImportResult {
    settings: number;
    watchedPlaylists: number;
    queueItems: number;
}

export class ConfigBackupService {
    exportEncrypted(passphrase: string): EncryptedConfigBackup {
        this.assertPassphrase(passphrase);

        const payload = {
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            data: {
                settings: settingsService.getAll(),
                watchedPlaylists: databaseService.getWatchedPlaylists(),
                queue: databaseService.getQueueItems()
            }
        };

        return this.encryptPayload(payload, passphrase);
    }

    async importEncrypted(
        backup: unknown,
        passphrase: string,
        mode: 'merge' | 'replace' = 'merge'
    ): Promise<ConfigImportResult> {
        this.assertPassphrase(passphrase);
        const payload = backupPayloadSchema.parse(this.decryptPayload(backup, passphrase));
        const { settings, watchedPlaylists, queue } = payload.data;

        if (mode === 'replace') {
            databaseService.clearWatchedPlaylists();
            downloadQueue.clear();
            databaseService.clearQueueItems();
        }

        settingsService.setMany(settings);

        for (const playlist of watchedPlaylists) {
            databaseService.upsertWatchedPlaylist({
                id: String(playlist.id || crypto.randomUUID()),
                playlistId: String(playlist.playlist_id || playlist.playlistId || ''),
                title:
                    playlist.title === undefined || playlist.title === null
                        ? undefined
                        : String(playlist.title),
                quality: this.toNumber(playlist.quality, 27),
                intervalHours: this.toNumber(playlist.interval_hours ?? playlist.intervalHours, 24),
                lastSyncedAt:
                    playlist.last_synced_at === undefined && playlist.lastSyncedAt === undefined
                        ? null
                        : String(playlist.last_synced_at || playlist.lastSyncedAt || ''),
                createdAt:
                    playlist.created_at === undefined && playlist.createdAt === undefined
                        ? undefined
                        : String(playlist.created_at || playlist.createdAt)
            });
        }

        for (const item of queue) {
            databaseService.addQueueItem({
                id: String(item.id || crypto.randomUUID()),
                type: String(item.type || 'track'),
                contentId: String(item.contentId || item.content_id || ''),
                quality: this.toNumber(item.quality, 27),
                status: String(item.status || 'pending'),
                priority: String(item.priority || 'normal'),
                progress: this.toNumber(item.progress, 0),
                title: item.title === undefined ? undefined : String(item.title),
                artist: item.artist ?? null,
                album: item.album ?? null,
                error: item.error === undefined || item.error === null ? null : String(item.error),
                filePath:
                    item.filePath === undefined && item.file_path === undefined
                        ? null
                        : String(item.filePath || item.file_path || ''),
                addedAt: this.toDate(item.addedAt || item.added_at) || new Date(),
                startedAt: this.toDate(item.startedAt || item.started_at),
                completedAt: this.toDate(item.completedAt || item.completed_at),
                retryCount: this.toNumber(item.retryCount ?? item.retry_count, 0),
                maxRetries: this.toNumber(item.maxRetries ?? item.max_retries, 3),
                metadata: item.metadata ?? null
            });
        }

        await downloadQueue.load();

        return {
            settings: Object.keys(settings).length,
            watchedPlaylists: watchedPlaylists.length,
            queueItems: queue.length
        };
    }

    private assertPassphrase(passphrase: string): void {
        if (!passphrase || passphrase.length < 8) {
            throw new Error('Backup passphrase must be at least 8 characters long');
        }
    }

    private encryptPayload(payload: unknown, passphrase: string): EncryptedConfigBackup {
        const salt = crypto.randomBytes(16);
        const iv = crypto.randomBytes(12);
        const key = crypto.pbkdf2Sync(passphrase, salt, KDF_ITERATIONS, 32, 'sha256');
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const plaintext = JSON.stringify(payload);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            kdf: 'pbkdf2-sha256',
            iterations: KDF_ITERATIONS,
            salt: salt.toString('base64'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
            ciphertext: ciphertext.toString('base64')
        };
    }

    private decryptPayload(backup: unknown, passphrase: string): unknown {
        const parsed = encryptedBackupSchema.parse(backup);
        const salt = Buffer.from(parsed.salt, 'base64');
        const iv = Buffer.from(parsed.iv, 'base64');
        const tag = Buffer.from(parsed.tag, 'base64');
        const ciphertext = Buffer.from(parsed.ciphertext, 'base64');
        const key = crypto.pbkdf2Sync(passphrase, salt, parsed.iterations, 32, 'sha256');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
            'utf8'
        );
        return JSON.parse(plaintext);
    }

    private toNumber(value: unknown, fallback: number): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private toDate(value: unknown): Date | null {
        if (!value) return null;
        const date = new Date(String(value));
        return Number.isNaN(date.getTime()) ? null : date;
    }
}

export const configBackupService = new ConfigBackupService();
