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
            const res = await fetch(`/api/puppacks/${id}/options`);
            const data = await res.json();

            this.renderOptions(data.options, data.pup_dir);
        } catch (e) {
            console.error('Failed to load PUP Pack options:', e);
            panel.innerHTML = `
                <div class="empty-state">
                    <p style="color: var(--danger);">Failed to load configuration options.</p>
                </div>
            `;
        }
    },

    renderOptions(options, pupDir) {
        const panel = document.getElementById('puppack-main-panel');
        const t = this.state.selectedTable;

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
                    ${options.map(opt => `
                        <div class="card" style="margin: 0; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); transition: all var(--transition-fast);">
                            <div class="card-body" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; height: 100%;">
                                <div>
                                    <h4 style="margin: 0 0 0.25rem 0; color: var(--text-primary); font-size: 1rem;">${this.escHtml(opt.name)}</h4>
                                    <div style="font-family: monospace; font-size: 0.72rem; color: var(--text-tertiary);">${this.escHtml(opt.file)}</div>
                                </div>
                                <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center;" onclick="PupPackManagerPage.applyOption('${opt.file}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Apply Configuration
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        panel.innerHTML = `
            <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="mobile-back-btn" onclick="PupPackManagerPage.closeDetail()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">${this.escHtml(t.name || t.filename)}</h2>
                        <div style="color: var(--text-secondary); font-size: 0.85rem; font-family: monospace;">pupvideos/${this.escHtml(pupDir)}/</div>
                    </div>
                </div>
            </div>

            <div style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--text-primary);">Available Configurations</h3>
                <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.9rem; line-height: 1.5;">Select a screen layout or configuration option below. This will automatically simulate the Windows batch file logic to set up your PUP Pack.</p>
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
