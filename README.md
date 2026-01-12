<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=for-the-badge&logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-orange?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge" alt="Platform">
</p>

<h1 align="center">
  🎵 QBZ-Downloader
</h1>

<p align="center">
  <b>Premium Hi-Res Music Downloader CLI for Qobuz</b><br>
  <sub>Download lossless FLAC audio up to 24-bit/192kHz with complete metadata, synced lyrics, and enhanced tagging</sub>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔥 **Hi-Res Audio** | Download studio-quality audio up to 24-bit/192kHz FLAC |
| 📝 **Complete Metadata** | Automatically embed all available tags including credits, composers, conductors |
| 🎤 **Synced Lyrics** | Fetch and embed time-synced lyrics (LRC format) from LRCLIB |
| 🖼️ **Cover Art** | High-resolution album artwork embedded in files |
| 🎯 **Multi-Source Metadata** | Enhanced metadata from Spotify, Discogs, and MusicBrainz |
| 📊 **Beautiful CLI** | Colorful, informative terminal interface with progress tracking |
| 🔍 **Catalog Search** | Search albums, tracks, and artists directly from CLI |
| 📚 **Batch Download** | Download entire albums with a single command |

---

## 🎯 Enhanced Metadata (NEW!)

This downloader enriches your music library with metadata from multiple sources:

| Source | Data Provided |
|--------|---------------|
| **Qobuz** | Audio, Cover Art, Label, Copyright, ISRC, UPC |
| **Spotify** | Artists (including featured), BPM, Key, Mood, Energy, Genres |
| **Discogs** | Catalog Number, Country, Styles, Labels |
| **MusicBrainz** | Original Release Date, Standardized IDs |
| **LRCLIB** | Synced Lyrics (LRC format) |

### Example Output Tags

```
ARTIST        = Lady Gaga; Bruno Mars
ALBUM         = Die With A Smile
YEAR          = 2024
GENRE         = Pop
BPM           = 158
KEY           = G Major
MOOD          = Happy
ENERGY        = 0.72
CATALOGNUMBER = B0041829-02
RELEASECOUNTRY= US
```

---

## 📦 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Valid Qobuz subscription** (Studio or Hi-Fi plan recommended for Hi-Res)

### Clone & Install

```bash
git clone https://github.com/ifauzeee/QBZ-Downloader.git
cd QBZ-Downloader
npm install
```

---

## ⚙️ Configuration

### 1. Copy Example Config

```bash
cp .env.example .env
```

### 2. Edit `.env` File

```env
# Qobuz Credentials (REQUIRED)
QOBUZ_APP_ID=your_app_id
QOBUZ_APP_SECRET=your_app_secret
QOBUZ_USER_AUTH_TOKEN=your_user_auth_token

# Enhanced Metadata APIs (OPTIONAL but recommended)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DISCOGS_TOKEN=your_discogs_token
```

### Getting API Credentials

| Service | How to Get |
|---------|------------|
| **Qobuz** | Browser DevTools while logged into play.qobuz.com |
| **Spotify** | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) |
| **Discogs** | [discogs.com/settings/developers](https://www.discogs.com/settings/developers) |

---

## 🚀 Usage

### Interactive Mode

```bash
npm start
```

### Commands

| Command | Description |
|---------|-------------|
| `download <url>` | Download a track or album |
| `search <query>` | Search the Qobuz catalog |
| `info <url>` | Get detailed information |
| `lyrics <url>` | Get lyrics for a track |
| `account` | Display account information |
| `quality` | Show available quality options |

### Quality Options

| ID | Format | Description |
|----|--------|-------------|
| **27** | FLAC 24/192 | 🔥 Hi-Res Max |
| **7** | FLAC 24/96 | ✨ Hi-Res |
| **6** | FLAC 16/44 | 💿 CD Quality |
| **5** | MP3 320 | 🎵 Lossy |

---

## 📋 Embedded Metadata

### Standard Tags
- Title, Artist, Album, Album Artist
- Track Number, Disc Number, Year
- Genre, Composer, Conductor

### Extended Tags
- Producer, Mixer, Engineer
- Label, Copyright, ISRC, UPC
- Catalog Number, Release Country

### Audio Features (via Spotify)
- BPM, Musical Key, Time Signature
- Danceability, Energy, Mood/Valence
- Acousticness, Instrumentalness

### Lyrics
- Synced Lyrics (LRC format with timestamps)
- Embedded directly into FLAC/MP3 files

---

## 📁 Output Structure

```
downloads/
└── Artist Name/
    └── Album Title/
        ├── 01 Track One.flac
        ├── 02 Track Two.flac
        └── cover.jpg
```

---

## 📝 Notes

- ⚠️ **Valid Qobuz subscription required**
- 🔒 **Hi-Res downloads** require Qobuz Studio subscription
- 📖 This tool is for **personal use only**
- 🎵 Lyrics sourced from [LRCLIB](https://lrclib.net)
- 📊 Enhanced metadata from Spotify & Discogs (optional)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ifauzeee">ifauzeee</a>
</p>

<p align="center">
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
