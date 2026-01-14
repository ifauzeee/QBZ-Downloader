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
| 📋 **Smart Detection** | Auto-detects Qobuz links from your clipboard for faster downloads |
| 🔄 **History Sync** | Prevents duplicate downloads by tracking your history in `history.json` |
| 🖼️ **Cover Art** | High-resolution album artwork embedded directly in files |
| 📊 **Beautiful CLI** | Modern TUI (Terminal User Interface) built with React (Ink) |
| 🔍 **Catalog Search** | Search albums, tracks, and artists directly from the CLI |
| 📚 **Batch Download** | Download entire albums, playlists, or artist discographies efficiently |

---

## 📦 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Modern Terminal** (Windows Terminal, iTerm2, or any terminal with Unicode/Color support)
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

#### Sensitive Credentials (`.env`)
The `.env` file is **only** for sensitive secrets:

```env
# Qobuz Credentials (REQUIRED)
QOBUZ_APP_ID=your_app_id
QOBUZ_APP_SECRET=your_app_secret
QOBUZ_USER_AUTH_TOKEN=your_user_auth_token

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

#### Application Settings (`settings.json`)
All other settings (paths, quality, metadata, etc.) are in `settings.json`.
The app will use default values if this file doesn't exist.

```json
{
  "downloads": {
    "path": "./downloads",
    "concurrent": 4
  },
  "quality": {
    "default": 27
  },
  "display": {
    "colorScheme": "gradient"
  }
}
```

### Getting API Credentials

| Service | How to Get |
|---------|------------|
| **Qobuz** | Browser DevTools while logged into play.qobuz.com |

---

## 🚀 Usage

### Mode 1: Interactive Menu (Recommended)
This is the easiest way to use the tool. Just run:
```bash
npm start
```
**Pro Tip:** Copy a Qobuz URL before running this command; the tool will automatically detect it from your clipboard!

### Mode 2: Direct CLI
For automation or power users:
```bash
# Download a specific URL
qbz-dl download <url>

# Download with specific quality (e.g., MP3 320)
qbz-dl download <url> -q 5

# Search and download
qbz-dl search "Daft Punk"
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

## 🤖 Telegram Bot

Turn your downloader into a personal music cloud bot!

### Features

- 🔍 **Interactive Search**: `/search <query>`
- ☁️ **Cloud Download**: Send any Qobuz link directly.
- 🛡️ **Security**: Use `TELEGRAM_ALLOWED_USERS` in `.env` to restrict access.

### Setup

1. **Create a Bot**: Talk to [@BotFather](https://t.me/BotFather) on Telegram to get your `TELEGRAM_BOT_TOKEN`.
2. **Get Chat ID**: Send a message to your new bot, then check `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` to find your numeric `id` (chat ID).
3. **Configure `.env`**:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789
TELEGRAM_UPLOAD_FILES=true
TELEGRAM_AUTO_DELETE=true
```

### Running the Bot

First, compile the code (required once):

```bash
npm run build
```

Then start the bot:

```bash
npm run bot
```

The bot is now online! Send it `/start` or any Qobuz URL.

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

## 💡 Quality Assurance & Pro Tips

While this tool strives for metadata perfection, sometimes external tools can provide that extra "polish":

- **Metadata Refinement:** If you feel the downloaded metadata needs further adjustment, we highly recommend using [Tagger](https://appteka.store/app/9e0r102377). For the most consistent results, we suggest setting the **Tag Combination** to **iTunes only**.
- **Lyrics Management:** Should you encounter missing or incomplete lyrics, [SongSync](https://github.com/Lambada10/SongSync) is an excellent tool for manually fetching and syncing lyrics with precision.

---

## 📝 Notes

- ⚠️ **Valid Qobuz subscription required** (Hi-Res downloads require a Studio plan).
- 🔒 This tool is intended for **personal use and archival purposes only**.
- 🎵 Lyrics are primarily sourced from [LRCLIB](https://lrclib.net).

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ifauzeee">ifauzeee</a>
</p>