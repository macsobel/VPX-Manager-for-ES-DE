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

            <div class="layout-split">
                <!-- Left Sidebar: Table List -->
                <div class="sidebar-panel">
                    <div class="sidebar-header" style="position: sticky; top: 0; background: var(--glass-bg); padding: 1.5rem; border-bottom: 1px solid var(--glass-border); z-index: 10; border-radius: 12px 12px 0 0; backdrop-filter: blur(12px);">
                        <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;">Tables with PUP Packs</h3>
                        <div class="search-box" style="margin-bottom: 0;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="puppack-search" placeholder="Search tables..." onkeyup="PupPackManagerPage.filterTables(this.value)">
                        </div>
                    </div>
                    <div class="table-list-compact" id="puppack-table-list" style="padding: 1rem; max-height: calc(100vh - 300px); overflow-y: auto;">
                        <div class="empty-state">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>

                <!-- Right Panel: Editor / Controls -->
                <div class="main-panel" id="puppack-main-panel">
                    <div class="empty-state" style="height: 100%; display: flex; flex-direction: column; justify-content: center;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        <h3 style="margin:0 0 0.5rem 0;">Select a Table</h3>
                        <p style="color: var(--text-secondary); max-width: 300px; margin: 0 auto;">Choose a table from the list to view and apply PUP Pack screen configurations.</p>
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

    filterTables(query) {
        query = query.toLowerCase();
        const items = document.querySelectorAll('.table-list-item');
        items.forEach(item => {
            const name = item.dataset.name.toLowerCase();
            if (name.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    renderTableList() {
        const list = document.getElementById('puppack-table-list');
        if (!this.state.tables || this.state.tables.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding: 3rem 1rem;">
                    <p>No PUP Packs detected.</p>
                    <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.5rem;">Upload a .zip PUP Pack to a table to see it here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.state.tables.map(t => `
            <div class="table-list-item" data-id="${t.id}" data-name="${this.escHtml(t.name || t.filename)}" onclick="PupPackManagerPage.selectTable(${t.id})">
                <div class="info">
                    <div class="name">${this.escHtml(t.name || t.filename)}</div>
                    <div class="file" style="font-family: monospace; font-size: 0.75rem; color: var(--text-tertiary);">${this.escHtml(t.filename)}</div>
                </div>
                <div class="status-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </div>
            </div>
        `).join('');
    },

    async selectTable(id) {
        document.querySelectorAll('.table-list-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.table-list-item[data-id="${id}"]`);
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

        if (!options || options.length === 0) {
            panel.innerHTML = `
                <div class="editor-header">
                    <h2>${this.escHtml(t.name || t.filename)}</h2>
                    <p class="editor-subtitle">pupvideos/${this.escHtml(pupDir)}/</p>
                </div>
                <div class="empty-state" style="margin: 2rem;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.5;">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>No automatic setup scripts (.bat files) found.</p>
                    <p style="font-size: 0.8rem; color: var(--text-tertiary); max-width: 300px; margin: 1rem auto 0 auto;">This PUP Pack may not require configuration, or it requires manual setup by editing screens.pup.</p>
                </div>
            `;
            return;
        }

        panel.innerHTML = `
            <div class="editor-header" style="border-bottom: 1px solid var(--glass-border); padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
                <h2 style="margin: 0 0 0.5rem 0;">${this.escHtml(t.name || t.filename)}</h2>
                <p class="editor-subtitle" style="margin: 0; color: var(--text-tertiary); font-family: monospace;">pupvideos/${this.escHtml(pupDir)}/</p>
            </div>

            <div style="padding: 0 2rem;">
                <h3 style="margin-bottom: 1rem; font-size: 1.1rem;">Available Configurations</h3>
                <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size: 0.9rem;">Select a screen layout or configuration option below. This will copy the appropriate screens.pup and other files into place.</p>

                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                    ${options.map(opt => `
                        <div class="config-card" style="background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
                            <div>
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">${this.escHtml(opt.name)}</h4>
                                <div style="font-family: monospace; font-size: 0.75rem; color: var(--text-tertiary);">${this.escHtml(opt.file)}</div>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="PupPackManagerPage.applyOption('${opt.file}')">
                                Apply Layout
                            </button>
                        </div>
                    `).join('')}
                </div>
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
