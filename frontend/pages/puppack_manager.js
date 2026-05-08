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

// Add modal HTML to index.html or inject it dynamically
PupPackManagerPage.injectModal = function() {
    if (document.getElementById('puppack-layout-modal')) return;
    const modalHtml = `
    <div id="puppack-layout-modal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 900px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>Configure PuP Screen Layout</h2>
                <button class="btn-icon" onclick="PupPackManagerPage.closeLayoutModal()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">

                <!-- Visual Preview Area -->
                <div id="pup-preview-container" style="background: #111; border-radius: 8px; border: 1px solid #333; position: relative; overflow: hidden; min-height: 250px; display: flex; justify-content: center; align-items: center; padding: 1rem;">
                    <div id="pup-preview-workspace" style="position: relative; transform-origin: top left;">
                        <!-- Monitors and Screen boxes injected here -->
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1rem;" id="pup-screen-controls">
                    <!-- Controls injected here -->
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; background: var(--bg-tertiary); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 1rem;">
                <button class="btn btn-secondary" onclick="PupPackManagerPage.closeLayoutModal()">Cancel</button>
                <button class="btn btn-primary" onclick="PupPackManagerPage.saveLayout()">Save Configuration</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
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
            Toast.success(`PuP Pack ${enable ? 'enabled' : 'disabled'} in VBS file.`);
            this.state.vbsStatus.puppack_enabled = enable;
        } else {
            const err = await res.json();
            Toast.error(err.detail || "Failed to toggle VBS");
            document.getElementById('puppack-vbs-toggle').checked = !enable; // revert
        }
    } catch (e) {
        Toast.error("Error communicating with server.");
        document.getElementById('puppack-vbs-toggle').checked = !enable; // revert
    }
};

PupPackManagerPage.openLayoutModal = async function() {
    this.injectModal();

    // Fetch global displays to build the workspace and dropdowns
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        this.state.globalDisplays = settings.displays || [];
    } catch(e) {
        Toast.error("Failed to load display settings.");
        return;
    }

    this.renderLayoutModal();
    document.getElementById('puppack-layout-modal').style.display = 'flex';
};

PupPackManagerPage.closeLayoutModal = function() {
    document.getElementById('puppack-layout-modal').style.display = 'none';
};

PupPackManagerPage.renderLayoutModal = function() {
    // We care about specific screens: Backglass, DMD, FullDMD
    const screens = ['Backglass', 'DMD', 'FullDMD'];

    const controlsContainer = document.getElementById('pup-screen-controls');
    controlsContainer.innerHTML = '';

    screens.forEach(screenName => {
        const prefix = `pup${screenName.toLowerCase()}`;
        const isEnabled = this.state.iniConfig[`${prefix}window`] === 1;
        const mappedMonitor = this.state.iniConfig[`${prefix}screen`] || 0;

        // Find if they have a global monitor mapped to this role
        let defaultMonitorIndex = mappedMonitor;
        if (!mappedMonitor) {
             const globalMatch = this.state.globalDisplays.find(d => d.role === screenName);
             if (globalMatch && globalMatch.index !== undefined) {
                 defaultMonitorIndex = globalMatch.index;
             }
        }

        const monitorOptions = this.state.globalDisplays.map(d =>
            `<option value="${d.index}" ${d.index == defaultMonitorIndex ? 'selected' : ''}>Monitor ${d.index} (${d.width}x${d.height}) - ${d.role || 'Unassigned'}</option>`
        ).join('');

        const html = `
            <div class="card" style="margin: 0; padding: 1rem; background: var(--bg-surface); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <label class="switch" style="margin: 0;">
                            <input type="checkbox" id="pup-enable-${screenName}" ${isEnabled ? 'checked' : ''} onchange="PupPackManagerPage.updatePreview()">
                            <span class="slider round"></span>
                        </label>
                        <h4 style="margin: 0; font-size: 1.1rem;">${screenName}</h4>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start;">
                    <div>
                        <label class="input-label">Assign to Monitor</label>
                        <select class="input-field" id="pup-monitor-${screenName}" onchange="PupPackManagerPage.applyPreset('${screenName}')">
                            <option value="">Select Monitor...</option>
                            ${monitorOptions}
                        </select>
                    </div>
                    <div>
                        <label class="input-label">Layout Preset</label>
                        <select class="input-field" id="pup-preset-${screenName}" onchange="PupPackManagerPage.applyPreset('${screenName}')">
                            <option value="fill">Fill Monitor</option>
                            <option value="center">Center (Keep Ratio)</option>
                            <option value="bottom">Bottom Half</option>
                            <option value="custom">Custom (Manual Math)</option>
                        </select>
                    </div>
                </div>

                <div id="pup-custom-${screenName}" style="display: none; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color);">
                    <div><label class="input-label" style="font-size:0.75rem;">X</label><input type="number" class="input-field" id="pup-x-${screenName}" value="${this.state.iniConfig[`${prefix}windowx`] || 0}" oninput="PupPackManagerPage.updatePreview()"></div>
                    <div><label class="input-label" style="font-size:0.75rem;">Y</label><input type="number" class="input-field" id="pup-y-${screenName}" value="${this.state.iniConfig[`${prefix}windowy`] || 0}" oninput="PupPackManagerPage.updatePreview()"></div>
                    <div><label class="input-label" style="font-size:0.75rem;">Width</label><input type="number" class="input-field" id="pup-w-${screenName}" value="${this.state.iniConfig[`${prefix}windowwidth`] || 0}" oninput="PupPackManagerPage.updatePreview()"></div>
                    <div><label class="input-label" style="font-size:0.75rem;">Height</label><input type="number" class="input-field" id="pup-h-${screenName}" value="${this.state.iniConfig[`${prefix}windowheight`] || 0}" oninput="PupPackManagerPage.updatePreview()"></div>
                </div>
            </div>
        `;
        controlsContainer.insertAdjacentHTML('beforeend', html);

        // Initial setup for this screen to hide/show custom and calculate if it's default
        if (isEnabled) {
            this.applyPreset(screenName, true); // true = initial render, don't overwrite if custom
        }
    });
    this.initDragDrop();

    this.updatePreview();
};

PupPackManagerPage.applyPreset = function(screenName, isInitial = false) {
    const preset = document.getElementById(`pup-preset-${screenName}`).value;
    const customDiv = document.getElementById(`pup-custom-${screenName}`);
    const monitorIdx = document.getElementById(`pup-monitor-${screenName}`).value;

    if (preset === 'custom') {
        customDiv.style.display = 'grid';
        this.updatePreview();
        return;
    } else {
        customDiv.style.display = 'none';
    }

    if (!monitorIdx || monitorIdx === "") return;

    const monitor = this.state.globalDisplays.find(d => d.index == monitorIdx);
    if (!monitor) return;

    // Use unscaled native width/height of the monitor for the math
    const mw = monitor.width;
    const mh = monitor.height;

    let x = 0, y = 0, w = mw, h = mh;

    if (preset === 'fill') {
        // x=0, y=0, w=mw, h=mh
    } else if (preset === 'center') {
        // Assume 16:9 for most PuP videos
        const targetRatio = 16 / 9;
        const monitorRatio = mw / mh;

        if (monitorRatio > targetRatio) {
            // Monitor is wider than 16:9 (e.g. ultrawide), pillarbox (bars on sides)
            w = mh * targetRatio;
            h = mh;
            x = (mw - w) / 2;
            y = 0;
        } else {
            // Monitor is narrower/taller (e.g. 4:3), letterbox (bars top/bottom)
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

    // Only overwrite values if it's NOT the initial render, OR if the initial render values are empty/0
    const prefix = `pup${screenName.toLowerCase()}`;
    const hasValues = this.state.iniConfig[`${prefix}windowwidth`] > 0;

    if (!isInitial || !hasValues) {
        document.getElementById(`pup-x-${screenName}`).value = Math.round(x);
        document.getElementById(`pup-y-${screenName}`).value = Math.round(y);
        document.getElementById(`pup-w-${screenName}`).value = Math.round(w);
        document.getElementById(`pup-h-${screenName}`).value = Math.round(h);
    } else {
        // If it HAS values and it's initial, force it to 'custom' preset to show the existing math
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

    if (totalW === 0 || totalH === 0) return;

    // Scale workspace to fit container
    const container = document.getElementById('pup-preview-container');
    const scaleX = (container.clientWidth - 40) / totalW;
    const scaleY = (container.clientHeight - 40) / totalH;
    const scale = Math.min(scaleX, scaleY, 0.2); // Cap scale so it doesn't get huge

    workspace.style.width = `${totalW}px`;
    workspace.style.height = `${totalH}px`;
    workspace.style.transform = `scale(${scale})`;

    // 2. Draw monitors
    this.state.globalDisplays.forEach(d => {
        const mx = (d.x || 0) - minX;
        const my = (d.y || 0) - minY;

        workspace.insertAdjacentHTML('beforeend', `
            <div style="position: absolute; left: ${mx}px; top: ${my}px; width: ${d.width}px; height: ${d.height}px; border: 4px solid #555; background: #222; display: flex; align-items: center; justify-content: center; color: #666; font-size: ${40/scale}px; font-weight: bold;">
                M${d.index}
            </div>
        `);
    });

    // 3. Draw enabled screens
    const colors = {
        'Backglass': 'rgba(59, 130, 246, 0.6)', // Blue
        'DMD': 'rgba(239, 68, 68, 0.6)',       // Red
        'FullDMD': 'rgba(16, 185, 129, 0.6)'    // Green
    };

    ['Backglass', 'DMD', 'FullDMD'].forEach(screenName => {
        if (!document.getElementById(`pup-enable-${screenName}`)?.checked) return;

        const monitorIdx = document.getElementById(`pup-monitor-${screenName}`).value;
        const monitor = this.state.globalDisplays.find(d => d.index == monitorIdx);
        if (!monitor) return;

        const mx = (monitor.x || 0) - minX;
        const my = (monitor.y || 0) - minY;

        const x = parseFloat(document.getElementById(`pup-x-${screenName}`).value) || 0;
        const y = parseFloat(document.getElementById(`pup-y-${screenName}`).value) || 0;
        const w = parseFloat(document.getElementById(`pup-w-${screenName}`).value) || 0;
        const h = parseFloat(document.getElementById(`pup-h-${screenName}`).value) || 0;


        const isCustom = document.getElementById(`pup-preset-${screenName}`).value === 'custom';
        const cursorStyle = isCustom ? 'cursor: move;' : '';

        workspace.insertAdjacentHTML('beforeend', `
            <div id="pup-preview-box-${screenName}"
                 class="pup-preview-box"
                 data-screen="${screenName}"
                 style="position: absolute; left: ${mx + x}px; top: ${my + y}px; width: ${w}px; height: ${h}px; background: ${colors[screenName]}; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; color: #fff; font-size: ${24/scale}px; text-shadow: 1px 1px 2px #000; box-sizing: border-box; ${cursorStyle}">
                ${screenName}
                ${isCustom ? `
                    <div class="resize-handle se" data-screen="${screenName}" style="position: absolute; right: -5px; bottom: -5px; width: 10px; height: 10px; background: #fff; border: 1px solid #000; cursor: se-resize;"></div>
                ` : ''}
            </div>
        `);

    });
};

PupPackManagerPage.saveLayout = async function() {
    const table = this.state.selectedTable;
    if (!table) return;

    const payload = {
        screens: []
    };

    ['Backglass', 'DMD', 'FullDMD'].forEach(screenName => {
        const enabled = document.getElementById(`pup-enable-${screenName}`).checked;
        if (enabled) {
            payload.screens.push({
                screen: screenName,
                enable: 1,
                monitor_index: parseInt(document.getElementById(`pup-monitor-${screenName}`).value) || 0,
                x: parseFloat(document.getElementById(`pup-x-${screenName}`).value) || 0,
                y: parseFloat(document.getElementById(`pup-y-${screenName}`).value) || 0,
                width: parseFloat(document.getElementById(`pup-w-${screenName}`).value) || 0,
                height: parseFloat(document.getElementById(`pup-h-${screenName}`).value) || 0
            });
        } else {
            payload.screens.push({
                screen: screenName,
                enable: 0,
                monitor_index: 0, x: 0, y: 0, width: 0, height: 0
            });
        }
    });

    try {
        const res = await fetch(`/api/puppacks/${table.id}/ini-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            Toast.success('PuP Screen Layout saved successfully.');
            this.closeLayoutModal();
            // Refresh to update local cache
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
    let containerScale = 1;

    workspace.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle')) {
            isResizing = true;
            currentScreen = e.target.getAttribute('data-screen');
        } else if (e.target.classList.contains('pup-preview-box')) {
            currentScreen = e.target.getAttribute('data-screen');
            if (document.getElementById(`pup-preset-${currentScreen}`).value !== 'custom') {
                return; // Only drag if custom
            }
            isDragging = true;
        } else {
            return;
        }

        e.preventDefault();

        // Calculate scale
        const transform = workspace.style.transform;
        const scaleMatch = transform.match(/scale\(([^)]+)\)/);
        containerScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

        startX = e.clientX;
        startY = e.clientY;

        const monitorIdx = document.getElementById(`pup-monitor-${currentScreen}`).value;
        const monitor = this.state.globalDisplays.find(d => d.index == monitorIdx);

        let minX = 0, minY = 0;
        this.state.globalDisplays.forEach(d => {
            if ((d.x||0) < minX) minX = d.x||0;
            if ((d.y||0) < minY) minY = d.y||0;
        });

        const mx = (monitor.x || 0) - minX;
        const my = (monitor.y || 0) - minY;

        startLeft = parseFloat(document.getElementById(`pup-x-${currentScreen}`).value) || 0;
        startTop = parseFloat(document.getElementById(`pup-y-${currentScreen}`).value) || 0;
        startWidth = parseFloat(document.getElementById(`pup-w-${currentScreen}`).value) || 0;
        startHeight = parseFloat(document.getElementById(`pup-h-${currentScreen}`).value) || 0;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging && !isResizing) return;
        if (!currentScreen) return;

        const dx = (e.clientX - startX) / containerScale;
        const dy = (e.clientY - startY) / containerScale;

        if (isDragging) {
            document.getElementById(`pup-x-${currentScreen}`).value = Math.round(startLeft + dx);
            document.getElementById(`pup-y-${currentScreen}`).value = Math.round(startTop + dy);
        } else if (isResizing) {
            document.getElementById(`pup-w-${currentScreen}`).value = Math.max(10, Math.round(startWidth + dx));
            document.getElementById(`pup-h-${currentScreen}`).value = Math.max(10, Math.round(startHeight + dy));
        }

        PupPackManagerPage.updatePreview();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
        currentScreen = null;
    });
};
