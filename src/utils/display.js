import chalk from 'chalk';

import gradient from 'gradient-string';
import Table from 'cli-table3';
import figlet from 'figlet';

const titleGradient = gradient(['#4FACFE', '#00F2FE']);
const goldGradient = gradient(['#FDC830', '#F37335']);

export function displayBanner() {
    console.clear();

    const banner = figlet.textSync('Qobuz-DL', {
        font: 'ANSI Shadow',
        horizontalLayout: 'default'
    });

    console.log(titleGradient(banner));

    console.log('\n' + chalk.bold.white('🎵 Premium High-Res Downloader'));
    console.log(chalk.gray('─────────────────────────────────────'));
    console.log(chalk.hex('#4FACFE')('✨ Up to 24bit/192kHz Hi-Res Audio'));
    console.log(chalk.hex('#00F2FE')('📝 Complete Metadata & Cover Art'));
    console.log(chalk.hex('#43E97B')('🎤 Synced Lyrics Support'));
    console.log(chalk.gray('─────────────────────────────────────'));
    console.log(chalk.dim('v1.0.0 | High-Fidelity Experience') + '\n');
}

export function displayAccountInfo(userInfo) {
    const subscription = userInfo?.subscription?.offer || 'Unknown';
    const country = userInfo?.country_code || 'N/A';
    const email = userInfo?.email || 'N/A';

    console.log('\n' + chalk.bold.hex('#00F2FE')('👤 Account Details'));
    console.log(chalk.gray('────────────────') + '\n');
    console.log(`${chalk.hex('#A0AEB8')('📧 Email       :')} ${chalk.white(email)}`);
    console.log(`${chalk.hex('#A0AEB8')('🌍 Country     :')} ${chalk.white(country)}`);
    console.log(
        `${chalk.hex('#A0AEB8')('💎 Plan        :')} ${chalk.hex('#00F260')(subscription)}`
    );
    console.log(`${chalk.hex('#A0AEB8')('🎧 Hi-Res Audio:')} ${chalk.green('✅ Active')}`);
    console.log(`${chalk.hex('#A0AEB8')('🎼 Lossless    :')} ${chalk.green('✅ Active')}`);
    console.log();
}

export function displayQualityOptions() {
    const table = new Table({
        head: [
            chalk.hex('#4FACFE')('ID'),
            chalk.hex('#4FACFE')('Quality'),
            chalk.hex('#4FACFE')('Format'),
            chalk.hex('#4FACFE')('Description')
        ],
        chars: {
            mid: '',
            'left-mid': '',
            'mid-mid': '',
            'right-mid': '',
            top: '─',
            bottom: '─',
            left: '│',
            right: '│'
        },
        style: { head: [], border: ['gray'] }
    });

    table.push(
        ['5', '🎵 MP3', '320kbps', 'High Quality Lossy'],
        ['6', '💿 CD', 'FLAC 16/44.1', 'Lossless Standard'],
        ['7', '✨ Hi-Res', 'FLAC 24/96', 'Studio Quality'],
        ['27', '🔥 Max Res', 'FLAC 24/192', 'Master Quality']
    );

    console.log('\n' + titleGradient('📊 Select Audio Quality:\n'));
    console.log(table.toString());
}

export function displayAlbumInfo(album) {
    const year = album.released_at ? new Date(album.released_at * 1000).getFullYear() : 'N/A';
    const duration = formatDuration(album.duration);
    const hiRes = album.hires ? chalk.hex('#00F260')('Hi-Res 24bit') : chalk.yellow('CD Quality');

    console.log(goldGradient('\n💿  ALBUM INFORMATION'));
    console.log(chalk.gray('──────────────────────────────') + '\n');
    console.log(`${chalk.bold.white(album.title)}`);
    console.log(`${chalk.hex('#F37335')(album.artist?.name || 'Unknown')}\n`);
    console.log(`${chalk.hex('#90A4AE')('📅 Year    :')} ${chalk.white(year)}`);
    console.log(
        `${chalk.hex('#90A4AE')('🎵 Tracks  :')} ${chalk.white(album.tracks_count || 'N/A')}`
    );
    console.log(`${chalk.hex('#90A4AE')('⏱️ Duration:')} ${chalk.white(duration)}`);
    console.log(
        `${chalk.hex('#90A4AE')('🏢 Label   :')} ${chalk.white(album.label?.name || 'N/A')}`
    );
    console.log(
        `${chalk.hex('#90A4AE')('🎼 Genre   :')} ${chalk.white(album.genre?.name || 'N/A')}`
    );
    console.log(`${chalk.hex('#90A4AE')('✨ Quality :')} ${hiRes}`);
    console.log();
}

