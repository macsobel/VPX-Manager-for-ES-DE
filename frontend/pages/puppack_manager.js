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
                    <h1 class="page-title">PUP Pack Manager (Beta)</h1>
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
            const res = await fetch('/api/puppacks');
            const data = await res.json();

            this.state.tables = data.tables;
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
                        <div style="font-weight: 600; font-size: 0.95rem; color: ${isSelected ? 'var(--accent-blue)' : 'var(--text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
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
            const [optRes, vbsRes, iniRes] = await Promise.all([
                fetch(`/api/puppacks/${id}/options`),
                fetch(`/api/puppacks/${id}/vbs-status`),
                fetch(`/api/puppacks/${id}/ini-config`)
            ]);

            const data = await optRes.json();
            const vbsData = vbsRes.ok ? await vbsRes.json() : null;
            const iniData = iniRes.ok ? await iniRes.json() : null;

            this.state.vbsStatus = vbsData;
            this.state.iniConfig = iniData?.config || {};
            this.state.pupScreens = data.screens; // save for modal

            this.renderOptions(data.options, data.pup_dir, data.screens);
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
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); display: flex; align-items: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Current Configuration
                    </h3>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.4;">
                        The badges below show which screens are currently enabled in the pack. These are <strong>indicators</strong> of the active state; use the layout options below to change them.
                    </p>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${screens.map(s => `
                            <div class="badge" style="padding: 0.4rem 0.75rem; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; display: flex; align-items: center; gap: 8px; user-select: none;">
                                <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent-emerald); box-shadow: 0 0 8px var(--accent-emerald);"></div>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${this.escHtml(s.description)}</span>
                                <span style="font-size: 0.7rem; color: var(--accent-emerald); font-weight: 500; opacity: 0.9;">${this.escHtml(s.status)}</span>
                            </div>
                        `).join('')}
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
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
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
                <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--bg-secondary); padding: 0.5rem 1rem; border-radius: var(--radius-full); border: 1px solid var(--border-color);">
                    <span style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Enable in VBS</span>
                    <label class="switch" style="margin: 0;">
                        <input type="checkbox" id="puppack-vbs-toggle" ${isEnabled ? 'checked' : ''} onchange="PupPackManagerPage.toggleVbs(this.checked)">
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
        }

        headerControls += `
            <button class="btn btn-primary btn-sm" onclick="PupPackManagerPage.openLayoutModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                Configure Screen Layout
            </button>
        `;

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
                <div style="display: flex; gap: 1rem; align-items: center;">
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

PupPackManagerPage.openLayoutModal = async function() {
    this.injectPanel();

    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        this.state.globalDisplays = settings.displays || [];
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
    this.resolveMonitors();

    const bg = this.state.resolvedMonitor_Backglass;
    const dmd = this.state.resolvedMonitor_DMD;
    const count = this.state.uniqueMonitorCount;

    const defaults = {
        Backglass: { enabled: true, x: 0, y: 0, w: 0, h: 0, preset: 'fill' },
        DMD: { enabled: true, x: 0, y: 0, w: 0, h: 0, preset: 'fill' }
    };

    if (!bg && !dmd) return defaults;

    if (count >= 3) {
        // 3 screens: both fill their dedicated monitors
        if (bg) { defaults.Backglass.w = bg.width; defaults.Backglass.h = bg.height; }
        if (dmd) { defaults.DMD.w = dmd.width; defaults.DMD.h = dmd.height; }
        defaults.Backglass.preset = 'fill';
        defaults.DMD.preset = 'fill';
    } else if (count === 2) {
        // 2 screens: Backglass fills its monitor, DMD is a bottom strip on backglass
        if (bg) {
            defaults.Backglass.w = bg.width;
            defaults.Backglass.h = bg.height;
            defaults.Backglass.preset = 'fill';
        }
        // DMD as bottom-center strip on whichever monitor it resolved to (likely Backglass)
        if (dmd) {
            const dmdW = Math.round(dmd.width * 0.6);
            const dmdH = Math.round(dmd.height * 0.15);
            defaults.DMD.w = dmdW;
            defaults.DMD.h = dmdH;
            defaults.DMD.x = Math.round((dmd.width - dmdW) / 2);
            defaults.DMD.y = dmd.height - dmdH;
            defaults.DMD.preset = 'custom';
        }
    } else {
        // 1 screen: everything on Playfield — small overlays that don't block the table
        // Backglass: right 35%, top 45% of screen
        if (bg) {
            const bgW = Math.round(bg.width * 0.35);
            const bgH = Math.round(bg.height * 0.45);
            defaults.Backglass.x = bg.width - bgW;
            defaults.Backglass.y = 0;
            defaults.Backglass.w = bgW;
            defaults.Backglass.h = bgH;
            defaults.Backglass.preset = 'custom';
        }
        // DMD: right 35%, small strip below the backglass area
        if (dmd) {
            const dmdW = Math.round(dmd.width * 0.35);
            const dmdH = Math.round(dmd.height * 0.10);
            const bgH = Math.round(dmd.height * 0.45);
            defaults.DMD.x = dmd.width - dmdW;
            defaults.DMD.y = bgH;
            defaults.DMD.w = dmdW;
            defaults.DMD.h = dmdH;
            defaults.DMD.preset = 'custom';
        }
    }

    return defaults;
};

