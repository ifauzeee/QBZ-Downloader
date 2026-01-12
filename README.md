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
  <sub>Download lossless FLAC audio up to 24-bit/192kHz with complete metadata and embedded lyrics</sub>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/ifauzeee/QBZ-Downloader/main/assets/demo.gif" alt="Demo" width="700">
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔥 **Hi-Res Audio** | Download studio-quality audio up to 24-bit/192kHz FLAC |
| 📝 **Complete Metadata** | Automatically embed all available tags including credits, composers, conductors |
| 🎤 **Synced Lyrics** | Fetch and embed time-synced lyrics (LRC format) from LRCLIB |
| 🖼️ **Cover Art** | High-resolution album artwork embedded in files |
| 🎯 **Enhanced Metadata** | Optional metadata enrichment from Spotify and iTunes/Apple Music |
| 📊 **Beautiful CLI** | Colorful, informative terminal interface with progress tracking |
| 🔍 **Catalog Search** | Search albums, tracks, and artists directly from CLI |
| 📚 **Batch Download** | Download entire albums with a single command |
| 📄 **Goodies Download** | Automatically download booklets and other album extras |

---

## 📦 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Valid Qobuz subscription** (Studio or Hi-Fi plan recommended for Hi-Res)
- **Qobuz API credentials** (see [Configuration](#-configuration))

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/ifauzeee/QBZ-Downloader.git

# Navigate to the directory
cd QBZ-Downloader

# Install dependencies
npm install
```

### Global Installation (Optional)

```bash
# Install globally for system-wide access
npm install -g .

# Now you can run from anywhere
qbz-dl
```

---

## ⚙️ Configuration

### 1. Create Environment File

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

### 2. Edit `.env` File

```env
# Qobuz Credentials (REQUIRED)
QOBUZ_APP_ID=your_app_id
QOBUZ_APP_SECRET=your_app_secret
QOBUZ_TOKEN=your_user_auth_token
QOBUZ_USER_ID=your_user_id

# Spotify Credentials (OPTIONAL - for enhanced metadata)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Getting Qobuz Credentials

You can obtain Qobuz API credentials using browser developer tools while logged into the Qobuz web player:

1. Log into [play.qobuz.com](https://play.qobuz.com)
2. Open Developer Tools (F12)
3. Go to Network tab
4. Look for API requests to find `app_id` and `user_auth_token`

### Getting Spotify Credentials (Optional)

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Copy the Client ID and Client Secret

---

## 🚀 Usage

### Interactive Mode

Simply run without arguments to access the interactive menu:

```bash
npm start
# or if installed globally
qbz-dl
```

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `download <url>` | `dl` | Download a track or album |
| `search <query>` | `s` | Search the Qobuz catalog |
| `info <url>` | `i` | Get detailed information |
| `lyrics <url>` | `l` | Get lyrics for a track |
| `account` | `acc` | Display account information |
| `quality` | `q` | Show available quality options |

### Download Examples

```bash
# Download album in Hi-Res Max quality (default)
npm start download https://www.qobuz.com/album/...

# Download with specific quality
npm start download https://www.qobuz.com/album/... -q 27   # Hi-Res Max (24/192)
npm start download https://www.qobuz.com/album/... -q 7    # Hi-Res (24/96)
npm start download https://www.qobuz.com/album/... -q 6    # CD Quality (16/44.1)
npm start download https://www.qobuz.com/album/... -q 5    # MP3 320

# Download a single track
npm start download https://www.qobuz.com/track/...

# Interactive download mode
npm start download -i
```

### Search Examples

```bash
# Search albums
npm start search "Daft Punk Random Access Memories"

# Search tracks
npm start search "Get Lucky" -t tracks

# Search artists with limit
npm start search "Coldplay" -t artists -l 20
```

### Get Information

```bash
# Album info
npm start info https://www.qobuz.com/album/...

# Track info with complete metadata
npm start info https://www.qobuz.com/track/... -m

# Track info with lyrics
npm start info https://www.qobuz.com/track/... -l
```

### Get Lyrics

```bash
# Get lyrics by track URL
npm start lyrics https://www.qobuz.com/track/...

# Show synced lyrics only
npm start lyrics <url> --synced

# Show plain lyrics only
npm start lyrics <url> --plain
```

---

## 📊 Audio Quality Options

| ID | Format | Bit Depth | Sample Rate | Description |
|----|--------|-----------|-------------|-------------|
| **27** | FLAC | 24-bit | 192 kHz | 🔥 Hi-Res Max (Best Quality) |
| **7** | FLAC | 24-bit | 96 kHz | ✨ Hi-Res Lossless |
| **6** | FLAC | 16-bit | 44.1 kHz | 💿 CD Quality Lossless |
| **5** | MP3 | - | 320 kbps | 🎵 Lossy Compressed |

> **Note:** Hi-Res quality requires a Qobuz Studio subscription. The downloader will automatically fall back to the best available quality if Hi-Res is not available for a specific track.

---

## 📋 Embedded Metadata

The downloader embeds comprehensive metadata into each file:

### Standard Tags
- Title, Artist, Album, Album Artist
- Track Number, Disc Number, Total Tracks, Total Discs
- Year, Release Date, Original Release Date
- Genre, Composer, Conductor

### Extended Tags
- Producer, Mixer, Engineer, Arranger
- Lyricist, Writer, Remixer
- Label, Publisher, Copyright
- ISRC, UPC/Barcode, Catalog Number

### Audio Information
- Bit Depth, Sample Rate
- Qobuz Track/Album/Artist IDs
- Source, Encoder

### Enhanced Metadata (via Spotify)
- BPM, Musical Key, Time Signature
- Danceability, Energy, Valence (mood)
- Acousticness, Instrumentalness
- Popularity Score

### Lyrics
- Unsynced Lyrics (plain text)
- Synced Lyrics (LRC format with timestamps)
- Separate `.lrc` file for external player support

---

## 📁 Output Structure

Downloads are organized in a clean folder structure:

```
downloads/
└── Artist Name/
    └── Album Title/
        ├── 01. Track One.flac
        ├── 01. Track One.lrc          # Synced lyrics file
        ├── 02. Track Two.flac
        ├── 02. Track Two.lrc
        ├── cover.jpg                   # High-res album artwork
        └── Digital Booklet.pdf         # If available
```

---

## 🔧 Advanced Configuration

Edit your `.env` file to customize the behavior without modifying the code.

### Download Settings
```env
DOWNLOAD_PATH="./downloads"          # Where to save files
FOLDER_TEMPLATE="{artist}/{album}"   # Folder structure
FILE_TEMPLATE="{trackNumber}. {title}" # File naming
MAX_CONCURRENCY=3                    # Number of parallel downloads
```

### Metadata & Preferences
```env
EMBED_COVER_ART=true                 # Embed cover art into files
SAVE_COVER_FILE=true                 # Save cover.jpg to folder
EMBED_LYRICS=true                    # Embed lyrics into files
```

---

## 🖥️ CLI Screenshots

<details>
<summary><b>📷 Click to view screenshots</b></summary>

### Main Menu
```
 ██████╗  ██████╗ ██████╗ ██╗   ██╗███████╗    ██████╗ ██╗     
██╔═══██╗██╔═══██╗██╔══██╗██║   ██║╚══███╔╝    ██╔══██╗██║     
██║   ██║██║   ██║██████╔╝██║   ██║  ███╔╝     ██║  ██║██║     
██║▄▄ ██║██║   ██║██╔══██╗██║   ██║ ███╔╝      ██║  ██║██║     
╚██████╔╝╚██████╔╝██████╔╝╚██████╔╝███████╗    ██████╔╝███████╗
 ╚══▀▀═╝  ╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝    ╚═════╝ ╚══════╝

🎵 Premium Qobuz Downloader CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Hi-Res Audio up to 24bit/192kHz
📝 Complete Metadata Embedding
🎤 Synced & Unsynced Lyrics
🖼️  High-Resolution Cover Art
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Main Menu:

  1) 🔍 Search Music
  2) 📥 Download by URL
  3) 👤 Account Info
  4) 🎚️ Quality Options
  5) ❌ Exit
```

</details>

---

## 📝 Notes & Disclaimers

- ⚠️ **Valid Qobuz subscription required** for downloading
- 🔒 **Hi-Res downloads** require Qobuz Studio subscription
- 📖 This tool is for **personal use only**
- 🎵 Lyrics are sourced from [LRCLIB](https://lrclib.net) (free service)
- 📊 Enhanced metadata from Spotify requires a free developer account

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [LRCLIB](https://lrclib.net) - Free synced lyrics API
- [Qobuz](https://www.qobuz.com) - Hi-Res music streaming service
- [Spotify Web API](https://developer.spotify.com) - Enhanced metadata
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) - Additional metadata

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ifauzeee">ifauzeee</a>
</p>

<p align="center">
  <sub>⭐ Star this repo if you find it useful!</sub>
</p>
