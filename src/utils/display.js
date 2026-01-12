/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                       CLI DISPLAY UTILS                           ║
 * ║         Beautiful terminal output with colors and formatting      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import Table from 'cli-table3';
import figlet from 'figlet';
import { CONFIG, getQualityEmoji, getQualityName } from '../config.js';


const qobuzGradient = gradient(['#00c8ff', '#0066ff', '#6600ff']);
const successGradient = gradient(['#00ff88', '#00cc66']);
const errorGradient = gradient(['#ff6b6b', '#ff0000']);
const goldGradient = gradient(['#ffd700', '#ffaa00', '#ff8800']);

/**
 * Display the CLI banner
 */
export function displayBanner() {
    console.clear();

    const banner = figlet.textSync('Qobuz-DL', {
        font: 'ANSI Shadow',
        horizontalLayout: 'default'
    });

    console.log(qobuzGradient(banner));

    console.log(boxen(
        chalk.white.bold('🎵 Premium Qobuz Downloader CLI') + '\n' +
        chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
        chalk.cyan('✨ Hi-Res Audio up to 24bit/192kHz') + '\n' +
        chalk.cyan('📝 Complete Metadata Embedding') + '\n' +
        chalk.cyan('🎤 Synced & Unsynced Lyrics') + '\n' +
        chalk.cyan('🖼️  High-Resolution Cover Art') + '\n' +
        chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
        chalk.gray(`Version 2.0.0 | Made with ${chalk.red('♥')}`),
        {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            textAlignment: 'center'
        }
    ));
}

/**
 * Display account info
 */
export function displayAccountInfo(userInfo) {
    const subscription = userInfo?.subscription?.offer || 'Unknown';
    const country = userInfo?.country_code || 'N/A';
    const email = userInfo?.email || 'N/A';

    console.log(boxen(
        chalk.bold.cyan('👤 Account Information') + '\n\n' +
        `${chalk.gray('Email:')} ${chalk.white(email)}\n` +
        `${chalk.gray('Country:')} ${chalk.white(country)}\n` +
        `${chalk.gray('Subscription:')} ${chalk.green.bold(subscription)}\n` +
        `${chalk.gray('Lossless:')} ${chalk.green('✅ Enabled')}\n` +
        `${chalk.gray('Hi-Res:')} ${chalk.green('✅ Enabled')}`,
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'green'
        }
    ));
}

/**
 * Display quality options
 */
export function displayQualityOptions() {
    const table = new Table({
        head: [
            chalk.cyan('ID'),
            chalk.cyan('Quality'),
            chalk.cyan('Format'),
            chalk.cyan('Description')
        ],
        style: { head: [], border: ['gray'] }
    });

    table.push(
        ['5', '🎵 MP3 320', 'MP3', 'Lossy compression at 320 kbps'],
        ['6', '💿 CD Quality', 'FLAC 16/44.1', 'Lossless CD quality audio'],
        ['7', '✨ Hi-Res', 'FLAC 24/96', 'High-resolution lossless audio'],
        ['27', '🔥 Hi-Res Max', 'FLAC 24/192', 'Maximum quality available']
    );

    console.log('\n' + chalk.bold.cyan('📊 Available Quality Options:\n'));
    console.log(table.toString());
}

/**
 * Display album info
 */
