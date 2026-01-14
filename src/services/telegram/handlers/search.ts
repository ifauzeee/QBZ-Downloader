import { Telegraf } from 'telegraf';
import QobuzAPI from '../../../api/qobuz.js';

import { settingsService } from '../../settings.js';
import { getQualityName } from '../../../config.js';
import { SearchCategory, TelegramContext, InlineKeyboardRow } from '../types.js';
import { escapeHtml, truncate, createKeyboard } from '../utils.js';
import {
    buildSearchMessage,
    buildSearchResultsMessage,
    buildAlbumInfoMessage,
    buildPlaylistInfoMessage,
    buildArtistInfoMessage,
    buildQualitySelectMessage
} from '../messages.js';

export class SearchHandler {
    private bot: Telegraf;
    private chatId: string;
    private api: QobuzAPI;

    constructor(bot: Telegraf, chatId: string, api: QobuzAPI) {
        this.bot = bot;
        this.chatId = chatId;
        this.api = api;
    }

    async handleSearch(
        ctx: TelegramContext,
        query: string,
        isUpdate: boolean = false
    ): Promise<void> {
        const msg = buildSearchMessage(query);
        const keyboard = createKeyboard([
            [
                { text: '🎵 Tracks', callback_data: `search_tracks_${query}` },
                { text: '💿 Albums', callback_data: `search_albums_${query}` }
            ],
            [
                { text: '👤 Artists', callback_data: `search_artists_${query}` },
                { text: '📜 Playlists', callback_data: `search_playlists_${query}` }
            ]
        ]);

        if (isUpdate) {
            try {
                await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
            } catch {}
        } else {
            await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
        }
    }

