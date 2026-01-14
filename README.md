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

### 🚀 Core Capabilities
*   **Hi-Res Audio**: Download studio-quality FLAC up to **24-bit/192kHz**.
*   **Batch Downloading**: Download tracks, albums, playlists, and even artist discographies.
*   **Persistent Queue**: Queue system backed by **SQLite** ensures your downloads are never lost, even after restarts.
*   **Smart Metadata**: Embeds complete tags, cover art, and even **Synced Lyrics** (LRC).
*   **Clipboard Integration**: Automatically detects Qobuz links from your clipboard for faster downloading.

### 🖥️ Technical Highlights
*   **CLI & Web Dashboard**: Choose your preferred interface. A rich TUI or a modern Web UI.
*   **Centralized Configuration**: All settings are now stored in **SQLite**, allowing live updates from the Web Dashboard.
*   **Telegram Bot**: Manage downloads remotely via a powerful Telegram Bot.
*   **Docker Ready**: Production-grade Docker support included with persistent data storage.

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
> **Note**: After linking, you can use the `qbz-dl` command globally.

### Option 2: Docker

```bash
docker-compose up -d
```

---

## ⚡ Quick Start

### 1. Setup

The application features an automatic setup wizard. Simply run:

```bash
qbz-dl
```

If not configured, it will guide you through entering your credentials which are then saved securely in the **SQLite database**.

### 2. Download

**Simple Download:**
```bash
qbz-dl download https://play.qobuz.com/album/123456
```

**Advanced Download Options:**
```bash
qbz-dl download <url> [options]

Options:
  -q, --quality <id>      Audio quality (5=MP3, 6=CD, 7=Hi-Res, 27=Hi-Res Max)
  -o, --output <path>     Custom output directory
  --no-lyrics             Skip lyrics embedding
  --no-cover              Skip cover art embedding
  -s, --skip-existing     Skip tracks already in history
  -i, --interactive       Force interactive selection mode
```

**Search & Download:**
```bash
qbz-dl search "Daft Punk"
```

### 3. Web Dashboard 🆕

Launch the web interface to manage settings and monitor downloads:

```bash
qbz-dl dashboard
```
> Access at [http://localhost:3000](http://localhost:3000). 
> *   **⚙️ Live Settings**: Update concurrence, file naming, and metadata preferences.
> *   **📥 Remote Queue**: Add URLs from any device.
> *   **📂 File Manager**: Browse and download files directly from the dashboard.
> *   **🛡️ Password Protection**: Secure your dashboard via `DASHBOARD_PASSWORD`.

---

## 🔧 CLI Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `qbz-dl download <url>` | `dl` | Download track/album/playlist from URL |
| `qbz-dl search <query>` | `s` | Search and download interactively |
| `qbz-dl info <url>` | - | Show metadata info without downloading |
| `qbz-dl lyrics <url>` | - | Fetch and display lyrics |
| `qbz-dl account` | - | Show Qobuz account information |
| `qbz-dl quality` | `q` | Display available quality options |
| `qbz-dl dashboard` | `web` | Launch web dashboard |
| `qbz-dl bot` | - | Start Telegram bot |
| `qbz-dl setup` | - | Run interactive setup wizard manually |

---

## 🛠️ Configuration (Centralized)

QBZ-Downloader has moved away from scattered JSON files. All configuration and history are now stored in `data/qbz.db`.

### Environment Variables (.env)
You only need a minimal `.env` for the first run or to override core settings. Copy `.env.example` to `.env`:

```env
# Essential (Required for first setup)
QOBUZ_APP_ID=...
QOBUZ_APP_SECRET=...
QOBUZ_USER_AUTH_TOKEN=...
QOBUZ_USER_ID=...

# Optional
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=your_secure_password
```

### Persistence (Docker)
Ensure the `data` directory is mounted to persist your database and settings:
```yaml
volumes:
  - ./data:/app/data
  - ./downloads:/app/downloads
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ❤️ by ifauzeee</sub>
</p>