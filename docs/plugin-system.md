# Music Source Plugin System

QBZ Downloader now has a public contract for third-party music source plugins. The first supported plugin type is `music-source`, intended for providers such as Tidal, Deezer HiFi, or private catalog bridges.

This is an interface contract and registry layer. Download engine integration should be added source-by-source after a plugin passes validation and can expose compatible track, album, playlist, and file URL methods.

## Manifest

Every plugin must provide a manifest that passes the `musicSourcePluginManifestSchema` validator from `src/plugins/music-source.ts`.

```json
{
  "apiVersion": "1.0",
  "id": "com.example.tidal",
  "name": "Tidal Source",
  "version": "0.1.0",
  "type": "music-source",
  "entrypoint": "./index.js",
  "description": "Example third-party music source.",
  "capabilities": {
    "search": true,
    "getTrack": true,
    "getAlbum": true,
    "getPlaylist": true,
    "getFileUrl": true,
    "getLyrics": false
  },
  "permissions": {
    "networkHosts": ["api.example.com"]
  },
  "credentials": [
    {
      "key": "ACCESS_TOKEN",
      "label": "Access token",
      "required": true,
      "secret": true
    }
  ],
  "configDefaults": {}
}
```

## Runtime Interface

A plugin module should export an object compatible with `MusicSourcePlugin`:

```ts
export default {
  manifest,
  async initialize(context) {},
  async search(request) {},
  async getTrack(id) {},
  async getAlbum(id) {},
  async getPlaylist(id) {},
  async getFileUrl(request) {},
  async getLyrics(track) {}
};
```

Only capabilities declared in the manifest should be called by the host.

## Registry Endpoints

The dashboard tools router exposes the initial developer-facing endpoints:

- `GET /api/tools/plugins/manifest-schema` returns the supported API descriptor and example manifest.
- `POST /api/tools/plugins/validate-manifest` validates a manifest without installing it.
- `GET /api/tools/plugins` lists registered plugin configs.
- `POST /api/tools/plugins/register` validates and stores a plugin manifest/config.
- `POST /api/tools/plugins/:id/enabled` enables or disables a registered plugin.

Registered plugin configs are stored in the existing `plugins` table, and lifecycle actions are recorded in `plugin_events`.

## Next Integration Steps

- Add a sandboxed loader that imports plugin entrypoints from a controlled plugin directory.
- Route catalog/search/download requests through a source registry instead of hard-coding Qobuz in every path.
- Store plugin credentials through the encrypted settings layer, not inside plugin config JSON.
- Add per-plugin permission prompts before allowing network access or file system access.
- Create a sample plugin package that implements search and metadata-only lookup before enabling file URL/download support.
