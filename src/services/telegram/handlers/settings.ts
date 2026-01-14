import { Telegraf } from 'telegraf';
import { getQualityName } from '../../../config.js';
import { botSettingsService } from '../../bot-settings.js';
import { logger } from '../../../utils/logger.js';
import { TelegramContext } from '../types.js';
import { createKeyboard } from '../utils.js';
import { buildSettingsMessage, buildQueueMessage } from '../messages.js';
import { downloadQueue } from '../queue.js';

export class SettingsHandler {
    private bot: Telegraf;
    private chatId: string;

    constructor(bot: Telegraf, chatId: string) {
        this.bot = bot;
        this.chatId = chatId;
    }

    async handleSettings(ctx: TelegramContext, isUpdate: boolean = false): Promise<void> {
        const currentQuality = botSettingsService.quality;
        const qualityName =
            currentQuality === 'ask'
                ? 'Interactive (Ask Every Time)'
                : getQualityName(currentQuality);

        const msg = buildSettingsMessage(qualityName);

        const keyboard = createKeyboard([
            [
                { text: '🔥 Hi-Res (192)', callback_data: 'set_bot_quality_27' },
                { text: '✨ Hi-Res (96)', callback_data: 'set_bot_quality_7' }
            ],
            [
                { text: '💿 CD Quality', callback_data: 'set_bot_quality_6' },
                { text: '🎵 MP3', callback_data: 'set_bot_quality_5' }
            ],
            [{ text: '❓ Interactive (Ask Every Time)', callback_data: 'set_bot_quality_ask' }]
        ]);

        if (isUpdate) {
            try {
                await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
            } catch {}
        } else {
            await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
        }
    }

    async updateQuality(ctx: TelegramContext, value: string): Promise<void> {
        botSettingsService.quality = value === 'ask' ? 'ask' : parseInt(value, 10);
        logger.success(`Settings: Quality updated to ${value} by user ${ctx.from?.id}`);
        await ctx.answerCbQuery(`✅ Quality updated to ${value}`);
        await this.handleSettings(ctx, true);
    }

    async handleQueue(ctx: TelegramContext, action?: string): Promise<void> {
        if (action === 'clear') {
            const cleared = downloadQueue.clearCompleted();
            const clearedPending = downloadQueue.clearPending();
            await ctx.reply(`🗑️ Cleared ${cleared + clearedPending} items from queue.`);
            return;
        }

        if (action === 'pause') {
            downloadQueue.pause();
            await ctx.reply('⏸️ Queue paused. Use /queue resume to continue.');
            return;
        }

        if (action === 'resume') {
            downloadQueue.resume();
            await ctx.reply('▶️ Queue resumed.');
            return;
        }

        const items = downloadQueue.getAll();
        const stats = downloadQueue.getStats();
        const msg = buildQueueMessage(items, stats);

        const keyboard = createKeyboard([
            [
                { text: '🗑️ Clear Queue', callback_data: 'queue_clear' },
                {
                    text: downloadQueue.isPaused() ? '▶️ Resume' : '⏸️ Pause',
                    callback_data: downloadQueue.isPaused() ? 'queue_resume' : 'queue_pause'
                }
            ],
            [{ text: '🔄 Refresh', callback_data: 'queue_refresh' }]
        ]);

        await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    async handleQueueCallback(ctx: TelegramContext, action: string): Promise<void> {
        switch (action) {
            case 'clear': {
                const cleared = downloadQueue.clearCompleted();
                const clearedPending = downloadQueue.clearPending();
                await ctx.answerCbQuery(`Cleared ${cleared + clearedPending} items`);
                await this.handleQueue(ctx);
                break;
            }
            case 'pause':
                downloadQueue.pause();
                await ctx.answerCbQuery('Queue paused');
                await this.handleQueue(ctx);
                break;
            case 'resume':
                downloadQueue.resume();
                await ctx.answerCbQuery('Queue resumed');
                await this.handleQueue(ctx);
                break;
            case 'refresh':
                await ctx.answerCbQuery('Refreshed');
                await this.handleQueue(ctx);
                break;
        }
    }
}
