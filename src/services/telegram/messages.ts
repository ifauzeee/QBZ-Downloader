import { DownloadType, QueueItem, QueueStats } from './types.js';
import {
    escapeHtml,
    formatSize,
    formatTimestamp,
    getTypeIcon,
    getStatusIcon,
    createProgressBar,
    truncate,
    SEPARATOR,
    createHeader,
    createFooter
} from './utils.js';

export function buildWelcomeMessage(): string {
    return (
        '🎨 <b>Welcome to Qobuz Premium Bot!</b>\n' +
        SEPARATOR +
        '\n' +
        'I can help you download high-quality music directly from Qobuz.\n\n' +
        '🚀 <b>Quick Start:</b>\n' +
        '1️⃣ Send any Qobuz Link (Track/Album/Playlist)\n' +
        '2️⃣ Use /search to find your favorite music\n' +
        '3️⃣ Configure your /settings\n' +
        '4️⃣ View your /queue\n\n' +
        '🔒 <i>All files &lt; 50MB are automatically uploaded.</i>'
    );
}

export function buildHelpMessage(): string {
    return (
        createHeader('COMMAND GUIDE', '📖') +
        '\n' +
        '🔍 <code>/search query</code> - Search everything\n' +
        '📋 <code>/queue</code> - View download queue\n' +
        '⚙️ <code>/settings</code> - Bot configuration\n' +
        'ℹ️ <code>/help</code> - Show this menu\n\n' +
        '💡 <i>Tip: Paste a Qobuz URL for instant info!</i>'
    );
}

export function buildDownloadStartMessage(
    title: string,
    type: DownloadType,
    quality: string
): string {
    const icon = getTypeIcon(type);
    return (
        '✨ <b>INCOMING DOWNLOAD</b> ✨\n' +
        SEPARATOR +
        '\n' +
        `${icon} <b>Item:</b> <code>${escapeHtml(title)}</code>\n` +
        `💎 <b>Quality:</b> <code>${escapeHtml(quality)}</code>\n` +
        `📂 <b>Type:</b> <i>${type.toUpperCase()}</i>\n` +
        SEPARATOR +
        '\n' +
        `⏱️ <b>Time:</b> <code>${formatTimestamp()}</code>`
    );
}

export function buildDownloadCompleteMessage(
    title: string,
    filePath: string,
    stats?: { totalSize?: number; trackCount?: number },
    showPath: boolean = true
): string {
    let statsMsg = '';
    if (stats) {
        if (stats.trackCount) {
            statsMsg += `📊 <b>Tracks:</b> <code>${stats.trackCount}</code>\n`;
        }
        if (stats.totalSize) {
            statsMsg += `💾 <b>Size:</b> <code>${formatSize(stats.totalSize)}</code>\n`;
        }
    }

    const pathLine = showPath ? `📂 <b>Path:</b> <code>${escapeHtml(filePath)}</code>\n` : '';

    return (
        '✅ <b>SUCCESSFULLY DOWNLOADED</b>\n' +
        SEPARATOR +
        '\n' +
        `🎧 <b>Title:</b> <code>${escapeHtml(title)}</code>\n` +
        statsMsg +
        pathLine +
        SEPARATOR +
        '\n' +
        '<i>Processing complete! Enjoy your music.</i>'
    );
}

export function buildErrorMessage(context: string, error: string): string {
    return (
        '❌ <b>ERROR DETECTED</b>\n' +
        SEPARATOR +
        '\n' +
        `❗ <b>Context:</b> <code>${escapeHtml(context)}</code>\n` +
        `⚠️ <b>Message:</b> <i>${escapeHtml(error)}</i>\n` +
        SEPARATOR +
        '\n' +
        '<i>Please check your settings or try again later.</i>'
    );
}

