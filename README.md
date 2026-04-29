# VPX Manager for ES-DE

**A web-based table management interface designed for Visual Pinball X (VPX) on macOS.** It provides a comprehensive solution for managing your VPX table library, directly integrating with EmulationStation-DE (ES-DE).

<p align="center">
  <img src="resources/icon.png" alt="VPX Manager for ES-DE app icon" width="128" height="128">
</p>

<p align="center">
  <a href="https://github.com/macsobel/VPX-Manager-for-ES-DE/releases"><strong>Releases</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/macOS-11%2B-blue" alt="macOS 11+">
  <img src="https://img.shields.io/badge/license-GPL--3.0-orange" alt="GPL-3.0 License">
</p>

---

## What this is

The primary purpose of this project is to simplify the management of Visual Pinball X tables on a Mac environment. It allows users to easily scan their directories for `.vpx` tables, organize them, scrape metadata and media assets (from sources like ScreenScraper), manage media efficiently, and export game configurations securely for EmulationStation.

## Screenshots

<p align="center">
  <img src="resources/screenshot.png" alt="VPX Manager for ES-DE screenshot" width="800">
  <br><em>VPX Manager for ES-DE interface</em>
</p>

## Features

- **Dashboard**: A quick overview of your pinball table library.
- **Table Management**: Scan local directories, view table metadata, and upload new tables directly from the browser.
- **Collections**: Group and organize tables into logical collections.
- **VBS Manager**: Tools for modifying and fixing associated VBScripts (Visual Basic Scripts) needed for VPX functionality.
- **Settings & Configuration**: Fully adjustable paths, integration with ScreenScraper, and customizable database locations.
- **EmulationStation Integration**: Syncing of media and updating of `gamelist.xml` files for ES-DE.
- **Standalone Mac App UI**: Integrated macOS menubar app (built with `rumps`) providing quick access to the Web UI, EmulationStation, and server management.

## Installation (Pre-built Release)

1. Download the latest version for your architecture from the [Releases](https://github.com/macsobel/VPX-Manager-for-ES-DE/releases) page.
2. Unzip the file and move **VPX Manager for ES-DE.app** to your `/Applications` folder.

### 🍏 macOS First Run Instructions

If macOS warns that the app is "damaged and can't be opened," it is blocked by Apple's Gatekeeper quarantine. To fix this:

1. Move the app to your **Applications** folder.
2. Open **Terminal** and run the following command to clear the quarantine flag:
   ```bash
   xattr -cr "/Applications/VPX Manager for ES-DE.app"
   ```

## Development Setup (From Source)

### Prerequisites
- macOS operating system (optimized for macOS, though backend features cross-platform capabilities).
- Python 3.11+ installed.

### Setup Instructions
1. **Clone the repository:**
   (Download the repository to your local machine).

2. **Install dependencies:**
   Navigate to the project root and install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configuration:**
   The application stores its configuration and database in `~/Library/Application Support/VPX Manager for ES-DE/`.
   When first starting the server, you can configure your directories (e.g., ROMs directory, ES-DE paths) via the Settings page in the web UI.

### Running the Application

To start the VPX Manager, simply run the main script:
```bash
python3 main.py
```

This will:
- Start the Uvicorn web server in the background (typically on port `8746`).
- Launch a macOS menubar icon (the standalone Mac App UI) to easily access the application.

You can access the Web UI by navigating your browser to:
`http://localhost:8746`

Or, simply click "Open Web UI" from the VPX Manager menubar icon.

### Testing and Development
If you are developing or testing, you can run the test suite by running:
```bash
python3 -m pytest
```
Make sure `PYTHONPATH=.` is set if needed for module discovery.

## License

This project is distributed under the [GNU General Public License v3.0](LICENSE).
