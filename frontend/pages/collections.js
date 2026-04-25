/* ═══════════════════════════════════════════════════════════
   Collections Page
   ═══════════════════════════════════════════════════════════ */

const CollectionsPage = {
    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h1 class="page-title">Collections</h1>
                        <p class="page-subtitle">Organize your tables into custom collections</p>
                    </div>
                    <button class="btn btn-primary" id="btn-new-collection">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        New Collection
                    </button>
                </div>
            </div>
            <div id="collections-content">
                <div style="text-align: center; padding: var(--space-xl);"><div class="spinner"></div></div>
            </div>
        `;

        this.loadCollections();
        this.bindEvents();
    },

    async loadCollections() {
        try {
            const res = await fetch('/api/collections');
            const data = await res.json();
            this.renderCollections(data.collections);
        } catch (e) {
            document.getElementById('collections-content').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">Could not load collections</div>
                </div>
            `;
        }
    },

    renderCollections(collections) {
        const content = document.getElementById('collections-content');
        if (!collections.length) {
            content.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                    <div class="empty-state-title">No collections yet</div>
                    <div class="empty-state-desc">Create a collection to organize your tables</div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="collection-cards-grid">
                ${collections.map((c, i) => `
                    <div class="collection-card" data-id="${c.id}" style="animation: slideUp var(--transition-slow) ${i * 50}ms both;">
                        <div class="collection-card-actions">
                            <button class="btn-icon btn-edit-collection" data-id="${c.id}" title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                            <button class="btn-icon btn-delete-collection" data-id="${c.id}" title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                        </div>
                        <div class="collection-card-name">${this.escHtml(c.name)}</div>
                        <div class="collection-card-desc">${this.escHtml(c.description || 'No description')}</div>
                        <div class="collection-card-count">${c.table_count || 0}</div>
                        <div class="collection-card-count-label">tables</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Click to view collection
        content.querySelectorAll('.collection-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button')) return;
                this.showCollectionDetail(parseInt(card.dataset.id));
            };
        });

        // Edit
        content.querySelectorAll('.btn-edit-collection').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showEditModal(parseInt(btn.dataset.id));
            };
        });

        // Delete
        content.querySelectorAll('.btn-delete-collection').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                Modal.confirm('Delete Collection', 'Are you sure you want to delete this collection? Tables will not be removed.', async () => {
                    try {
                        await fetch(`/api/collections/${id}`, { method: 'DELETE' });
                        Toast.success('Collection deleted');
                        this.loadCollections();
                    } catch (e) {
                        Toast.error('Failed to delete: ' + e.message);
                    }
                });
            };
        });
    },

    async showCollectionDetail(collectionId) {
        try {
            const res = await fetch(`/api/collections/${collectionId}`);
            const data = await res.json();

            const tablesHtml = data.tables && data.tables.length
                ? `<div class="data-table-wrapper" style="margin-top: var(--space-md);">
                    <table class="data-table">
                        <thead><tr><th>Table</th><th>Manufacturer</th><th>Year</th><th></th></tr></thead>
                        <tbody>
                            ${data.tables.map(t => `
                                <tr>
                                    <td style="font-weight: 600; color: var(--text-primary);">${this.escHtml(t.display_name)}</td>
                                    <td>${t.manufacturer || '—'}</td>
                                    <td>${t.year || '—'}</td>
                                    <td>
                                        <button class="btn-icon btn-remove-from-collection" data-table-id="${t.id}" data-collection-id="${collectionId}" title="Remove">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`
                : '<div style="color: var(--text-muted); text-align: center; padding: var(--space-lg);">No tables in this collection</div>';

            Modal.show(`
                <h3 class="modal-title">${this.escHtml(data.name)}</h3>
                <p style="color: var(--text-tertiary); font-size: 0.85rem; margin-bottom: var(--space-md);">
                    ${this.escHtml(data.description || 'No description')} · ${data.table_count || 0} tables
                </p>
                ${tablesHtml}
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="Modal.hide()">Close</button>
                    <button class="btn btn-primary" id="btn-add-to-collection" data-id="${collectionId}">Add Tables</button>
                </div>
            `);

            // Remove from collection
            document.querySelectorAll('.btn-remove-from-collection').forEach(btn => {
                btn.onclick = async () => {
                    try {
                        await fetch(`/api/collections/${btn.dataset.collectionId}/tables/${btn.dataset.tableId}`, { method: 'DELETE' });
                        Toast.success('Table removed from collection');
                        Modal.hide();
                        this.showCollectionDetail(collectionId);
                        this.loadCollections();
                    } catch (e) {
                        Toast.error('Failed: ' + e.message);
                    }
                };
            });

            // Add tables
            document.getElementById('btn-add-to-collection').onclick = () => {
                Modal.hide();
                this.showAddTablesModal(collectionId);
            };
        } catch (e) {
            Toast.error('Failed to load collection: ' + e.message);
        }
    },

    async showAddTablesModal(collectionId) {
        try {
            const res = await fetch('/api/tables?limit=200');
            const data = await res.json();

            Modal.show(`
                <h3 class="modal-title">Add Tables to Collection</h3>
                <div class="input-group">
                    <input class="input-field" id="add-table-search" placeholder="Search tables...">
                </div>
                <div id="add-table-list" style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-xs);">
                    ${data.tables.map(t => `
                        <label style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); cursor: pointer; transition: background var(--transition-fast);" class="add-table-row" data-name="${t.display_name.toLowerCase()}">
                            <input type="checkbox" value="${t.id}" style="accent-color: var(--accent-blue);">
                            <span style="font-size: 0.9rem; color: var(--text-primary);">${this.escHtml(t.display_name)}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                    <button class="btn btn-primary" id="btn-confirm-add-tables">Add Selected</button>
                </div>
            `);

            // Search filter
            document.getElementById('add-table-search').oninput = (e) => {
                const q = e.target.value.toLowerCase();
                document.querySelectorAll('.add-table-row').forEach(row => {
                    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
                });
            };

            // Confirm
            document.getElementById('btn-confirm-add-tables').onclick = async () => {
                const checked = [...document.querySelectorAll('#add-table-list input:checked')];
                const tableIds = checked.map(cb => parseInt(cb.value));
                if (!tableIds.length) {
                    Toast.warning('No tables selected');
                    return;
                }
                try {
                    await fetch(`/api/collections/${collectionId}/tables`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ table_ids: tableIds }),
                    });
                    Toast.success(`Added ${tableIds.length} tables to collection`);
                    Modal.hide();
                    this.loadCollections();
                } catch (e) {
                    Toast.error('Failed: ' + e.message);
                }
            };
        } catch (e) {
            Toast.error('Failed to load tables: ' + e.message);
        }
    },

    showCreateModal() {
        Modal.show(`
            <h3 class="modal-title">New Collection</h3>
            <div class="input-group">
                <label class="input-label">Name</label>
                <input class="input-field" id="new-collection-name" placeholder="e.g., Favorites, 90s Tables">
            </div>
            <div class="input-group">
                <label class="input-label">Description</label>
                <textarea class="input-field" id="new-collection-desc" rows="3" placeholder="Optional description..."></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                <button class="btn btn-primary" id="btn-create-collection">Create</button>
            </div>
        `);

        document.getElementById('btn-create-collection').onclick = async () => {
            const name = document.getElementById('new-collection-name').value.trim();
            if (!name) {
                Toast.warning('Name is required');
                return;
            }
            try {
                await fetch('/api/collections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        description: document.getElementById('new-collection-desc').value,
                    }),
                });
                Toast.success(`Created collection "${name}"`);
                Modal.hide();
                this.loadCollections();
            } catch (e) {
                Toast.error('Failed to create: ' + e.message);
            }
        };
    },

    async showEditModal(collectionId) {
        try {
            const res = await fetch(`/api/collections/${collectionId}`);
            const data = await res.json();

            Modal.show(`
                <h3 class="modal-title">Edit Collection</h3>
                <div class="input-group">
                    <label class="input-label">Name</label>
                    <input class="input-field" id="edit-collection-name" value="${this.escHtml(data.name)}">
                </div>
                <div class="input-group">
                    <label class="input-label">Description</label>
                    <textarea class="input-field" id="edit-collection-desc" rows="3">${this.escHtml(data.description || '')}</textarea>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-collection">Save</button>
                </div>
            `);

            document.getElementById('btn-save-collection').onclick = async () => {
                try {
                    await fetch(`/api/collections/${collectionId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: document.getElementById('edit-collection-name').value,
                            description: document.getElementById('edit-collection-desc').value,
                        }),
                    });
                    Toast.success('Collection updated');
                    Modal.hide();
                    this.loadCollections();
                } catch (e) {
                    Toast.error('Failed to save: ' + e.message);
                }
            };
        } catch (e) {
            Toast.error('Failed to load collection: ' + e.message);
        }
    },

    bindEvents() {
        document.getElementById('btn-new-collection').onclick = () => this.showCreateModal();
    },

    escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};
