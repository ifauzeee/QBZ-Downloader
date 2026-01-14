import fs from 'fs';
import path from 'path';

interface HistoryEntry {
    downloadedAt: string;
    filename: string;
    quality: number;
    title: string;
}

interface HistoryData {
    tracks: Record<string, HistoryEntry>;
}

export class HistoryService {
    private historyFile: string;
    private data: HistoryData;

    constructor(filePath: string = 'history.json') {
        this.historyFile = path.resolve(filePath);
        this.data = { tracks: {} };
        this.load();
    }

    private load() {
        if (fs.existsSync(this.historyFile)) {
            try {
                const content = fs.readFileSync(this.historyFile, 'utf-8');
                this.data = JSON.parse(content);
                if (!this.data.tracks) this.data.tracks = {};
            } catch {
                this.data = { tracks: {} };
            }
        }
    }

    private save() {
        try {
            fs.writeFileSync(this.historyFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Failed to save history file:', error);
        }
    }

    has(trackId: string | number): boolean {
        return !!this.data.tracks[trackId.toString()];
    }

    get(trackId: string | number): HistoryEntry | undefined {
        return this.data.tracks[trackId.toString()];
    }

    add(trackId: string | number, entry: Omit<HistoryEntry, 'downloadedAt'>) {
        this.data.tracks[trackId.toString()] = {
            ...entry,
            downloadedAt: new Date().toISOString()
        };
        this.save();
    }
}

export const historyService = new HistoryService();