PupPackManagerPage.applyDefaults = function() {
    const defaults = this.computeDefaults();

    ['Backglass', 'DMD'].forEach(key => {
        const d = defaults[key];
        const enableEl = document.getElementById(`pup-enable-${key}`);
        if (enableEl) enableEl.checked = d.enabled;
        document.getElementById(`pup-x-${key}`).value = d.x;
        document.getElementById(`pup-y-${key}`).value = d.y;
        document.getElementById(`pup-w-${key}`).value = d.w;
        document.getElementById(`pup-h-${key}`).value = d.h;

        const presetEl = document.getElementById(`pup-preset-${key}`);
        if (presetEl) presetEl.value = d.preset;

        const customDiv = document.getElementById(`pup-custom-${key}`);
        if (customDiv) customDiv.style.display = d.preset === 'custom' ? 'grid' : 'none';
    });

    this.updatePreview();
    Toast.success('Reset to smart defaults');
};

PupPackManagerPage.renderLayoutPanel = function() {
    const screenSections = [
        { label: 'Backglass', key: 'Backglass', role: 'Backglass' },
        { label: 'DMD / FullDMD', key: 'DMD', role: 'DMD' }
    ];

    // Resolve monitors with fallback
    this.resolveMonitors();

    const body = document.getElementById('puppack-layout-body');

    // Mapping from our screen key to VPX pad prefix
    const PAD_PREFIX = { Backglass: 'bgpad', DMD: 'svpad' };

    // Check if this is a "fresh" config (no existing pad or legacy values)
    const hasExistingConfig = ('bgpadleft' in this.state.iniConfig) ||
                              ('svpadleft' in this.state.iniConfig) ||
                              (this.state.iniConfig.pupbackglasswindowwidth > 0) ||
                              (this.state.iniConfig.pupdmdwindowwidth > 0);

    // Compute defaults for fresh configs
    const defaults = this.computeDefaults();

    let html = `
        <div style="display: flex; justify-content: flex-end; margin-bottom: 0.75rem;">
            <button class="btn btn-secondary btn-sm" onclick="PupPackManagerPage.applyDefaults()" style="font-size: 0.78rem; padding: 4px 10px; display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                Reset to Defaults
            </button>
        </div>
        <div id="pup-preview-container" style="background: #111; border-radius: 8px; border: 1px solid #333; position: relative; overflow: hidden; min-height: 180px; display: flex; justify-content: center; align-items: center; padding: 0.75rem;">
            <div id="pup-preview-workspace" style="position: relative; transform-origin: center center;"></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;" id="pup-screen-controls">
    `;

    screenSections.forEach(section => {
        const prefix = `pup${section.key.toLowerCase()}`;
        const padPrefix = PAD_PREFIX[section.key];
        const monitor = this.state[`resolvedMonitor_${section.key}`];

        // Use existing config if present, otherwise use computed defaults
        let isEnabled, valX, valY, valW, valH;
        if (hasExistingConfig) {
            // Try VPX pad format first (new format)
            if (padPrefix && `${padPrefix}left` in this.state.iniConfig && monitor) {
                const padL = this.state.iniConfig[`${padPrefix}left`] || 0;
                const padT = this.state.iniConfig[`${padPrefix}top`] || 0;
                const padR = this.state.iniConfig[`${padPrefix}right`] || 0;
                const padB = this.state.iniConfig[`${padPrefix}bottom`] || 0;
                valX = padL;
                valY = padT;
                valW = monitor.width - padL - padR;
                valH = monitor.height - padT - padB;
                isEnabled = this.state.iniConfig[`${prefix}window`] === 1 || valW > 0;
            } else {
                // Fallback to old format (legacy)
                isEnabled = this.state.iniConfig[`${prefix}window`] === 1;
                valX = this.state.iniConfig[`${prefix}windowx`] || 0;
                valY = this.state.iniConfig[`${prefix}windowy`] || 0;
                valW = this.state.iniConfig[`${prefix}windowwidth`] || 0;
                valH = this.state.iniConfig[`${prefix}windowheight`] || 0;
            }
        } else {
            const d = defaults[section.key];
            isEnabled = d.enabled;
            valX = d.x;
            valY = d.y;
            valW = d.w;
            valH = d.h;
        }

        // Show monitor info — with fallback indicator
        let monitorInfo = '';
        if (monitor) {
            const isDedicated = this.state.globalDisplays.find(d => d.role === section.role);
            if (isDedicated) {
                monitorInfo = `<span style="font-size: 0.8rem; color: var(--accent-emerald); font-weight: 500;">Monitor ${monitor.index} (${monitor.width}×${monitor.height})</span>`;
            } else {
                monitorInfo = `<span style="font-size: 0.8rem; color: var(--accent-blue); font-weight: 500;">Monitor ${monitor.index} (${monitor.width}×${monitor.height}) <span style="color: var(--text-tertiary);">— sharing</span></span>`;
            }
        } else {
            monitorInfo = `<span style="font-size: 0.8rem; color: var(--accent-amber);">No monitors assigned — <a href="#settings" onclick="PupPackManagerPage.closeLayoutPanel()" style="color: var(--accent-blue);">configure in Settings</a></span>`;
        }

        html += `
            <div class="card" style="margin: 0; padding: 1rem; background: var(--bg-surface); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <label class="switch" style="margin: 0;">
                            <input type="checkbox" id="pup-enable-${section.key}" ${isEnabled ? 'checked' : ''} onchange="PupPackManagerPage.updatePreview()">
                            <span class="slider round"></span>
                        </label>
                        <div>
                            <h4 style="margin: 0; font-size: 1rem;">${section.label}</h4>
                            <div style="margin-top: 2px;">${monitorInfo}</div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 0.5rem;">
                    <label class="input-label">Layout Preset</label>
                    <select class="input-field" id="pup-preset-${section.key}" onchange="PupPackManagerPage.applyPreset('${section.key}')">
                        <option value="fill">Fill Monitor</option>
                        <option value="center">Center (Keep Ratio)</option>
                        <option value="bottom">Bottom Half</option>
                        <option value="custom">Custom (Drag / Manual)</option>
                    </select>
                </div>

                <div id="pup-custom-${section.key}" style="display: none; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-color);">
                    <div><label class="input-label" style="font-size:0.75rem;">X</label><input type="number" class="input-field" id="pup-x-${section.key}" value="${valX}" min="0" oninput="PupPackManagerPage.clampValues('${section.key}')"></div>
                    <div><label class="input-label" style="font-size:0.75rem;">Y</label><input type="number" class="input-field" id="pup-y-${section.key}" value="${valY}" min="0" oninput="PupPackManagerPage.clampValues('${section.key}')"></div>
                    <div><label class="input-label" style="font-size:0.75rem;">Width</label><input type="number" class="input-field" id="pup-w-${section.key}" value="${valW}" min="1" oninput="PupPackManagerPage.clampValues('${section.key}')"></div>
                    <div><label class="input-label" style="font-size:0.75rem;">Height</label><input type="number" class="input-field" id="pup-h-${section.key}" value="${valH}" min="1" oninput="PupPackManagerPage.clampValues('${section.key}')"></div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    body.innerHTML = html;

    // Set correct presets and show/hide custom fields
    screenSections.forEach(section => {
        const prefix = `pup${section.key.toLowerCase()}`;
        const isEnabled = document.getElementById(`pup-enable-${section.key}`)?.checked;

        if (!hasExistingConfig) {
            // Fresh config: use computed default preset
            const d = defaults[section.key];
            const presetEl = document.getElementById(`pup-preset-${section.key}`);
            if (presetEl) presetEl.value = d.preset;
            const customDiv = document.getElementById(`pup-custom-${section.key}`);
            if (customDiv) customDiv.style.display = d.preset === 'custom' ? 'grid' : 'none';
        } else if (isEnabled) {
            this.applyPreset(section.key, true);
        }
    });

    this.initDragDrop();
    this.updatePreview();
};

PupPackManagerPage.clampValues = function(screenName) {
    const monitor = this.state[`resolvedMonitor_${screenName}`];
    if (!monitor) { this.updatePreview(); return; }

    const mw = monitor.width;
    const mh = monitor.height;

    const xEl = document.getElementById(`pup-x-${screenName}`);
    const yEl = document.getElementById(`pup-y-${screenName}`);
    const wEl = document.getElementById(`pup-w-${screenName}`);
    const hEl = document.getElementById(`pup-h-${screenName}`);

    let x = parseInt(xEl.value) || 0;
    let y = parseInt(yEl.value) || 0;
    let w = parseInt(wEl.value) || 1;
    let h = parseInt(hEl.value) || 1;

    // Clamp width/height to monitor size
    w = Math.max(1, Math.min(w, mw));
    h = Math.max(1, Math.min(h, mh));

    // Clamp position so the box stays within the monitor
    x = Math.max(0, Math.min(x, mw - w));
    y = Math.max(0, Math.min(y, mh - h));

    xEl.value = x;
    yEl.value = y;
    wEl.value = w;
    hEl.value = h;

    this.updatePreview();
};

PupPackManagerPage.applyPreset = function(screenName, isInitial = false) {
    const preset = document.getElementById(`pup-preset-${screenName}`).value;
    const customDiv = document.getElementById(`pup-custom-${screenName}`);

    if (preset === 'custom') {
        customDiv.style.display = 'grid';
        this.updatePreview();
        return;
    } else {
        customDiv.style.display = 'none';
    }

    // Resolve monitor from settings (no dropdown)
    const monitor = this.state[`resolvedMonitor_${screenName}`];
    if (!monitor) return;

    const mw = monitor.width;
    const mh = monitor.height;

    let x = 0, y = 0, w = mw, h = mh;

    if (preset === 'fill') {
        // x=0, y=0, w=mw, h=mh (defaults)
    } else if (preset === 'center') {
        const targetRatio = 16 / 9;
        const monitorRatio = mw / mh;

        if (monitorRatio > targetRatio) {
            w = mh * targetRatio;
            h = mh;
            x = (mw - w) / 2;
            y = 0;
        } else {
            w = mw;
            h = mw / targetRatio;
            x = 0;
            y = (mh - h) / 2;
        }
    } else if (preset === 'bottom') {
        x = 0;
        y = mh / 2;
        w = mw;
        h = mh / 2;
    }

    const prefix = `pup${screenName.toLowerCase()}`;
    const hasValues = this.state.iniConfig[`${prefix}windowwidth`] > 0;

    if (!isInitial || !hasValues) {
        document.getElementById(`pup-x-${screenName}`).value = Math.round(x);
        document.getElementById(`pup-y-${screenName}`).value = Math.round(y);
        document.getElementById(`pup-w-${screenName}`).value = Math.round(w);
        document.getElementById(`pup-h-${screenName}`).value = Math.round(h);
    } else {
        document.getElementById(`pup-preset-${screenName}`).value = 'custom';
        customDiv.style.display = 'grid';
    }

    this.updatePreview();
};

PupPackManagerPage.updatePreview = function() {
    const workspace = document.getElementById('pup-preview-workspace');
    if (!workspace) return;
    workspace.innerHTML = '';

    // 1. Calculate the bounding box of all monitors
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    this.state.globalDisplays.forEach(d => {
        const x = d.x || 0;
        const y = d.y || 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + d.width > maxX) maxX = x + d.width;
        if (y + d.height > maxY) maxY = y + d.height;
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
    const availH = container.clientHeight - 20;
    const scale = Math.min(availW / totalW, availH / totalH);

    workspace.style.width = `${totalW * scale}px`;
    workspace.style.height = `${totalH * scale}px`;
    workspace.style.transform = 'none';

    // 2. Draw monitors
    this.state.globalDisplays.forEach(d => {
        const mx = ((d.x || 0) - minX) * scale;
        const my = ((d.y || 0) - minY) * scale;

        workspace.insertAdjacentHTML('beforeend', `
            <div style="position: absolute; left: ${mx}px; top: ${my}px; width: ${d.width * scale}px; height: ${d.height * scale}px; border: 2px solid #444; background: #1a1a2e; display: flex; align-items: center; justify-content: center; color: #555; font-size: ${Math.max(12, 14 * scale)}px; font-weight: bold; border-radius: 4px; box-sizing: border-box;">
                M${d.index}
            </div>
        `);
    });

    // 3. Draw enabled screens (Backglass + DMD only)
    const colors = {
        'Backglass': 'rgba(59, 130, 246, 0.5)',
        'DMD': 'rgba(16, 185, 129, 0.5)'
    };
    const borderColors = {
        'Backglass': '#3b82f6',
        'DMD': '#10b981'
    };

    ['Backglass', 'DMD'].forEach(screenName => {
        if (!document.getElementById(`pup-enable-${screenName}`)?.checked) return;

        const monitor = this.state[`resolvedMonitor_${screenName}`];
        if (!monitor) return;

        const mx = ((monitor.x || 0) - minX) * scale;
        const my = ((monitor.y || 0) - minY) * scale;

        const x = parseFloat(document.getElementById(`pup-x-${screenName}`).value) || 0;
        const y = parseFloat(document.getElementById(`pup-y-${screenName}`).value) || 0;
        const w = parseFloat(document.getElementById(`pup-w-${screenName}`).value) || 0;
        const h = parseFloat(document.getElementById(`pup-h-${screenName}`).value) || 0;

        const isCustom = document.getElementById(`pup-preset-${screenName}`).value === 'custom';
        const cursorStyle = isCustom ? 'cursor: move;' : '';
        const label = screenName === 'DMD' ? 'DMD/FullDMD' : screenName;

        workspace.insertAdjacentHTML('beforeend', `
            <div id="pup-preview-box-${screenName}"
                 class="pup-preview-box"
                 data-screen="${screenName}"
                 style="position: absolute; left: ${mx + x * scale}px; top: ${my + y * scale}px; width: ${w * scale}px; height: ${h * scale}px; background: ${colors[screenName]}; border: 2px solid ${borderColors[screenName]}; display: flex; align-items: center; justify-content: center; color: #fff; font-size: ${Math.max(10, 12)}px; text-shadow: 1px 1px 2px #000; box-sizing: border-box; border-radius: 3px; ${cursorStyle}">
                ${label}
                ${isCustom ? `
                    <div class="resize-handle se" data-screen="${screenName}" style="position: absolute; right: -4px; bottom: -4px; width: 8px; height: 8px; background: #fff; border: 1px solid #000; cursor: se-resize; border-radius: 2px;"></div>
                ` : ''}
            </div>
        `);
    });
};

PupPackManagerPage.saveLayout = async function() {
    const table = this.state.selectedTable;
    if (!table) return;

    const payload = { screens: [] };

    // Backglass
    const bgEnabled = document.getElementById('pup-enable-Backglass')?.checked;
    const bgMonitor = this.state.resolvedMonitor_Backglass;
    if (bgEnabled && bgMonitor) {
        payload.screens.push({
            screen: 'Backglass', enable: 1,
            monitor_index: bgMonitor.index,
            x: parseFloat(document.getElementById('pup-x-Backglass').value) || 0,
            y: parseFloat(document.getElementById('pup-y-Backglass').value) || 0,
            width: parseFloat(document.getElementById('pup-w-Backglass').value) || 0,
            height: parseFloat(document.getElementById('pup-h-Backglass').value) || 0,
            monitor_width: bgMonitor.width,
            monitor_height: bgMonitor.height
        });
    } else {
        payload.screens.push({ screen: 'Backglass', enable: 0, monitor_index: 0, x: 0, y: 0, width: 0, height: 0, monitor_width: 0, monitor_height: 0 });
    }

    // DMD + FullDMD (merged — same values for both)
    const dmdEnabled = document.getElementById('pup-enable-DMD')?.checked;
    const dmdMonitor = this.state.resolvedMonitor_DMD;
    if (dmdEnabled && dmdMonitor) {
        const dmdConfig = {
            enable: 1,
            monitor_index: dmdMonitor.index,
            x: parseFloat(document.getElementById('pup-x-DMD').value) || 0,
            y: parseFloat(document.getElementById('pup-y-DMD').value) || 0,
            width: parseFloat(document.getElementById('pup-w-DMD').value) || 0,
            height: parseFloat(document.getElementById('pup-h-DMD').value) || 0,
            monitor_width: dmdMonitor.width,
            monitor_height: dmdMonitor.height
        };
        payload.screens.push({ screen: 'DMD', ...dmdConfig });
        payload.screens.push({ screen: 'FullDMD', ...dmdConfig });
    } else {
        payload.screens.push({ screen: 'DMD', enable: 0, monitor_index: 0, x: 0, y: 0, width: 0, height: 0, monitor_width: 0, monitor_height: 0 });
        payload.screens.push({ screen: 'FullDMD', enable: 0, monitor_index: 0, x: 0, y: 0, width: 0, height: 0, monitor_width: 0, monitor_height: 0 });
    }

    try {
        const res = await fetch(`/api/puppacks/${table.id}/ini-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            Toast.success('PuP Screen Layout saved successfully.');

            // Automatically enable in VBS if setting exists, is currently disabled, and at least one screen is enabled
            const anyEnabled = payload.screens.some(s => s.enable === 1);
            if (anyEnabled && this.state.vbsStatus && this.state.vbsStatus.has_puppack_setting && !this.state.vbsStatus.puppack_enabled) {
                await this.toggleVbs(true);
            }

            this.closeLayoutPanel();
            this.selectTable(table.id);
        } else {
            const err = await res.json();
            Toast.error(err.detail || 'Failed to save layout.');
        }
    } catch (e) {
        Toast.error('Network error while saving layout.');
    }
};


