/* ═══════════════════════════════════════════════════════════
   Settings Page
   ═══════════════════════════════════════════════════════════ */

const SettingsPage = {
    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Settings</h1>
                <p class="page-subtitle">Configure file paths and adjust system settings</p>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    Directory Paths
                </div>
                <div class="card">
                    <form class="settings-grid" id="settings-form">
                        <div style="text-align: center;"><div class="spinner"></div></div>
                    </form>
                </div>
            </div>


            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    System Status
                </div>
                <div class="card" id="system-status-card">
                    <div style="text-align: center;"><div class="spinner"></div></div>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    Maintenance
                </div>
                <div style="display: flex; gap: var(--space-md); flex-wrap: wrap;">
                    <button class="btn btn-secondary" id="btn-rescan">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Rescan Tables
                    </button>
                    <button class="btn btn-secondary" id="btn-sync-vps">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                        Sync VPS Database
                    </button>
                    <button class="btn btn-secondary" id="btn-media-preferences" onclick="window.location.hash = 'media-preferences'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        Media Download Preferences
                    </button>
                    <button class="btn btn-secondary" id="btn-check-updates">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        Check for Updates
                    </button>
                </div>
            </div>
        `;

        this.loadSettings();
        this.loadSystemStatus();
        this.bindEvents();
    },

    _renderDirInput(id, label, value, description, pickFiles = false, isLocal = true) {
        return `
            <div class="input-group">
                <label class="input-label">${label}</label>
                <div style="display: flex; gap: var(--space-sm); align-items: center;">
                    <input class="input-field" id="${id}" name="${id}" value="${value}" style="flex: 1;">
                    ${isLocal ? `
                    <button class="btn btn-secondary btn-pick-path" data-target="${id}" data-prompt="${label}" data-files="${pickFiles}" title="Browse…" style="flex-shrink: 0; padding: 7px 12px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                        Browse
                    </button>
                    ` : ''}
                </div>
                ${description ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">${description}</div>` : ''}
            </div>
        `;
    },

    async loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();

            document.getElementById('settings-form').innerHTML = `
                ${this._renderDirInput('setting-tables-dir', 'Tables Directory', data.tables_dir, 'Folder containing your VPX tables', false, data.is_local)}

                <div style="grid-column: 1 / -1; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                        <div style="font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-xs);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            Visual Pinball Standalone Settings
                        </div>
                        <a href="https://github.com/vpinball/vpinball" target="_blank" style="font-size: 0.75rem; color: var(--accent-blue); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                            Official GitHub Repository
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    </div>
                    <div style="display: grid; gap: var(--space-md);">
                        ${this._renderDirInput('setting-vpx-app', 'VPX Standalone App Path', data.vpx_standalone_app_path, 'Path to the VPinballX executable or .app bundle', true, data.is_local)}

                        <div class="input-group">
                            <label class="input-label">VPX Flavor</label>
                            <select class="input-field" id="setting-vpx-flavor">
                                <option value="BGFX" ${data.vpx_use_flavor === 'BGFX' ? 'selected' : ''}>BGFX</option>
                                <option value="GL" ${data.vpx_use_flavor === 'GL' ? 'selected' : ''}>GL</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <label class="input-label">Display Mode</label>
                            <select class="input-field" id="setting-vpx-display-mode">
                                <option value="Desktop" ${data.vpx_display_mode === 'Desktop' ? 'selected' : ''}>Desktop</option>
                                <option value="Cabinet" ${data.vpx_display_mode === 'Cabinet' ? 'selected' : ''}>Cabinet</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div style="grid-column: 1 / -1; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                        <div style="font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-xs);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                            Emulation Station Desktop Edition Settings
                        </div>
                        <a href="https://es-de.org/" target="_blank" style="font-size: 0.75rem; color: var(--accent-blue); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                            es-de.org
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    </div>
                    <div style="display: grid; gap: var(--space-md);">
                        ${this._renderDirInput('setting-esde-app', 'Emulation Station Desktop Edition App Path', data.esde_app_path, 'Path to the ES-DE executable or .app bundle', true, data.is_local)}
                        
                        <div style="margin-top: var(--space-sm);">
                            <label class="input-label">Media Storage Strategy</label>
                            <select class="input-field" id="setting-media-storage-mode" style="margin-bottom: var(--space-xs);">
                                <option value="portable" ${data.media_storage_mode === 'portable' ? 'selected' : ''}>Portable (Store in Tables Directory)</option>
                                <option value="standard" ${data.media_storage_mode === 'standard' ? 'selected' : ''}>Standard (Store in ES-DE Downloaded Media Directory)</option>
                            </select>
                            <div style="font-size: 0.85rem; color: var(--text-tertiary);">Determines how media paths are written to gamelist.xml and where media is stored.</div>
                        </div>

                        <div id="esde-media-dir-container" style="${data.media_storage_mode === 'standard' ? '' : 'display: none;'}">
                            ${this._renderDirInput('setting-esde-media-dir', 'ES-DE Downloaded Media Directory', data.esde_media_dir, 'Directory for ES-DE downloaded media', false, data.is_local)}
                        </div>

                        <div style="margin-top: var(--space-xs);">
                            <button type="button" class="btn btn-secondary btn-sm" id="btn-migrate-media">Migrate Existing Media</button>
                        </div>
                    </div>
                </div>

                <div style="grid-column: 1 / -1; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                        <div style="font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-xs);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ScreenScraper Account
                        </div>
                        <a href="https://www.screenscraper.fr/membreinscription.php" target="_blank" style="font-size: 0.75rem; color: var(--accent-blue); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                            Register for a New ScreenScraper Account
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
                        <div class="input-group">
                            <label class="input-label">Username</label>
                            <input class="input-field" id="setting-ss-user" name="screenscraper_username" value="${data.screenscraper_username || ''}" placeholder="ScreenScraper ID">
                        </div>
                        <div class="input-group">
                            <label class="input-label">Password</label>
                            <input class="input-field" type="password" id="setting-ss-pass" name="screenscraper_password" value="${data.screenscraper_password || ''}" placeholder="••••••••">
                        </div>
                    </div>
                    <div style="margin-top: var(--space-md); display: flex; gap: var(--space-sm); align-items: center;">
                        <button class="btn btn-secondary" id="btn-test-ss">
                            Test Connection
                        </button>
                        <div id="ss-test-status" style="font-size: 0.85rem;"></div>
                    </div>
                </div>

                <div style="margin-top: var(--space-md);">
                    <button type="submit" class="btn btn-primary" id="btn-save-settings">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save Settings
                    </button>
                </div>
            `;

            // Bind Form Submit
            const form = document.getElementById('settings-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.saveSettings(true);
            };

            // Test ScreenScraper button
            document.getElementById('btn-test-ss').onclick = async () => {
                const statusDiv = document.getElementById('ss-test-status');
                statusDiv.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></div> Testing...';
                statusDiv.className = '';

                try {
                    // Better: The user should save settings first, then test.
                    // Or let's just save them automatically on test.
                    await this.saveSettings(false);

                    const res = await fetch('/api/scraper/test', { method: 'POST' });
                    const result = await res.json();

                    if (result.success) {
                        statusDiv.innerHTML = `<span style="color: var(--accent-green);">✓ ${result.message}</span>`;
                    } else {
                        statusDiv.innerHTML = `<span style="color: var(--accent-red);">✗ ${result.message}</span>`;
                    }
                } catch (e) {
                    statusDiv.innerHTML = `<span style="color: var(--accent-red);">✗ Error: ${e.message}</span>`;
                }
            };

            // Bind path picker buttons
            document.querySelectorAll('.btn-pick-path').forEach(btn => {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    const targetId = btn.dataset.target;
                    const prompt = btn.dataset.prompt || 'Select a path';
                    const pickFiles = btn.dataset.files === 'true';
                    btn.disabled = true;
                    btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div>';

                    try {
                        const res = await fetch(`/api/settings/pick-path?prompt=${encodeURIComponent('Select ' + prompt)}&pick_files=${pickFiles}`, { method: 'POST' });
                        const data = await res.json();
                        if (data.path) {
                            const target = document.getElementById(targetId);
                            if (target) target.value = data.path;
                            Toast.success(`Selected: ${data.path}`);
                        } else if (data.error) {
                            Toast.warning(data.error);
                        }
                    } catch (e) {
                        Toast.error('Failed to open path picker');
                    }

                    btn.disabled = false;
                    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Browse';
                };
            });

            // Toggle visibility of esde-media-dir based on strategy
            const strategySelect = document.getElementById('setting-media-storage-mode');
            const mediaDirContainer = document.getElementById('esde-media-dir-container');
            strategySelect.addEventListener('change', (e) => {
                if (e.target.value === 'standard') {
                    mediaDirContainer.style.display = 'block';
                    // Auto-suggest gamelist path if media path exists
                    const mediaDir = document.getElementById('setting-esde-media-dir')?.value;
                    const gamelistInput = document.getElementById('setting-esde-gamelists-dir');
                    if (mediaDir && gamelistInput && !gamelistInput.value) {
                        const suggested = mediaDir.replace('downloaded_media', 'gamelists');
                        gamelistInput.value = suggested;
                    }
                } else {
                    mediaDirContainer.style.display = 'none';
                }
            });

            const btnMigrate = document.getElementById('btn-migrate-media');
            if (btnMigrate) {
                btnMigrate.onclick = async () => {
                    Modal.confirm('Migrate Media Storage', 'This will physically move all downloaded media to match your currently selected storage strategy. This may take several minutes depending on library size.\n\nContinue?', async () => {
                        btnMigrate.disabled = true;
                        btnMigrate.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; display: inline-block;"></div> Migrating...';
                        try {
                            const res = await fetch('/api/migrate-media', { method: 'POST' });
                            const data = await res.json();
                            Toast.success(data.message);
                        } catch (e) {
                            Toast.error('Migration failed: ' + e.message);
                            btnMigrate.disabled = false;
                            btnMigrate.innerText = 'Migrate Existing Media';
                        }
                    });
                };
            }

            // Save button (explicit click handled by form onsubmit)
            // But we keep the id for styling/manual binding if needed.
        } catch (e) {
            document.getElementById('settings-form').innerHTML = `<span style="color: var(--accent-red);">Failed to load settings: ${e.message}</span>`;
        }
    },

    async saveSettings(showToast = true) {
        try {
            const getVal = (id) => document.getElementById(id)?.value || '';

            const body = {
                tables_dir: getVal('setting-tables-dir'),
                media_storage_mode: getVal('setting-media-storage-mode'),
                esde_media_dir: getVal('setting-esde-media-dir'),
                esde_gamelists_dir: getVal('setting-esde-gamelists-dir'),
                vpx_standalone_app_path: getVal('setting-vpx-app'),
                esde_app_path: getVal('setting-esde-app'),
                vpx_use_flavor: getVal('setting-vpx-flavor'),
                vpx_display_mode: getVal('setting-vpx-display-mode'),
                screenscraper_username: getVal('setting-ss-user'),
                screenscraper_password: getVal('setting-ss-pass'),
            };

            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (showToast) Toast.success('Settings saved');
            this.loadSystemStatus();
        } catch (e) {
            if (showToast) Toast.error('Failed to save: ' + e.message);
            throw e;
        }
    },

    async loadSystemStatus() {
        try {
            const res = await fetch('/api/system/status');
            const info = await res.json();

            document.getElementById('system-status-card').innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-xl);">
                    <div>
                        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-sm); font-size: 0.85rem;">Files on Disk</div>
                        <div style="display: grid; gap: var(--space-xs); font-size: 0.85rem; color: var(--text-tertiary);">
                            <div><span style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${info.counts.vpx_files}</span> VPX tables</div>
                            <div><span style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${info.counts.b2s_files}</span> Backglass files</div>
                            <div><span style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${info.counts.rom_files}</span> ROM files</div>
                            <div><span style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${info.counts.media_files}</span> Media files</div>
                            <div><span style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">${info.counts.db_tables}</span> in database</div>
                        </div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-sm); font-size: 0.85rem;">Storage</div>
                        <div style="display: grid; gap: var(--space-xs); font-size: 0.85rem; color: var(--text-tertiary);">
                            <div>Tables: <strong style="color: var(--text-primary);">${info.storage.tables_size_mb} MB</strong></div>
                            <div>Disk Total: <strong style="color: var(--text-primary);">${info.storage.disk_total_gb} GB</strong></div>
                            <div>Disk Free: <strong style="color: var(--text-primary);">${info.storage.disk_free_gb} GB</strong></div>
                        </div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-sm); font-size: 0.85rem;">Directories</div>
                        <div style="display: grid; gap: var(--space-xs); font-size: 0.85rem;">
                            <div class="dir-status ${info.directories.tables_dir.exists ? 'exists' : 'missing'}">
                                ${info.directories.tables_dir.exists ? '✓' : '✗'} Tables
                            </div>
                            <div class="dir-status ${info.directories.support_dir.exists ? 'exists' : 'missing'}">
                                ${info.directories.support_dir.exists ? '✓' : '✗'} Internal Data
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: var(--space-sm);">
                                Version: <strong style="color: var(--text-secondary);">${info.version || '2.0.0'}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            document.getElementById('system-status-card').innerHTML = `<span style="color: var(--accent-red);">Failed to load</span>`;
        }
    },

    bindEvents() {
        document.getElementById('btn-rescan').onclick = async () => {
            const btn = document.getElementById('btn-rescan');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div> Scanning...';

            try {
                Toast.info('Scanning tables directory...');
                const res = await fetch('/api/tables/scan', { method: 'POST' });
                const startData = await res.json();

                if (!startData.success) {
                    Toast.error(startData.message || 'Failed to start scan');
                    return;
                }

                // Poll for completion
                const pollStatus = async () => {
                    const statusRes = await fetch('/api/tables/scan/status');
                    const statusData = await statusRes.json();

                    if (statusData.status === 'completed' || statusData.status === 'idle') {
                        const scanned = statusData.total_items || statusData.scanned || 0;
                        const added = statusData.new_items || statusData.new || 0;
                        Toast.success(`Scan complete: ${scanned} tables found, ${added} new added`);
                        this.loadSystemStatus();
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    } else if (statusData.status === 'failed') {
                        Toast.error('Scan failed: ' + (statusData.message || 'Unknown error'));
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    } else {
                        // Still running, wait and poll again
                        setTimeout(pollStatus, 1000);
                    }
                };

                setTimeout(pollStatus, 1000);
            } catch (e) {
                Toast.error('Failed to initiate scan');
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        };

        document.getElementById('btn-sync-vps').onclick = async () => {
            const btn = document.getElementById('btn-sync-vps');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div> Syncing...';

            try {
                Toast.info('Syncing VPS database...');
                const res = await fetch('/api/vps/sync', { method: 'POST' });
                const startData = await res.json();

                if (!startData.success) {
                    Toast.error(startData.message || 'Failed to start sync');
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                    return;
                }

                // Poll for completion
                const pollStatus = async () => {
                    const statusRes = await fetch('/api/vps/sync/status');
                    const statusData = await statusRes.json();

                    if (statusData.status === 'completed' || statusData.status === 'idle') {
                        Toast.success(statusData.message || 'VPS Database sync complete');
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    } else if (statusData.status === 'failed') {
                        Toast.error('Sync failed: ' + (statusData.message || 'Unknown error'));
                        btn.disabled = false;
                        btn.innerHTML = originalHtml;
                    } else {
                        setTimeout(pollStatus, 1500);
                    }
                };

                setTimeout(pollStatus, 1500);
            } catch (e) {
                Toast.error('Failed to initiate VPS sync');
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        };

        document.getElementById('btn-check-updates').onclick = async () => {
            const btn = document.getElementById('btn-check-updates');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div> Checking...';

            try {
                const res = await fetch('/api/updates/check');
                const result = await res.json();

                if (result.update_available) {
                    Modal.confirm(
                        'Update Available',
                        `A new version (${result.latest_version}) is available. Would you like to open the release page?\n\n${result.body.substring(0, 200)}${result.body.length > 200 ? '...' : ''}`,
                        () => {
                            window.open(result.download_url, '_blank');
                        }
                    );
                } else if (result.error) {
                    Toast.error('Update check failed: ' + result.error);
                } else {
                    Toast.success('You are running the latest version (' + result.current_version + ')');
                }
            } catch (e) {
                Toast.error('Failed to check for updates');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        };
    },
};
