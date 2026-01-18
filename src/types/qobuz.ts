export interface Artist {
    id: number | string;
    name: string;
    albums_count?: number;
    image?: { small?: string; medium?: string; large?: string };
}

export interface Playlist {
    id: number | string;
    name: string;
    description?: string;
    tracks: {
        items: Track[];
        total: number;
    };
    owner?: {
        name: string;
        id: number | string;
    };
}

export interface Album {
    id: string | number;
    title: string;
    artist: Artist;
    label?: { name: string };
    genre?: { name: string };
    duration: number;
    tracks_count: number;
    released_at?: number;
    hires: boolean;
    hires_streamable?: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
    goodies?: unknown[];
    tracks?: {
        items: Track[];
    };
    [key: string]: unknown;
}

export interface Track {
    id: string | number;
    title: string;
    artist?: Artist;
    performer?: {
        id?: number | string;
        name: string;
        image?: { small?: string; medium?: string; large?: string };
    };
    album?: {
        title: string;
        id?: string | number;
        artist?: Artist;
        image?: {
            small?: string;
            medium?: string;
            large?: string;
            mega?: string;
            extralarge?: string;
        };
    };
    duration: number;
    hires: boolean;
    track_number: number;
    maximum_sampling_rate?: number;
    maximum_bit_depth?: number;
    hires_streamable?: boolean;
    lyrics?: {
        sync?: string;
        text?: string;
        copyright?: string;
        writer?: string;
    };
}

export interface UserInfo {
    id: string | number;
    email: string;
    country_code: string;
    subscription?: {
        offer: string;
        end_date?: string;
        period_end_date?: string;
    };
    hires_streaming: boolean;
    credential?: {
        parameters?: {
            hires_streaming?: boolean;
            lossless_streaming?: boolean;
        };
    };
}

export interface DownloadResultSummary {
    success: boolean;
    title?: string;
    name?: string;
    artist?: string;
    totalTracks?: number;
    completedTracks?: number;
    failedTracks?: number;
}

export interface SearchResults {
    albums?: { items: Album[] };
    tracks?: { items: Track[] };
    artists?: { items: Artist[] };
    [key: string]: { items: (Album | Track | Artist)[] } | undefined;
}

export interface LyricsResult {
    success: boolean;
    syncedLyrics?: boolean;
    parsedLyrics?: { timeStr: string; text: string }[];
    plainLyrics?: string;
    synced?: string | null;
    unsynced?: string | null;
    copyright?: string | null;
    writer?: string | null;
    error?: string;
}

export interface FileUrlData {
    url: string;
    format_id: number;
    bit_depth?: number;
    sampling_rate?: number;
    mime_type?: string;
}