PupPackManagerPage.initDragDrop = function() {
    const workspace = document.getElementById('pup-preview-workspace');
    if (!workspace || this.dragDropInitialized) return;
    this.dragDropInitialized = true;

    let isDragging = false;
    let isResizing = false;
    let currentScreen = null;
    let startX, startY;
    let startLeft, startTop, startWidth, startHeight;

    workspace.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            isResizing = true;
            currentScreen = e.target.getAttribute('data-screen');
        } else if (e.target.classList.contains('pup-preview-box')) {
            currentScreen = e.target.getAttribute('data-screen');
            if (document.getElementById(`pup-preset-${currentScreen}`).value !== 'custom') {
                return;
            }
            isDragging = true;
        } else {
            return;
        }

        e.preventDefault();

        startX = e.clientX;
        startY = e.clientY;

        startLeft = parseFloat(document.getElementById(`pup-x-${currentScreen}`).value) || 0;
        startTop = parseFloat(document.getElementById(`pup-y-${currentScreen}`).value) || 0;
        startWidth = parseFloat(document.getElementById(`pup-w-${currentScreen}`).value) || 0;
        startHeight = parseFloat(document.getElementById(`pup-h-${currentScreen}`).value) || 0;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging && !isResizing) return;
        if (!currentScreen) return;

        // Calculate the scale that was applied to the workspace
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

        // Convert pixel movement to native coordinates
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;

        if (isDragging) {
            document.getElementById(`pup-x-${currentScreen}`).value = Math.round(startLeft + dx);
            document.getElementById(`pup-y-${currentScreen}`).value = Math.round(startTop + dy);
        } else if (isResizing) {
            document.getElementById(`pup-w-${currentScreen}`).value = Math.max(10, Math.round(startWidth + dx));
            document.getElementById(`pup-h-${currentScreen}`).value = Math.max(10, Math.round(startHeight + dy));
        }

        // Clamp to monitor bounds
        PupPackManagerPage.clampValues(currentScreen);

        PupPackManagerPage.updatePreview();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        currentScreen = null;
    });
};
