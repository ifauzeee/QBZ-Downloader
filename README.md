<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=for-the-badge&logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/license-MIT-orange?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=for-the-badge" alt="Platform">
</p>

<h1 align="center">
  🎵 QBZ-Downloader (TypeScript Edition)
</h1>

<p align="center">
  <b>Premium Hi-Res Music Downloader CLI for Qobuz</b><br>
  <sub>Download lossless FLAC audio up to 24-bit/192kHz with complete metadata, synced lyrics, and enhanced tagging</sub>
</p>

---

## ✨ New in v2.0 (TypeScript)

- **🚀 Full TypeScript Migration:** Safer, more robust codebase.
- **🔄 Auto-Token Refresh:** Automatically prompts for a new token when expired, no restarts needed.
- **🛡️ Enhanced Error Handling:** Better error messages and recovery.
- **🏗️ Modern Architecture:** Modular service-based design.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔥 **Hi-Res Audio** | Download studio-quality audio up to 24-bit/192kHz FLAC |
| 📝 **Complete Metadata** | Automatically embed all available tags including credits, composers, conductors |
| 🎤 **Synced Lyrics** | Fetch and embed time-synced lyrics (LRC format) from LRCLIB |
| 🖼️ **Cover Art** | High-resolution album artwork embedded in files |
| 📊 **Beautiful CLI** | Colorful, informative terminal interface with progress tracking |
| 🔍 **Catalog Search** | Search albums, tracks, and artists directly from CLI |
| 📚 **Batch Download** | Download entire albums, playlists, or artist discographies |

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

### 1. Run Setup Wizard (Recommended)

The easiest way to configure the tool is to run the setup wizard:

```bash
npm start setup
```

This will prompt you for your credentials and create the `.env` file automatically.

### 2. Manual Configuration

Alternatively, copy the example config and edit it manually:

```bash
cp .env.example .env
```

Edit `.env` file:

```env
# Qobuz Credentials (REQUIRED)
QOBUZ_APP_ID=your_app_id
QOBUZ_APP_SECRET=your_app_secret
QOBUZ_USER_AUTH_TOKEN=your_user_auth_token
```

### Getting API Credentials

| Service | How to Get |
|---------|------------|
| **Qobuz** | Browser DevTools while logged into play.qobuz.com |

---

## 🚀 Usage

### Development / Direct Run

You can run the tool directly using `npm start`.

```bash
npm start
```

### Building for Production

To compile the TypeScript code to JavaScript for faster execution:

```bash
npm run build
node dist/index.js
```

### Commands

| Command | Description |
|---------|-------------|
| `download <url>` | Download a track, album, playlist, or artist |
| `search <query>` | Search the Qobuz catalog |
| `info <url>` | Get detailed information about media |
| `lyrics <url>` | Get lyrics for a track |
| `account` | Display account information |
| `quality` | Show available quality options |
| `setup` | Run configuration wizard |

### Quality Options

| ID | Format | Description |
|----|--------|-------------|
| **27** | FLAC 24/192 | 🔥 Hi-Res Max |
| **7** | FLAC 24/96 | ✨ Hi-Res |
| **6** | FLAC 16/44 | 💿 CD Quality |
| **5** | MP3 320 | 🎵 Lossy |

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

## 🛠️ Development

### Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run lint`: Run ESLint check
- `npm test`: Run tests with Vitest
- `npm run format`: Format code with Prettier

---

## 📝 Notes

- ⚠️ **Valid Qobuz subscription required**
- 🔒 **Hi-Res downloads** require Qobuz Studio subscription
- 📖 This tool is for **personal use only**
- 🎵 Lyrics sourced from [LRCLIB](https://lrclib.net)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ifauzeee">ifauzeee</a>
</p>