export interface Artist {
    id: number | string;
    name: string;
    albums_count?: number;
    image?: { small?: string; medium?: string; large?: string };
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
    release_date_original?: string;
    description?: string;
    image?: {
        small?: string;
        thumbnail?: string;
        medium?: string;
        large?: string;
        extralarge?: string;
        mega?: string;
    };
    hires: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
    already_downloaded?: boolean;
}

export interface Track {
    id: string | number;
    title: string;
    artist?: Artist;
    album?: Album;
    duration: number;
    hires: boolean;
    track_number: number;
    maximum_sampling_rate?: number;
    maximum_bit_depth?: number;
    already_downloaded?: boolean;
}

export interface ArtistData extends Artist {
    biography?: { en?: string; id?: string; [key: string]: string | undefined } | string;
    albums?: { items: Album[] };
    tracks?: { items: Track[] };
    similar_artists?: { items: Artist[] };
    already_downloaded?: boolean;
}