export function displayTrackInfo(track, albumData = null) {
    const album = track.album || albumData || {};
    const duration = formatDuration(track.duration);
    const quality = track.maximum_bit_depth
        ? `${track.maximum_bit_depth}-bit / ${track.maximum_sampling_rate}kHz`
        : 'CD Quality';

    console.log(chalk.hex('#00F2FE').bold('\n🎵  TRACK DETAILS'));
    console.log(chalk.gray('──────────────────────────────') + '\n');
    console.log(`${chalk.bold.white(track.title)}`);
    console.log(`${chalk.hex('#4FACFE')(track.performer?.name || 'Unknown')}`);
    console.log(chalk.dim(album.title || 'Unknown') + '\n');
    console.log(
        `${chalk.hex('#90A4AE')('🔢 Track   :')} ${chalk.white(`${track.track_number || 1}/${album.tracks_count || 1}`)}`
    );
    console.log(`${chalk.hex('#90A4AE')('⏱️ Duration:')} ${chalk.white(duration)}`);
    console.log(`${chalk.hex('#90A4AE')('✨ Quality :')} ${chalk.hex('#00F260')(quality)}`);
    console.log(`${chalk.hex('#90A4AE')('🔗 ISRC    :')} ${chalk.dim(track.isrc || 'N/A')}`);
    console.log();
}