export function displayAlbumInfo(album) {
    const year = album.released_at ? new Date(album.released_at * 1000).getFullYear() : 'N/A';
    const duration = formatDuration(album.duration);
    const hiRes = album.hires ? chalk.green('✅ Hi-Res Available') : chalk.yellow('📀 CD Quality');

    console.log('\n' + boxen(
        goldGradient.multiline(`
╔══════════════════════════════════════╗
║            ALBUM DETAILS             ║
╚══════════════════════════════════════╝
`.trim()) + '\n\n' +
        `${chalk.bold.white('💿 Album:')} ${chalk.cyan(album.title)}\n` +
        `${chalk.bold.white('🎤 Artist:')} ${chalk.yellow(album.artist?.name || 'Unknown')}\n` +
        `${chalk.bold.white('📅 Year:')} ${chalk.white(year)}\n` +
        `${chalk.bold.white('🎵 Tracks:')} ${chalk.white(album.tracks_count || 'N/A')}\n` +
        `${chalk.bold.white('⏱️ Duration:')} ${chalk.white(duration)}\n` +
        `${chalk.bold.white('🏷️ Label:')} ${chalk.gray(album.label?.name || 'N/A')}\n` +
        `${chalk.bold.white('🎼 Genre:')} ${chalk.gray(album.genre?.name || 'N/A')}\n` +
        `${chalk.bold.white('✨ Quality:')} ${hiRes}\n` +
        `${chalk.bold.white('🔗 UPC:')} ${chalk.gray(album.upc || 'N/A')}`,
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
        }
    ));
}

/**
 * Display track info
 */
export function displayTrackInfo(track, albumData = null) {
    const album = track.album || albumData || {};
    const duration = formatDuration(track.duration);
    const quality = track.maximum_bit_depth ?
        `${track.maximum_bit_depth}bit/${track.maximum_sampling_rate}kHz` : 'CD Quality';

    console.log('\n' + boxen(
        chalk.bold.cyan('🎵 Track Information') + '\n\n' +
        `${chalk.gray('Title:')} ${chalk.white.bold(track.title)}\n` +
        `${chalk.gray('Artist:')} ${chalk.yellow(track.performer?.name || 'Unknown')}\n` +
        `${chalk.gray('Album:')} ${chalk.cyan(album.title || 'Unknown')}\n` +
        `${chalk.gray('Track:')} ${chalk.white(`${track.track_number || 1}/${album.tracks_count || 1}`)}\n` +
        `${chalk.gray('Duration:')} ${chalk.white(duration)}\n` +
        `${chalk.gray('Quality:')} ${chalk.green(quality)}\n` +
        `${chalk.gray('ISRC:')} ${chalk.gray(track.isrc || 'N/A')}`,
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        }
    ));
}

/**
 * Display metadata details
 */
export function displayMetadata(metadata) {
    const table = new Table({
        style: { head: [], border: ['gray'] },
        colWidths: [25, 50]
    });

    const display = [
        ['📀 Title', metadata.title],
        ['🎤 Artist', metadata.artist],
        ['👥 Album Artist', metadata.albumArtist],
        ['💿 Album', metadata.album],
        ['📅 Year', metadata.year],
        ['🔢 Track', `${metadata.trackNumber}/${metadata.totalTracks}`],
        ['💽 Disc', `${metadata.discNumber}/${metadata.totalDiscs}`],
        ['🎵 Genre', metadata.genre],
        ['✍️ Composer', metadata.composer || 'N/A'],
        ['🎭 Conductor', metadata.conductor || 'N/A'],
        ['🏭 Producer', metadata.producer || 'N/A'],
        ['🏷️ Label', metadata.label],
        ['©️ Copyright', metadata.copyright?.substring(0, 45) + '...' || 'N/A'],
        ['🔗 ISRC', metadata.isrc],
        ['📊 UPC/Barcode', metadata.upc],
        ['📦 Catalog #', metadata.catalogNumber || 'N/A'],
        ['📆 Release Date', metadata.releaseDate],
        ['⏱️ Duration', metadata.durationFormatted],
        ['🎚️ Bit Depth', `${metadata.bitDepth} bit`],
        ['📻 Sample Rate', `${metadata.sampleRate} kHz`],
        ['✨ Hi-Res', metadata.hiresAvailable ? '✅ Yes' : '❌ No'],
        ['🆔 Qobuz ID', metadata.qobuzTrackId]
    ];

    for (const [key, value] of display) {
        table.push([chalk.cyan(key), chalk.white(value || 'N/A')]);
    }

    console.log('\n' + chalk.bold.magenta('📋 Complete Metadata:\n'));
    console.log(table.toString());
}