    async handleSearchCategory(
        ctx: TelegramContext,
        query: string,
        type: SearchCategory
    ): Promise<void> {
        try {
            const result = await this.api.search(query, type, 10);
            if (!result.success || !result.data) {
                throw new Error('No results found.');
            }

            let items: any[] = [];

            if (type === 'tracks') {
                items = result.data.tracks?.items || [];
            } else if (type === 'albums') {
                items = result.data.albums?.items || [];
            } else if (type === 'artists') {
                items = result.data.artists?.items || [];
            } else if (type === 'playlists') {
                items = result.data.playlists?.items || [];
            }

            if (items.length === 0) {
                await ctx.reply(`❌ No ${type} found for "<code>${escapeHtml(query)}</code>"`, {
                    parse_mode: 'HTML'
                });
                return;
            }

            const botQuality = settingsService.get('defaultQuality') as number | 'ask';
            const keyboardRows: InlineKeyboardRow[] = items.map((item) => {
                let text = '';
                let cb = '';

                if (type === 'tracks') {
                    text = `🎵 ${item.title} - ${item.performer?.name}`;
                    cb =
                        botQuality === 'ask'
                            ? `ask_dl_track_${item.id}`
                            : `dl_track_${item.id}_${botQuality}`;
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

                return [{ text: truncate(text, 60), callback_data: cb }];
            });

            keyboardRows.push([
                { text: '⬅️ Back to Categories', callback_data: `search_back_${query}` }
            ]);

            const msg = buildSearchResultsMessage(query, type, items.length);

            await ctx.editMessageText(msg, {
                parse_mode: 'HTML',
                reply_markup: createKeyboard(keyboardRows)
            });
        } catch (error: any) {
            await ctx.reply(`⚠️ ${error.message}`);
        }
    }

    async handleInfoRequest(
        ctx: TelegramContext,
        id: string | number,
        type: string
    ): Promise<void> {
        const botQuality = settingsService.get('defaultQuality') as number | 'ask';

        if (type === 'album') {
            await this.handleAlbumInfo(ctx, id, botQuality);
        } else if (type === 'playlist') {
            await this.handlePlaylistInfo(ctx, id, botQuality);
        } else if (type === 'artist') {
            await this.handleArtistInfo(ctx, id, botQuality);
        }
    }

    private async handleAlbumInfo(
        ctx: TelegramContext,
        id: string | number,
        botQuality: number | 'ask'
    ): Promise<void> {
        const info = await this.api.getAlbum(id);
        if (!info.success || !info.data) {
            throw new Error('Album not found');
        }
        const album = info.data;

        const keyboardRows: InlineKeyboardRow[] = [];

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

        if (album.tracks?.items) {
            album.tracks.items.forEach((track) => {
                keyboardRows.push([
                    {
                        text: `🎵 ${truncate(track.title, 30)}`,
                        callback_data:
                            botQuality === 'ask'
                                ? `ask_dl_track_${track.id}`
                                : `dl_track_${track.id}_${botQuality}`
                    }
                ]);
            });
        }

        const msg = buildAlbumInfoMessage(
            album.title,
            album.artist.name,
            String(album.release_date_original || 'N/A'),
            album.tracks_count,
            album.tracks?.items?.map((t) => ({ title: t.title }))
        );

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            reply_markup: createKeyboard(keyboardRows)
        });
    }

    private async handlePlaylistInfo(
        ctx: TelegramContext,
        id: string | number,
        botQuality: number | 'ask'
    ): Promise<void> {
        const info = await this.api.getPlaylist(id);
        if (!info.success || !info.data) {
            throw new Error('Playlist not found');
        }
        const playlist = info.data;

        const keyboardRows: InlineKeyboardRow[] = [];

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

        if (playlist.tracks?.items) {
            playlist.tracks.items.forEach((track) => {
                keyboardRows.push([
                    {
                        text: `🎵 ${truncate(track.title, 30)}`,
                        callback_data:
                            botQuality === 'ask'
                                ? `ask_dl_track_${track.id}`
                                : `dl_track_${track.id}_${botQuality}`
                    }
                ]);
            });
        }

        const msg = buildPlaylistInfoMessage(
            playlist.name,
            playlist.owner?.name || 'N/A',
            playlist.tracks.total,
            playlist.tracks?.items?.map((t) => ({ title: t.title }))
        );

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            reply_markup: createKeyboard(keyboardRows)
        });
    }

    private async handleArtistInfo(
        ctx: TelegramContext,
        id: string | number,
        botQuality: number | 'ask'
    ): Promise<void> {
        const info = await this.api.getArtist(id);
        if (!info.success || !info.data) {
            throw new Error('Artist not found');
        }
        const artist = info.data as any;

        const keyboardRows: InlineKeyboardRow[] = [];

        if (botQuality === 'ask') {
            keyboardRows.push([
                { text: '🔥 Hi-Res', callback_data: `dl_artist_${id}_27` },
                { text: '💿 CD', callback_data: `dl_artist_${id}_6` },
                { text: 'MP3', callback_data: `dl_artist_${id}_5` }
            ]);
        } else {
            keyboardRows.push([
                {
                    text: `📥 Download Discography (${getQualityName(botQuality)})`,
                    callback_data: `dl_artist_${id}_${botQuality}`
                }
            ]);
        }

        const msg = buildArtistInfoMessage(artist.name, artist.albums_count);

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            reply_markup: createKeyboard(keyboardRows)
        });
    }

    async askQuality(ctx: TelegramContext, type: string, id: string | number): Promise<void> {
        const msg = buildQualitySelectMessage(type, id);

        await ctx.reply(msg, {
            parse_mode: 'HTML',
            reply_markup: createKeyboard([
                [
                    { text: '🔥 Hi-Res (192kHz)', callback_data: `dl_${type}_${id}_27` },
                    { text: '✨ Hi-Res (96kHz)', callback_data: `dl_${type}_${id}_7` }
                ],
                [
                    { text: '💿 CD (16-bit)', callback_data: `dl_${type}_${id}_6` },
                    { text: '🎵 MP3 (320kbps)', callback_data: `dl_${type}_${id}_5` }
                ]
            ])
        });
    }

    parseUrl(url: string): { type: string; id: string } | null {
        return this.api.parseUrl(url);
    }
}
