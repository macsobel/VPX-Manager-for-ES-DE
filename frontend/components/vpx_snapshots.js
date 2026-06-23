/* ═══════════════════════════════════════════════════════════
   VPX Application Snapshots Drawer Component
   ═══════════════════════════════════════════════════════════ */

const VpxSnapshotsDrawer = {
    state: {
        snapshots: [],
        isOpen: false
    },

    init() {
        // Create drawer elements if they don't exist
        if (!document.getElementById('vpx-snapshot-drawer')) {
            const drawer = document.createElement('div');
            drawer.id = 'vpx-snapshot-drawer';
            drawer.className = 'snapshot-drawer';
            document.body.appendChild(drawer);

            const overlay = document.createElement('div');
            overlay.id = 'vpx-drawer-overlay';
            overlay.className = 'drawer-overlay';
            document.body.appendChild(overlay);

            overlay.onclick = () => this.hide();
        }
    },

    async show() {
        this.init();
        this.state.isOpen = true;

        this.renderLoading();
        
        const drawer = document.getElementById('vpx-snapshot-drawer');
        const overlay = document.getElementById('vpx-drawer-overlay');
        drawer.classList.add('open');
        overlay.classList.add('open');

        await this.loadSnapshots();
        this.render();
        
        // Start polling in case a task is already running
        this.startPolling();
    },

    hide() {
        this.state.isOpen = false;
        if (this._polling) {
            clearInterval(this._polling);
            this._polling = null;
        }
        const drawer = document.getElementById('vpx-snapshot-drawer');
        const overlay = document.getElementById('vpx-drawer-overlay');
        if (drawer) drawer.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    },

    async loadSnapshots() {
        try {
            const res = await fetch('/api/vpx-snapshots');
            this.state.snapshots = await res.json();
        } catch (e) {
            console.error('Failed to load VPX snapshots:', e);
            Toast.error('Failed to load VPX backup history');
        }
    },

    renderLoading() {
        const drawer = document.getElementById('vpx-snapshot-drawer');
        drawer.innerHTML = `
            <div class="snapshot-drawer-header">
                <h3 class="card-title">VPX Application Backups</h3>
                <button class="btn-icon" id="close-vpx-snapshots">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="snapshot-drawer-body">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px;">
                    <div class="spinner" style="width: 32px; height: 32px;"></div>
                    <span style="color: var(--text-tertiary);">Loading backup history...</span>
                </div>
            </div>
        `;
        document.getElementById('close-vpx-snapshots').onclick = () => this.hide();
    },

    render() {
        const drawer = document.getElementById('vpx-snapshot-drawer');
        drawer.innerHTML = `
            <div class="snapshot-drawer-header">
                <div style="display: flex; flex-direction: column;">
                    <h3 class="card-title" style="margin-bottom: 2px;">VPX Application Backups</h3>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Backup Visual Pinball before installing a new version</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-sm" id="btn-create-vpx-snapshot">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        New Backup
                    </button>
                    <button class="btn-icon" id="close-vpx-snapshots">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="snapshot-drawer-body">
                <!-- Download Link Card -->
                <div style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: var(--radius-lg); padding: 1rem 1.25rem; margin-bottom: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <div>
                                <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">Download Latest VPX Build</div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary);">GitHub Actions — vpinball/vpinball</div>
                            </div>
                        </div>
                        <a href="https://github.com/vpinball/vpinball/actions/workflows/vpinball.yml" target="_blank" class="btn btn-secondary btn-sm" style="padding: 5px 12px; font-size: 0.78rem; display: flex; align-items: center; gap: 6px; text-decoration: none;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            Open
                        </a>
                    </div>
                </div>

                <!-- Progress Container will be prepended here -->
                ${this.state.snapshots.length === 0 ? `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50%; gap: 16px; text-align: center; opacity: 0.6;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No backups yet</div>
                            <div style="font-size: 0.85rem; color: var(--text-tertiary);">Create a backup before updating Visual Pinball.</div>
                        </div>
                    </div>
                ` : `
                    <div class="snapshot-timeline">
                        ${this.state.snapshots.map(s => {
                            const date = new Date(s.timestamp);
                            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                            
                            const hasApp = s.app_file_count > 0;
                            const hasSettings = s.settings_file_count > 0;

                            return `
                                <div class="snapshot-card" data-id="${s.id}">
                                    <div class="snapshot-card-time">${dateStr} @ ${timeStr}</div>
                                    <div class="snapshot-card-header">
                                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">
                                            ${s.label || 'Manual Backup'}
                                        </div>
                                        <div class="badge badge-neutral" style="font-size: 0.6rem; padding: 1px 5px; opacity: 0.8;">
                                            ${s.platform === 'Darwin' ? 'macOS' : 'Linux'}
                                        </div>
                                    </div>
                                    <div class="snapshot-card-files">
                                        ${hasApp ? '<span class="snapshot-file-badge" style="background: rgba(168, 85, 247, 0.12); color: var(--accent-purple); border-color: rgba(168, 85, 247, 0.2);">APP</span>' : ''}
                                        ${hasSettings ? '<span class="snapshot-file-badge" style="background: rgba(79, 140, 255, 0.12); color: var(--accent-blue); border-color: rgba(79, 140, 255, 0.2);">SETTINGS</span>' : ''}
                                        <span style="font-size: 0.7rem; color: var(--text-tertiary); margin-left: auto; align-self: center;">${(s.size / (1024 * 1024)).toFixed(1)} MB</span>
                                    </div>
                                    <div class="snapshot-card-actions">
                                        <button class="btn btn-icon btn-sm btn-delete-vpx-snapshot" data-id="${s.id}" title="Delete Backup" style="width: 28px; height: 28px;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                        <button class="btn btn-primary btn-sm btn-restore-vpx-snapshot" data-id="${s.id}" style="padding: 4px 12px; font-size: 0.8rem;">
                                            Restore
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
            <div class="snapshot-drawer-footer">
                <div style="font-size: 0.8rem; color: var(--text-tertiary);">
                    <strong>${this.state.snapshots.length}</strong> backup${this.state.snapshots.length !== 1 ? 's' : ''} stored
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('close-vpx-snapshots').onclick = () => this.hide();
        
        document.getElementById('btn-create-vpx-snapshot').onclick = () => {
            Modal.prompt('New VPX Backup', 'Enter a label for this backup:', 'Pre-Update Backup', async (label) => {
                try {
                    const res = await fetch('/api/vpx-snapshots', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ label: label || 'Manual Backup' })
                    });
                    const data = await res.json();
                    if (data.success) {
                        this._pendingPostBackup = true;
                        this.startPolling();
                    } else {
                        Toast.error(data.error || 'Failed to start backup');
                    }
                } catch (e) {
                    Toast.error('Error starting backup');
                }
            });
        };

        // Restore buttons
        document.querySelectorAll('.btn-restore-vpx-snapshot').forEach(btn => {
            btn.onclick = () => {
                const snapshotId = btn.dataset.id;
                
                if (btn.classList.contains('snapshot-confirm-btn')) {
                    this.performRestore(snapshotId);
                } else {
                    // Enter confirm state
                    btn.textContent = 'Confirm?';
                    btn.classList.add('snapshot-confirm-btn');
                    
                    // Reset after 3 seconds if not clicked
                    setTimeout(() => {
                        if (btn) {
                            btn.textContent = 'Restore';
                            btn.classList.remove('snapshot-confirm-btn');
                        }
                    }, 3000);
                }
            };
        });

        // Delete buttons
        document.querySelectorAll('.btn-delete-vpx-snapshot').forEach(btn => {
            btn.onclick = () => {
                const snapshotId = btn.dataset.id;
                Modal.confirm('Delete Backup', 'Are you sure you want to delete this VPX backup? This cannot be undone.', async () => {
                    try {
                        const res = await fetch(`/api/vpx-snapshots/${snapshotId}`, {
                            method: 'DELETE'
                        });
                        if (res.ok) {
                            Toast.success('Backup deleted');
                            await this.loadSnapshots();
                            this.render();
                        }
                    } catch (e) {
                        Toast.error('Failed to delete backup');
                    }
                });
            };
        });
    },

    async performRestore(snapshotId) {
        try {
            const res = await fetch(`/api/vpx-snapshots/${snapshotId}/restore`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                this.startPolling();
            } else {
                Toast.error(data.error || 'Restore failed');
            }
        } catch (e) {
            Toast.error('Restore error');
        }
    },

    showPostBackupDialog() {
        Modal.choice(
            'Backup Complete',
            'Your VPX application and settings have been backed up successfully.<br><br>Would you like to delete the existing Visual Pinball application and settings files to prepare for a fresh install?',
            [
                {
                    label: 'Keep Files',
                    class: 'btn-secondary',
                    onClick: () => {
                        // Do nothing, just close
                    }
                },
                {
                    label: 'Delete & Prepare for Fresh Install',
                    class: 'btn-danger',
                    onClick: async () => {
                        try {
                            const res = await fetch('/api/vpx-snapshots/delete-originals', {
                                method: 'POST'
                            });
                            const data = await res.json();
                            if (data.success) {
                                Toast.success('VPX application and settings deleted. Ready for fresh install.');
                            } else {
                                Toast.error(data.error || 'Failed to delete files');
                            }
                        } catch (e) {
                            Toast.error('Failed to delete files: ' + e.message);
                        }
                    }
                }
            ]
        );
    },

    renderProgress(status) {
        const drawer = document.getElementById('vpx-snapshot-drawer');
        const body = drawer.querySelector('.snapshot-drawer-body');
        if (!body) return;

        let progressContainer = document.getElementById('vpx-snapshot-progress-container');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'vpx-snapshot-progress-container';
            progressContainer.style.padding = '1.25rem';
            progressContainer.style.background = 'rgba(79, 140, 255, 0.08)';
            progressContainer.style.borderBottom = '1px solid rgba(79, 140, 255, 0.2)';
            progressContainer.style.marginBottom = '1rem';
            // Insert after the download link card
            const downloadCard = body.querySelector('div[style*="rgba(59, 130, 246"]');
            if (downloadCard && downloadCard.nextSibling) {
                body.insertBefore(progressContainer, downloadCard.nextSibling);
            } else {
                body.prepend(progressContainer);
            }
        }

        const percent = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
        
        progressContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="spinner-sm"></div>
                    <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${status.message || 'Processing...'}</span>
                </div>
                <span style="font-size: 0.85rem; color: var(--accent-blue); font-weight: 700;">${percent}%</span>
            </div>
            <div style="width: 100%; background: rgba(0,0,0,0.3); height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative;">
                    <div class="progress-shimmer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
                </div>
            </div>
        `;
    },

    startPolling() {
        if (this._polling) clearInterval(this._polling);
        this._polling = setInterval(async () => {
            try {
                const res = await fetch('/api/vpx-snapshots/status');
                const status = await res.json();
                
                if (status.status === 'running') {
                    this.renderProgress(status);
                } else if (status.status === 'completed') {
                    clearInterval(this._polling);
                    this._polling = null;
                    const progressContainer = document.getElementById('vpx-snapshot-progress-container');
                    if (progressContainer) progressContainer.remove();
                    
                    Toast.success(status.message || 'Operation complete');
                    
                    // Refresh snapshots list
                    await this.loadSnapshots();
                    this.render();

                    // Show post-backup dialog if this was a create operation
                    if (this._pendingPostBackup) {
                        this._pendingPostBackup = false;
                        this.showPostBackupDialog();
                    }
                } else if (status.status === 'failed') {
                    clearInterval(this._polling);
                    this._polling = null;
                    this._pendingPostBackup = false;
                    const progressContainer = document.getElementById('vpx-snapshot-progress-container');
                    if (progressContainer) progressContainer.remove();
                    Toast.error(status.error || 'Operation failed');
                }
            } catch (e) {
                console.error('VPX snapshot polling error:', e);
            }
        }, 1000);
    }
};
