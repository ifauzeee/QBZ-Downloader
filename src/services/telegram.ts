import { Telegraf } from 'telegraf';
import { CONFIG } from '../config.js';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import DownloadService from './download.js';
import { getQualityName } from '../config.js';
import fs from 'fs';
import path from 'path';

const resolveQuality = (quality: number | 'ask' | 'min' | 'max'): number => {
    if (typeof quality === 'number') return quality;
    if (quality === 'min') return 5;
    return 27;
};

export class TelegramService {
    private bot: Telegraf | null = null;
    private chatId: string | null = null;
    private enabled: boolean = false;
    private uploadEnabled: boolean = true;
    private api: QobuzAPI;
    private downloadService: DownloadService;
    private lastProgressUpdate: number = 0;

    constructor() {
        const token = CONFIG.telegram.token;
        const chatId = CONFIG.telegram.chatId;
        this.uploadEnabled = CONFIG.telegram.uploadFiles ?? true;

        this.api = new QobuzAPI();
        this.downloadService = new DownloadService();

        if (token && chatId) {
            try {
                this.bot = new Telegraf(token);
                this.chatId = chatId;
                this.enabled = true;
            } catch (error) {
                console.warn(chalk.yellow('⚠️  Failed to initialize Telegram bot:'), error);
                this.enabled = false;
            }
        }
    }

    private formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private deleteEmptyDirs(dir: string) {
        if (!dir || dir === CONFIG.download.outputDir) return;
        try {
            const files = fs.readdirSync(dir);
            if (files.length === 0) {
                fs.rmdirSync(dir);
                this.deleteEmptyDirs(path.dirname(dir));
            }
        } catch { }
    }

    async sendMessage(message: string) {
        if (!this.enabled || !this.bot || !this.chatId) return;

        try {
            await this.bot.telegram.sendMessage(this.chatId, message, {
                parse_mode: 'HTML'
            });
        } catch { }
    }

    async uploadFile(filePath: string, caption?: string) {
        if (!this.enabled || !this.bot || !this.chatId || !this.uploadEnabled) return;

        try {
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            const sizeInMB = fileSizeInBytes / (1024 * 1024);

            if (sizeInMB > 49) {
                await this.sendMessage(
                    '⚠️ <b>File > 50MB (Telegram Limit)</b>\n' +
                    `📄 <code>${path.basename(filePath)}</code> (${this.formatSize(fileSizeInBytes)})\n` +
                    '<i>Saved on server. Cannot auto-delete.</i>'
                );
                return;
            }

            console.log(chalk.cyan(`    📤 Uploading to Telegram: ${path.basename(filePath)}`));
            await this.bot.telegram.sendAudio(
                this.chatId,
                { source: filePath },
                {
                    caption: caption || path.basename(filePath)
                }
            );

            if (CONFIG.telegram.autoDelete) {
                try {
                    fs.unlinkSync(filePath);
                    this.deleteEmptyDirs(path.dirname(filePath));
                } catch (delErr) {
                    console.error(chalk.red('Failed to delete local file:'), delErr);
                }
            }
        } catch (error) {
            console.error(chalk.red('Failed to upload file to Telegram:'), error);
            await this.sendError(
                'Upload Failed',
                `Could not upload ${path.basename(filePath)}. File kept locally.`
            );
        }
    }

    async sendDownloadStart(
        title: string,
        type: 'track' | 'album' | 'playlist' | 'artist',
        quality: string
    ) {
        const icon =
            type === 'track' ? '🎵' : type === 'album' ? '💿' : type === 'artist' ? '👤' : '📜';
        const msg =
            '<b>📥 Started Download</b>\n\n' +
            `${icon} <b>${title}</b>\n` +
            `💎 Quality: ${quality}\n` +
            `⏱️ Time: ${new Date().toLocaleTimeString()}`;

        await this.sendMessage(msg);
    }

    async sendDownloadComplete(
        title: string,
        path: string,
        stats?: { totalSize?: number; trackCount?: number }
    ) {
        let statsMsg = '';
        if (stats) {
            if (stats.trackCount) statsMsg += `📊 Tracks: ${stats.trackCount}\n`;
            if (stats.totalSize) statsMsg += `💾 Size: ${this.formatSize(stats.totalSize)}\n`;
        }

        let pathLine = `📂 Path: <code>${path}</code>`;

        if (CONFIG.telegram.uploadFiles && CONFIG.telegram.autoDelete) {
            pathLine = '';
        }

        const msg =
            '<b>✅ Download Complete</b>\n\n' + `<b>${title}</b>\n` + `${statsMsg}` + `${pathLine}`;

        await this.sendMessage(msg);
    }

    async sendError(context: string, error: string) {
        const msg = '<b>❌ Error</b>\n\n' + `<b>${context}</b>\n` + `⚠️ ${error}`;

        await this.sendMessage(msg);
    }