/**
 * Display download progress
 */
export function displayProgress(phase, percent, details = {}) {
    const width = 40;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;

    const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentStr = chalk.white.bold(`${percent}%`);

    const phases = {
        'downloading': { icon: '📥', label: 'Downloading' },
        'cover': { icon: '🖼️', label: 'Cover Art' },
        'lyrics': { icon: '🎤', label: 'Lyrics' },
        'metadata': { icon: '📝', label: 'Embedding Metadata' },
        'complete': { icon: '✅', label: 'Complete' }
    };

    const { icon, label } = phases[phase] || { icon: '⏳', label: 'Processing' };

    process.stdout.write(`\r${icon} ${chalk.cyan(label)} [${bar}] ${percentStr}`);

    if (details.speed) {
        process.stdout.write(` ${chalk.gray(details.speed)}`);
    }

    if (phase === 'complete') {
        console.log();
    }
}

/**
 * Display track list
 */
export function displayTrackList(tracks) {
    const table = new Table({
        head: [
            chalk.cyan('#'),
            chalk.cyan('Title'),
            chalk.cyan('Duration'),
            chalk.cyan('Quality')
        ],
        style: { head: [], border: ['gray'] },
        colWidths: [5, 45, 12, 15]
    });

    for (const track of tracks) {
        const quality = track.hires ? '✨ Hi-Res' : '💿 CD';
        table.push([
            chalk.yellow(track.track_number?.toString().padStart(2, '0')),
            chalk.white(track.title?.substring(0, 40) || 'Unknown'),
            chalk.gray(formatDuration(track.duration)),
            quality
        ]);
    }

    console.log('\n' + chalk.bold.cyan('🎵 Track List:\n'));
    console.log(table.toString());
}

/**
 * Display search results
 */
export function displaySearchResults(results, type) {
    console.log('\n' + chalk.bold.cyan(`🔍 Search Results (${type}):\n`));

    if (type === 'albums') {
        const table = new Table({
            head: [
                chalk.cyan('#'),
                chalk.cyan('Album'),
                chalk.cyan('Artist'),
                chalk.cyan('Year'),
                chalk.cyan('Tracks'),
                chalk.cyan('Quality')
            ],
            style: { head: [], border: ['gray'] },
            colWidths: [4, 35, 25, 8, 8, 12]
        });

        results.albums?.items?.forEach((album, i) => {
            const year = album.released_at ? new Date(album.released_at * 1000).getFullYear() : 'N/A';
            const quality = album.hires ? '✨Hi-Res' : '💿 CD';
            table.push([
                chalk.yellow((i + 1).toString()),
                chalk.white(album.title?.substring(0, 32) || 'Unknown'),
                chalk.gray(album.artist?.name?.substring(0, 22) || 'Unknown'),
                chalk.white(year),
                chalk.white(album.tracks_count || 0),
                quality
            ]);
        });

        console.log(table.toString());
    } else if (type === 'tracks') {
        const table = new Table({
            head: [
                chalk.cyan('#'),
                chalk.cyan('Title'),
                chalk.cyan('Artist'),
                chalk.cyan('Album'),
                chalk.cyan('Duration')
            ],
            style: { head: [], border: ['gray'] },
            colWidths: [4, 30, 20, 25, 10]
        });

        results.tracks?.items?.forEach((track, i) => {
            table.push([
                chalk.yellow((i + 1).toString()),
                chalk.white(track.title?.substring(0, 27) || 'Unknown'),
                chalk.gray(track.performer?.name?.substring(0, 17) || 'Unknown'),
                chalk.cyan(track.album?.title?.substring(0, 22) || 'Unknown'),
                chalk.white(formatDuration(track.duration))
            ]);
        });

        console.log(table.toString());
    } else if (type === 'artists') {
        const table = new Table({
            head: [
                chalk.cyan('#'),
                chalk.cyan('Artist'),
                chalk.cyan('Albums'),
                chalk.cyan('Genre')
            ],
            style: { head: [], border: ['gray'] },
            colWidths: [4, 40, 10, 30]
        });

        results.artists?.items?.forEach((artist, i) => {
            table.push([
                chalk.yellow((i + 1).toString()),
                chalk.white(artist.name?.substring(0, 37) || 'Unknown'),
                chalk.cyan(artist.albums_count || 0),
                chalk.gray(artist.genres?.slice(0, 2).join(', ') || 'N/A')
            ]);
        });

        console.log(table.toString());
    }
}

