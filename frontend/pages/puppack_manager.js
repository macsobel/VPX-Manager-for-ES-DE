const PAD_PREFIX = { Backglass: 'bgpad', DMD: 'svpad' };
const PUP_SCREEN_NAMES = {
    "0": "Topper",
    "1": "DMD",
    "2": "Backglass",
    "3": "Playfield",
    "4": "Music",
    "5": "FullDMD",
    "6": "Select",
    "7": "Audio",
    "8": "Callouts",
    "9": "GameInfo",
    "10": "GameHelp",
    "14": "Overlay",
    "15": "Game"
};

const ROLE_TO_PUP_ID = {
    "Topper": 0,
    "DMD": 1,
    "Backglass": 2,
    "Playfield": 3,
    "FullDMD": 5,
    "Music": 4,
    "Select": 6,
    "Audio": 7,
    "Callouts": 8,
    "GameInfo": 9,
    "GameHelp": 10,
    "Overlay": 14,
    "Game": 15
};

const PupPackManagerPage = {
    state: {
        tables: [],
        selectedTable: null,
    },

    async render(tableId = null) {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 class="page-title">PUP Pack Manager</h1>
                    <p class="page-subtitle">Configure screen layouts and options for installed PUP Packs</p>
                </div>
            </div>

            <div class="adaptive-split-layout" id="puppack-workspace">
                <!-- Left Sidebar: Table List -->
                <div class="adaptive-sidebar">
                    <div style="padding: 1.25rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
                        <div class="search-wrapper">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="puppack-search" class="search-input" placeholder="Search tables..." oninput="PupPackManagerPage.renderTableList()">
                        </div>
                    </div>
                    <div id="puppack-table-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                        <div class="empty-state" style="padding: 2rem;">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
 
                <!-- Right Panel: Editor / Controls -->
                <div class="adaptive-content" id="puppack-main-panel">
                    <div id="puppack-detail-empty" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-secondary); color: var(--text-muted); padding: 2rem; text-align: center;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: var(--text-primary);">Select a Table</h3>
                        <p style="color: var(--text-secondary); max-width: 300px; margin: 0 auto; font-size: 0.9rem;">Choose a table from the list to view and apply PUP Pack screen configurations.</p>
                    </div>
                </div>
            </div>
        `;

        await this.loadTables(tableId);
    },

    async loadTables(selectId = null) {
        try {
            const [pupRes, settingsRes, displaysRes] = await Promise.all([
                fetch('/api/puppacks'),
                fetch('/api/settings'),
                fetch('/api/displays')
            ]);
            const data = await pupRes.json();
            const settings = await settingsRes.json();
            const displays = await displaysRes.json();

            this.state.tables = data.tables;
            this.state.master_orientation = settings.master_orientation || '';
            this.state.displayAssignments = settings.displays || [];
            this.state.globalDisplays = displays.displays || [];
            this.renderTableList();

            if (selectId) {
                const table = this.state.tables.find(t => t.id === parseInt(selectId));
                if (table) {
                    await this.selectTable(table.id);
                }
            }
        } catch (e) {
            console.error('Failed to load PUP Pack tables:', e);
            document.getElementById('puppack-table-list').innerHTML = `
                <div class="empty-state">
                    <p style="color: var(--danger);">Failed to load tables.</p>
                </div>
            `;
        }
    },

    // Redundant filterTables removed in favor of renderTableList()

    renderTableList() {
        const list = document.getElementById('puppack-table-list');
        const search = (document.getElementById('puppack-search')?.value || '').toLowerCase();
        const filtered = this.state.tables.filter(t => 
            (t.name || '').toLowerCase().includes(search) || 
            (t.filename || '').toLowerCase().includes(search)
        );

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 3rem 1rem;">
                    <p>No PUP Packs detected.</p>
                    <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.5rem;">Upload a .zip PUP Pack to a table to see it here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(t => {
            const isSelected = this.state.selectedTable && this.state.selectedTable.id === t.id;
            return `
                <div class="vbs-list-item ${isSelected ? 'active' : ''}" data-id="${t.id}" data-name="${this.escHtml(t.name || t.filename)}" onclick="PupPackManagerPage.selectTable(${t.id})">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div class="vbs-item-title" style="font-weight: 600; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                            ${this.escHtml(t.name || t.filename)}
                        </div>
                        <div class="status-badge" style="opacity: ${isSelected ? '1' : '0.4'};">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); font-family: monospace; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${this.escHtml(t.filename)}
                    </div>
                </div>
            `;
        }).join('');
    },

    async selectTable(id) {
        document.getElementById('puppack-workspace')?.classList.add('content-active');
        document.querySelectorAll('.vbs-list-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.vbs-list-item[data-id="${id}"]`);
        if (activeItem) activeItem.classList.add('active');

        this.state.selectedTable = this.state.tables.find(t => t.id === id);

        const panel = document.getElementById('puppack-main-panel');
        panel.innerHTML = `
            <div style="padding: 2rem; display: flex; align-items: center; justify-content: center; height: 100%;">
                <div class="spinner"></div>
            </div>
        `;

        try {
            const [optRes, vbsRes, screensRes] = await Promise.all([
                fetch(`/api/puppacks/${id}/options`),
                fetch(`/api/puppacks/${id}/vbs-status`),
                fetch(`/api/puppacks/${id}/screens`)
            ]);

            const data = await optRes.json();
            const vbsData = vbsRes.ok ? await vbsRes.json() : null;
            const screensData = screensRes.ok ? await screensRes.json() : { screens: [] };

            this.state.vbsStatus = vbsData;
            this.state.pupScreens = screensData.screens; // full list from screens.pup

            this.renderOptions(data.options, data.pup_dir, screensData.screens);
        } catch (e) {
            console.error('Failed to load PUP Pack options:', e);
            panel.innerHTML = `
                <div class="empty-state">
                    <p style="color: var(--danger);">Failed to load configuration options.</p>
                </div>
            `;
        }
    },

    renderOptions(options, pupDir, screens = []) {
        const panel = document.getElementById('puppack-main-panel');
        const t = this.state.selectedTable;

        let screensHtml = '';
        if (screens && screens.length > 0) {
            screensHtml = `
                <div style="background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color); margin-bottom: 2rem;">
                    <h3 style="margin: 0 0 1rem 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); display: flex; align-items: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        PUP Pack Configuration (screens.pup)
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${screens.map(s => {
                            const isActive = s.active && s.active !== '0' && s.active.toLowerCase() !== 'off';
                            
                            // Determine effective screen ID (CustomPos overrides ScreenNum)
                            let effScreenNum = s.screen_num;
                            if (s.custom_pos && s.custom_pos.includes(',')) {
                                const parts = s.custom_pos.split(',');
                                if (parts.length >= 1 && !isNaN(parseInt(parts[0]))) {
                                    effScreenNum = parts[0].trim();
                                }
                            }
                            
                            const effScreenName = PUP_SCREEN_NAMES[effScreenNum] || `Screen ${effScreenNum}`;
                            const physIdx = this.getPhysicalIndexFromPupId(effScreenNum);
                            
                            // Find the physical monitor to see its cabinet role
                            const monitor = this.state.globalDisplays.find(d => parseInt(d.index) === physIdx);
                            const cabRole = monitor ? monitor.role : null;
                            
                            let screenLabel = '';
                            if (physIdx !== null) {
                                if (cabRole && cabRole !== effScreenName) {
                                    // It's a cross-mapping (e.g. FullDMD on a DMD-labeled monitor)
                                    screenLabel = `${effScreenName} → Monitor ${physIdx} (${cabRole})`;
                                } else {
                                    screenLabel = `${effScreenName} (Monitor ${physIdx})`;
                                }
                            } else {
                                screenLabel = `${effScreenName} — No Monitor Assigned`;
                            }
                            
                            return `
                                <div class="pup-element-row">
                                    <div class="pup-element-info">
                                        <label class="switch" style="margin: 0; flex-shrink: 0;">
                                            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="PupPackManagerPage.toggleScreen(${s.id}, this.checked)">
                                            <span class="slider round"></span>
                                        </label>
                                        <div style="min-width: 0; flex: 1;">
                                            <div class="pup-element-labels">
                                                <span class="badge" style="background: var(--accent-blue-subtle); color: var(--accent-blue); font-weight: 700; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; white-space: nowrap;">${this.escHtml(s.description || 'Unnamed')}</span>
                                                <span style="font-weight: 600; font-size: 0.9rem; color: ${physIdx !== null ? 'var(--text-primary)' : 'var(--accent-red)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                    ${this.escHtml(physIdx !== null ? screenLabel : `${effScreenName} (Unassigned / No Monitor)`)}
                                                </span>
                                            </div>
                                            ${(s.playlist || s.playfile) ? `
                                                <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                    ${s.playlist ? `Playlist: <span style="color: var(--text-secondary);">${this.escHtml(s.playlist)}</span>` : ''}
                                                    ${s.playlist && s.playfile ? ' &bull; ' : ''}
                                                    ${s.playfile ? `File: <span style="color: var(--text-secondary);">${this.escHtml(s.playfile)}</span>` : ''}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                                        <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.75rem;" onclick="PupPackManagerPage.openLayoutModal(${s.id})">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            Edit Screens
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        let optionsHtml = '';
        if (!options || options.length === 0) {
            optionsHtml = `
                <div class="empty-state" style="margin: 2rem;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>No automatic setup scripts (.bat files) found.</p>
                    <p style="font-size: 0.8rem; color: var(--text-tertiary); max-width: 300px; margin: 1rem auto 0 auto;">This PUP Pack may not require configuration, or it requires manual setup by editing screens.pup.</p>
                </div>
            `;
        } else {
            optionsHtml = `
                <div class="pup-options-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;">
                    ${options.map(opt => {
                        // Clean up the name
                        let cleanName = opt.name
                            .replace(/Option\s*\d+\s*[-_]\s*/gi, '')
                            .replace(/OPTION\s*\d+_/gi, '')
                            .replace(/_/g, ' ')
                            .trim();
                        
                        return `
                            <div class="card layout-card" style="margin: 0; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); transition: all var(--transition-fast);">
                                <div class="card-body" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; height: 100%;">
                                    <div>
                                        <h4 style="margin: 0 0 0.25rem 0; color: var(--text-primary); font-size: 1rem;">${this.escHtml(cleanName)}</h4>
                                        <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-tertiary);">${this.escHtml(opt.file)}</div>
                                    </div>
                                    <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center;" onclick="PupPackManagerPage.applyOption('${opt.file}')">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        Apply this Layout
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        let headerControls = '';
        if (this.state.vbsStatus && this.state.vbsStatus.has_puppack_setting) {
            const isEnabled = this.state.vbsStatus.puppack_enabled;
            headerControls += `
                <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--bg-secondary); padding: 0.5rem 1rem; border-radius: var(--radius-full); border: 1px solid var(--border-color); flex-shrink: 0;">
                    <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; white-space: nowrap;">Enable in VBS</span>
                    <label class="switch" style="margin: 0; flex-shrink: 0;">
                        <input type="checkbox" id="puppack-vbs-toggle" ${isEnabled ? 'checked' : ''} onchange="PupPackManagerPage.toggleVbs(this.checked)">
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
        }


        panel.innerHTML = `
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="mobile-back-btn" onclick="PupPackManagerPage.closeDetail()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">${this.escHtml(t.name || t.filename)}</h2>
                        <div style="color: var(--text-secondary); font-size: 0.85rem; font-family: monospace;">pupvideos/${this.escHtml(pupDir)}/</div>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                    ${headerControls}
                </div>
            </div>

            <div style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                ${screensHtml}
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-primary);">Layout Options</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5;">Choose a screen layout below. Applying a layout will automatically copy the appropriate templates and scale the coordinates based on your Cabinet Display Profile settings.</p>
                </div>
                ${optionsHtml}
            </div>
        `;
    },

    async applyOption(filename) {
        if (!this.state.selectedTable) return;

        try {
            const res = await fetch(`/api/puppacks/${this.state.selectedTable.id}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            if (res.ok) {
                Toast.success(`Successfully applied configuration: ${filename}`);
                
                // Automatically enable in VBS if setting exists and is currently disabled
                if (this.state.vbsStatus && this.state.vbsStatus.has_puppack_setting && !this.state.vbsStatus.puppack_enabled) {
                    await this.toggleVbs(true);
                }

                // Refresh to show updated screen layout
                this.selectTable(this.state.selectedTable.id);
            } else {
                const data = await res.json();
                Toast.error(data.detail || `Failed to apply ${filename}`);
            }
        } catch (e) {
            console.error('Apply error:', e);
            Toast.error('An error occurred while applying the configuration.');
        }
    },

    closeDetail() {
        document.getElementById('puppack-workspace')?.classList.remove('content-active');
    },

    escHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

window.PupPackManagerPage = PupPackManagerPage;

// Inject the slide-in detail panel (matches NVRAM Manager pattern)
PupPackManagerPage.injectPanel = function() {
    if (document.getElementById('puppack-layout-panel')) return;
    const panelHtml = `
    <div class="detail-panel" id="puppack-layout-panel">
        <div class="detail-panel-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 32px; height: 32px; background: rgba(79, 140, 255, 0.12); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-blue);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <h3 class="card-title" style="margin: 0; font-size: 1.1rem;">Screen Layout</h3>
            </div>
            <button class="btn-icon" onclick="PupPackManagerPage.closeLayoutPanel()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="detail-panel-body" id="puppack-layout-body" style="padding: var(--space-lg); overflow-y: auto; flex: 1;"></div>
        <div class="detail-panel-footer" style="padding: 1rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button class="btn btn-secondary" onclick="PupPackManagerPage.closeLayoutPanel()">Cancel</button>
            <button class="btn btn-primary" onclick="PupPackManagerPage.saveLayout()">Save Configuration</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', panelHtml);
};

PupPackManagerPage.toggleVbs = async function(enable) {
    const table = this.state.selectedTable;
    if (!table) return;

    try {
        const res = await fetch(`/api/puppacks/${table.id}/toggle-vbs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable })
        });

        if (res.ok) {
            const data = await res.json();
            Toast.success(`PuP Pack ${data.puppack_enabled ? 'enabled' : 'disabled'} in VBS file.`);
            this.state.vbsStatus.puppack_enabled = data.puppack_enabled;
            // Update checkbox state directly just in case a re-render is pending
            const toggle = document.getElementById('puppack-vbs-toggle');
            if (toggle) toggle.checked = data.puppack_enabled;
        } else {
            const err = await res.json();
            Toast.error(err.detail || "Failed to toggle VBS");
            document.getElementById('puppack-vbs-toggle').checked = !enable;
        }
    } catch (e) {
        Toast.error("Error communicating with server.");
        document.getElementById('puppack-vbs-toggle').checked = !enable;
    }
};

PupPackManagerPage.toggleScreen = async function(id, enabled) {
    const screen = this.state.pupScreens.find(s => s.id === id);
    if (!screen) return;
    screen.active = enabled ? 'show' : 'off';
    await this.saveAllScreens();
};

PupPackManagerPage.saveAllScreens = async function() {
    const table = this.state.selectedTable;
    if (!table) return;

    try {
        const res = await fetch(`/api/puppacks/${table.id}/screens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screens: this.state.pupScreens })
        });

        if (res.ok) {
            Toast.success('Successfully saved screens.pup');
            this.selectTable(table.id);
        } else {
            const err = await res.json();
            Toast.error(err.detail || 'Failed to save screens.pup');
        }
    } catch (e) {
        Toast.error('Network error while saving.');
    }
};

PupPackManagerPage.getPhysicalIndexFromPupId = function(pupId) {
    const role = PUP_SCREEN_NAMES[String(pupId)];
    if (!role) return null;
    
    // Find our assignment for this role in settings
    const assignment = this.state.displayAssignments.find(a => a.role === role);
    if (assignment) return parseInt(assignment.index);
    
    return null;
};

PupPackManagerPage.getPupIdFromPhysicalIndex = function(physIndex, originalPupId = null) {
    // Get all roles assigned to this physical monitor
    const assignments = this.state.displayAssignments.filter(a => parseInt(a.index) === parseInt(physIndex));
    if (assignments.length === 0) return originalPupId !== null ? originalPupId : parseInt(physIndex);
    
    // If the element's original role is supported by this monitor, keep it
    if (originalPupId !== null) {
        const originalRole = PUP_SCREEN_NAMES[String(originalPupId)];
        if (originalRole && assignments.some(a => a.role === originalRole)) {
            return parseInt(originalPupId);
        }
    }
    
    // Otherwise, pick the "best" role for this monitor to determine the ID
    // Prioritize Backglass/DMD/FullDMD
    const priority = ["Backglass", "DMD", "FullDMD", "Topper", "Playfield"];
    for (const p of priority) {
        if (assignments.some(a => a.role === p)) return ROLE_TO_PUP_ID[p];
    }
    
    // Last resort: pick the first one
    return ROLE_TO_PUP_ID[assignments[0].role] ?? parseInt(physIndex);
};

PupPackManagerPage.openLayoutModal = async function(id) {
    this.injectPanel();
    this.state.editingScreenId = id;

    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        this.state.globalDisplays = settings.displays || [];
        this.state.master_orientation = settings.master_orientation || '';
    } catch(e) {
        Toast.error("Failed to load display settings.");
        return;
    }

    this.dragDropInitialized = false;
    this.renderLayoutPanel();
    document.getElementById('puppack-layout-panel').classList.add('open');
};

PupPackManagerPage.closeLayoutModal = function() {
    document.getElementById('puppack-layout-panel')?.classList.remove('open');
};

PupPackManagerPage.closeLayoutPanel = function() {
    document.getElementById('puppack-layout-panel')?.classList.remove('open');
};

PupPackManagerPage.identifyDisplays = async function(btn) {
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<div class="spinner" style="width: 12px; height: 12px; border-width: 2px;"></div>';
    try {
        await fetch('/api/displays/identify', { method: 'POST' });
        Toast.success('Identification overlays sent to all displays');
    } catch (e) {
        Toast.error('Failed to trigger display identification');
    }
    btn.disabled = false;
    btn.innerHTML = originalHtml;
};

PupPackManagerPage.resolveMonitors = function() {
    // Resolve monitors with fallback: DMD→Backglass→Playfield, Backglass→Playfield
    const find = (role) => this.state.globalDisplays.find(d => d.role === role) || null;

    const pf = find('Playfield');
    const bg = find('Backglass') || pf;  // fallback to Playfield
    const dmd = find('DMD') || find('FullDMD') || bg;  // fallback to Backglass, then Playfield

    this.state.resolvedMonitor_Backglass = bg;
    this.state.resolvedMonitor_DMD = dmd;

    // Track unique monitors for default logic
    const uniqueIds = new Set();
    if (pf) uniqueIds.add(pf.uuid || pf.index);
    if (find('Backglass')) uniqueIds.add((find('Backglass')).uuid || (find('Backglass')).index);
    if (find('DMD') || find('FullDMD')) uniqueIds.add((find('DMD') || find('FullDMD')).uuid || (find('DMD') || find('FullDMD')).index);
    this.state.uniqueMonitorCount = uniqueIds.size;
};

PupPackManagerPage.computeDefaults = function() {
    const id = this.state.editingScreenId;
    const screen = this.state.pupScreens.find(s => s.id === id);
    if (!screen) return {};

    this.resolveMonitors();

    // Default to Backglass monitor if possible, else Playfield
    const monitor = this.state.resolvedMonitor_Backglass || this.state.globalDisplays[0];
    if (!monitor) return {};

    return {
        x: 0, y: 0, 
        w: monitor.width, 
        h: monitor.height, 
        s: monitor.index, 
        preset: 'fill'
    };
};

PupPackManagerPage.applyDefaults = function() {
    const d = this.computeDefaults();
    if (!d.s) return;

    document.getElementById('pup-monitor-select').value = d.s;
    document.getElementById('pup-x-pct').value = 0;
    document.getElementById('pup-y-pct').value = 0;
    document.getElementById('pup-w-pct').value = 100;
    document.getElementById('pup-h-pct').value = 100;
    document.getElementById('pup-preset').value = d.preset;
    document.getElementById('pup-custom-fields').style.display = d.preset === 'custom' ? 'grid' : 'none';

    this.updatePreview();
    Toast.success('Reset to monitor fill');
};

PupPackManagerPage.renderLayoutPanel = function() {
    const id = this.state.editingScreenId;
    const screen = this.state.pupScreens.find(s => s.id === id);
    if (!screen) return;

    this.resolveMonitors();
    const body = document.getElementById('puppack-layout-body');

    // Parse CustomPos: [S,X,Y,W,H]
    let s_val = 2, x_val = 0, y_val = 0, w_val = 100, h_val = 100;
    let isLegacyFill = false;

    if (screen.custom_pos) {
        if (screen.custom_pos === "1") {
            isLegacyFill = true;
        } else {
            const parts = screen.custom_pos.split(',').map(p => p.trim());
            if (parts.length >= 5) {
                const rawPupId = parts[0];
                const foundIdx = this.getPhysicalIndexFromPupId(rawPupId);
                s_val = foundIdx !== null ? foundIdx : (this.state.resolvedMonitor_Backglass?.index || 0);
                x_val = parseFloat(parts[1]) || 0;
                y_val = parseFloat(parts[2]) || 0;
                w_val = parseFloat(parts[3]) || 100;
                h_val = parseFloat(parts[4]) || 100;
            }
        }
    } else {
        // Fallback: use screen_num if no custom_pos
        const foundIdx = this.getPhysicalIndexFromPupId(screen.screen_num);
        s_val = foundIdx !== null ? foundIdx : (this.state.resolvedMonitor_Backglass?.index || 0);
    }

    // Convert percentages to pixels for the editor based on the target monitor
    const monitor = this.state.globalDisplays.find(d => d.index === s_val) || this.state.globalDisplays[0];
    const mw = monitor ? monitor.width : 1920;
    const mh = monitor ? monitor.height : 1080;

    const px_x = Math.round((x_val / 100) * mw);
    const px_y = Math.round((y_val / 100) * mh);
    const px_w = Math.round((w_val / 100) * mw);
    const px_h = Math.round((h_val / 100) * mh);

    let html = `
        <div style="margin-bottom: 1.5rem; background: var(--bg-secondary); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border-color); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); font-weight: 700; width: 100px;">Description</span>
                    <span style="color: var(--text-primary); font-weight: 600; font-size: 0.95rem;">${this.escHtml(screen.description || 'No description provided')}</span>
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-bottom: 0.75rem; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="PupPackManagerPage.identifyDisplays(this)" style="font-size: 0.78rem; padding: 4px 10px; display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Identify Screens
            </button>
            <button class="btn btn-secondary btn-sm" onclick="PupPackManagerPage.applyDefaults()" style="font-size: 0.78rem; padding: 4px 10px; display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                Reset to Fill
            </button>
        </div>
        <div id="pup-preview-container" style="background: #111; border-radius: 8px; border: 1px solid #333; position: relative; overflow: hidden; min-height: 220px; display: flex; justify-content: center; align-items: center; padding: 0.75rem;">
            <div id="pup-preview-workspace" style="position: relative; transform-origin: center center;"></div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
            <div class="card" style="margin: 0; padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color);">
                <div style="margin-bottom: 1rem;">
                    <label class="input-label">Target Physical Monitor</label>
                    <select class="input-field" id="pup-monitor-select" onchange="PupPackManagerPage.updatePreview()">
                        ${(() => {
                            const grouped = [];
                            this.state.globalDisplays.forEach(d => {
                                let existing = grouped.find(g => g.index === d.index);
                                if (existing) {
                                    if (d.role && !existing.roles.includes(d.role)) {
                                        existing.roles.push(d.role);
                                    }
                                } else {
                                    grouped.push({
                                        index: d.index,
                                        width: d.width,
                                        height: d.height,
                                        roles: d.role ? [d.role] : []
                                    });
                                }
                            });
                            return grouped.map(m => {
                                let w = m.width, h = m.height;
                                if (m.roles.includes('Playfield') && (this.state.master_orientation === '90' || this.state.master_orientation === '270')) {
                                    w = m.height; h = m.width;
                                }
                                let roleText = m.roles.length > 0 ? m.roles.join(' / ') : 'Monitor';
                                if (m.roles.some(r => r.includes('DMD'))) roleText = 'DMD';
                                const label = `${roleText}: ${w}x${h} (Monitor ${m.index})`;
                                return `<option value="${m.index}" ${m.index === s_val ? 'selected' : ''}>${this.escHtml(label)}</option>`;
                            }).join('');
                        })()}
                    </select>
                </div>

                <div style="margin-bottom: 1rem;">
                    <label class="input-label">Layout Preset</label>
                    <select class="input-field" id="pup-preset" onchange="PupPackManagerPage.applyPreset()">
                        <option value="custom" ${!isLegacyFill ? 'selected' : ''}>Custom (Drag / Manual)</option>
                        <option value="fill" ${isLegacyFill ? 'selected' : ''}>Fill Monitor</option>
                        <option value="center_169">Center (16:9 Ratio - 60%)</option>
                        <option value="center_60">Center (60% Size)</option>
                        <option value="top">Top Half</option>
                        <option value="bottom">Bottom Half</option>
                    </select>
                </div>

                <div id="pup-custom-fields" style="display: flex; flex-direction: column; gap: 1.25rem; padding-top: 1.25rem; border-top: 1px dashed var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <label class="input-label" style="width: 65px; margin: 0; font-size: 0.75rem;">X-Offset</label>
                        <input type="range" min="0" max="100" step="1" class="input-range" id="pup-x-pct" value="${Math.round(x_val)}" style="flex: 1;" oninput="PupPackManagerPage.updatePreview()">
                        <span style="width: 45px; font-size: 0.85rem; font-weight: 700; color: var(--accent-blue); text-align: right;"><span id="pup-x-pct-display">${Math.round(x_val)}</span>%</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <label class="input-label" style="width: 65px; margin: 0; font-size: 0.75rem;">Y-Offset</label>
                        <input type="range" min="0" max="100" step="1" class="input-range" id="pup-y-pct" value="${Math.round(y_val)}" style="flex: 1;" oninput="PupPackManagerPage.updatePreview()">
                        <span style="width: 45px; font-size: 0.85rem; font-weight: 700; color: var(--accent-blue); text-align: right;"><span id="pup-y-pct-display">${Math.round(y_val)}</span>%</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <label class="input-label" style="width: 65px; margin: 0; font-size: 0.75rem;">Width</label>
                        <input type="range" min="0" max="100" step="1" class="input-range" id="pup-w-pct" value="${Math.round(w_val)}" style="flex: 1;" oninput="PupPackManagerPage.updatePreview()">
                        <span style="width: 45px; font-size: 0.85rem; font-weight: 700; color: var(--accent-blue); text-align: right;"><span id="pup-w-pct-display">${Math.round(w_val)}</span>%</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <label class="input-label" style="width: 65px; margin: 0; font-size: 0.75rem;">Height</label>
                        <input type="range" min="0" max="100" step="1" class="input-range" id="pup-h-pct" value="${Math.round(h_val)}" style="flex: 1;" oninput="PupPackManagerPage.updatePreview()">
                        <span style="width: 45px; font-size: 0.85rem; font-weight: 700; color: var(--accent-blue); text-align: right;"><span id="pup-h-pct-display">${Math.round(h_val)}</span>%</span>
                    </div>
                    
                    <button class="btn btn-secondary btn-sm" onclick="PupPackManagerPage.centerManualElement()" style="margin-top: 0.5rem; justify-content: center; font-size: 0.75rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        Center Element on Monitor
                    </button>
                </div>
            </div>
        </div>
    `;
    body.innerHTML = html;
    
    document.getElementById('pup-custom-fields').style.display = isLegacyFill ? 'none' : 'grid';

    this.initDragDrop();
    this.updatePreview();
};


PupPackManagerPage.applyPreset = function() {
    const preset = document.getElementById('pup-preset').value;
    const customDiv = document.getElementById('pup-custom-fields');

    if (preset === 'custom') {
        customDiv.style.display = 'grid';
        this.updatePreview();
        return;
    } else {
        customDiv.style.display = 'none';
    }

    const s_val = parseInt(document.getElementById('pup-monitor-select').value);
    const monitor = this.state.globalDisplays.find(d => d.index === s_val);
    if (!monitor) return;

    const _getEffSize = (d) => {
        let w = d.width, h = d.height;
        if (d.role === 'Playfield' && (this.state.master_orientation === '90' || this.state.master_orientation === '270')) {
            w = d.height; h = d.width;
        }
        return { w, h };
    };

    const { w: mw, h: mh } = _getEffSize(monitor);

    let x = 0, y = 0, w = 100, h = 100;

    if (preset === 'fill') {
        // Full screen 0,0,100,100
    } else if (preset === 'center_169') {
        const targetRatio = 16 / 9;
        const monitorRatio = mw / mh;
        let baseW, baseH;
        if (monitorRatio > targetRatio) {
            baseW = (mh * targetRatio / mw) * 100;
            baseH = 100;
        } else {
            baseW = 100;
            baseH = (mw / targetRatio / mh) * 100;
        }
        w = baseW * 0.6;
        h = baseH * 0.6;
        x = (100 - w) / 2;
        y = (100 - h) / 2;
    } else if (preset === 'center_60') {
        w = 60; h = 60; x = 20; y = 20;
    } else if (preset === 'top') {
        x = 0; y = 0; w = 100; h = 50;
    } else if (preset === 'bottom') {
        x = 0; y = 50; w = 100; h = 50;
    }

    document.getElementById('pup-x-pct').value = Math.round(x);
    document.getElementById('pup-y-pct').value = Math.round(y);
    document.getElementById('pup-w-pct').value = Math.round(w);
    document.getElementById('pup-h-pct').value = Math.round(h);

    this.updatePreview();
};

PupPackManagerPage.centerManualElement = function() {
    const w = parseFloat(document.getElementById('pup-w-pct').value) || 0;
    const h = parseFloat(document.getElementById('pup-h-pct').value) || 0;
    
    const x = (100 - w) / 2;
    const y = (100 - h) / 2;
    
    document.getElementById('pup-x-pct').value = Math.round(x);
    document.getElementById('pup-y-pct').value = Math.round(y);
    
    this.updatePreview();
    Toast.success('Element centered on monitor');
};

PupPackManagerPage.updatePreview = function() {
    const workspace = document.getElementById('pup-preview-workspace');
    if (!workspace) return;
    workspace.innerHTML = '';

    const _getEffSize = (d) => {
        let w = d.width, h = d.height;
        if (d.role === 'Playfield' && (this.state.master_orientation === '90' || this.state.master_orientation === '270')) {
            w = d.height; h = d.width;
        }
        return { w, h };
    };

    // 1. Calculate the bounding box of all monitors
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    this.state.globalDisplays.forEach(d => {
        const { w, h } = _getEffSize(d);
        const x = d.x || 0;
        const y = d.y || 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
    });

    const totalW = maxX - minX;
    const totalH = maxY - minY;

    if (totalW === 0 || totalH === 0) {
        workspace.innerHTML = '<div style="color: #666; font-size: 0.85rem;">No displays configured</div>';
        return;
    }

    // Scale workspace to fit container — no arbitrary cap
    const container = document.getElementById('pup-preview-container');
    const availW = container.clientWidth - 20;
    const availH = container.clientHeight - 60; // Increased to accommodate top labels and bottom padding
    const scale = Math.min(availW / totalW, availH / totalH);

    workspace.style.width = `${totalW * scale}px`;
    workspace.style.height = `${totalH * scale}px`;
    workspace.style.transform = 'none';

    // 2. Draw monitors
    this.state.globalDisplays.forEach(d => {
        const { w, h } = _getEffSize(d);
        const mx = ((d.x || 0) - minX) * scale;
        const my = ((d.y || 0) - minY) * scale;
        const roleName = d.role === 'FullDMD' ? 'DMD' : (d.role || `Monitor ${d.index}`);
        const label = d.role ? `${roleName} (M${d.index})` : roleName;
        const orientLabel = (d.role === 'Playfield' && (this.state.master_orientation === '90' || this.state.master_orientation === '270')) ? ' (Portrait)' : '';

        workspace.insertAdjacentHTML('beforeend', `
            <div class="monitor-label" style="position: absolute; left: ${mx}px; top: ${my - 24}px; padding: 2px 8px; background: rgba(30, 30, 46, 0.8); backdrop-filter: blur(4px); border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 10px; color: #a6adc8; font-weight: 700; white-space: nowrap; pointer-events: none; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                ${this.escHtml(label + orientLabel)}
            </div>
            <div style="position: absolute; left: ${mx}px; top: ${my}px; width: ${w * scale}px; height: ${h * scale}px; border: 1px solid #313244; background: #11111b; display: flex; align-items: center; justify-content: center; color: #45475a; font-size: ${Math.max(10, 11 * scale)}px; font-weight: 500; border-radius: 4px; box-sizing: border-box; overflow: hidden;">
                ${w}x${h}
            </div>
        `);
    });

    // 3. Draw enabled screen element
    const s_val = parseInt(document.getElementById('pup-monitor-select')?.value);
    const monitor = this.state.globalDisplays.find(d => d.index === s_val);
    if (!monitor) return;

    const { w: mw, h: mh } = _getEffSize(monitor);

    const mx = ((monitor.x || 0) - minX) * scale;
    const my = ((monitor.y || 0) - minY) * scale;

    let x_pct = parseFloat(document.getElementById('pup-x-pct').value) || 0;
    let y_pct = parseFloat(document.getElementById('pup-y-pct').value) || 0;
    let w_pct = parseFloat(document.getElementById('pup-w-pct').value) || 0;
    let h_pct = parseFloat(document.getElementById('pup-h-pct').value) || 0;

    // Hard clamp position 0-100
    x_pct = Math.max(0, Math.min(x_pct, 100));
    y_pct = Math.max(0, Math.min(y_pct, 100));
    document.getElementById('pup-x-pct').value = x_pct;
    document.getElementById('pup-y-pct').value = y_pct;

    // Constrain logic: If X + W > 100, shrink W.
    if (x_pct + w_pct > 100) {
        w_pct = Math.max(1, 100 - x_pct);
        document.getElementById('pup-w-pct').value = Math.round(w_pct);
    }
    if (y_pct + h_pct > 100) {
        h_pct = Math.max(1, 100 - y_pct);
        document.getElementById('pup-h-pct').value = Math.round(h_pct);
    }

    // Update slider percentage display labels
    const xDisp = document.getElementById('pup-x-pct-display');
    const yDisp = document.getElementById('pup-y-pct-display');
    const wDisp = document.getElementById('pup-w-pct-display');
    const hDisp = document.getElementById('pup-h-pct-display');
    if (xDisp) xDisp.textContent = Math.round(x_pct);
    if (yDisp) yDisp.textContent = Math.round(y_pct);
    if (wDisp) wDisp.textContent = Math.round(w_pct);
    if (hDisp) hDisp.textContent = Math.round(h_pct);

    // Convert back to pixels for the CSS preview
    const px_x = (x_pct / 100) * mw;
    const px_y = (y_pct / 100) * mh;
    const px_w = (w_pct / 100) * mw;
    const px_h = (h_pct / 100) * mh;

    const isCustom = document.getElementById('pup-preset').value === 'custom';
    const cursorStyle = isCustom ? 'cursor: move;' : '';
    
    const id = this.state.editingScreenId;
    const screen = this.state.pupScreens.find(s => s.id === id);
    const label = screen ? screen.screen_name : 'Element';

    workspace.insertAdjacentHTML('beforeend', `
        <div id="pup-preview-box"
             class="pup-preview-box"
             style="position: absolute; left: ${mx + px_x * scale}px; top: ${my + px_y * scale}px; width: ${px_w * scale}px; height: ${px_h * scale}px; background: rgba(59, 130, 246, 0.4); border: 2px solid #3b82f6; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; text-shadow: 1px 1px 2px #000; box-sizing: border-box; border-radius: 4px; ${cursorStyle}">
            ${isCustom ? `
                <div class="resize-handle se" style="position: absolute; right: -4px; bottom: -4px; width: 8px; height: 8px; background: #fff; border: 1px solid #000; cursor: se-resize; border-radius: 2px;"></div>
            ` : ''}
        </div>
    `);
};

PupPackManagerPage.saveLayout = async function() {
    const id = this.state.editingScreenId;
    const screen = this.state.pupScreens.find(s => s.id === id);
    if (!screen) return;

    const s_phys = parseInt(document.getElementById('pup-monitor-select').value);
    
    // Translate physical index back to PUP ID for the file
    // We pass the screen.screen_num to help the helper decide if it's a shared monitor
    const originalPupId = (screen.custom_pos && screen.custom_pos.includes(',')) 
        ? screen.custom_pos.split(',')[0] 
        : screen.screen_num;
    const s_pup = this.getPupIdFromPhysicalIndex(s_phys, originalPupId);

    const x_pct = parseFloat(document.getElementById('pup-x-pct').value);
    const y_pct = parseFloat(document.getElementById('pup-y-pct').value);
    const w_pct = parseFloat(document.getElementById('pup-w-pct').value);
    const h_pct = parseFloat(document.getElementById('pup-h-pct').value);

    // Format: S,X,Y,W,H
    const customPos = `${s_pup},${Math.round(x_pct)},${Math.round(y_pct)},${Math.round(w_pct)},${Math.round(h_pct)}`;

    const preset = document.getElementById('pup-preset').value;
    
    if (preset === 'fill') {
        screen.custom_pos = "1"; // Legacy fill flag as requested
    } else {
        screen.custom_pos = customPos;
    }

    this.closeLayoutPanel();
    this.renderOptions(null, null, this.state.pupScreens); // partial refresh
    await this.saveAllScreens();
};


PupPackManagerPage.initDragDrop = function() {
    const workspace = document.getElementById('pup-preview-workspace');
    if (!workspace || this.dragDropInitialized) return;
    this.dragDropInitialized = true;

    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startBoxX, startBoxY, startBoxW, startBoxH;

    let lockAxis = null;

    workspace.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            isResizing = true;
        } else if (e.target.classList.contains('pup-preview-box')) {
            if (document.getElementById('pup-preset').value !== 'custom') return;
            isDragging = true;
        } else {
            return;
        }

        e.preventDefault();

        startX = e.clientX;
        startY = e.clientY;
        lockAxis = null;

        const s_val = parseInt(document.getElementById('pup-monitor-select').value);
        const monitor = this.state.globalDisplays.find(d => d.index === s_val);

        const _getEffSize = (d) => {
            let w = d.width, h = d.height;
            if (d.role === 'Playfield' && (this.state.master_orientation === '90' || this.state.master_orientation === '270')) {
                w = d.height; h = d.width;
            }
            return { w, h };
        };
        const { w: mw, h: mh } = _getEffSize(monitor);

        startBoxX = (parseFloat(document.getElementById('pup-x-pct').value) / 100) * mw;
        startBoxY = (parseFloat(document.getElementById('pup-y-pct').value) / 100) * mh;
        startBoxW = (parseFloat(document.getElementById('pup-w-pct').value) / 100) * mw;
        startBoxH = (parseFloat(document.getElementById('pup-h-pct').value) / 100) * mh;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging && !isResizing) return;

        const container = document.getElementById('pup-preview-container');
        const ws = document.getElementById('pup-preview-workspace');
        if (!container || !ws) return;

        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        this.state.globalDisplays.forEach(d => {
            const dx = d.x || 0;
            const dy = d.y || 0;
            if (dx < minX) minX = dx;
            if (dy < minY) minY = dy;
            if (dx + d.width > maxX) maxX = dx + d.width;
            if (dy + d.height > maxY) maxY = dy + d.height;
        });
        const totalW = maxX - minX;
        const totalH = maxY - minY;
        if (totalW === 0 || totalH === 0) return;

        const availW = container.clientWidth - 20;
        const availH = container.clientHeight - 20;
        const scale = Math.min(availW / totalW, availH / totalH);

        // Convert pixel movement to native monitor coordinates
        let moveX = (e.clientX - startX) / scale;
        let moveY = (e.clientY - startY) / scale;

        // Axis locking with Shift key
        if (isDragging && e.shiftKey) {
            if (!lockAxis) {
                // Determine lock direction after a small movement threshold
                if (Math.abs(moveX) > 5 || Math.abs(moveY) > 5) {
                    lockAxis = Math.abs(moveX) > Math.abs(moveY) ? 'x' : 'y';
                }
            }
            if (lockAxis === 'x') moveY = 0;
            else if (lockAxis === 'y') moveX = 0;
        } else {
            lockAxis = null;
        }

        const s_val = parseInt(document.getElementById('pup-monitor-select').value);
        const monitor = this.state.globalDisplays.find(d => d.index === s_val);
        if (!monitor) return;

        let newPxX = startBoxX;
        let newPxY = startBoxY;
        let newPxW = startBoxW;
        let newPxH = startBoxH;

        const _getEffSize = (d) => {
            let w = d.width, h = d.height;
            if (d.role === 'Playfield' && (this.state.master_orientation === '90' || this.state.master_orientation === '270')) {
                w = d.height; h = d.width;
            }
            return { w, h };
        };
        const { w: mw, h: mh } = _getEffSize(monitor);

        if (isDragging) {
            newPxX = startBoxX + moveX;
            newPxY = startBoxY + moveY;
        } else if (isResizing) {
            newPxW = Math.max(10, startBoxW + moveX);
            newPxH = Math.max(10, startBoxH + moveY);
        }

        // Convert back to percentages for the input fields
        const x_pct = (newPxX / mw) * 100;
        const y_pct = (newPxY / mh) * 100;
        const w_pct = (newPxW / mw) * 100;
        const h_pct = (newPxH / mh) * 100;

        document.getElementById('pup-x-pct').value = x_pct.toFixed(2);
        document.getElementById('pup-y-pct').value = y_pct.toFixed(2);
        document.getElementById('pup-w-pct').value = w_pct.toFixed(2);
        document.getElementById('pup-h-pct').value = h_pct.toFixed(2);

        document.getElementById('pup-preset').value = 'custom';
        document.getElementById('pup-custom-fields').style.display = 'grid';

        this.updatePreview();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
    });
};
