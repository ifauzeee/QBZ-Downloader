import { z } from 'zod';

export const MUSIC_SOURCE_PLUGIN_API_VERSION = '1.0';

const pluginIdSchema = z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z][a-z0-9.-]*[a-z0-9]$/);

const pluginCapabilitySchema = z
    .object({
        search: z.boolean().default(false),
        getTrack: z.boolean().default(false),
        getAlbum: z.boolean().default(false),
        getPlaylist: z.boolean().default(false),
        getFileUrl: z.boolean().default(false),
        getLyrics: z.boolean().default(false)
    })
    .strict();

const pluginCredentialSchema = z
    .object({
        key: z.string().trim().min(1).max(64).regex(/^[A-Z0-9_]+$/),
        label: z.string().trim().min(1).max(80),
        required: z.boolean().default(true),
        secret: z.boolean().default(true),
        description: z.string().trim().max(240).optional()
    })
    .strict();

export const musicSourcePluginManifestSchema = z
    .object({
        apiVersion: z.literal(MUSIC_SOURCE_PLUGIN_API_VERSION),
        id: pluginIdSchema,
        name: z.string().trim().min(1).max(80),
        version: z.string().trim().min(1).max(32),
        type: z.literal('music-source'),
        entrypoint: z.string().trim().min(1).max(240),
        description: z.string().trim().max(500).optional(),
        homepage: z.string().url().optional(),
        capabilities: pluginCapabilitySchema,
        permissions: z
            .object({
                networkHosts: z.array(z.string().trim().min(1).max(160)).max(20).default([])
            })
            .strict()
            .default({ networkHosts: [] }),
        credentials: z.array(pluginCredentialSchema).max(20).default([]),
        configDefaults: z.record(z.string(), z.unknown()).default({})
    })
    .strict();

export type MusicSourcePluginManifest = z.infer<typeof musicSourcePluginManifestSchema>;

export interface MusicSourceSearchRequest {
    query: string;
    type?: 'tracks' | 'albums' | 'artists' | 'playlists';
    limit?: number;
}

export interface MusicSourceImage {
    small?: string;
    thumbnail?: string;
    large?: string;
    original?: string;
}

export interface MusicSourceArtist {
    id: string;
    name: string;
    image?: MusicSourceImage;
}

export interface MusicSourceAlbum {
    id: string;
    title: string;
    artist?: MusicSourceArtist;
    releaseDate?: string;
    label?: string;
    genre?: string;
    image?: MusicSourceImage;
}

export interface MusicSourceTrack {
    id: string;
    title: string;
    duration?: number;
    trackNumber?: number;
    artist?: MusicSourceArtist;
    album?: MusicSourceAlbum;
    isrc?: string;
    quality?: number;
}

export interface MusicSourcePlaylist {
    id: string;
    title: string;
    description?: string;
    trackCount?: number;
    image?: MusicSourceImage;
}

export interface MusicSourceSearchResult {
    tracks?: MusicSourceTrack[];
    albums?: MusicSourceAlbum[];
    artists?: MusicSourceArtist[];
    playlists?: MusicSourcePlaylist[];
}

export interface MusicSourceFileUrlRequest {
    trackId: string;
    quality: number;
}

export interface MusicSourceFileUrlResult {
    url: string;
    format?: string;
    expiresAt?: string;
}

export interface MusicSourcePluginContext {
    credentials: Record<string, string>;
    config: Record<string, unknown>;
    logger: {
        debug(message: string): void;
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
    };
}

export interface MusicSourcePlugin {
    manifest: MusicSourcePluginManifest;
    initialize?(context: MusicSourcePluginContext): Promise<void> | void;
    search?(request: MusicSourceSearchRequest): Promise<MusicSourceSearchResult>;
    getTrack?(id: string): Promise<MusicSourceTrack>;
    getAlbum?(id: string): Promise<MusicSourceAlbum>;
    getPlaylist?(id: string): Promise<MusicSourcePlaylist>;
    getFileUrl?(request: MusicSourceFileUrlRequest): Promise<MusicSourceFileUrlResult>;
    getLyrics?(track: MusicSourceTrack): Promise<{ text: string; synced?: boolean } | null>;
}

export const musicSourcePluginApiDescriptor = {
    apiVersion: MUSIC_SOURCE_PLUGIN_API_VERSION,
    type: 'music-source',
    requiredFields: ['apiVersion', 'id', 'name', 'version', 'type', 'entrypoint', 'capabilities'],
    capabilityKeys: ['search', 'getTrack', 'getAlbum', 'getPlaylist', 'getFileUrl', 'getLyrics'],
    manifestExample: {
        apiVersion: MUSIC_SOURCE_PLUGIN_API_VERSION,
        id: 'com.example.tidal',
        name: 'Tidal Source',
        version: '0.1.0',
        type: 'music-source',
        entrypoint: './index.js',
        description: 'Example third-party music source.',
        capabilities: {
            search: true,
            getTrack: true,
            getAlbum: true,
            getPlaylist: true,
            getFileUrl: true,
            getLyrics: false
        },
        permissions: {
            networkHosts: ['api.example.com']
        },
        credentials: [
            {
                key: 'ACCESS_TOKEN',
                label: 'Access token',
                required: true,
                secret: true
            }
        ],
        configDefaults: {}
    }
} as const;

export function validateMusicSourcePluginManifest(input: unknown): MusicSourcePluginManifest {
    return musicSourcePluginManifestSchema.parse(input);
}
