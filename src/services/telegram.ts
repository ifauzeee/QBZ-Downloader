import { Telegraf } from 'telegraf';
import { CONFIG } from '../config.js';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import DownloadService, { DownloadProgress } from './download.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from './metadata.js';
import { getQualityName } from '../config.js';
import fs from 'fs';
import path from 'path';
import { botSettingsService } from './bot-settings.js';
import { logger } from '../utils/logger.js';

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
    private currentActivity: string = '';

    constructor() {
        const token = CONFIG.telegram.token;
        const chatId = CONFIG.telegram.chatId;
        this.uploadEnabled = CONFIG.telegram.uploadFiles ?? true;

        this.api = new QobuzAPI();
        const lyricsProvider = new LyricsProvider();
        const metadataService = new MetadataService();
        this.downloadService = new DownloadService(this.api, lyricsProvider, metadataService);

        if (token && chatId) {
            try {
                this.bot = new Telegraf(token);
                this.chatId = chatId;
                this.enabled = true;
            } catch (error) {
                logger.warn(`Failed to initialize Telegram bot: ${error}`);
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
                logger.debug(`Cleaned up empty directory: ${path.basename(dir)}`);
                this.deleteEmptyDirs(path.dirname(dir));
            }
        } catch {}
    }

    async sendMessage(message: string) {
        if (!this.enabled || !this.bot || !this.chatId) return;

        try {
            await this.bot.telegram.sendMessage(this.chatId, message, {
                parse_mode: 'HTML'
            });
        } catch {}
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

            logger.info(
                `Uploading to Telegram: ${path.basename(filePath)} (${this.formatSize(fileSizeInBytes)})`
            );
            await this.bot.telegram.sendAudio(
                this.chatId,
                { source: filePath },
                {
                    caption: caption || path.basename(filePath)
                }
            );
            logger.success(`Upload complete: ${path.basename(filePath)}`);

            if (CONFIG.telegram.autoDelete) {
                try {
                    fs.unlinkSync(filePath);
                    logger.debug(`Local file deleted (Auto-clean): ${path.basename(filePath)}`);
                    this.deleteEmptyDirs(path.dirname(filePath));
                } catch (delErr) {
                    logger.warn(`Failed to delete local file: ${delErr}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to upload file to Telegram: ${error}`);
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
            '✨ <b>INCOMING DOWNLOAD</b> ✨\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            `${icon} <b>Item:</b> <code>${title}</code>\n` +
            `💎 <b>Quality:</b> <code>${quality}</code>\n` +
            `📂 <b>Type:</b> <i>${type.toUpperCase()}</i>\n` +
            '━━━━━━━━━━━━━━━━━━\n' +
            `⏱️ <b>Time:</b> <code>${new Date().toLocaleTimeString()}</code>`;

        await this.sendMessage(msg);
    }

    async sendDownloadComplete(
        title: string,
        path: string,
        stats?: { totalSize?: number; trackCount?: number }
    ) {
        let statsMsg = '';
        if (stats) {
            if (stats.trackCount)
                statsMsg += `📊 <b>Tracks:</b> <code>${stats.trackCount}</code>\n`;
            if (stats.totalSize)
                statsMsg += `💾 <b>Size:</b> <code>${this.formatSize(stats.totalSize)}</code>\n`;
        }

        let pathLine = `📂 <b>Path:</b> <code>${path}</code>`;

        if (CONFIG.telegram.uploadFiles && CONFIG.telegram.autoDelete) {
            pathLine = '';
        }

        const msg =
            '✅ <b>SUCCESSFULLY DOWNLOADED</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            `🎧 <b>Title:</b> <code>${title}</code>\n` +
            `${statsMsg}` +
            `${pathLine}` +
            '━━━━━━━━━━━━━━━━━━\n' +
            '<i>Processing complete! Enjoy your music.</i>';
        await this.sendMessage(msg);
    }

    async sendError(context: string, error: string) {
        logger.error(`${context}: ${error}`);
        const msg =
            '❌ <b>ERROR DETECTED</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            `❗ <b>Context:</b> <code>${context}</code>\n` +
            `⚠️ <b>Message:</b> <i>${error}</i>\n` +
            '━━━━━━━━━━━━━━━━━━\n' +
            '<i>Please check your settings or try again later.</i>';

        await this.sendMessage(msg);
    }

    private async updateProgress(
        _ctx: any,
        messageId: number,
        progress: DownloadProgress,
        title: string
    ) {
        const { phase, loaded, total } = progress;

        if (this.currentActivity !== phase) {
            this.currentActivity = phase;
            logger.debug(`Activity: ${phase.toUpperCase()} - ${title}`);
        }

        const now = Date.now();
        if (now - this.lastProgressUpdate < 2000 && loaded !== total && phase !== 'tagging') return;
        this.lastProgressUpdate = now;

        let statusText = '';
        let percent = 0;

        if (phase === 'download_start') statusText = '🚀 <b>Initializing...</b>';
        else if (phase === 'download') {
            if (total) {
                percent = Math.floor((loaded / total) * 100);
                const barLen = 12;
                const filled = Math.floor((percent / 100) * barLen);
                const bar = '🟢'.repeat(filled) + '⚪'.repeat(barLen - filled);
                statusText = `📥 <b>Downloading...</b>\n<code>${bar} ${percent}%</code>\n<i>${(loaded / 1024 / 1024).toFixed(2)} MB / ${(total / 1024 / 1024).toFixed(2)} MB</i>`;
            } else {
                statusText = `📥 <b>Downloading...</b>\n<code>${(loaded / 1024 / 1024).toFixed(2)} MB</code>`;
            }
        } else if (phase === 'lyrics') statusText = '📝 <b>Fetching Lyrics...</b>';
        else if (phase === 'cover') statusText = '🖼️ <b>Fetching Cover...</b>';
        else if (phase === 'tagging') statusText = '🏷️ <b>Tagging Metadata...</b>';

        const msgCode =
            `🛰️ <b>ACTIVITY: ${phase.toUpperCase()}</b>\n` +
            '━━━━━━━━━━━━━━━━━━\n' +
            `🎵 <b>Track:</b> <code>${title}</code>\n` +
            '━━━━━━━━━━━━━━━━━━\n' +
            `${statusText}`;

        try {
            await this.bot!.telegram.editMessageText(this.chatId!, messageId, undefined, msgCode, {
                parse_mode: 'HTML'
            });
        } catch {}
    }

    async startBot() {
        if (!this.enabled || !this.bot) {
            logger.error('Telegram Bot is not configured. Please check .env settings.');
            return;
        }

        logger.success('Starting Qobuz-DL Telegram Bot...');
        logger.info(`Listening for messages from Chat ID: ${this.chatId}`);

        this.bot.use(async (ctx, next) => {
            const userId = ctx.from?.id.toString();
            const allowedUsers = CONFIG.telegram.allowedUsers;
            const mainChatId = CONFIG.telegram.chatId;

            const isAllowed =
                (allowedUsers && allowedUsers.includes(userId || '')) ||
                (mainChatId && userId === mainChatId);

            if (!isAllowed) {
                logger.error(`Access denied for user: ${userId} (${ctx.from?.username})`);
                await ctx.reply('⛔ You are not authorized to use this bot.');
                return;
            }
            if (ctx.message && 'text' in ctx.message) {
                logger.msg(`Message from ${ctx.from?.username} (${userId}): ${ctx.message.text}`);
            }
            await next();
        });

        this.bot.start((ctx) => {
            ctx.reply(
                '🎨 <b>Welcome to Qobuz Premium Bot!</b>\n' +
                    '━━━━━━━━━━━━━━━━━━\n' +
                    'I can help you download high-quality music directly from Qobuz.\n\n' +
                    '🚀 <b>Quick Start:</b>\n' +
                    '1️⃣ Send any Qobuz Link (Track/Album/Playlist)\n' +
                    '2️⃣ Use /search to find your favorite music\n' +
                    '3️⃣ Configure your /settings\n\n' +
                    '🔒 <i>All files < 50MB are automatically uploaded.</i>',
                { parse_mode: 'HTML' }
            );
        });

        this.bot.help((ctx) => {
            ctx.reply(
                '📖 <b>COMMAND GUIDE</b>\n' +
                    '━━━━━━━━━━━━━━━━━━\n' +
                    '🔍 <code>/search query</code> - Search everything\n' +
                    '⚙️ <code>/settings</code> - Bot configuration\n' +
                    'ℹ️ <code>/help</code> - Show this menu\n\n' +
                    '💡 <i>Tip: Paste a Qobuz URL for instant info!</i>',
                { parse_mode: 'HTML' }
            );
        });

        this.bot.command('search', async (ctx) => {
            const query = ctx.message.text.split(' ').slice(1).join(' ');
            logger.info(`Search command: ${query}`);
            if (!query) {
                await ctx.reply(
                    '⚠️ Please provide a search query.\nExample: <code>/search adele</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }
            await this.handleSearch(ctx, query);
        });

        this.bot.command(['settings', 'setting'], async (ctx) => {
            await this.handleSettings(ctx);
        });

        this.bot.action(/^set_bot_quality_(.+)$/, async (ctx) => {
            const val = ctx.match[1];
            botSettingsService.quality = val === 'ask' ? 'ask' : parseInt(val, 10);
            logger.success(`Settings: Quality updated to ${val} by user ${ctx.from?.id}`);
            await ctx.answerCbQuery(`✅ Quality updated to ${val}`);
            await this.handleSettings(ctx, true);
        });

        this.bot.action(/^search_(tracks|albums|artists|playlists)_(.+)$/, async (ctx) => {
            const [, type, query] = ctx.match;
            logger.info(`Search category selected: ${type} for query "${query}"`);
            await ctx.answerCbQuery(`Searching ${type}...`);
            await this.handleSearchCategory(ctx, query, type as any);
        });

        this.bot.action(/^search_back_(.+)$/, async (ctx) => {
            const query = ctx.match[1];
            await ctx.answerCbQuery();
            await this.handleSearch(ctx, query, true);
        });

        this.bot.action(/^dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)_(.+)$/, async (ctx) => {
            const match = ctx.match;
            const [, type, id, quality] = match;
            logger.info(`Download requested via callback: ${type} ${id} (Quality: ${quality})`);
            await ctx.answerCbQuery('Queueing download...');
            await ctx.reply(`🔍 Queueing ${type} download: ${id} with quality ${quality}...`);

            const q = parseInt(quality, 10) || 27;

            if (type === 'track') {
                this.handleDownloadRequest(id, type, '', q).catch(async (err) => {
                    await this.sendError('Download Error', err.message);
                });
            } else {
                this.handleBatchDownload(id, type as 'album' | 'playlist' | 'artist', q).catch(
                    async (err) => {
                        await this.sendError('Download Error', err.message);
                    }
                );
            }
        });

        this.bot.action(/^ask_dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)$/, async (ctx) => {
            const match = ctx.match;
            const [, type, id] = match;
            if (type === 'track') {
                await this.askQuality(ctx, type, id);
            } else {
                await ctx.answerCbQuery('Fetching info...');
                await this.handleInfoRequest(ctx, id, type);
            }
        });

        this.bot.hears(/^\/dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)/, async (ctx) => {
            const match = ctx.message.text.match(
                /^\/dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)/
            );
            if (!match) return;

            const [, type, id] = match;
            await ctx.reply(`🔍 Queueing ${type} download: ${id}...`);

            if (type === 'track') {
                this.handleDownloadRequest(
                    id,
                    type,
                    '',
                    resolveQuality(CONFIG.quality.default)
                ).catch(async (err) => {
                    console.error(chalk.red(`❌ Download track error: ${err.message}`));
                    await this.sendError('Download Error', err.message);
                });
            } else {
                this.handleBatchDownload(
                    id,
                    type as 'album' | 'playlist' | 'artist',
                    resolveQuality(CONFIG.quality.default)
                ).catch(async (err) => {
                    await this.sendError('Download Error', err.message);
                });
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
                const botQuality = botSettingsService.quality;
                if (botQuality === 'ask') {
                    await this.askQuality(ctx, parsed.type, parsed.id);
                } else {
                    this.handleDownloadRequest(parsed.id, parsed.type, message, botQuality).catch(
                        async (err) => {
                            await this.sendError('Bot Download Error', err.message);
                        }
                    );
                }
            } else {
                this.handleInfoRequest(ctx, parsed.id, parsed.type).catch(async (err) => {
                    await this.sendError('Info Error', err.message);
                });
            }

            void processingMsg;
        });

        process.once('SIGINT', () => this.bot!.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot!.stop('SIGTERM'));

        try {
            await this.bot.launch();
            logger.success('Bot is running! Press Ctrl+C to stop.');
        } catch (error) {
            logger.error(`Failed to launch bot: ${error}`);
        }
    }

    private async handleInfoRequest(ctx: any, id: string | number, type: string) {
        if (type === 'album') {
            const info = await this.api.getAlbum(id);
            if (!info.success || !info.data) throw new Error('Album not found');
            const album = info.data;

            let msg =
                '💿 <b>ALBUM INFORMATION</b>\n' +
                '━━━━━━━━━━━━━━━━━━\n' +
                `💽 <b>Title:</b> <code>${album.title}</code>\n` +
                `👤 <b>Artist:</b> <code>${album.artist.name}</code>\n` +
                `📅 <b>Year:</b> <code>${album.release_date_original || 'N/A'}</code>\n` +
                `🎼 <b>Tracks:</b> <code>${album.tracks_count}</code>\n` +
                '━━━━━━━━━━━━━━━━━━\n' +
                '<b>Tracklist:</b>\n';

            const botQuality = botSettingsService.quality;
            const keyboardRows: any[][] = [];

            if (botQuality === 'ask') {
                keyboardRows.push(
                    [
                        { text: '🔥 Hi-Res 24/192', callback_data: `dl_album_${id}_27` },
                        { text: '✨ Hi-Res 24/96', callback_data: `dl_album_${id}_7` }
                    ],
                    [
                        { text: '💿 CD Quality', callback_data: `dl_album_${id}_6` },
                        { text: '🎵 MP3 320', callback_data: `dl_album_${id}_5` }
                    ]
                );
            } else {
                keyboardRows.push([
                    {
                        text: `📥 Download Album (${getQualityName(botQuality)})`,
                        callback_data: `dl_album_${id}_${botQuality}`
                    }
                ]);
            }

            if (album.tracks && album.tracks.items) {
                album.tracks.items.forEach((track, index) => {
                    msg += `<code>${index + 1}.</code> ${track.title}\n`;
                    keyboardRows.push([
                        {
                            text: `🎵 ${track.title.substring(0, 30)}`,
                            callback_data:
                                botQuality === 'ask'
                                    ? `ask_dl_track_${track.id}`
                                    : `dl_track_${track.id}_${botQuality}`
                        }
                    ]);
                });
            }

            await ctx.reply(msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboardRows }
            });
        } else if (type === 'playlist') {
            const info = await this.api.getPlaylist(id);
            if (!info.success || !info.data) throw new Error('Playlist not found');
            const playlist = info.data;

            let msg =
                '📜 <b>PLAYLIST INFORMATION</b>\n' +
                '━━━━━━━━━━━━━━━━━━\n' +
                `� <b>Name:</b> <code>${playlist.name}</code>\n` +
                `👤 <b>Owner:</b> <code>${playlist.owner?.name || 'N/A'}</code>\n` +
                `🎼 <b>Tracks:</b> <code>${playlist.tracks.total}</code>\n` +
                '━━━━━━━━━━━━━━━━━━\n' +
                '<b>Tracklist:</b>\n';

            const botQuality = botSettingsService.quality;
            const keyboardRows: any[][] = [];

            if (botQuality === 'ask') {
                keyboardRows.push(
                    [
                        { text: '🔥 Hi-Res 24/192', callback_data: `dl_playlist_${id}_27` },
                        { text: '✨ Hi-Res 24/96', callback_data: `dl_playlist_${id}_7` }
                    ],
                    [
                        { text: '💿 CD Quality', callback_data: `dl_playlist_${id}_6` },
                        { text: '🎵 MP3 320', callback_data: `dl_playlist_${id}_5` }
                    ]
                );
            } else {
                keyboardRows.push([
                    {
                        text: `📥 Download Playlist (${getQualityName(botQuality)})`,
                        callback_data: `dl_playlist_${id}_${botQuality}`
                    }
                ]);
            }

            if (playlist.tracks && playlist.tracks.items) {
                playlist.tracks.items.forEach((track, index) => {
                    msg += `<code>${index + 1}.</code> ${track.title}\n`;
                    keyboardRows.push([
                        {
                            text: `🎵 ${track.title.substring(0, 30)}`,
                            callback_data:
                                botQuality === 'ask'
                                    ? `ask_dl_track_${track.id}`
                                    : `dl_track_${track.id}_${botQuality}`
                        }
                    ]);
                });
            }
            await ctx.reply(msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboardRows }
            });
        } else if (type === 'artist') {
            const info = await this.api.getArtist(id);
            if (!info.success || !info.data) throw new Error('Artist not found');
            const artist = info.data as any;

            const msg =
                '👤 <b>ARTIST PROFILE</b>\n' +
                '━━━━━━━━━━━━━━━━━━\n' +
                `🎤 <b>Name:</b> <code>${artist.name}</code>\n` +
                `💿 <b>Albums:</b> <code>${artist.albums_count || 'N/A'}</code>\n` +
                '━━━━━━━━━━━━━━━━━━\n' +
                '<i>Select a quality to download discography:</i>';

            const botQual = botSettingsService.quality;
            const inlineKeyboard = [];

            if (botQual === 'ask') {
                inlineKeyboard.push([
                    { text: '🔥 Hi-Res', callback_data: `dl_artist_${id}_27` },
                    { text: '💿 CD', callback_data: `dl_artist_${id}_6` },
                    { text: 'MP3', callback_data: `dl_artist_${id}_5` }
                ]);
            } else {
                inlineKeyboard.push([
                    {
                        text: `📥 Download Discography (${getQualityName(botQual)})`,
                        callback_data: `dl_artist_${id}_${botQual}`
                    }
                ]);
            }

            await ctx.reply(msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: inlineKeyboard }
            });
        }
    }

    private async handleBatchDownload(
        id: string | number,
        type: 'album' | 'playlist' | 'artist',
        qualityLevel?: number
    ) {
        const quality = qualityLevel || resolveQuality(CONFIG.quality.default);
        const qualityName = getQualityName(quality);

        if (type === 'album') {
            const info = await this.api.getAlbum(id);
            if (!info.success || !info.data) throw new Error('Album not found');
            const title = info.data.title;
            logger.info(`Batch download started: ${title} (${id})`);
            await this.sendDownloadStart(title, 'album', qualityName);

            const progressMsg = await this.bot!.telegram.sendMessage(
                this.chatId!,
                '📦 <b>BATCH INITIALIZING</b>\n' +
                    '━━━━━━━━━━━━━━━━━━\n' +
                    `💿 <b>Album:</b> <code>${title}</code>\n` +
                    '━━━━━━━━━━━━━━━━━━\n' +
                    '⏳ <i>Please wait while we prepare your tracks...</i>',
                { parse_mode: 'HTML' }
            );
            const messageId = progressMsg.message_id;

            const res = await this.downloadService.downloadAlbum(id, quality, {
                onProgress: (_id, data) => {
                    if (data.status === 'done') {
                        void 0;
                    }
                }
            });

            try {
                await this.bot!.telegram.deleteMessage(this.chatId!, messageId);
            } catch {}

            const albumPath = res.tracks?.[0]?.filePath
                ? path.dirname(res.tracks[0].filePath)
                : 'Album Directory';

            if (res.success || (res.tracks && res.tracks.some((t) => t.success))) {
                const uploadMsg = await this.bot!.telegram.sendMessage(
                    this.chatId!,
                    '📤 <b>BATCH UPLOADING</b>\n' +
                        '━━━━━━━━━━━━━━━━━━\n' +
                        `💿 <b>Album:</b> <code>${title}</code>\n` +
                        '━━━━━━━━━━━━━━━━━━\n' +
                        '⏳ <i>Transferring tracks to Telegram...</i>',
                    { parse_mode: 'HTML' }
                );

                await this.sendDownloadComplete(title, albumPath, {
                    trackCount: res.totalTracks
                });

                if (!res.success) {
                    await this.sendMessage(
                        `⚠️ Some tracks failed to download (${res.failedTracks}/${res.totalTracks})`
                    );
                }

                if (res.tracks) {
                    for (const trackRes of res.tracks) {
                        if (trackRes.success && trackRes.filePath) {
                            await this.uploadFile(trackRes.filePath);
                        }
                    }
                }
                try {
                    await this.bot!.telegram.deleteMessage(this.chatId!, uploadMsg.message_id);
                } catch {}
            } else {
                logger.error(`Batch download failed for ${title}: ${res.error}`);
                throw new Error(res.error || `All ${res.totalTracks} tracks failed to download.`);
            }
        } else if (type === 'playlist') {
            const info = await this.api.getPlaylist(id);
            if (!info.success || !info.data) throw new Error('Playlist not found');
            const title = info.data.name;
            await this.sendDownloadStart(title, 'playlist', qualityName);

            const progressMsg = await this.bot!.telegram.sendMessage(
                this.chatId!,
                '📜 <b>PLAYLIST INITIALIZING</b>\n' +
                    '━━━━━━━━━━━━━━━━━━\n' +
                    `📝 <b>Playlist:</b> <code>${title}</code>\n` +
                    '━━━━━━━━━━━━━━━━━━\n' +
                    '⏳ <i>Preparing playlist tracks...</i>',
                { parse_mode: 'HTML' }
            );
            const messageId = progressMsg.message_id;

            const res = await this.downloadService.downloadPlaylist(id, quality, {
                onProgress: (_id, _data) => {}
            });

            try {
                await this.bot!.telegram.deleteMessage(this.chatId!, messageId);
            } catch {}

            if (res.success || (res.tracks && res.tracks.some((t) => t.success))) {
                const uploadMsg = await this.bot!.telegram.sendMessage(
                    this.chatId!,
                    '📤 <b>PLAYLIST UPLOADING</b>\n' +
                        '━━━━━━━━━━━━━━━━━━\n' +
                        `📝 <b>Playlist:</b> <code>${title}</code>\n` +
                        '━━━━━━━━━━━━━━━━━━\n' +
                        '⏳ <i>Sending tracks to Telegram...</i>',
                    { parse_mode: 'HTML' }
                );

                await this.sendDownloadComplete(title, 'Playlist Directory', {
                    trackCount: res.totalTracks
                });

                if (!res.success) {
                    await this.sendMessage(
                        `⚠️ Some tracks failed to download (${res.failedTracks}/${res.totalTracks})`
                    );
                }

                if (res.tracks) {
                    for (const trackRes of res.tracks) {
                        if (trackRes.success && trackRes.filePath) {
                            await this.uploadFile(trackRes.filePath);
                        }
                    }
                }
                try {
                    await this.bot!.telegram.deleteMessage(this.chatId!, uploadMsg.message_id);
                } catch {}
            } else {
                console.error(chalk.red(`❌ Playlist batch failed for ${title}`));
                console.error(res);
                throw new Error(res.error || `All ${res.totalTracks} tracks failed to download.`);
            }
        } else if (type === 'artist') {
            await this.downloadService.downloadArtist(id, quality);
        }
    }

    private async handleDownloadRequest(
        id: string | number,
        type: string,
        _originalUrl: string,
        qualityLevel?: number
    ) {
        const quality = qualityLevel || resolveQuality(CONFIG.quality.default);
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
                onProgress: (progress) => {
                    this.updateProgress(null, messageId, progress, title);
                }
            });

            try {
                await this.bot!.telegram.deleteMessage(this.chatId!, messageId);
            } catch {}

            if (res.success && res.filePath) {
                const uploadMsg = await this.bot!.telegram.sendMessage(
                    this.chatId!,
                    '📤 <b>TRACK UPLOADING</b>\n' +
                        '━━━━━━━━━━━━━━━━━━\n' +
                        `🎵 <b>Track:</b> <code>${title}</code>\n` +
                        '━━━━━━━━━━━━━━━━━━\n' +
                        '⏳ <i>Uploading to your chat...</i>',
                    { parse_mode: 'HTML' }
                );

                await this.sendDownloadComplete(title, res.filePath, { totalSize: 0 });
                await this.uploadFile(res.filePath);

                try {
                    await this.bot!.telegram.deleteMessage(this.chatId!, uploadMsg.message_id);
                } catch {}
            } else {
                logger.error(`Download failed for ${title}: ${res.error}`);
                throw new Error(res.error || 'Unknown error');
            }
        }
    }
    private async handleSearch(ctx: any, query: string, isUpdate = false) {
        const msg =
            '🔍 <b>SEARCH OPERATOR</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            `Query: <code>${query}</code>\n\n` +
            'Select a category to view results:';

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎵 Tracks', callback_data: `search_tracks_${query}` },
                    { text: '💿 Albums', callback_data: `search_albums_${query}` }
                ],
                [
                    { text: '👤 Artists', callback_data: `search_artists_${query}` },
                    { text: '📜 Playlists', callback_data: `search_playlists_${query}` }
                ]
            ]
        };

        if (isUpdate) {
            try {
                await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
            } catch {}
        } else {
            await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
        }
    }

    private async handleSearchCategory(
        ctx: any,
        query: string,
        type: 'tracks' | 'albums' | 'artists' | 'playlists'
    ) {
        try {
            const res = await this.api.search(query, type, 10);
            if (!res.success || !res.data) throw new Error('No results found.');

            let items: any[] = [];
            let header = '';

            if (type === 'tracks') {
                items = res.data.tracks?.items || [];
                header = '🎵 <b>TOP TRACKS</b>';
            } else if (type === 'albums') {
                items = res.data.albums?.items || [];
                header = '💿 <b>TOP ALBUMS</b>';
            } else if (type === 'artists') {
                items = res.data.artists?.items || [];
                header = '👤 <b>TOP ARTISTS</b>';
            } else if (type === 'playlists') {
                items = res.data.playlists?.items || [];
                header = '📜 <b>TOP PLAYLISTS</b>';
            }

            if (items.length === 0) {
                await ctx.reply(`❌ No ${type} found for "<code>${query}</code>"`, {
                    parse_mode: 'HTML'
                });
                return;
            }

            const botQual = botSettingsService.quality;
            const keyboardRows = items.map((item) => {
                let text = '';
                let cb = '';

                if (type === 'tracks') {
                    text = `🎵 ${item.title} - ${item.performer?.name}`;
                    cb =
                        botQual === 'ask'
                            ? `ask_dl_track_${item.id}`
                            : `dl_track_${item.id}_${botQual}`;
                } else if (type === 'albums') {
                    text = `💿 ${item.title} - ${item.artist?.name}`;
                    cb = `ask_dl_album_${item.id}`;
                } else if (type === 'artists') {
                    text = `👤 ${item.name}`;
                    cb = `ask_dl_artist_${item.id}`;
                } else if (type === 'playlists') {
                    text = `📜 ${item.name}`;
                    cb = `ask_dl_playlist_${item.id}`;
                }

                return [{ text: text.substring(0, 60), callback_data: cb }];
            });

            keyboardRows.push([
                { text: '⬅️ Back to Categories', callback_data: `search_back_${query}` }
            ]);

            const msg =
                `${header}\n` +
                '━━━━━━━━━━━━━━━━━━\n' +
                `Results for: <code>${query}</code>\n\n` +
                '<i>Select an item to view or download:</i>';

            await ctx.editMessageText(msg, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboardRows }
            });
        } catch (error: any) {
            await ctx.reply(`⚠️ ${error.message}`);
        }
    }

    private async askQuality(ctx: any, type: string, id: string | number) {
        const msg =
            '💎 <b>SELECT AUDIO QUALITY</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            `Item: <code>${type.toUpperCase()} #${id}</code>\n\n` +
            'Choose your preferred quality:';

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔥 Hi-Res (192kHz)', callback_data: `dl_${type}_${id}_27` },
                        { text: '✨ Hi-Res (96kHz)', callback_data: `dl_${type}_${id}_7` }
                    ],
                    [
                        { text: '💿 CD (16-bit)', callback_data: `dl_${type}_${id}_6` },
                        { text: '🎵 MP3 (320kbps)', callback_data: `dl_${type}_${id}_5` }
                    ]
                ]
            }
        });
    }

    private async handleSettings(ctx: any, isUpdate = false) {
        const currentQuality = botSettingsService.quality;
        const qualityName =
            currentQuality === 'ask'
                ? 'Interactive (Ask Every Time)'
                : getQualityName(currentQuality);

        const msg =
            '⚙️ <b>BOT CONFIGURATION</b>\n' +
            '━━━━━━━━━━━━━━━━━━\n' +
            `Current Default: <b>${qualityName}</b>\n\n` +
            '<i>Changing this will affect how links and search results behave.</i>';

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔥 Hi-Res (192)', callback_data: 'set_bot_quality_27' },
                    { text: '✨ Hi-Res (96)', callback_data: 'set_bot_quality_7' }
                ],
                [
                    { text: '💿 CD Quality', callback_data: 'set_bot_quality_6' },
                    { text: '🎵 MP3', callback_data: 'set_bot_quality_5' }
                ],
                [{ text: '❓ Interactive (Ask Every Time)', callback_data: 'set_bot_quality_ask' }]
            ]
        };

        if (isUpdate) {
            try {
                await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
            } catch {}
        } else {
            await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
        }
    }
}

export const telegramService = new TelegramService();
