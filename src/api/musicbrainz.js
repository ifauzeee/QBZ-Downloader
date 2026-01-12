import axios from 'axios';

class MusicBrainzAPI {
    constructor() {
        this.baseUrl = 'https://musicbrainz.org/ws/2';
        this.userAgent = 'Qobuz-DL-CLI/1.0.0 ( https://github.com/ifauzeee/QBZ-Downloader )';
    }

    async getMetadata(title, artist, album, isrc = null) {
        try {
            let releaseData = null;

            if (isrc) {
                console.log(`    🔍 MusicBrainz: Searching via ISRC (${isrc})...`);
                const isrcData = await this.lookupByIsrc(isrc);
                if (isrcData) {
                    releaseData = isrcData;
                }
            }

            if (!releaseData) {
                console.log('    🔍 MusicBrainz: Searching via text match...');
                const searchData = await this.searchRecording(title, artist, album);
                if (searchData) {
                    releaseData = searchData;
                }
            }

            if (!releaseData) return null;

            return this.extractMetadata(releaseData);

        } catch (error) {
            return null;
        }
    }

    async lookupByIsrc(isrc) {
        try {
            const url = `${this.baseUrl}/recording?query=isrc:${isrc}&fmt=json&inc=releases+artist-credits+tags+ratings`;
            const response = await axios.get(url, { headers: { 'User-Agent': this.userAgent } });

            if (response.data.recordings && response.data.recordings.length > 0) {
                return response.data.recordings[0];
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    async searchRecording(title, artist, album) {
        try {
            const query = `recording:"${title}" AND artist:"${artist}"`;
            const url = `${this.baseUrl}/recording?query=${encodeURIComponent(query)}&fmt=json&inc=releases+artist-credits`;

            const response = await axios.get(url, { headers: { 'User-Agent': this.userAgent } });

            if (response.data.recordings && response.data.recordings.length > 0) {
                return response.data.recordings[0];
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    extractMetadata(recording) {
        const metadata = {};

        if (recording['first-release-date']) {
            metadata.originalReleaseDate = recording['first-release-date'];
        } else if (recording.releases && recording.releases.length > 0) {
            const dates = recording.releases
                .map(r => r.date)
                .filter(d => d)
                .sort();
            if (dates.length > 0) metadata.originalReleaseDate = dates[0];
        }

        if (recording.releases && recording.releases.length > 0) {
            const release = recording.releases[0];
            if (release['text-representation']) {
            }
        }

        if (recording.tags) {
            metadata.genres = recording.tags.map(t => t.name).slice(0, 5);
        }

        metadata.musicBrainzId = recording.id;

        return metadata;
    }
}

export default new MusicBrainzAPI();
