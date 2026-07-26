import { create } from 'zustand';
import { smartFetch } from '../utils/api';

export interface AutoFixFile {
    filePath: string;
    title: string;
    artist: string;
    album?: string;
    missingTags?: string[];
    status: 'pending' | 'identifying' | 'found' | 'not_found' | 'applied' | 'failed';
    error?: string;
    result?: any;
}

export interface AutoFixSummary {
    applied: number;
    failed: number;
    notFound: number;
    stopped: boolean;
}

interface AutoFixState {
    files: AutoFixFile[];
    running: boolean;
    stopRequested: boolean;
    setFiles: (files: AutoFixFile[]) => void;
    stop: () => void;
    run: (onDone?: (summary: AutoFixSummary) => void) => Promise<void>;
}

const readError = async (res: Response | null): Promise<string> => {
    if (!res) return 'Request failed';
    try {
        const body = await res.json();
        return String(body?.error || `HTTP ${res.status}`);
    } catch {
        return `HTTP ${res.status}`;
    }
};

/**
 * Auto-Fix runs here rather than inside LibraryView so it survives navigation.
 * As component state, the loop kept running after the view unmounted while its
 * "running" flag was destroyed with the component -- so returning to the tab
 * showed an idle button over a job that was still writing files, and pressing it
 * again started a second concurrent pass over the same paths.
 */
export const useAutoFixStore = create<AutoFixState>((set, get) => ({
    files: [],
    running: false,
    stopRequested: false,

    // Refusing writes mid-run keeps a tab switch (which refetches the list) from
    // discarding the live per-file progress.
    setFiles: (files) => {
        if (get().running) return;
        set({ files });
    },

    stop: () => set({ stopRequested: true }),

    run: async (onDone) => {
        if (get().running) return;
        set({ running: true, stopRequested: false });

        const files = get().files.map((f) => ({ ...f }));
        const summary: AutoFixSummary = { applied: 0, failed: 0, notFound: 0, stopped: false };
        const commit = () => set({ files: files.map((f) => ({ ...f })) });

        for (let i = 0; i < files.length; i++) {
            if (get().stopRequested) {
                summary.stopped = true;
                break;
            }

            const file = files[i];
            if (!file || file.status === 'applied') continue;

            file.status = 'identifying';
            file.error = undefined;
            commit();

            try {
                const idRes = await smartFetch('/api/tools/identify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: file.filePath })
                });

                if (!idRes || !idRes.ok) {
                    file.status = 'not_found';
                    file.error = await readError(idRes);
                    summary.notFound++;
                    commit();
                    continue;
                }

                const data = await idRes.json();
                file.result = data.data;
                file.status = 'found';
                commit();

                const applyRes = await smartFetch('/api/tools/apply-metadata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: file.filePath, metadata: data.data })
                });

                if (applyRes && applyRes.ok) {
                    file.status = 'applied';
                    file.title = data.data?.title ?? file.title;
                    file.artist = data.data?.artist ?? file.artist;
                    summary.applied++;
                } else {
                    // A failed write -- read-only share, locked file, bad path --
                    // used to be dropped here, leaving the row looking untouched
                    // and the run still reporting success at the end.
                    file.status = 'failed';
                    file.error = await readError(applyRes);
                    summary.failed++;
                }
            } catch (e) {
                file.status = 'failed';
                file.error = e instanceof Error ? e.message : String(e);
                summary.failed++;
            }

            commit();
        }

        set({ running: false, stopRequested: false });
        onDone?.(summary);
    }
}));
