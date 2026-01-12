import axios from 'axios';

class MusicBrainzAPI {
    constructor() {
        this.baseUrl = 'https://musicbrainz.org/ws/2';
        this.userAgent = 'Qobuz-DL-CLI/2.0 ( https://github.com/ifauzeee/QBZ-Downloader )';
    }

    async searchRelease(artist, album) {
        try {
            const query = `artist:"${artist}" AND release:"${album}"`;
            const response = await axios.get(`${this.baseUrl}/release`, {
                headers: { 'User-Agent': this.userAgent },
                params: { query, fmt: 'json', limit: 1 }
            });

            return response.data.releases?.[0] || null;
        } catch (error) {
            return null;
        }
    }

    async getReleaseDetails(releaseId) {
        try {
            const response = await axios.get(`${this.baseUrl}/release/${releaseId}`, {
                headers: { 'User-Agent': this.userAgent },
                params: { inc: 'artist-credits+labels+recordings+release-groups', fmt: 'json' }
            });
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async getEnhancedMetadata(artist, album, isrc = null) {
        try {
            let release = null;

            if (isrc) {
                const isrcResponse = await axios.get(`${this.baseUrl}/recording`, {
                    headers: { 'User-Agent': this.userAgent },
                    params: { query: `isrc:${isrc}`, fmt: 'json', limit: 1 }
                });

                if (isrcResponse.data.recordings?.[0]?.releases?.[0]) {
                    release = isrcResponse.data.recordings[0].releases[0];
                }
            }

            if (!release) {
                release = await this.searchRelease(artist, album);
            }

            if (!release) return null;

            const details = await this.getReleaseDetails(release.id);
            if (!details) return null;

            return {
                musicbrainzId: details.id,
                originalDate: details['release-group']?.['first-release-date'] || details.date,
                standardizedArtist: details['artist-credit']?.map((c) => c.name).join(', ') || null,
                label: details['label-info']?.[0]?.label?.name || null,
                catalogNumber: details['label-info']?.[0]?.['catalog-number'] || null,
                barcode: details.barcode || null
            };
        } catch (error) {
            return null;
        }
    }
}

export default MusicBrainzAPI;
