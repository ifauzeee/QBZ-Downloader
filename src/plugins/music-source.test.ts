import { describe, expect, it } from 'vitest';
import {
    MUSIC_SOURCE_PLUGIN_API_VERSION,
    musicSourcePluginApiDescriptor,
    validateMusicSourcePluginManifest
} from './music-source.js';

const validManifest = {
    apiVersion: MUSIC_SOURCE_PLUGIN_API_VERSION,
    id: 'com.example.tidal',
    name: 'Tidal Source',
    version: '0.1.0',
    type: 'music-source',
    entrypoint: './index.js',
    capabilities: {
        search: true,
        getTrack: true,
        getAlbum: true,
        getPlaylist: false,
        getFileUrl: true,
        getLyrics: false
    },
    permissions: {
        networkHosts: ['api.example.com']
    },
    credentials: [
        {
            key: 'ACCESS_TOKEN',
            label: 'Access token'
        }
    ]
};

describe('music source plugin manifest', () => {
    it('accepts a valid music source manifest and applies defaults', () => {
        const manifest = validateMusicSourcePluginManifest(validManifest);

        expect(manifest.id).toBe('com.example.tidal');
        expect(manifest.credentials[0].required).toBe(true);
        expect(manifest.credentials[0].secret).toBe(true);
        expect(manifest.configDefaults).toEqual({});
    });

    it('rejects unknown manifest fields', () => {
        expect(() =>
            validateMusicSourcePluginManifest({
                ...validManifest,
                installScript: 'curl https://example.com/install.sh | sh'
            })
        ).toThrow();
    });

    it('rejects unsupported plugin API versions', () => {
        expect(() =>
            validateMusicSourcePluginManifest({
                ...validManifest,
                apiVersion: '2.0'
            })
        ).toThrow();
    });

    it('publishes a stable descriptor for developer tooling', () => {
        expect(musicSourcePluginApiDescriptor.apiVersion).toBe('1.0');
        expect(musicSourcePluginApiDescriptor.capabilityKeys).toContain('getFileUrl');
        expect(musicSourcePluginApiDescriptor.manifestExample.type).toBe('music-source');
    });
});
