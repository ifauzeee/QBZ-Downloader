import axios from 'axios';
import { CONFIG } from '../config.js';

class DiscogsAPI {
    constructor() {
        this.token = CONFIG.credentials.discogsToken || process.env.DISCOGS_TOKEN;
        this.baseUrl = 'https://api.discogs.com';
    }

    getHeaders() {
        return {
            Authorization: `Discogs token=${this.token}`,
            'User-Agent': 'Qobuz-DL-CLI/2.0 +https://github.com/ifauzeee/QBZ-Downloader'
        };
    }

    async searchRelease(artist, album) {
        if (!this.token) return null;

        try {
            const cleanArtist = artist.split(/,|\s+ft\.|\s+feat\./i)[0].trim();
            const cleanAlbum = album.replace(/\(.*\)/, '').trim();

            const params = {
                artist: cleanArtist,
                release_title: cleanAlbum,
                type: 'release',
                format: 'Digital',
                per_page: 3
            };

            const response = await axios.get(`${this.baseUrl}/database/search`, {
                headers: this.getHeaders(),
                params
            });

            if (response.data.results && response.data.results.length > 0) {
                return response.data.results[0];
            }

            params.type = 'master';
            const masterResponse = await axios.get(`${this.baseUrl}/database/search`, {
                headers: this.getHeaders(),
                params
            });

            return masterResponse.data.results[0] || null;
        } catch (error) {
            return null;
        }
    }

    async getReleaseDetails(releaseId, isMaster = false) {
        if (!this.token || !releaseId) return null;

        try {
            const endpoint = isMaster ? `/masters/${releaseId}` : `/releases/${releaseId}`;
            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                headers: this.getHeaders()
            });

            return response.data;
        } catch (error) {
            return null;
        }
    }

    async getEnhancedMetadata(artist, album) {
        if (!this.token) return null;

        try {
            const searchResult = await this.searchRelease(artist, album);
            if (!searchResult) return null;

            const isMaster = searchResult.type === 'master';
            const details = await this.getReleaseDetails(searchResult.id, isMaster);

            if (!details) return null;

            return {
                discogsId: details.id,
                styles: details.styles || [],
                genres: details.genres || [],
                country: details.country,
                released: details.released || details.year,
                labels: details.labels?.map((l) => l.name).join(', ') || '',
                catno: details.labels?.[0]?.catno || '',
                credits: details.extraartists || []
            };
        } catch (error) {
            return null;
        }
    }
}

export default DiscogsAPI;