export function buildProgressMessage(
    title: string,
    phase: string,
    loaded: number,
    total?: number
): string {
    let statusText = '';
    let percent = 0;

    switch (phase) {
        case 'download_start':
            statusText = '🚀 <b>Initializing...</b>';
            break;
        case 'download':
            if (total) {
                percent = Math.floor((loaded / total) * 100);
                const bar = createProgressBar(percent);
                statusText =
                    '📥 <b>Downloading...</b>\n' +
                    `<code>${bar} ${percent}%</code>\n` +
                    `<i>${formatSize(loaded)} / ${formatSize(total)}</i>`;
            } else {
                statusText = `📥 <b>Downloading...</b>\n<code>${formatSize(loaded)}</code>`;
            }
            break;
        case 'lyrics':
            statusText = '📝 <b>Fetching Lyrics...</b>';
            break;
        case 'cover':
            statusText = '🖼️ <b>Fetching Cover...</b>';
            break;
        case 'tagging':
            statusText = '🏷️ <b>Tagging Metadata...</b>';
            break;
        default:
            statusText = `⚙️ <b>${phase}</b>`;
    }

    return (
        `🛰️ <b>ACTIVITY: ${phase.toUpperCase()}</b>\n` +
        SEPARATOR +
        '\n' +
        `🎵 <b>Track:</b> <code>${escapeHtml(title)}</code>\n` +
        SEPARATOR +
        '\n' +
        statusText
    );
}

export function buildBatchInitMessage(title: string, type: DownloadType): string {
    const typeNames: Record<DownloadType, string> = {
        track: 'TRACK',
        album: 'BATCH',
        playlist: 'PLAYLIST',
        artist: 'DISCOGRAPHY'
    };
    const icon = getTypeIcon(type);
    const typeName = typeNames[type] || 'BATCH';

    return (
        `📦 <b>${typeName} INITIALIZING</b>\n` +
        SEPARATOR +
        '\n' +
        `${icon} <b>${type.charAt(0).toUpperCase() + type.slice(1)}:</b> <code>${escapeHtml(title)}</code>\n` +
        SEPARATOR +
        '\n' +
        '⏳ <i>Please wait while we prepare your tracks...</i>'
    );
}

export function buildBatchUploadMessage(title: string, type: DownloadType): string {
    const icon = getTypeIcon(type);
    return (
        `📤 <b>${type.toUpperCase()} UPLOADING</b>\n` +
        SEPARATOR +
        '\n' +
        `${icon} <b>${type.charAt(0).toUpperCase() + type.slice(1)}:</b> <code>${escapeHtml(title)}</code>\n` +
        SEPARATOR +
        '\n' +
        '⏳ <i>Transferring tracks to Telegram...</i>'
    );
}

export function buildFileTooLargeMessage(filename: string, size: number): string {
    return (
        '⚠️ <b>File &gt; 50MB (Telegram Limit)</b>\n' +
        `📄 <code>${escapeHtml(filename)}</code> (${formatSize(size)})\n` +
        '<i>Saved on server. Cannot auto-delete.</i>'
    );
}

export function buildSearchMessage(query: string): string {
    return (
        createHeader('SEARCH OPERATOR', '🔍') +
        '\n' +
        `Query: <code>${escapeHtml(query)}</code>\n\n` +
        'Select a category to view results:'
    );
}

export function buildSearchResultsMessage(query: string, type: string, itemCount: number): string {
    const headers: Record<string, string> = {
        tracks: '🎵 <b>TOP TRACKS</b>',
        albums: '💿 <b>TOP ALBUMS</b>',
        artists: '👤 <b>TOP ARTISTS</b>',
        playlists: '📜 <b>TOP PLAYLISTS</b>'
    };

    return (
        `${headers[type] || '📋 <b>RESULTS</b>'}\n` +
        SEPARATOR +
        '\n' +
        `Results for: <code>${escapeHtml(query)}</code>\n` +
        `Found: <b>${itemCount}</b> items\n\n` +
        '<i>Select an item to view or download:</i>'
    );
}

export function buildQualitySelectMessage(type: string, id: string | number): string {
    return (
        createHeader('SELECT AUDIO QUALITY', '💎') +
        '\n' +
        `Item: <code>${type.toUpperCase()} #${id}</code>\n\n` +
        'Choose your preferred quality:'
    );
}

