import chalk from 'chalk';
import Table from 'cli-table3';
import cliProgress from 'cli-progress';
import { printBox, printHeader, printSuccess, printError, printLogo } from './ui.js';
import { COLORS, SYMBOLS } from './theme.js';

export { printLogo as displayBanner };
export { printSuccess as displaySuccess };
export { printError as displayError };

let progressBar: cliProgress.SingleBar | null = null;

export function displayProgress(
    phase: 'download_start' | 'download' | 'lyrics' | 'cover' | 'tagging',
    loaded: number,
    total?: number
) {
    if (!progressBar) {
        progressBar = new cliProgress.SingleBar({
            format: ' {bar} | {percentage}% | {value}/{total} | {status}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        progressBar.start(total || 100, 0, { status: 'Starting...' });
    }

    if (phase === 'download_start') {
        progressBar.start(total || 100, 0, { status: 'Downloading...' });
    } else if (phase === 'download') {
        if (total) progressBar.setTotal(total);
        progressBar.update(loaded, { status: chalk.cyan('Downloading') });
    } else if (phase === 'lyrics') {
        progressBar.update((progressBar as any).value, { status: chalk.yellow('Fetching Lyrics') });
    } else if (phase === 'cover') {
        progressBar.update((progressBar as any).value, { status: chalk.yellow('Fetching Cover') });
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

export function displayAccountInfo(userInfo: any) {
    const content = `
${chalk.bold('Email:')}    ${userInfo.email}
${chalk.bold('Country:')}  ${userInfo.country_code}
${chalk.bold('Plan:')}     ${chalk.hex(COLORS.success)(userInfo.subscription?.offer || 'Free')}
${chalk.bold('Hi-Res:')}   ${userInfo.hires_streaming ? SYMBOLS.success : SYMBOLS.error}
    `;
    printBox(content.trim(), '👤 Account Information');
}

export function displayAlbumInfo(album: any) {
    const year = album.released_at ? new Date(album.released_at * 1000).getFullYear() : 'N/A';
    const duration = formatDuration(album.duration);
    const quality = album.hires
        ? chalk.hex(COLORS.success)('Hi-Res 24-bit')
        : chalk.yellow('CD Quality');

    const content = `
${chalk.hex(COLORS.secondary).bold(album.artist?.name || 'Unknown')}
${chalk.white.italic(album.title)}

${chalk.gray('─────────────────────────────')}

📅 ${chalk.white(year)}
🏢 ${chalk.white(album.label?.name || 'N/A')}
🎼 ${chalk.white(album.genre?.name || 'Pop')}
⏱️ ${chalk.white(duration)}
✨ ${quality}
    `.trim();

    printBox(content, '💿 Album Details');
}

export function displayTrackInfo(track: any) {
    const content = `
${chalk.bold(track.title)}
${chalk.hex(COLORS.secondary)(track.performer?.name)}
${chalk.gray(track.album?.title)}

${chalk.gray('─────────────────────────────')}

⏱️ ${formatDuration(track.duration)}
✨ ${track.hires ? 'Hi-Res' : 'CD Quality'}
    `.trim();

    printBox(content, '🎵 Track Details');
}

export function displayTrackList(tracks: any[]) {
    const table = new Table({
        head: [
            chalk.hex(COLORS.primary)('#'),
            chalk.hex(COLORS.primary)('Title'),
            chalk.hex(COLORS.primary)('Time'),
            chalk.hex(COLORS.primary)('Q')
        ],
        chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
        style: { 'padding-left': 1, 'padding-right': 1, border: ['gray'], head: [] },
        colWidths: [6, 40, 10, 8]
    });

    tracks.forEach((t, i) => {
        table.push([
            chalk.gray((i + 1).toString().padStart(2, '0')),
            chalk.white(t.title.substring(0, 38)),
            chalk.gray(formatDuration(t.duration)),
            t.hires ? chalk.green('HR') : chalk.yellow('CD')
        ]);
    });

    console.log(table.toString());
}

export function displayMetadata(metadata: Record<string, any>) {
    const content = Object.entries(metadata)
        .map(([key, val]) => {
            if (!val || typeof val === 'object') return null;
            return `${chalk.hex(COLORS.primary)(key.padEnd(15))}: ${val}`;
        })
        .filter(Boolean)
        .join('\n');

    printBox(content, '📝 Metadata Preview');
}

export function displaySearchResults(results: any, type: string) {
    printHeader(`Search Results: ${type}`);

    if (!results || !results[`${type}`]?.items?.length) {
        console.log(chalk.gray('No results found.'));
        return;
    }

    const items = results[`${type}`].items;

    items.forEach((item: any, i: number) => {
        const num = chalk.hex(COLORS.primary)(`[${i + 1}]`);
        let title = '';
        let subtitle = '';

        if (type === 'albums') {
            title = item.title;
            subtitle = item.artist?.name;
        } else if (type === 'tracks') {
            title = item.title;
            subtitle = `${item.performer?.name} • ${item.album?.title}`;
        } else if (type === 'artists') {
            title = item.name;
            subtitle = `${item.albums_count || 0} Albums`;
        }

        console.log(`${num} ${chalk.bold.white(title)}`);
        console.log(`    ${chalk.gray(subtitle)}`);
        console.log();
    });
}

export function displayLyrics(lyrics: any) {
    if (!lyrics.success) {
        console.log(chalk.gray('No lyrics found.'));
        return;
    }

    const text = lyrics.syncedLyrics
        ? lyrics.parsedLyrics
              .slice(0, 10)
              .map((l: any) => `${chalk.cyan(l.timeStr)} ${l.text}`)
              .join('\n')
        : lyrics.plainLyrics.split('\n').slice(0, 10).join('\n');

    printBox(text + '\n\n' + chalk.gray('...'), '🎤 Lyrics Preview');
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

export function displayDownloadSummary(results: any) {
    const successCount = results.completedTracks || (results.success ? 1 : 0);
    const failCount = results.failedTracks || (results.success ? 0 : 1);

    const content = `
${chalk.bold('Item:')}    ${results.title || results.name}
${chalk.bold('Artist:')}  ${results.artist || 'Unknown'}
${chalk.bold('Total:')}   ${results.totalTracks || 1}

${chalk.green('✔ Success:')} ${successCount}
${chalk.red('✖ Failed:')}  ${failCount}
    `.trim();

    const style = failCount > 0 ? 'warning' : 'success';
    printBox(content, '📊 Download Summary', style);
}

function formatDuration(seconds: number) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