    private async updateProgress(
        _ctx: any,
        messageId: number,
        phase: string,
        loaded: number,
        total: number | undefined,
        title: string
    ) {
        const now = Date.now();
        if (now - this.lastProgressUpdate < 2000 && loaded !== total && phase !== 'tagging') return;
        this.lastProgressUpdate = now;

        let statusText = '';
        let percent = 0;

        if (phase === 'download_start') statusText = '📥 Starting Download...';
        else if (phase === 'download') {
            if (total) {
                percent = Math.floor((loaded / total) * 100);
                const barLen = 10;
                const filled = Math.floor((percent / 100) * barLen);
                const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
                statusText = `📥 Downloading...\n<code>[${bar}] ${percent}%</code>`;
            } else {
                statusText = `📥 Downloading... ${(loaded / 1024 / 1024).toFixed(2)} MB`;
            }
        } else if (phase === 'lyrics') statusText = '📝 Fetching Lyrics...';
        else if (phase === 'cover') statusText = '🖼️ Fetching Cover...';
        else if (phase === 'tagging') statusText = '🏷️ Tagging Metadata...';

        const msgCode = `<b>${title}</b>\n\n${statusText}`;

        try {
            await this.bot!.telegram.editMessageText(this.chatId!, messageId, undefined, msgCode, {
                parse_mode: 'HTML'
            });
        } catch { }
    }

