# Acknowledgements

This project was made possible by the incredible work of the Visual Pinball community and the developers of various open-source tools and libraries. I would like to express my gratitude and acknowledge the following resources, projects, and authors:

## Project Inspiration
- **VPinFE**: A huge thank you to the authors and community around VPinFE. This project was heavily inspired by the user experience and vision of VPinFE, striving to bring a seamless and premium table management experience to macOS and ES-DE.

## Visual Pinball Community & Ecosystem
The passion and dedication of the Visual Pinball community form the foundation of this application.
- **jsm174 & vpx-standalone-scripts**: For the essential VBS scripts that enable Visual Pinball X Standalone to run smoothly across platforms. Their repository provides the critical sidecar files necessary for game execution.
- **Table Authors & Modders**: The countless creators who have dedicated their time to recreating real pinball tables and designing original masterpieces for VPX.

## Metadata & Media Sources
This project relies on several fantastic community-driven databases for matching tables and downloading rich media:
- **Virtual Pinball Spreadsheet (VPS)**: The definitive database for Virtual Pinball. The integration heavily utilizes data from the `vps-db` (https://virtualpinballspreadsheet.github.io/) to accurately match tables, ROMs, and provide relevant metadata.
- **VPinMediaDB (superhac/vpinmediadb)**: An invaluable, open repository for high-quality visual pinball media assets (wheels, screenshots, videos).
- **ScreenScraper (screenscraper.fr)**: For their extensive retro-gaming database and API, which provides supplementary game metadata, manuals, and standard media for frontend displays.

## Open Source Libraries & Technologies
This application is built on the shoulders of giants. I gratefully acknowledge the authors and maintainers of the following software libraries:

**Backend & Core (Python):**
- [FastAPI](https://fastapi.tiangolo.com/): For the lightning-fast, modern backend API framework.
- [Uvicorn](https://www.uvicorn.org/): For the robust ASGI server.
- [Pydantic](https://docs.pydantic.dev/): For reliable data validation and settings management.
- [HTTPX](https://www.python-httpx.org/): For efficient, asynchronous HTTP client functionality.
- [aiosqlite](https://aiosqlite.omnilib.dev/): For asynchronous SQLite database interactions.
- [Pillow (PIL)](https://python-pillow.org/): For powerful image processing capabilities.
- [olefile](https://olefile.readthedocs.io/): Crucial for parsing and interacting with OLE Structured Storage formats like `.vpx` files.
- [rumps](https://github.com/jaredks/rumps): For enabling native, lightweight macOS menu bar app integration.
- Archive Utilities: `py7zr`, `rarfile`, and `patool` for seamless handling of compressed table archives.
- [setproctitle](https://github.com/dvarrazzo/py-setproctitle): For process naming.

**Frontend:**
- **Vanilla Web Technologies**: Built elegantly with standard HTML5, CSS3, and JavaScript, demonstrating the power of modern web standards.
- [PDF.js](https://mozilla.github.io/pdf.js/): By Mozilla, integrated natively into the frontend to provide smooth, browser-based PDF rendering for game manuals without relying on external plugins.

Thank you to everyone who contributes to the preservation, enhancement, and enjoyment of digital pinball.
