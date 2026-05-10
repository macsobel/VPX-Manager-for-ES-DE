/* ═══════════════════════════════════════════════════════════
   Snapshots Drawer Component
   ═══════════════════════════════════════════════════════════ */

const SnapshotsDrawer = {
    state: {
        tableId: null,
        tableName: '',
        snapshots: [],
        isOpen: false
    },

    init() {
        // Create drawer elements if they don't exist
        if (!document.getElementById('snapshot-drawer')) {
            const drawer = document.createElement('div');
            drawer.id = 'snapshot-drawer';
            drawer.className = 'snapshot-drawer';
            document.body.appendChild(drawer);

            const overlay = document.createElement('div');
            overlay.id = 'drawer-overlay';
            overlay.className = 'drawer-overlay';
            document.body.appendChild(overlay);

            overlay.onclick = () => this.hide();
        }
    },

    async show(tableId, tableName) {
        this.init();
        this.state.tableId = tableId;
        this.state.tableName = tableName;
        this.state.isOpen = true;

        this.renderLoading();
        
        const drawer = document.getElementById('snapshot-drawer');
        const overlay = document.getElementById('drawer-overlay');
        drawer.classList.add('open');
        overlay.classList.add('open');

        await this.loadSnapshots();
        this.render();
    },

    hide() {
        this.state.isOpen = false;
        document.getElementById('snapshot-drawer').classList.remove('open');
        document.getElementById('drawer-overlay').classList.remove('open');
    },

    async loadSnapshots() {
        try {
            const res = await fetch(`/api/tables/${this.state.tableId}/snapshots`);
            this.state.snapshots = await res.json();
        } catch (e) {
            console.error('Failed to load snapshots:', e);
            Toast.error('Failed to load snapshot history');
        }
    },

    renderLoading() {
        const drawer = document.getElementById('snapshot-drawer');
        drawer.innerHTML = `
            <div class="snapshot-drawer-header">
                <h3 class="card-title">Snapshots: ${this.state.tableName}</h3>
                <button class="btn-icon" id="close-snapshots">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="snapshot-drawer-body">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px;">
                    <div class="spinner" style="width: 32px; height: 32px;"></div>
                    <span style="color: var(--text-tertiary);">Loading history...</span>
                </div>
            </div>
        `;
        document.getElementById('close-snapshots').onclick = () => this.hide();
    },

    render() {
        const drawer = document.getElementById('snapshot-drawer');
        drawer.innerHTML = `
            <div class="snapshot-drawer-header">
                <div style="display: flex; flex-direction: column;">
                    <h3 class="card-title" style="margin-bottom: 2px;">Snapshots: ${this.state.tableName}</h3>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Table ID: ${this.state.tableId}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-sm" id="btn-create-snapshot">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        New Snapshot
                    </button>
                    <button class="btn-icon" id="close-snapshots">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
            <div class="snapshot-drawer-body">
                ${this.state.snapshots.length === 0 ? `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; gap: 16px; text-align: center; opacity: 0.6;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No snapshots yet</div>
                            <div style="font-size: 0.85rem; color: var(--text-tertiary);">Create a snapshot before making changes to your table.</div>
                        </div>
                    </div>
                ` : `
                    <div class="snapshot-timeline">
                        ${this.state.snapshots.map(s => {
                            const date = new Date(s.timestamp);
                            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                            
                            const isAuto = s.label.includes('Auto');
                            const hasVpx = s.files.some(f => f.endsWith('.vpx'));
                            const hasVbs = s.files.some(f => f.endsWith('.vbs'));
                            const hasPup = s.files.some(f => f.includes('pupvideos'));

                            return `
                                <div class="snapshot-card ${isAuto ? 'auto-backup' : ''}" data-id="${s.id}">
                                    <div class="snapshot-card-time">${dateStr} @ ${timeStr}</div>
                                    <div class="snapshot-card-header">
                                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">
                                            ${s.label === 'Manual Snapshot' ? 'Manual Backup' : s.label}
                                        </div>
                                        <div class="badge ${isAuto ? 'badge-info' : 'badge-neutral'}" style="font-size: 0.6rem; padding: 1px 5px; opacity: 0.8;">
                                            ${isAuto ? 'AUTO' : 'MANUAL'}
                                        </div>
                                    </div>
                                    <div class="snapshot-card-files">
                                        ${hasVpx ? '<span class="snapshot-file-badge vpx">VPX</span>' : ''}
                                        ${hasVbs ? '<span class="snapshot-file-badge vbs">VBS</span>' : ''}
                                        ${hasPup ? '<span class="snapshot-file-badge pup">PUP</span>' : ''}
                                        <span style="font-size: 0.7rem; color: var(--text-tertiary); margin-left: auto; align-self: center;">${(s.size / (1024 * 1024)).toFixed(1)} MB</span>
                                    </div>
                                    <div class="snapshot-card-actions">
                                        <button class="btn btn-icon btn-sm btn-delete-snapshot" data-id="${s.id}" title="Delete Snapshot" style="width: 28px; height: 28px;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                        <button class="btn btn-primary btn-sm btn-restore-snapshot" data-id="${s.id}" style="padding: 4px 12px; font-size: 0.8rem;">
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
                    <strong>${this.state.snapshots.length}</strong> snapshots stored
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Auto-backup</span>
                    <label class="switch-sm">
                        <input type="checkbox" id="toggle-auto-snapshot" checked disabled title="Coming soon">
                        <span class="slider-sm round"></span>
                    </label>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('close-snapshots').onclick = () => this.hide();
        
        document.getElementById('btn-create-snapshot').onclick = () => {
            Modal.prompt('New Snapshot', 'Enter a label for this snapshot:', 'Manual Backup', async (label) => {
                Toast.info('Creating snapshot...');
                try {
                    const res = await fetch(`/api/tables/${this.state.tableId}/snapshots`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ label: label || 'Manual Snapshot' })
                    });
                    const data = await res.json();
                    if (data.success) {
                        Toast.success('Snapshot created');
                        await this.loadSnapshots();
                        this.render();
                    } else {
                        Toast.error(data.error || 'Failed to create snapshot');
                    }
                } catch (e) {
                    Toast.error('Error creating snapshot');
                }
            });
        };

        // Restore buttons
        document.querySelectorAll('.btn-restore-snapshot').forEach(btn => {
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
        document.querySelectorAll('.btn-delete-snapshot').forEach(btn => {
            btn.onclick = () => {
                const snapshotId = btn.dataset.id;
                Modal.confirm('Delete Snapshot', 'Are you sure you want to delete this snapshot? This cannot be undone.', async () => {
                    try {
                        const res = await fetch(`/api/tables/${this.state.tableId}/snapshots/${snapshotId}`, {
                            method: 'DELETE'
                        });
                        if (res.ok) {
                            Toast.success('Snapshot deleted');
                            await this.loadSnapshots();
                            this.render();
                        }
                    } catch (e) {
                        Toast.error('Failed to delete snapshot');
                    }
                });
            };
        });
    },

    async performRestore(snapshotId) {
        Toast.info('Restoring files...');
        try {
            const res = await fetch(`/api/tables/${this.state.tableId}/snapshots/${snapshotId}/restore`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                Toast.success('Restored successfully!');
                this.hide();
                // Refresh table list if possible
                if (typeof TablesPage !== 'undefined' && TablesPage.loadTables) {
                    TablesPage.loadTables();
                }
            } else {
                Toast.error(data.error || 'Restore failed');
            }
        } catch (e) {
            Toast.error('Restore error');
        }
    }
};
