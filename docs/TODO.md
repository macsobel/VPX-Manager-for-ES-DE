# Project TODOs & Future Features

## 🚀 High Priority (In Progress)
- [ ] **Media Migration Utility**: 
    - Currently implemented in `services/media_manager.py` and `routers/settings.py`.
    - **STATUS: UNSTABLE**. Hidden from UI again due to reported hangs/failures.
    - Needs deep-dive into why the background task stalls for some users.
    - Needs a "Real-time Progress Bar" instead of just a spinner.

## 🛠️ Maintenance & Refinement
- [ ] **Version Number Sync**: Continue keeping `version.txt` as the source of truth for all builds.
- [ ] **Menubar Improvements**: Add more status indicators to the tray (e.g., active task count).

## 💡 New Feature Ideas
- [ ] **Bulk Metadata Editing**: Select multiple tables and update fields like 'Company' or 'Year' at once.
- [ ] **Cloud Backup**: Optional backup of the `vpx_manager.db` to a user-provided cloud storage.
