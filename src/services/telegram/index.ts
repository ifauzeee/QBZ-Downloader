import { Telegraf } from 'telegraf';
import { CONFIG } from '../../config.js';

import QobuzAPI from '../../api/qobuz.js';
import DownloadService from '../download.js';
import LyricsProvider from '../../api/lyrics.js';
import MetadataService from '../metadata.js';
import { botSettingsService } from '../bot-settings.js';
import { logger } from '../../utils/logger.js';
import { DownloadHandler, SearchHandler, SettingsHandler } from './handlers/index.js';
import { downloadQueue } from './queue.js';
import { buildWelcomeMessage, buildHelpMessage } from './messages.js';
import { DownloadType } from './types.js';
import { rateLimiter } from './security/index.js';

export class TelegramService {
    private bot: Telegraf | null = null;
    private chatId: string | null = null;
    private enabled: boolean = false;

    private api: QobuzAPI;
    private downloadService: DownloadService;

    private downloadHandler!: DownloadHandler;
    private searchHandler!: SearchHandler;
    private settingsHandler!: SettingsHandler;

    constructor() {
        const token = CONFIG.telegram.token;
        const chatId = CONFIG.telegram.chatId;

        this.api = new QobuzAPI();
        const lyricsProvider = new LyricsProvider();
        const metadataService = new MetadataService();
        this.downloadService = new DownloadService(this.api, lyricsProvider, metadataService);

        if (token && chatId) {
            try {
                this.bot = new Telegraf(token);
                this.chatId = chatId;
                this.enabled = true;

                this.initializeHandlers();
            } catch (error) {
                logger.warn(`Failed to initialize Telegram bot: ${error}`);
                this.enabled = false;
            }
        }
    }

    private initializeHandlers(): void {
        if (!this.bot || !this.chatId) return;

        const uploadEnabled = CONFIG.telegram.uploadFiles ?? true;

        this.downloadHandler = new DownloadHandler(
            this.bot,
            this.chatId,
            this.api,
            this.downloadService,
            uploadEnabled
        );

        this.searchHandler = new SearchHandler(this.bot, this.chatId, this.api);

        this.settingsHandler = new SettingsHandler(this.bot, this.chatId);
    }

    async sendMessage(message: string): Promise<void> {
        if (!this.enabled || !this.bot || !this.chatId) return;
        try {
            await this.bot.telegram.sendMessage(this.chatId, message, {
                parse_mode: 'HTML'
            });
        } catch {}
    }

    async uploadFile(filePath: string, caption?: string): Promise<void> {
        if (!this.enabled || !this.downloadHandler) return;
        await this.downloadHandler.uploadFile(filePath, caption);
    }

    async sendDownloadStart(
        title: string,
        type: 'track' | 'album' | 'playlist' | 'artist',
        quality: string
    ): Promise<void> {
        if (!this.enabled) return;
        const { buildDownloadStartMessage } = await import('./messages.js');
        await this.sendMessage(buildDownloadStartMessage(title, type, quality));
    }

    async sendDownloadComplete(
        title: string,
        path: string,
        stats?: { totalSize?: number; trackCount?: number }
    ): Promise<void> {
        if (!this.enabled) return;
        const { buildDownloadCompleteMessage } = await import('./messages.js');
        const showPath = !(CONFIG.telegram.uploadFiles && CONFIG.telegram.autoDelete);
        await this.sendMessage(buildDownloadCompleteMessage(title, path, stats, showPath));
    }

    async sendError(context: string, error: string): Promise<void> {
        if (!this.enabled) return;
        const { buildErrorMessage } = await import('./messages.js');
        logger.error(`${context}: ${error}`);
        await this.sendMessage(buildErrorMessage(context, error));
    }

    async startBot(): Promise<void> {
        if (!this.enabled || !this.bot) {
            logger.error('Telegram Bot is not configured. Please check .env settings.');
            return;
        }

        logger.success('Starting Qobuz-DL Telegram Bot...');
        logger.info(`Listening for messages from Chat ID: ${this.chatId}`);

        this.setupMiddleware();
        this.setupCommands();
        this.setupCallbackHandlers();
        this.setupTextHandler();
        this.setupShutdownHandlers();

        try {
            await this.bot.launch();
            logger.success('Bot is running! Press Ctrl+C to stop.');
        } catch (error) {
            logger.error(`Failed to launch bot: ${error}`);
        }
    }