    async startBot() {
        if (!this.enabled || !this.bot) {
            console.log(
                chalk.red('❌ Telegram Bot is not configured. Please check .env settings.')
            );
            return;
        }

        console.log(chalk.cyan('🤖 Starting Qobuz-DL Telegram Bot...'));
        console.log(chalk.gray(`   Listening for messages from Chat ID: ${this.chatId}`));

        this.bot.use(async (ctx, next) => {
            if (ctx.chat?.id.toString() !== this.chatId) {
                return;
            }
            await next();
        });

        this.bot.start((ctx) => {
            ctx.reply(
                '<b>👋 Welcome to Qobuz-DL Bot!</b>\n\n' +
                'Send me a Qobuz link to start downloading.\nIf the file is &lt; 50MB, I will send it here.',
                { parse_mode: 'HTML' }
            );
        });

        this.bot.help((ctx) => {
            ctx.reply(
                '<b>Available Commands:</b>\n\n' +
                '/search &lt;query&gt; - Search for tracks/albums\n' +
                '/help - Show this message\n\n' +
                'Or just send a Qobuz link.',
                { parse_mode: 'HTML' }
            );
        });

        this.bot.command('search', async (ctx) => {
            const query = ctx.message.text.split(' ').slice(1).join(' ');
            if (!query) {
                await ctx.reply(
                    '⚠️ Please provide a search query.\nExample: <code>/search adele</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }
            await this.handleSearch(ctx, query);
        });

        this.bot.hears(/^\/dl_(track|album|playlist|artist)_(\d+)/, async (ctx) => {
            const match = ctx.message.text.match(/^\/dl_(track|album|playlist|artist)_(\d+)/);
            if (!match) return;

            const [, type, id] = match;
            await ctx.reply(`🔍 Queueing ${type} download: ${id}...`);

            if (type === 'track') {
                this.handleDownloadRequest(id, type, '').catch(async (err) => {
                    await this.sendError('Download Error', err.message);
                });
            } else {
                this.handleBatchDownload(id, type as 'album' | 'playlist' | 'artist').catch(
                    async (err) => {
                        await this.sendError('Download Error', err.message);
                    }
                );
            }
        });

        this.bot.on('text', async (ctx) => {
            const message = ctx.message.text;

            if (message.startsWith('/')) return;

            if (!message.includes('qobuz.com')) return;

            const parsed = this.api.parseUrl(message);
            if (!parsed) {
                await ctx.reply('❌ Invalid Qobuz URL.');
                return;
            }

            const processingMsg = await ctx.reply(`🔍 Processing ${parsed.type}: ${parsed.id}...`);

            if (parsed.type === 'track') {
                this.handleDownloadRequest(parsed.id, parsed.type, message).catch(async (err) => {
                    await this.sendError('Bot Download Error', err.message);
                });
            } else {
                this.handleInfoRequest(parsed.id, parsed.type).catch(async (err) => {
                    await this.sendError('Info Error', err.message);
                });
            }

            void processingMsg;
        });

        process.once('SIGINT', () => this.bot!.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot!.stop('SIGTERM'));

        try {
            await this.bot.launch();
            console.log(chalk.green('✅ Bot is running! Press Ctrl+C to stop.'));
        } catch (error) {
            console.error(chalk.red('❌ Failed to launch bot:'), error);
        }
    }

    private async handleInfoRequest(id: string | number, type: string) {
        if (type === 'album') {
            const info = await this.api.getAlbum(id);
            if (!info.success || !info.data) throw new Error('Album not found');
            const album = info.data;

            let msg =
                `<b>💿 Album: ${album.title}</b>\n` +
                `👤 Artist: ${album.artist.name}\n` +
                `Songs: ${album.tracks_count}\n\n` +
                `⬇️ <b><a href="/dl_album_${id}">Download All Tracks</a></b> (/dl_album_${id})\n\n` +
                '<b>Tracklist:</b>\n';

            if (album.tracks && album.tracks.items) {
                album.tracks.items.forEach((track, index) => {
                    msg += `${index + 1}. ${track.title} - /dl_track_${track.id}\n`;
                });
            }

            await this.sendMessage(msg);
        } else if (type === 'playlist') {
            const info = await this.api.getPlaylist(id);
            if (!info.success || !info.data) throw new Error('Playlist not found');
            const playlist = info.data;

            let msg =
                `<b>📜 Playlist: ${playlist.name}</b>\n` +
                `Songs: ${playlist.tracks.total}\n\n` +
                `⬇️ <b><a href="/dl_playlist_${id}">Download All Tracks</a></b> (/dl_playlist_${id})\n\n` +
                '<b>Tracklist:</b>\n';

            if (playlist.tracks && playlist.tracks.items) {
                playlist.tracks.items.forEach((track, index) => {
                    msg += `${index + 1}. ${track.title} - /dl_track_${track.id}\n`;
                });
            }
            await this.sendMessage(msg);
        } else if (type === 'artist') {
            const info = await this.api.getArtist(id);
            if (!info.success || !info.data) throw new Error('Artist not found');
            const artist = info.data as any;

            const msg =
                `<b>👤 Artist: ${artist.name}</b>\n\n` +
                `⬇️ <b>Download Discography</b>: /dl_artist_${id}`;
            await this.sendMessage(msg);
        }
    }

    private async handleBatchDownload(id: string | number, type: 'album' | 'playlist' | 'artist') {
        const quality = resolveQuality(CONFIG.quality.default);
        const qualityName = getQualityName(quality);

        if (type === 'album') {
            const info = await this.api.getAlbum(id);
            if (!info.success || !info.data) throw new Error('Album not found');
            const title = info.data.title;
            await this.sendDownloadStart(title, 'album', qualityName);

            const progressMsg = await this.bot!.telegram.sendMessage(
                this.chatId!,
                `<b>${title}</b>\n\n⏳ Initializing Batch Download...`,
                { parse_mode: 'HTML' }
            );
            const messageId = progressMsg.message_id;

            const res = await this.downloadService.downloadAlbum(id, quality, {
                onProgress: (phase, loaded, total) => {
                    this.updateProgress(null, messageId, phase, loaded, total, title);
                }
            });

            try {
                await this.bot!.telegram.deleteMessage(this.chatId!, messageId);
            } catch {
                /* empty */
            }

            const albumPath = res.tracks?.[0]?.filePath
                ? path.dirname(res.tracks[0].filePath)
                : 'Album Directory';

            if (res.success) {
                const uploadMsg = await this.bot!.telegram.sendMessage(
                    this.chatId!,
                    `<b>${title}</b>\n\n📤 Batch Uploading may take a while...`,
                    { parse_mode: 'HTML' }
                );

                await this.sendDownloadComplete(title, albumPath, {
                    trackCount: res.totalTracks
                });
                if (res.tracks) {
                    for (const trackRes of res.tracks) {
                        if (trackRes.success && trackRes.filePath) {
                            await this.uploadFile(trackRes.filePath);
                        }
                    }
                }
                try {
                    await this.bot!.telegram.deleteMessage(this.chatId!, uploadMsg.message_id);
                } catch {
                    /* empty */
                }
            } else {
                throw new Error(res.error || 'Unknown error');
            }
        } else if (type === 'playlist') {
            const info = await this.api.getPlaylist(id);
            if (!info.success || !info.data) throw new Error('Playlist not found');
            const title = info.data.name;
            await this.sendDownloadStart(title, 'playlist', qualityName);

            const progressMsg = await this.bot!.telegram.sendMessage(
                this.chatId!,
                `<b>${title}</b>\n\n⏳ Initializing Playlist...`,
                { parse_mode: 'HTML' }
            );
            const messageId = progressMsg.message_id;

            const res = await this.downloadService.downloadPlaylist(id, quality, {
                onProgress: (phase, loaded, total) => {
                    this.updateProgress(null, messageId, phase, loaded, total, title);
                }
            });

            try {
                await this.bot!.telegram.deleteMessage(this.chatId!, messageId);
            } catch {
                /* empty */
            }

            if (res.success) {
                const uploadMsg = await this.bot!.telegram.sendMessage(
                    this.chatId!,
                    `<b>${title}</b>\n\n📤 Batch Uploading...`,
                    { parse_mode: 'HTML' }
                );

                await this.sendDownloadComplete(title, 'Playlist Directory', {
                    trackCount: res.totalTracks
                });
                if (res.tracks) {
                    for (const trackRes of res.tracks) {
                        if (trackRes.success && trackRes.filePath) {
                            await this.uploadFile(trackRes.filePath);
                        }
                    }
                }
                try {
                    await this.bot!.telegram.deleteMessage(this.chatId!, uploadMsg.message_id);
                } catch {
                    /* empty */
                }
            } else {
                throw new Error(res.error || 'Unknown error');
            }
        } else if (type === 'artist') {
            const info = await this.api.getArtist(id);
            if (!info.success || !info.data) throw new Error('Artist not found');
            const data = info.data as any;
            const title = data.name;
            await this.sendDownloadStart(title, 'artist', qualityName);

            const res = await this.downloadService.downloadArtist(id, quality);
            if (res.success) {
                await this.sendDownloadComplete(title, 'Artist Directory', {
                    trackCount: res.totalTracks
                });
                await this.sendMessage(
                    '⚠️ Bulk Artist upload is not supported to avoid flooding. Files are saved on server.'
                );
            } else {
                throw new Error(res.error || 'Unknown error');
            }
        }
    }

    private async handleDownloadRequest(id: string | number, type: string, _originalUrl: string) {
        const quality = resolveQuality(CONFIG.quality.default);
        if (type === 'track') {
            const info = await this.api.getTrack(id);
            if (!info.success || !info.data) throw new Error('Track not found');

            const title = info.data.title;

            const progressMsg = await this.bot!.telegram.sendMessage(
                this.chatId!,
                `<b>${title}</b>\n\n⏳ Initializing...`,
                { parse_mode: 'HTML' }
            );
            const messageId = progressMsg.message_id;

            const res = await this.downloadService.downloadTrack(id, quality, {
                onProgress: (phase, loaded, total) => {
                    this.updateProgress(null, messageId, phase, loaded, total, title);
                }
            });

            try {
                await this.bot!.telegram.deleteMessage(this.chatId!, messageId);
            } catch {
                /* empty */
            }

            if (res.success && res.filePath) {
                const uploadMsg = await this.bot!.telegram.sendMessage(
                    this.chatId!,
                    `<b>${title}</b>\n\n📤 Uploading to Telegram...`,
                    { parse_mode: 'HTML' }
                );

                await this.sendDownloadComplete(title, res.filePath, { totalSize: 0 });
                await this.uploadFile(res.filePath);

                try {
                    await this.bot!.telegram.deleteMessage(this.chatId!, uploadMsg.message_id);
                } catch {
                    /* empty */
                }
            } else {
                throw new Error(res.error || 'Unknown error');
            }
        }
    }
    private async handleSearch(ctx: any, query: string) {
        try {
            await ctx.reply('🔍 Searching...', { parse_mode: 'HTML' });

            const [tracksRes, albumsRes] = await Promise.all([
                this.api.search(query, 'tracks', 5),
                this.api.search(query, 'albums', 5)
            ]);

            let resultMsg = `<b>🔎 Search Results for "${query}"</b>\n\n`;

            if (tracksRes.success && tracksRes.data?.tracks?.items) {
                resultMsg += '<b>🎵 Tracks</b>\n';
                tracksRes.data.tracks.items.forEach((track: any) => {
                    const title = track.title;
                    const artist = track.performer?.name || 'Unknown Artist';
                    const safeTitle = title
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    const safeArtist = artist
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    resultMsg += `• ${safeTitle} - ${safeArtist}\n  ⬇️ /dl_track_${track.id}\n\n`;
                });
            }

            if (albumsRes.success && albumsRes.data?.albums?.items) {
                resultMsg += '<b>💿 Albums</b>\n';
                albumsRes.data.albums.items.forEach((album: any) => {
                    const title = album.title;
                    const artist = album.artist?.name || 'Unknown Artist';
                    const safeTitle = title
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    const safeArtist = artist
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    resultMsg += `• ${safeTitle} - ${safeArtist}\n  ⬇️ /dl_album_${album.id}\n\n`;
                });
            }

            if (!tracksRes.data?.tracks?.items?.length && !albumsRes.data?.albums?.items?.length) {
                resultMsg += '<i>No results found.</i>';
            }

            await ctx.reply(resultMsg, { parse_mode: 'HTML' });
        } catch (error: unknown) {
            const err = error as Error;
            await ctx.reply(`⚠️ Search Failed: ${err.message}`);
        }
    }
}

export const telegramService = new TelegramService();
