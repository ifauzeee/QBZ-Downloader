import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { printBox, printHeader, printLogo } from './ui.js';
import { COLORS, SYMBOLS } from './theme.js';
import {
    Album,
    Track,
    UserInfo,
    DownloadResultSummary,
    SearchResults,
    LyricsResult,
    Artist
} from '../types/qobuz.js';

export { printLogo as displayBanner };

let progressBar: cliProgress.SingleBar | null = null;

const stripAnsi = (str: string) => {
    const pattern =
        '[' +
        String.fromCharCode(27) +
        String.fromCharCode(155) +
        ']' +
        '[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]';
    return str.replace(new RegExp(pattern, 'g'), '');
};

const getVisibleWidth = (str: string) => {
    const stripped = stripAnsi(str);
    let width = 0;
    for (const char of stripped) {
        const code = char.charCodeAt(0);
        if (code >= 0x1f000 || (code >= 0xd800 && code <= 0xdbff)) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
};

const center = (text: string, width: number) => {
    const visibleWidth = getVisibleWidth(text);
    if (visibleWidth >= width) return text;
    const padding = Math.floor((width - visibleWidth) / 2);
    const rightPadding = width - visibleWidth - padding;
    return ' '.repeat(padding) + text + ' '.repeat(rightPadding);
};

const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.substring(0, length - 3) + '...';
};

export function displayProgress(
    phase: 'download_start' | 'download' | 'lyrics' | 'cover' | 'tagging',
    loaded: number,
    total?: number
) {
    if (!progressBar) {
        progressBar = new cliProgress.SingleBar({
            format: `${chalk.hex(COLORS.primary)('{bar}')} | {percentage}% | {value}/{total} | {status}`,
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            barsize: 30
        });
        progressBar.start(total || 100, 0, { status: 'Starting...' });
    }

    if (phase === 'download_start') {
        progressBar.start(total || 100, 0, { status: chalk.white('Preparing...') });
    } else if (phase === 'download') {
        if (total) progressBar.setTotal(total);
        progressBar.update(loaded, { status: chalk.cyan('Downloading') });
    } else if (phase === 'lyrics') {
        const val = (progressBar as unknown as { value: number }).value;
        progressBar.update(val, { status: chalk.yellow('Lyrics') });
    } else if (phase === 'cover') {
        const val = (progressBar as unknown as { value: number }).value;
        progressBar.update(val, { status: chalk.yellow('Cover Art') });
    } else if (phase === 'tagging') {
        progressBar.update(progressBar.getTotal(), { status: chalk.magenta('Tagging') });
    }
}

export function stopProgress() {
    if (progressBar) {
        progressBar.stop();
        progressBar = null;
    }
}

export function spinnerMessage(text: string) {
    return chalk.hex(COLORS.primary)(text);
}

export function displayAccountInfo(userInfo: UserInfo) {
    const plan = userInfo.subscription?.offer || 'Free';
    const hires = userInfo.hires_streaming ? chalk.green('Yes') : chalk.red('No');

    const content = [
        `${chalk.bold('UserID')} : ${chalk.white(userInfo.email || userInfo.id)}`,
        `${chalk.bold('Country')} : ${chalk.white(userInfo.country_code)}`,
        `${chalk.bold('Plan')}    : ${chalk.hex(COLORS.success)(plan)}`,
        `${chalk.bold('Hi-Res')}  : ${hires}`
    ].join('\n');

    printBox(content, '👤 Account Information');
}

export function displayAlbumInfo(album: Album) {
    const year = album.released_at ? new Date(album.released_at * 1000).getFullYear() : 'N/A';
    const duration = formatDuration(album.duration);
    const quality = album.hires
        ? chalk.hex(COLORS.success)('Hi-Res 24-bit')
        : chalk.yellow('CD Quality');

    const title = chalk.bold.white(album.title);
    const artist = chalk.hex(COLORS.secondary)(album.artist?.name || 'Unknown Artist');

    const width = 50;
    const header = `${center(title, width)}\n${center(artist, width)}`;
    const divider = chalk.gray('─'.repeat(width));

    const meta = [
        `${SYMBOLS.time} ${chalk.white(year)}`,
        `🏢 ${chalk.white(album.label?.name || 'N/A')}`,
        `${SYMBOLS.music} ${chalk.white(album.genre?.name || 'Unknown Genre')}`,
        `⏱️ ${chalk.white(duration)}`,
        `${SYMBOLS.quality} ${quality}`
    ]
        .map((line) => ` ${line}`)
        .join('\n');

    printBox(`${header}\n\n${divider}\n\n${meta}`, '💿 Album Details');
}

export function displayTrackInfo(track: Track) {
    const title = chalk.bold.white(track.title);
    const artist = chalk.hex(COLORS.secondary)(track.performer?.name);

    const width = 40;
    const content = `
${center(title, width)}
${center(artist, width)}

${chalk.gray('─'.repeat(width))}

⏱️  ${chalk.white(formatDuration(track.duration))}
${SYMBOLS.quality}  ${track.hires ? chalk.hex(COLORS.success)('Hi-Res') : chalk.yellow('CD Quality')}
${track.album ? `💿  ${chalk.gray(track.album.title)}` : ''}
    `.trim();

    printBox(content, '🎵 Track Details');
}