    private setupMiddleware(): void {
        this.bot!.use(async (ctx, next) => {
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

            if (userId && !rateLimiter.isAllowed(userId)) {
                const resetTime = Math.ceil(rateLimiter.getResetTime(userId) / 1000);
                logger.warn(`Rate limited user: ${userId} (${ctx.from?.username})`);
                await ctx.reply(
                    '⏳ <b>Rate Limited</b>\n\n' +
                        'You\'re sending too many requests.\n' +
                        `Please wait <b>${resetTime}</b> seconds before trying again.`,
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (ctx.message && 'text' in ctx.message) {
                logger.msg(`Message from ${ctx.from?.username} (${userId}): ${ctx.message.text}`);
            }

            await next();
        });
    }

    private setupCommands(): void {
        this.bot!.start((ctx) => {
            ctx.reply(buildWelcomeMessage(), { parse_mode: 'HTML' });
        });

        this.bot!.help((ctx) => {
            ctx.reply(buildHelpMessage(), { parse_mode: 'HTML' });
        });

        this.bot!.command('search', async (ctx) => {
            const query = ctx.message.text.split(' ').slice(1).join(' ');
            logger.info(`Search command: ${query}`);
            if (!query) {
                await ctx.reply(
                    '⚠️ Please provide a search query.\nExample: <code>/search adele</code>',
                    { parse_mode: 'HTML' }
                );
                return;
            }
            await this.searchHandler.handleSearch(ctx as any, query);
        });

        this.bot!.command(['settings', 'setting'], async (ctx) => {
            await this.settingsHandler.handleSettings(ctx as any);
        });

        this.bot!.command('queue', async (ctx) => {
            const parts = ctx.message.text.split(' ');
            const action = parts[1];
            await this.settingsHandler.handleQueue(ctx as any, action);
        });
    }

    private setupCallbackHandlers(): void {
        this.bot!.action(/^set_bot_quality_(.+)$/, async (ctx) => {
            const value = ctx.match[1];
            await this.settingsHandler.updateQuality(ctx as any, value);
        });

        this.bot!.action(/^search_(tracks|albums|artists|playlists)_(.+)$/, async (ctx) => {
            const [, type, query] = ctx.match;
            logger.info(`Search category selected: ${type} for query "${query}"`);
            await ctx.answerCbQuery(`Searching ${type}...`);
            await this.searchHandler.handleSearchCategory(ctx as any, query, type as any);
        });

        this.bot!.action(/^search_back_(.+)$/, async (ctx) => {
            const query = ctx.match[1];
            await ctx.answerCbQuery();
            await this.searchHandler.handleSearch(ctx as any, query, true);
        });

        this.bot!.action(/^dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)_(.+)$/, async (ctx) => {
            const [, type, id, quality] = ctx.match;
            logger.info(`Download requested via callback: ${type} ${id} (Quality: ${quality})`);
            await ctx.answerCbQuery('Adding to queue...');

            const q = parseInt(quality, 10) || 27;

            try {
                await this.downloadHandler.queueDownload(id, type as DownloadType, q);
            } catch (error: any) {
                await ctx.reply(`⚠️ ${error.message}`);
            }
        });

        this.bot!.action(/^ask_dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)$/, async (ctx) => {
            const [, type, id] = ctx.match;
            if (type === 'track') {
                await this.searchHandler.askQuality(ctx as any, type, id);
            } else {
                await ctx.answerCbQuery('Fetching info...');
                await this.searchHandler.handleInfoRequest(ctx as any, id, type);
            }
        });

        this.bot!.action(/^queue_(clear|pause|resume|refresh)$/, async (ctx) => {
            const action = ctx.match[1];
            await this.settingsHandler.handleQueueCallback(ctx as any, action);
        });
    }

    private setupTextHandler(): void {
        this.bot!.hears(/^\/dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)/, async (ctx) => {
            const match = ctx.message.text.match(
                /^\/dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)/
            );
            if (!match) return;

            const [, type, id] = match;
            const quality = this.downloadHandler.resolveQuality(CONFIG.quality.default);

            try {
                await this.downloadHandler.queueDownload(id, type as DownloadType, quality);
            } catch (error: any) {
                await ctx.reply(`⚠️ ${error.message}`);
            }
        });

        this.bot!.on('text', async (ctx) => {
            const message = ctx.message.text;

            if (message.startsWith('/')) return;
            if (!message.includes('qobuz.com')) return;

            const parsed = this.searchHandler.parseUrl(message);
            if (!parsed) {
                await ctx.reply('❌ Invalid Qobuz URL.');
                return;
            }

            const processingMsg = await ctx.reply(`🔍 Processing ${parsed.type}: ${parsed.id}...`);

            if (parsed.type === 'track') {
                const botQuality = botSettingsService.quality;
                if (botQuality === 'ask') {
                    await this.searchHandler.askQuality(ctx as any, parsed.type, parsed.id);
                } else {
                    try {
                        await this.downloadHandler.queueDownload(parsed.id, 'track', botQuality);
                    } catch (error: any) {
                        await this.sendError('Bot Download Error', error.message);
                    }
                }
            } else {
                try {
                    await this.searchHandler.handleInfoRequest(ctx as any, parsed.id, parsed.type);
                } catch (error: any) {
                    await this.sendError('Info Error', error.message);
                }
            }

            void processingMsg;
        });
    }

    private setupShutdownHandlers(): void {
        process.once('SIGINT', () => this.bot!.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot!.stop('SIGTERM'));
    }

    getQueueStats() {
        return downloadQueue.getStats();
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}

export const telegramService = new TelegramService();
