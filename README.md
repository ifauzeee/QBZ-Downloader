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
  <b>The Ultimate Qobuz Downloader CLI & Web Dashboard</b><br>
  <sub>Download Hi-Res FLAC audio (up to 24-bit/192kHz) with ease, style, and power.</sub>
</p>

---

## ✨ Features

### 🚀 Core Capabilities
*   **Hi-Res Audio**: Download studio-quality FLAC up to **24-bit/192kHz**.
*   **Batch Downloading**: Download tracks, albums, playlists, and even artist discographies.
*   **Persistent Queue**: Queue system backed by **SQLite** ensures your downloads are never lost, even after restarts.
*   **Smart Metadata**: Embeds complete tags, cover art, and even **Synced Lyrics** (LRC).

### 🖥️ Technical Highlights
*   **CLI & Web Dashboard**: Choose your preferred interface. A rich TUI or a modern Web UI.
*   **Telegram Bot**: Manage downloads remotely via a powerful Telegram Bot.
*   **Headless Mode**: Run on a server/VPS/Raspberry Pi seamlessly.
*   **Docker Ready**: Production-grade Docker support included.

---

## 📦 Installation

### Option 1: NPM (Recommended)

```bash
git clone https://github.com/ifauzeee/QBZ-Downloader.git
cd QBZ-Downloader
npm install
npm run build
npm link
```

### Option 2: Docker

```bash
docker-compose up -d
```

---

## ⚡ Quick Start

### 1. Setup

Run the interactive setup wizard to configure your Qobuz credentials:

```bash
npm start setup
```

### 2. Download

**Simple Download:**
```bash
qbz-dl download https://play.qobuz.com/album/123456
```

**Search & Download:**
```bash
qbz-dl search "Daft Punk"
```

### 3. Web Dashboard 🆕

Launch the web interface to monitor and manage queue:

```bash
qbz-dl dashboard
```
> Access at [http://localhost:3000](http://localhost:3000)

### 4. Telegram Bot

Start the bot service:

```bash
qbz-dl bot
```

---

## 🔧 CLI Commands

| Command | Description |
|---------|-------------|
| `qbz-dl download <url>` | Download track/album/playlist from URL |
| `qbz-dl search <query>` | Search and download interactively |
| `qbz-dl info <url>` | Show metadata info without downloading |
| `qbz-dl lyrics <url>` | Fetch and display lyrics |
| `qbz-dl account` | Show Qobuz account information |
| `qbz-dl quality` | Display available quality options |
| `qbz-dl dashboard` | Launch web dashboard |
| `qbz-dl bot` | Start Telegram bot |
| `qbz-dl setup` | Run interactive setup wizard |

### Download Options

```bash
# Download with specific quality
qbz-dl download <url> -q 27

# Download to custom directory
qbz-dl download <url> -o ./my-music

# Skip existing tracks
qbz-dl download <url> --skip-existing
```

---

## 🛠️ Advanced Usage

### Persistent Queue
The application now uses a local **SQLite** database (`data/qbz.db`) to store queue and history. You can safely stop the application (`Ctrl+C`); pending downloads will resume automatically next time you start the `dashboard` or `bot`.

### Docker Deployment
The project includes a multi-stage `Dockerfile`. 
To run the full stack (Bot + CLI support):

```bash
docker-compose up -d
```

### Environment Variables (.env)

Copy `.env.example` to `.env` and configure:

```env
# Essential (Required)
QOBUZ_APP_ID=...
QOBUZ_APP_SECRET=...
QOBUZ_USER_AUTH_TOKEN=...

# Telegram Bot (Optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_ALLOWED_USERS=12345678,87654321

# Download Settings
DOWNLOADS_PATH=./downloads
DEFAULT_QUALITY=27

# Web Dashboard (Optional)
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=
```

### Quality Options

| ID | Format | Description |
|----|--------|-------------|
| `5` | MP3 320kbps | Lossy, smallest file size |
| `6` | FLAC 16-bit/44.1kHz | CD Quality, lossless |
| `7` | FLAC 24-bit/96kHz | Hi-Res Audio |
| `27` | FLAC 24-bit/192kHz | Hi-Res Max (Best) |

### File Naming Templates

You can customize file naming in `settings.json`:

```json
{
  "downloads": {
    "folderTemplate": "{artist}/{album}",
    "fileTemplate": "{track_number}. {title}"
  }
}
```

**Available placeholders:** `{artist}`, `{album}`, `{title}`, `{track_number}`, `{year}`, `{quality}`

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ❤️ by ifauzeee</sub>
</p>