import { exec } from 'child_process';
import axios from 'axios';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

const execAsync = promisify(exec);

export interface AcoustIDResult {
    id: string;
    score: number;
    recordings?: Array<{
        id: string;
        title: string;
        artists?: Array<{ id: string; name: string }>;
        releasegroups?: Array<{
            id: string;
            title: string;
            type?: string;
        }>;
    }>;
}

export class AcoustIDService {
    private apiKey: string;
    private baseUrl = 'https://api.acoustid.org/v2/lookup';

    constructor() {
        this.apiKey = CONFIG.credentials.acoustidKey;
    }

    async getFingerprint(
        filePath: string
    ): Promise<{ duration: number; fingerprint: string } | null> {
        try {
            const { stdout } = await execAsync(`fpcalc -json "${filePath}"`);
            const data = JSON.parse(stdout);
            return {
                duration: data.duration,
                fingerprint: data.fingerprint
            };
        } catch (error: any) {
            logger.debug(`Fingerprinting failed for ${filePath}: ${error.message}`, 'ACOUSTID');
            return null;
        }
    }

    async lookup(filePath: string): Promise<AcoustIDResult[] | null> {
        if (!this.apiKey) {
            logger.warn('AcoustID API Key not configured', 'ACOUSTID');
            return null;
        }

        const fpData = await this.getFingerprint(filePath);
        if (!fpData) return null;

        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    client: this.apiKey,
                    duration: Math.round(fpData.duration),
                    fingerprint: fpData.fingerprint,
                    meta: 'recordings+releasegroups+compress'
                }
            });

            if (response.data.status === 'ok') {
                return response.data.results;
            }

            return null;
        } catch (error: any) {
            logger.error(`Lookup failed: ${error.message}`, 'ACOUSTID');
            return null;
        }
    }

    async identify(filePath: string) {
        const results = await this.lookup(filePath);
        if (!results || results.length === 0) return null;

        const bestMatch = results.sort((a, b) => b.score - a.score)[0];
        if (bestMatch.score < 0.5) return null;

        const recording = bestMatch.recordings?.[0];
        if (!recording) return null;

        return {
            title: recording.title,
            artist: recording.artists?.[0]?.name || 'Unknown',
            album: recording.releasegroups?.[0]?.title || 'Unknown',
            acoustidId: bestMatch.id,
            recordingId: recording.id
        };
    }
}

export const acoustidService = new AcoustIDService();
export default acoustidService;
