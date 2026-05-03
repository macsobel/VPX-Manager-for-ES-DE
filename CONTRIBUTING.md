# Development Guide

This guide provides instructions for setting up a local development environment for **VPX Manager for ES-DE**.

## 🛠 Prerequisites

- **Python 3.11 or 3.12** (Python 3.13+ may have compatibility issues with some dependencies like `rumps`).
- **Git**
- **Homebrew** (for macOS dependencies) or **apt/dnf** (for Linux).

## 🚀 Setting Up the Environment

1. **Clone the Repository**
   ```bash
   git clone https://github.com/macsobel/VPX-Manager-for-ES-DE
   cd VPX-Manager-for-ES-DE
   ```

2. **Create a Virtual Environment**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install System Dependencies (macOS)**
   ```bash
   # Required for Backglass Companion and Video Processing
   brew install sdl2 sdl2_image sdl2_mixer sdl2_ttf ffmpeg
   ```

---

## 🔑 ScreenScraper API Credentials

To use the scraping features during development, you need your own **ScreenScraper Developer Credentials**. Without these, the app will fall back to public access, which has lower rate limits and may fail for certain media types.

### 1. Obtain Credentials
Register for a developer account at [ScreenScraper.fr](https://www.screenscraper.fr/) to obtain:
- `devid`
- `devpassword`

### 2. Configure Your Environment
You can provide these credentials to the app in two ways:

#### Option A: Environment Variables (Recommended)
Add the following to your shell profile (`.zshrc` or `.bashrc`) or a local `.env` file:
```bash
export SS_DEV_ID="your_dev_id"
export SS_DEVPASS="your_dev_password"
```

#### Option B: `config.dat` File
Create a `config.dat` file in the project root. This file is ignored by git to prevent accidental commits of your credentials.
```json
{
  "screenscraper_devid": "your_dev_id",
  "screenscraper_devpassword": "your_dev_password"
}
```
> [!IMPORTANT]
> Never commit your `config.dat` file or your personal credentials to a public repository.

---

## 🖥 Running Locally

Launch the application in development mode:
```bash
python3 main.py
```
- **Web UI**: Access at `http://localhost:8746`
- **Logs**: View real-time logs in the terminal or in `~/Library/Application Support/VPX Manager for ES-DE/vpx_manager.log`.

---

## 📦 Building the Application

To package the application into a standalone `.app` bundle (macOS) or binary (Linux), use the provided build script:

```bash
./scripts/build/build_app.sh
```

This script handles:
1. Bundling the FastAPI backend.
2. Compiling the SDL2-based Backglass Companion.
3. Obfuscating baked-in credentials (if present in `config.dat`).
4. Creating the final DMG or distribution folder.

## 🤝 Contributing

1. **Create a Branch**: `git checkout -b feature/your-feature-name`
2. **Commit Changes**: Use descriptive commit messages.
3. **Push & PR**: Push your branch and open a Pull Request against the `main` branch.

Please ensure your code follows the existing style and includes comments for complex logic.
