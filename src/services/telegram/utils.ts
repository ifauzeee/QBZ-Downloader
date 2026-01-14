import { InlineKeyboard, InlineKeyboardRow, DownloadType, QueueItemStatus } from './types.js';

export function escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatSpeed(bytesPerSecond: number): string {
    return `${formatSize(bytesPerSecond)}/s`;
}

export function getTypeIcon(type: DownloadType): string {
    const icons: Record<DownloadType, string> = {
        track: '🎵',
        album: '💿',
        playlist: '📜',
        artist: '👤'
    };
    return icons[type] || '📄';
}

export function getStatusIcon(status: QueueItemStatus): string {
    const icons: Record<QueueItemStatus, string> = {
        pending: '⏳',
        downloading: '📥',
        processing: '⚙️',
        uploading: '📤',
        completed: '✅',
        failed: '❌',
        cancelled: '🚫'
    };
    return icons[status] || '❓';
}

export function createProgressBar(percent: number, length: number = 12): string {
    const filled = Math.floor((percent / 100) * length);
    const empty = length - filled;
    return '🟢'.repeat(filled) + '⚪'.repeat(empty);
}

export function truncate(str: string, maxLength: number): string {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

export function createKeyboard(rows: InlineKeyboardRow[]): InlineKeyboard {
    return { inline_keyboard: rows };
}

export function generateQueueId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function parseDownloadCallback(data: string): {
    type: DownloadType;
    id: string;
    quality: number;
} | null {
    const match = data.match(/^dl_(track|album|playlist|artist)_([a-zA-Z0-9]+)_(\d+)$/);
    if (!match) return null;
    return {
        type: match[1] as DownloadType,
        id: match[2],
        quality: parseInt(match[3], 10)
    };
}

export function createDownloadCallback(
    type: DownloadType,
    id: string | number,
    quality: number
): string {
    return `dl_${type}_${id}_${quality}`;
}

export function formatTimestamp(date?: Date): string {
    const d = date || new Date();
    return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

export function calculateEta(remaining: number, speed: number): string {
    if (!speed || speed <= 0) return '--:--';
    const seconds = Math.floor(remaining / speed);
    return formatDuration(seconds);
}

export const SEPARATOR = '━━━━━━━━━━━━━━━━━━';

export function createHeader(text: string, icon?: string): string {
    const headerIcon = icon || '📢';
    return `${headerIcon} <b>${text}</b>\n${SEPARATOR}`;
}

export function createFooter(text: string): string {
    return `${SEPARATOR}\n<i>${text}</i>`;
}
