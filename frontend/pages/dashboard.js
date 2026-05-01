/* ═══════════════════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════════════════ */

const DashboardPage = {
    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <p class="page-subtitle">Overview of your Visual Pinball library</p>
            </div>
            <div class="stats-grid" id="stats-grid">
                <div class="stat-card blue loading-skeleton" style="height: 130px;"></div>
                <div class="stat-card purple loading-skeleton" style="height: 130px;"></div>
                <div class="stat-card amber loading-skeleton" style="height: 130px;"></div>
            </div>
            <div class="toolbar">
                <h2 style="font-size: 1.15rem; font-weight: 700;">Quick Actions</h2>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-md);">
                <button class="card" id="btn-quick-scan" style="cursor: pointer; text-align: left; border: none; font-family: var(--font-family);">
                    <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-sm);">
                        <div class="stat-icon blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary);">Scan Tables</span>
                    </div>
                    <p style="font-size: 0.82rem; color: var(--text-tertiary);">Scan your tables directory for new and updated .vpx files</p>
                    <div id="scan-progress-container" style="display: none; margin-top: 1rem; background: rgba(79, 140, 255, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(79, 140, 255, 0.2);"></div>
                </button>
                <button class="card" id="btn-quick-vps" style="cursor: pointer; text-align: left; border: none; font-family: var(--font-family);">
                    <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-sm);">
                        <div class="stat-icon purple">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary);">Update Databases</span>
                    </div>
                    <p style="font-size: 0.82rem; color: var(--text-tertiary);">Download the latest Visual Pinball Spreadsheet and VBS Standalone Scripts databases</p>
                    <div id="vps-progress-container" style="display: none; margin-top: 1rem; background: rgba(147, 51, 234, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(147, 51, 234, 0.2);"></div>
                </button>
                <button class="card" id="btn-quick-upload" style="cursor: pointer; text-align: left; border: none; font-family: var(--font-family);">
                    <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-sm);">
                        <div class="stat-icon emerald">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <span style="font-weight: 700; color: var(--text-primary);">Add New Table</span>
                    </div>
                    <p style="font-size: 0.82rem; color: var(--text-tertiary);">Drop .vpx, .directb2s, and ROM .zip files for easy guided installation</p>
                </button>
            </div>
            <div class="card" style="margin-top: var(--space-xl);" id="system-info-card">
                <div class="card-header">
                    <span class="card-title">System Information</span>
                </div>
                <div id="system-info" style="color: var(--text-tertiary); font-size: 0.85rem;">
                    <div class="spinner"></div> Loading...
                </div>
            </div>
        `;

        this.loadStats();
        this.loadSystemInfo();
        this.bindActions();

        // Proactive check: if tasks are already running, start polling
        this.checkActiveTasks();
    },

    async checkActiveTasks() {
        try {
            // Check scanner
            const scanRes = await fetch('/api/tables/scan/status');
            const scanStatus = await scanRes.json();
            if (scanStatus.status === 'running' || scanStatus.status === 'completed') {
                this.pollTaskStatus('scanner', 'scan-progress-container');
            }

            // Check VPS sync
            const vpsRes = await fetch('/api/vps/sync/status');
            const vpsStatus = await vpsRes.json();
            if (vpsStatus.status === 'running' || vpsStatus.status === 'completed') {
                this.pollTaskStatus('vps_sync', 'vps-progress-container');
            }
        } catch (e) {
            console.warn('Failed to check active tasks on load', e);
        }
    },

    async loadStats() {
        try {
            const res = await fetch('/api/tables/stats');
            const stats = await res.json();

            const percentMatched = stats.total_tables > 0 ? Math.round((stats.vps_matched / stats.total_tables) * 100) : 0;
            const percentMedia = stats.total_tables > 0 ? Math.round(((stats.total_tables - stats.missing_media) / stats.total_tables) * 100) : 0;

            document.getElementById('stats-grid').innerHTML = `
                <div class="stat-card blue" onclick="window.location.hash = 'tables/list'" style="cursor: pointer;">
                    <div class="stat-icon blue">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    </div>
                    <div class="stat-value">${stats.total_tables}</div>
                    <div class="stat-label">Visual Pinball Tables</div>
                </div>
                <div class="stat-card purple" onclick="window.location.hash = 'tables/list'" style="cursor: pointer;">
                    <div class="stat-icon purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    </div>
                    <div class="stat-value">${percentMatched}%</div>
                    <div class="stat-label">Percent Matched with VPS</div>
                </div>
                <div class="stat-card amber" onclick="window.location.hash = 'tables/media'" style="cursor: pointer;">
                    <div class="stat-icon red">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    </div>
                    <div class="stat-value">${percentMedia}%</div>
                    <div class="stat-label">Media Files Downloaded</div>
                </div>
            `;
        } catch (e) {
            document.getElementById('stats-grid').innerHTML = `
                <div class="stat-card blue">
                    <div class="stat-value">—</div>
                    <div class="stat-label">Scan tables to populate</div>
                </div>
            `;
        }
    },

    async loadSystemInfo() {
        try {
            const [sysRes, updateRes] = await Promise.all([
                fetch('/api/system/status'),
                fetch('/api/tables/update-count')
            ]);
            const info = await sysRes.json();
            const updateData = await updateRes.json();
            const updatesCount = updateData.updates_available || 0;

            const fmtSize = (mb) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;

            const updatesHtml = updatesCount > 0
                ? `<a href="#tables" style="color: var(--accent-amber); font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    ${updatesCount} table update${updatesCount === 1 ? '' : 's'} available
                   </a>`
                : `<div style="color: var(--accent-emerald); display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    All tables up to date
                   </div>`;

            const softwareCheck = (sw) => {
                const icon = sw.exists
                    ? `<span style="color: var(--accent-emerald);">✓</span>`
                    : `<span style="color: var(--accent-red);">✗</span>`;
                const pathHint = !sw.exists
                    ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; word-break: break-all;">${sw.path}</div>`
                    : '';
                return `<div>${icon} ${sw.label}${pathHint}</div>`;
            };

            document.getElementById('system-info').innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-lg);">
                    <div>
                        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-sm);">Storage</div>
                        <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; font-size: 0.9rem;">
                            <span style="color: var(--text-tertiary);">Tables:</span>
                            <span style="color: var(--text-secondary); font-weight: 500;">${fmtSize(info.storage.tables_size_mb)}</span>
                            <span style="color: var(--text-tertiary);">Media:</span>
                            <span style="color: var(--text-secondary); font-weight: 500;">${fmtSize(info.storage.media_size_mb)}</span>
                            <span style="color: var(--text-tertiary);">Disk Free:</span>
                            <span style="color: var(--text-secondary); font-weight: 500;">${info.storage.disk_free_gb} GB</span>
                        </div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-sm);">Updates</div>
                        <div style="font-size: 0.9rem;">${updatesHtml}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-sm);">Software</div>
                        <div style="font-size: 0.9rem; display: grid; gap: 8px;">
                            ${softwareCheck(info.software.vpx)}
                            ${softwareCheck(info.software.esde)}
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            document.getElementById('system-info').innerHTML = `<span style="color: var(--accent-red);">Could not load system info</span>`;
            console.error('Dashboard load error:', e);
        }
    },

    bindActions() {
        document.getElementById('btn-quick-scan').onclick = async () => {
            const btn = document.getElementById('btn-quick-scan');
            btn.disabled = true;
            Toast.info('Scan started in background...');
            try {
                await fetch('/api/tables/scan', { method: 'POST' });
                DashboardPage.pollTaskStatus('scanner', 'scan-progress-container');
            } catch (e) {
                Toast.error('Scan failed: ' + e.message);
                btn.disabled = false;
            }
        };

        document.getElementById('btn-quick-vps').onclick = async () => {
            const btn = document.getElementById('btn-quick-vps');
            btn.disabled = true;
            Toast.info('Database sync started...');
            try {
                await fetch('/api/vps/sync', { method: 'POST' });
                DashboardPage.pollTaskStatus('vps_sync', 'vps-progress-container');
            } catch (e) {
                Toast.error('Database update failed: ' + e.message);
                btn.disabled = false;
            }
        };

        document.getElementById('btn-quick-upload').onclick = () => {
            window.location.hash = 'upload';
        };
    },

    pollTaskStatus(taskId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this._intervals) this._intervals = {};
        if (this._intervals[taskId]) clearInterval(this._intervals[taskId]);

        const poll = async () => {
            try {
                const endpoint = taskId === 'scanner' ? '/api/tables/scan/status' : '/api/vps/sync/status';
                const res = await fetch(endpoint);
                const status = await res.json();

                if (status.status === 'running') {
                    container.style.display = 'block';
                    const percent = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
                    container.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="spinner" style="width: 12px; height: 12px;"></div>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${status.message || (taskId === 'scanner' ? 'Scanning tables...' : 'Updating databases...')}</span>
                            </div>
                            <span style="color: var(--text-tertiary); font-size: 0.8rem; font-weight: 500;">${status.current} / ${status.total}</span>
                        </div>
                        <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: 6px; overflow: hidden; height: 8px; border: 1px solid rgba(255, 255, 255, 0.05);">
                            <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, ${taskId === 'scanner' ? 'var(--accent-blue)' : 'var(--accent-purple)'}, ${taskId === 'scanner' ? '#60a5fa' : '#a78bfa'}); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                            <span>${percent}%</span>
                        </div>
                    `;
                } else if (status.status === 'completed') {
                    if (this._intervals[taskId]) {
                        clearInterval(this._intervals[taskId]);
                        this._intervals[taskId] = null;
                    }
                    container.style.display = 'block';
                    container.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--accent-emerald); font-size: 0.9rem; font-weight: 500;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                            ${status.message || 'Complete'}
                        </div>
                    `;
                    setTimeout(() => {
                        container.style.display = 'none';
                        container.innerHTML = '';
                    }, 5000);

                    // Re-enable buttons and reload stats
                    const btnScan = document.getElementById('btn-quick-scan');
                    const btnVps = document.getElementById('btn-quick-vps');
                    if (btnScan) btnScan.disabled = false;
                    if (btnVps) btnVps.disabled = false;
                    this.loadStats();
                    this.loadSystemInfo();
                } else {
                    // Idle or failed - stop polling
                    if (this._intervals[taskId]) {
                        clearInterval(this._intervals[taskId]);
                        this._intervals[taskId] = null;
                    }
                    const btnScan = document.getElementById('btn-quick-scan');
                    const btnVps = document.getElementById('btn-quick-vps');
                    if (btnScan) btnScan.disabled = false;
                    if (btnVps) btnVps.disabled = false;
                    if (container && status.status !== 'failed') container.style.display = 'none';
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        };

        // Run immediately then every second
        poll();
        this._intervals[taskId] = setInterval(poll, 1000);
    },

    unmount() {
        if (this._intervals) {
            Object.values(this._intervals).forEach(i => { if (i) clearInterval(i); });
            this._intervals = {};
        }
    }
};