export function displayTrackList(tracks: Track[]) {
    printHeader('Track List');

    const hNo = chalk.gray('#');
    const hTitle = chalk.gray('TITLE');
    const hTime = chalk.gray('TIME');
    const hQ = chalk.gray('Q');

    console.log(`  ${hNo}   ${hTitle.padEnd(45)} ${hTime.padEnd(8)} ${hQ}`);
    console.log(chalk.gray('  ' + '─'.repeat(60)));

    tracks.forEach((t, i) => {
        const num = chalk.hex(COLORS.primary)((i + 1).toString().padStart(2, '0'));
        const title = chalk.white(truncate(t.title, 43));
        const time = chalk.gray(formatDuration(t.duration));
        const q = t.hires ? chalk.green('HR') : chalk.yellow('CD');

        console.log(`  ${num}   ${title.padEnd(45)} ${time.padEnd(8)} ${q}`);
    });
    console.log();
}

export function displayMetadata(metadata: Record<string, unknown>) {
    const maxKeyLen = Math.max(...Object.keys(metadata).map((k) => k.length));

    const content = Object.entries(metadata)
        .map(([key, val]) => {
            if (!val || typeof val === 'object') return null;
            const keyStr = chalk.hex(COLORS.primary)(key.padEnd(maxKeyLen));
            return `${keyStr} : ${chalk.white(val)}`;
        })
        .filter(Boolean)
        .join('\n');

    printBox(content, '📝 Metadata Preview');
}

export function displaySearchResults(results: SearchResults, type: string) {
    printHeader(`Search Results: ${type.toUpperCase()}`);

    if (!results || !results[`${type}`]?.items?.length) {
        console.log(chalk.gray('   No results found.'));
        return;
    }

    const section = results[`${type}`];
    if (!section || !section.items) return;
    const items = section.items;

    items.forEach((item: Album | Track | Artist, i: number) => {
        const num = chalk.hex(COLORS.primary)(`[${i + 1}]`.padEnd(4));
        let top = '';
        let bottom = '';

        if (type === 'albums') {
            const album = item as Album;
            top = chalk.bold.white(album.title);
            bottom = chalk.gray(album.artist?.name || 'Unknown Artist');
        } else if (type === 'tracks') {
            const track = item as Track;
            top = chalk.bold.white(track.title);
            bottom = chalk.gray(`${track.performer?.name} • ${track.album?.title}`);
        } else if (type === 'artists') {
            const artist = item as Artist;
            top = chalk.bold.white(artist.name);
            bottom = chalk.gray(`${artist.albums_count || 0} Albums`);
        }

        console.log(` ${num} ${top}`);
        if (bottom) console.log(`      ${bottom}`);
        console.log(chalk.blackBright('      ' + '─'.repeat(40)));
    });
    console.log();
}

export function displayLyrics(lyrics: LyricsResult) {
    if (!lyrics.success) {
        console.log(chalk.gray('No lyrics found.'));
        return;
    }

    const lines = lyrics.syncedLyrics
        ? lyrics
            .parsedLyrics!.slice(0, 8)
            .map((l) => `${chalk.hex(COLORS.secondary)(l.timeStr)}  ${chalk.white(l.text)}`)
        : lyrics.plainLyrics!.split('\n').slice(0, 8);

    const text = Array.isArray(lines) ? lines.join('\n') : lines;

    printBox(
        text + '\n\n' + chalk.gray(center('... full lyrics in file ...', 40)),
        '🎤 Lyrics Preview'
    );
}

export function displayQualityOptions() {
    const content = `
${chalk.hex(COLORS.primary)('5')}  : MP3 320kbps
${chalk.hex(COLORS.primary)('6')}  : FLAC 16-bit / 44.1kHz (CD)
${chalk.hex(COLORS.primary)('7')}  : FLAC 24-bit / 96kHz   (Hi-Res)
${chalk.hex(COLORS.primary)('27')} : FLAC 24-bit / 192kHz  (Max)
    `.trim();
    printBox(content, 'Available Qualities');
}

export function displayDownloadSummary(results: DownloadResultSummary) {
    const total = results.totalTracks || 1;
    const success = results.completedTracks || (results.success ? 1 : 0);
    const failed = results.failedTracks || (results.success ? 0 : 1);

    const title = results.title || results.name || 'Unknown';
    const artist = results.artist || 'Unknown';

    const rate = Math.round((success / total) * 100);
    const rateColor = rate === 100 ? 'green' : rate > 50 ? 'yellow' : 'red';

    const content = `
${chalk.bold.white(truncate(title, 40))}
${chalk.gray(artist)}

${chalk.gray('─'.repeat(40))}

${chalk.bold('Progress')} : ${chalk[rateColor](`${success}/${total}`)} (${rate}%)
${chalk.green('Success')}  : ${success}
${chalk.red('Failed')}   : ${failed}
    `.trim();

    const style = failed > 0 ? (success > 0 ? 'warning' : 'error') : 'success';
    const headerTitle = failed === 0 ? '✨ Download Complete' : '⚠️  Download Finished';

    printBox(content, headerTitle, style);
}

export function displaySuccess(msg: string) {
    console.log(chalk.hex(COLORS.success)(`\n${SYMBOLS.success} ${msg}`));
}

export function displayError(msg: string) {
    console.log(chalk.hex(COLORS.error)(`\n${SYMBOLS.error} ${msg}`));
}

function formatDuration(seconds: number) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
