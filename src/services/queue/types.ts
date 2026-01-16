export type QualityOption = number | 'ask' | 'min' | 'max';

export type DownloadType = 'track' | 'album' | 'playlist' | 'artist';
export type BatchDownloadType = 'album' | 'playlist' | 'artist';

export type SearchCategory = 'tracks' | 'albums' | 'artists' | 'playlists';

export type QueueItemStatus =
    | 'pending'
    | 'downloading'
    | 'processing'
    | 'uploading'
    | 'completed'
    | 'failed'
    | 'cancelled';

export type QueuePriority = 'low' | 'normal' | 'high';

export interface QueueItem {
    id: string;
    type: DownloadType;
    contentId: string | number;
    quality: number;
    status: QueueItemStatus;
    priority: QueuePriority;
    progress: number;
    title?: string;
    artist?: any;
    album?: any;
    error?: string;
    filePath?: string;
    addedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    retryCount: number;
    maxRetries: number;
    metadata?: any;
}

export interface QueueStats {
    total: number;
    pending: number;
    downloading: number;
    processing: number;
    completed: number;
    failed: number;
}

export interface DownloadRequest {
    id: string | number;
    type: DownloadType;
    quality: number;
    url?: string;
    priority?: QueuePriority;
}

export interface InfoResult {
    type: DownloadType;
    id: string | number;
    title: string;
    artist?: string;
    tracksCount?: number;
    releaseDate?: string;
    coverUrl?: string;
}

export type QueueEvents = {
    'item:added': (item: QueueItem) => void;
    'item:started': (item: QueueItem) => void;
    'item:progress': (item: QueueItem, progress: number) => void;
    'item:completed': (item: QueueItem) => void;
    'item:failed': (item: QueueItem, error: string) => void;
    'item:cancelled': (item: QueueItem) => void;
    'queue:empty': () => void;
    'queue:paused': () => void;
    'queue:resumed': () => void;
    [key: string]: (...args: any[]) => void;
};