export function buildSettingsMessage(currentQuality: string): string {
    return (
        createHeader('BOT CONFIGURATION', '⚙️') +
        '\n' +
        `Current Default: <b>${escapeHtml(currentQuality)}</b>\n\n` +
        '<i>Changing this will affect how links and search results behave.</i>'
    );
}

export function buildQueueMessage(items: QueueItem[], stats: QueueStats): string {
    let msg = createHeader('DOWNLOAD QUEUE', '📋') + '\n';
    msg += `📊 <b>Stats:</b> ${stats.pending} pending | ${stats.downloading} active | ${stats.completed} done\n\n`;

    if (items.length === 0) {
        msg += '<i>Queue is empty. Send a Qobuz link to start!</i>';
    } else {
        const displayItems = items.slice(0, 10);
        displayItems.forEach((item, index) => {
            const icon = getStatusIcon(item.status);
            const typeIcon = getTypeIcon(item.type);
            const title = truncate(item.title || `${item.type} #${item.contentId}`, 30);
            msg += `${index + 1}. ${icon} ${typeIcon} <code>${escapeHtml(title)}</code>\n`;
        });

        if (items.length > 10) {
            msg += `\n<i>... and ${items.length - 10} more items</i>`;
        }
    }

    return msg + '\n' + createFooter('Use /queue clear to empty the queue');
}

export function buildAlbumInfoMessage(
    title: string,
    artist: string,
    year: string,
    tracksCount: number,
    tracks?: { title: string }[]
): string {
    let msg =
        createHeader('ALBUM INFORMATION', '💿') +
        '\n' +
        `💽 <b>Title:</b> <code>${escapeHtml(title)}</code>\n` +
        `👤 <b>Artist:</b> <code>${escapeHtml(artist)}</code>\n` +
        `📅 <b>Year:</b> <code>${year}</code>\n` +
        `🎼 <b>Tracks:</b> <code>${tracksCount}</code>\n` +
        SEPARATOR +
        '\n' +
        '<b>Tracklist:</b>\n';

    if (tracks) {
        tracks.forEach((track, index) => {
            msg += `<code>${index + 1}.</code> ${escapeHtml(track.title)}\n`;
        });
    }

    return msg;
}

export function buildPlaylistInfoMessage(
    name: string,
    owner: string,
    tracksCount: number,
    tracks?: { title: string }[]
): string {
    let msg =
        createHeader('PLAYLIST INFORMATION', '📜') +
        '\n' +
        `📝 <b>Name:</b> <code>${escapeHtml(name)}</code>\n` +
        `👤 <b>Owner:</b> <code>${escapeHtml(owner)}</code>\n` +
        `🎼 <b>Tracks:</b> <code>${tracksCount}</code>\n` +
        SEPARATOR +
        '\n' +
        '<b>Tracklist:</b>\n';

    if (tracks) {
        tracks.slice(0, 20).forEach((track, index) => {
            msg += `<code>${index + 1}.</code> ${escapeHtml(track.title)}\n`;
        });
        if (tracks.length > 20) {
            msg += `<i>... and ${tracks.length - 20} more tracks</i>\n`;
        }
    }

    return msg;
}

export function buildArtistInfoMessage(name: string, albumsCount: number): string {
    return (
        createHeader('ARTIST PROFILE', '👤') +
        '\n' +
        `🎤 <b>Name:</b> <code>${escapeHtml(name)}</code>\n` +
        `💿 <b>Albums:</b> <code>${albumsCount || 'N/A'}</code>\n` +
        SEPARATOR +
        '\n' +
        '<i>Select a quality to download discography:</i>'
    );
}

export function buildQueuedMessage(title: string, type: DownloadType, position: number): string {
    const icon = getTypeIcon(type);
    return (
        '📋 <b>ADDED TO QUEUE</b>\n' +
        SEPARATOR +
        '\n' +
        `${icon} <b>Item:</b> <code>${escapeHtml(title)}</code>\n` +
        `📍 <b>Position:</b> #${position}\n` +
        `⏱️ <b>Time:</b> <code>${formatTimestamp()}</code>`
    );
}
