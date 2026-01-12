/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                    LYRICS PROVIDER API                            ║
 * ║        Fetches synced and unsynced lyrics from multiple sources   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

class LyricsProvider {
    constructor() {
        this.providers = [
            { name: 'LRCLIB', enabled: true },
            { name: 'Genius', enabled: true }
        ];
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    /**
     * Search lyrics from LRCLIB (free, synced lyrics)
     */
    async searchLrclib(title, artist, album = '', duration = 0) {
        try {
            const response = await axios.get('https://lrclib.net/api/get', {
                params: {
                    track_name: title,
                    artist_name: artist,
                    album_name: album,
                    duration: Math.round(duration)
                },
                timeout: 10000
            });

            if (response.data) {
                return {
                    success: true,
                    source: 'LRCLIB',
                    data: {
                        syncedLyrics: response.data.syncedLyrics || null,
                        plainLyrics: response.data.plainLyrics || null,
                        instrumental: response.data.instrumental || false,
                        duration: response.data.duration || 0
                    }
                };
            }
            return { success: false, error: 'No lyrics found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Search lyrics using best match from LRCLIB
     */
    async searchLrclibBest(title, artist) {
        try {
            const response = await axios.get('https://lrclib.net/api/search', {
                params: {
                    q: `${title} ${artist}`
                },
                timeout: 10000
            });

            if (response.data && response.data.length > 0) {

                const match = response.data[0];
                return {
                    success: true,
                    source: 'LRCLIB',
                    data: {
                        syncedLyrics: match.syncedLyrics || null,
                        plainLyrics: match.plainLyrics || null,
                        instrumental: match.instrumental || false,
                        duration: match.duration || 0
                    }
                };
            }
            return { success: false, error: 'No lyrics found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Search lyrics from Genius (Fallback, Unsynced)
     */
    async searchGenius(title, artist) {
        try {
            console.log('    🔍 Searching Genius fallback...');

            const query = `${title} ${artist}`;
            const searchUrl = `https://genius.com/api/search/multi?per_page=1&q=${encodeURIComponent(query)}`;

            const searchRes = await axios.get(searchUrl, {
                headers: { 'User-Agent': this.userAgent }
            });

            const hits = searchRes.data?.response?.sections?.[0]?.hits || [];
            if (hits.length === 0) return { success: false };

            const songUrl = hits[0].result.url;


            const pageRes = await axios.get(songUrl, { headers: { 'User-Agent': this.userAgent } });
            const $ = cheerio.load(pageRes.data);


            let lyrics = '';
            $('[data-lyrics-container="true"]').each((i, elem) => {

                $(elem).find('br').replaceWith('\n');
                lyrics += $(elem).text() + '\n\n';
            });

            lyrics = lyrics.trim();

            if (lyrics) {
                return {
                    success: true,
                    source: 'Genius',
                    data: {
                        syncedLyrics: null,
                        plainLyrics: lyrics,
                        instrumental: false
                    }
                };
            }

            return { success: false, error: 'Lyrics content not found' };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Parse LRC format to structured format
     */
    parseLrc(lrcText) {
        if (!lrcText) return null;

        const lines = lrcText.split('\n');
        const lyrics = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

        for (const line of lines) {
            const match = line.match(timeRegex);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3].padEnd(3, '0'));
                const timeMs = (minutes * 60 + seconds) * 1000 + milliseconds;
                const text = line.replace(timeRegex, '').trim();

                if (text) {
                    lyrics.push({
                        time: timeMs,
                        timeStr: `${match[1]}:${match[2]}.${match[3]}`,
                        text: text
                    });
                }
            }
        }

        return lyrics;
    }

    /**
     * Convert synced lyrics to SYLT format for ID3
     */
    toSylt(syncedLyrics) {
        const parsed = this.parseLrc(syncedLyrics);
        if (!parsed) return null;

        return parsed.map(line => ({
            text: line.text,
            timeStamp: line.time
        }));
    }

    /**
     * Convert synced lyrics to embedded LRC format
     */
    toLrcEmbed(syncedLyrics) {
        if (!syncedLyrics) return null;
        return syncedLyrics;
    }

    /**
     * Get lyrics from all available sources
     */
    async getLyrics(title, artist, album = '', duration = 0) {


        let result = await this.searchLrclib(title, artist, album, duration);


        if (!result.success) {
            result = await this.searchLrclibBest(title, artist);
        }


        if (!result.success) {
            result = await this.searchGenius(title, artist);
        }

        if (result.success) {
            return {
                success: true,
                source: result.source,
                syncedLyrics: result.data.syncedLyrics,
                plainLyrics: result.data.plainLyrics,
                parsedLyrics: this.parseLrc(result.data.syncedLyrics),
                syltFormat: this.toSylt(result.data.syncedLyrics),
                instrumental: result.data.instrumental
            };
        }

        return { success: false, error: 'No lyrics found from any source' };
    }

    /**
     * Format lyrics for CLI display
     */
    formatForDisplay(lyrics, maxLines = 10) {
        if (!lyrics) return 'No lyrics available';

        if (lyrics.syncedLyrics) {
            const parsed = this.parseLrc(lyrics.syncedLyrics);
            if (parsed) {
                return parsed.slice(0, maxLines).map(l =>
                    `[${l.timeStr}] ${l.text}`
                ).join('\n') + (parsed.length > maxLines ? '\n...' : '');
            }
        }

        if (lyrics.plainLyrics) {
            const lines = lyrics.plainLyrics.split('\n').slice(0, maxLines);
            return lines.join('\n') + (lyrics.plainLyrics.split('\n').length > maxLines ? '\n...' : '');
        }

        return 'No lyrics available';
    }
}

export default LyricsProvider;
