export interface Artist {
    id: number | string;
    name: string;
    albums_count?: number;
    image?: { small?: string; medium?: string; large?: string };
    [key: string]: unknown;
}

export interface ArtistDetails extends Artist {
    albums?: {
        items: Album[];
        total: number;
        offset: number;
        limit: number;
    };
    tracks?: {
        items: Track[];
        total: number;
    };
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
    description?: string;
    image?: {
        small?: string;
        thumbnail?: string;
        large?: string;
        extralarge?: string;
        mega?: string;
        [key: string]: unknown;
    };
    hires: boolean;
    hires_streamable?: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
    goodies?: unknown[];
    tracks?: {
        items: Track[];
    };
    media_count?: number;
    genres_list?: (string | { name: string })[];
    credits?: { role?: string; name?: string }[];
    copyright?: string;
    upc?: string;
    catalog_number?: string;
    release_type?: string;
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
        description?: string;
        image?: {
            small?: string;
            thumbnail?: string;
            medium?: string;
            large?: string;
            mega?: string;
            extralarge?: string;
            [key: string]: unknown;
        };
    };
    duration: number;
    hires: boolean;
    track_number: number;
    maximum_sampling_rate?: number;
    maximum_bit_depth?: number;
    hires_streamable?: boolean;
    media_number?: number;
    performers?: string;
    parental_warning?: boolean;
    streamable?: boolean;
    composer?: { name: string; id?: string | number };
    isrc?: string;
    version?: string;
    lyrics?: {
        sync?: string;
        text?: string;
        copyright?: string;
        writer?: string;
    };
    [key: string]: unknown;
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
    source?: string;
    syncedLyrics?: string | boolean | null;
    plainLyrics?: string | null;
    parsedLyrics?: unknown[] | null;
    syltFormat?: unknown[] | null;
    synced?: string | null;
    unsynced?: string | null;
    copyright?: string | null;
    writer?: string | null;
    error?: string;
    [key: string]: unknown;
}

export interface FileUrlData {
    url: string;
    format_id: number;
    bit_depth?: number;
    sampling_rate?: number;
    mime_type?: string;
}
