import { create } from 'zustand';
import { smartFetch } from '../utils/api';

export interface QueueStats {
    total: number;
    downloading: number;
    completed: number;
    failed: number;
    pending: number;
}

export interface QueueItem {
    id: string;
    contentId: string;
    title: string;
    type: string;
    quality: number;
    status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    artist?: string;
    album?: string;
}

interface QueueState {
    stats: QueueStats;
    queue: QueueItem[];
    setStats: (stats: QueueStats) => void;
    setQueue: (queue: QueueItem[]) => void;
    updateItemProgress: (data: Partial<QueueItem> & { id: string }) => void;
    fetchQueue: () => Promise<void>;
}

export const useQueueStore = create<QueueState>((set) => ({
    stats: { total: 0, downloading: 0, completed: 0, failed: 0, pending: 0 },
    queue: [],
    setStats: (stats) => set({ stats }),
    setQueue: (queue) => set({ queue }),
    updateItemProgress: (data) => set((state) => ({
        queue: state.queue.map(item =>
            item.id === data.id ? { ...item, ...data } : item
        )
    })),
    fetchQueue: async () => {
        const res = await smartFetch('/api/queue');
        if (res && res.ok) {
            const data = await res.json();
            set({ queue: data });
        }
    }
}));