export function displayMetadata(metadata) {
    const table = new Table({
        style: { head: [], border: ['gray'] },
        chars: {
            mid: '',
            'left-mid': '',
            'mid-mid': '',
            'right-mid': '',
            top: '─',
            bottom: '─',
            left: '│',
            right: '│'
        },
        colWidths: [20, 55]
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
        ['✨ Hi-Res', metadata.hiresAvailable ? chalk.green('Yes') : chalk.gray('No')],
        ['🆔 Qobuz ID', metadata.qobuzTrackId]
    ];

    for (const [key, value] of display) {
        table.push([chalk.hex('#4FACFE')(key), chalk.white(value || 'N/A')]);
    }

    console.log('\n' + titleGradient('� Embedded Metadata:\n'));
    console.log(table.toString());
}

export function displayProgress(phase, percent, details = {}) {
    const width = 30;
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;

    const filledChar = '━';
    const emptyChar = '─';

    const barFilled = titleGradient(filledChar.repeat(filled));
    const barEmpty = chalk.gray(emptyChar.repeat(empty));

    const percentStr = chalk.bold.white(`${percent.toFixed(1)}%`.padStart(6));

    const phases = {
        downloading: { icon: '📥', label: 'Downloading ' },
        cover: { icon: '🖼️ ', label: 'Processing Art' },
        lyrics: { icon: '🎤', label: 'Fetching Lyrics' },
        metadata: { icon: '📝', label: 'Tagging Tracks' },
        complete: { icon: '✨', label: 'Thinking...   ' }
    };

    const { icon, label } = phases[phase] || { icon: '⏳', label: 'Processing   ' };
    const speed = details.speed ? chalk.dim(` | ${details.speed}`) : '';

    process.stdout.write(
        `\r ${icon} ${chalk.cyan(label)} ${barFilled}${barEmpty} ${percentStr}${speed}`
    );

    if (phase === 'complete') {
        console.log();
    }
}

export function displayTrackList(tracks) {
    const table = new Table({
        head: [
            chalk.hex('#4FACFE')('#'),
            chalk.hex('#4FACFE')('Title'),
            chalk.hex('#4FACFE')('Duration'),
            chalk.hex('#4FACFE')('Quality')
        ],
        chars: {
            mid: '',
            'left-mid': '',
            'mid-mid': '',
            'right-mid': '',
            top: '─',
            bottom: '─',
            left: '│',
            right: '│'
        },
        style: { head: [], border: ['gray'] },
        colWidths: [6, 45, 12, 12]
    });

    for (const track of tracks) {
        const quality = track.hires ? chalk.hex('#00F260')('Hi-Res') : chalk.gray('CD');
        table.push([
            chalk.yellow(track.track_number?.toString().padStart(2, '0')),
            chalk.white(track.title?.substring(0, 40) || 'Unknown'),
            chalk.gray(formatDuration(track.duration)),
            quality
        ]);
    }

    console.log('\n' + titleGradient('🎵 Tracks:\n'));
    console.log(table.toString());
}

export function displaySearchResults(results, type) {
    console.log('\n' + titleGradient(`🔍 Search Results (${type}):\n`));

    const chars = {
        mid: '',
        'left-mid': '',
        'mid-mid': '',
        'right-mid': '',
        top: '─',
        bottom: '─',
        left: '│',
        right: '│'
    };

    if (type === 'albums') {
        const table = new Table({
            head: [
                chalk.hex('#4FACFE')('#'),
                chalk.hex('#4FACFE')('Album'),
                chalk.hex('#4FACFE')('Artist'),
                chalk.hex('#4FACFE')('Year'),
                chalk.hex('#4FACFE')('Tracks'),
                chalk.hex('#4FACFE')('Quality')
            ],
            style: { head: [], border: ['gray'] },
            chars,
            colWidths: [5, 35, 25, 8, 8, 12]
        });

        results.albums?.items?.forEach((album, i) => {
            const year = album.released_at
                ? new Date(album.released_at * 1000).getFullYear()
                : 'N/A';
            const quality = album.hires ? chalk.hex('#00F260')('Hi-Res') : chalk.gray('CD');
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
                chalk.hex('#4FACFE')('#'),
                chalk.hex('#4FACFE')('Title'),
                chalk.hex('#4FACFE')('Artist'),
                chalk.hex('#4FACFE')('Album'),
                chalk.hex('#4FACFE')('Duration')
            ],
            style: { head: [], border: ['gray'] },
            chars,
            colWidths: [5, 30, 20, 25, 10]
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
                chalk.hex('#4FACFE')('#'),
                chalk.hex('#4FACFE')('Artist'),
                chalk.hex('#4FACFE')('Albums'),
                chalk.hex('#4FACFE')('Genre')
            ],
            style: { head: [], border: ['gray'] },
            chars,
            colWidths: [5, 40, 10, 30]
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

export function displayLyrics(lyrics, maxLines = 15) {
    if (!lyrics || (!lyrics.syncedLyrics && !lyrics.plainLyrics)) {
        console.log(chalk.hex('#FDC830')('\n⚠️ No lyrics available for this track.\n'));
        return;
    }

    console.log(chalk.bold.hex('#FF00CC')('\n🎤 Lyrics Preview'));
    console.log(chalk.gray('──────────────────────────────') + '\n');

    if (lyrics.syncedLyrics) {
        console.log(chalk.hex('#4FACFE')('[Synced Lyrics Available]') + '\n');
        console.log(
            lyrics.parsedLyrics
                ?.slice(0, maxLines)
                .map((l) => chalk.gray(`[${l.timeStr}]`) + ' ' + chalk.white(l.text))
                .join('\n')
        );
    } else {
        console.log(
            lyrics.plainLyrics
                ?.split('\n')
                .slice(0, maxLines)
                .map((l) => chalk.white(l))
                .join('\n')
        );
    }

    if (
        (lyrics.parsedLyrics?.length || 0) > maxLines ||
        (lyrics.plainLyrics?.split('\n').length || 0) > maxLines
    ) {
        console.log('\n' + chalk.gray('... (lyrics truncated)'));
    }
    console.log();
}

export function displaySuccess(message) {
    console.log(
        '\n' + chalk.bold.hex('#00F260')('✅ SUCCESS') + '\n\n' + chalk.white(message) + '\n'
    );
}

export function displayError(message) {
    console.log(
        '\n' + chalk.bold.hex('#FF416C')('❌ ERROR') + '\n\n' + chalk.white(message) + '\n'
    );
}

export function displayWarning(message) {
    console.log(chalk.hex('#FDC830')(`\n⚠️  ${message}\n`));
}

export function displayInfo(message) {
    console.log(chalk.hex('#4FACFE')(`\nℹ️  ${message}\n`));
}

export function displayDownloadSummary(results) {
    const total = results.tracks?.length || 1;
    const completed = results.completedTracks || (results.success ? 1 : 0);
    const failed = results.failedTracks || (results.success ? 0 : 1);

    console.log(goldGradient('\n📊  DOWNLOAD SUMMARY'));
    console.log(chalk.gray('──────────────────────────────') + '\n');
    console.log(
        `${chalk.hex('#A0AEB8')('💿 Item    :')} ${chalk.white(results.title || 'Unknown')}`
    );
    console.log(
        `${chalk.hex('#A0AEB8')('🎤 Artist  :')} ${chalk.hex('#F37335')(results.artist || 'Unknown')}`
    );
    console.log(`${chalk.hex('#A0AEB8')('🔢 Total   :')} ${chalk.white(total)}`);
    console.log(`${chalk.hex('#A0AEB8')('✅ Success :')} ${chalk.green(completed)}`);
    console.log(
        `${chalk.hex('#A0AEB8')('❌ Failed  :')} ${failed > 0 ? chalk.red(failed) : chalk.gray('0')}`
    );
    console.log();
    console.log(
        results.success
            ? chalk.bold.hex('#00F260')('✨ DOWNLOAD COMPLETE')
            : chalk.bold.hex('#FF416C')('⚠️ COMPLETED WITH ERRORS')
    );
    console.log();
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function spinnerMessage(text) {
    return chalk.cyan('⏳ ') + chalk.white(text);
}