/**
 * Display lyrics
 */
export function displayLyrics(lyrics, maxLines = 15) {
    if (!lyrics || (!lyrics.syncedLyrics && !lyrics.plainLyrics)) {
        console.log(chalk.yellow('\n⚠️ No lyrics available for this track.\n'));
        return;
    }

    console.log('\n' + boxen(
        chalk.bold.magenta('🎤 Lyrics') + '\n' +
        chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n\n' +
        (lyrics.syncedLyrics ?
            chalk.cyan('[Synced Lyrics Available]') + '\n\n' +
            lyrics.parsedLyrics?.slice(0, maxLines).map(l =>
                chalk.gray(`[${l.timeStr}]`) + ' ' + chalk.white(l.text)
            ).join('\n') :
            lyrics.plainLyrics?.split('\n').slice(0, maxLines).map(l =>
                chalk.white(l)
            ).join('\n')
        ) +
        (((lyrics.parsedLyrics?.length || 0) > maxLines ||
            (lyrics.plainLyrics?.split('\n').length || 0) > maxLines) ?
            '\n' + chalk.gray('... (lyrics truncated)') : ''),
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'magenta'
        }
    ));
}

/**
 * Display success message
 */
export function displaySuccess(message) {
    console.log('\n' + boxen(
        chalk.green.bold('✅ SUCCESS') + '\n\n' + chalk.white(message),
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'green'
        }
    ));
}

/**
 * Display error message
 */
export function displayError(message) {
    console.log('\n' + boxen(
        chalk.red.bold('❌ ERROR') + '\n\n' + chalk.white(message),
        {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'red'
        }
    ));
}

/**
 * Display warning message
 */
export function displayWarning(message) {
    console.log(chalk.yellow(`\n⚠️  ${message}\n`));
}

/**
 * Display info message
 */
export function displayInfo(message) {
    console.log(chalk.cyan(`\nℹ️  ${message}\n`));
}

/**
 * Display download summary
 */
export function displayDownloadSummary(results) {
    const total = results.tracks?.length || 1;
    const completed = results.completedTracks || (results.success ? 1 : 0);
    const failed = results.failedTracks || (results.success ? 0 : 1);

    console.log('\n' + boxen(
        goldGradient('═══════════════════════════════════') + '\n' +
        chalk.bold.white('        📊 DOWNLOAD SUMMARY        ') + '\n' +
        goldGradient('═══════════════════════════════════') + '\n\n' +
        `${chalk.gray('Album/Track:')} ${chalk.cyan(results.title || 'Unknown')}\n` +
        `${chalk.gray('Artist:')} ${chalk.yellow(results.artist || 'Unknown')}\n` +
        `${chalk.gray('Total Tracks:')} ${chalk.white(total)}\n` +
        `${chalk.gray('Completed:')} ${chalk.green(completed + ' ✅')}\n` +
        `${chalk.gray('Failed:')} ${failed > 0 ? chalk.red(failed + ' ❌') : chalk.gray('0')}\n` +
        `${chalk.gray('Status:')} ${results.success ? chalk.green.bold('SUCCESS ✨') : chalk.red.bold('PARTIAL FAILURE')}`,
        {
            padding: 1,
            borderStyle: 'double',
            borderColor: results.success ? 'green' : 'yellow'
        }
    ));
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create a spinner message
 */
export function spinnerMessage(text) {
    return chalk.cyan('⏳ ') + chalk.white(text);
}
