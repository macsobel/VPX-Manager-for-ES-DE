/* ═══════════════════════════════════════════════════════════
   VBS Manager Page
   ═══════════════════════════════════════════════════════════ */

const VbsManagerPage = {
    state: {
        tables: [],
        selectedTable: null,
        pollingInterval: null,
        editor: null,
        originalContent: "",
        proposedContent: ""
    },

    async render(tableId = null) {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 class="page-title">VBS Manager</h1>
                    <p class="page-subtitle">Extract, patch, and edit table scripts for Standalone</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div id="patch-summary-badge" class="vbs-patch-summary" onclick="VbsManagerPage.openPatchManager()">
                        <div class="vbs-patch-stat no-border">
                            <span class="label">Patches Available:</span>
                            <span id="vbs-count-available" class="value val-avail">-</span>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="VbsManagerPage.openPatchManager()" title="Manage all standalone patches">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                         Patches
                    </button>
                    <button class="btn btn-primary" id="btn-bulk-extract">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Bulk Extract
                    </button>
                </div>
            </div>

            <!-- Progress Bar Container (Hidden by default) -->
            <div id="bulk-progress-container" style="display: none; margin-bottom: 2rem; background: var(--glass-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border); backdrop-filter: blur(8px);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="spinner-sm" id="bulk-spinner"></div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;" id="bulk-status-label">Synchronizing VBS Scripts...</span>
                    </div>
                    <span id="bulk-progress-text" style="color: var(--text-tertiary); font-variant-numeric: tabular-nums; font-size: 0.85rem; font-weight: 500;">0 / 0</span>
                </div>
                <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-full); overflow: hidden; height: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div id="bulk-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;">
                        <div class="progress-shimmer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
                    </div>
                </div>
            </div>

            <!-- Main Layout: Master List vs Detail -->
            <div class="adaptive-split-layout" id="vbs-workspace">
                <!-- Left: Master List -->
                <div class="adaptive-sidebar">
                    <div style="padding: 1.25rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
                        <div class="search-wrapper">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="vbs-search" class="search-input" placeholder="Search tables...">
                        </div>
                    </div>
                    <div id="vbs-table-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                        <div style="padding: 2rem; text-align: center;">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>

                <!-- Right: Detail Workspace -->
                <div class="adaptive-content" id="vbs-detail-workspace" style="display: none;">
                    <!-- Detail Header -->
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <button class="mobile-back-btn" onclick="VbsManagerPage.closeDetail()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            </button>
                            <div>
                                <h2 id="detail-title" style="margin: 0 0 0.5rem 0; font-size: 1.25rem;">Table Name</h2>
                                <div id="detail-filename" style="color: var(--text-secondary); font-size: 0.85rem; font-family: monospace;">filename.vpx</div>
                            </div>
                        </div>
                        <div id="detail-actions" style="display: flex; gap: 0.5rem;">
                            <!-- Actions injected dynamically based on status -->
                        </div>
                    </div>

                    <!-- Editor Area -->
                    <div id="editor-container" style="flex: 1; position: relative;">
                        <div id="code-editor" style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"></div>
                    </div>

                    <!-- Editor Footer -->
                    <div class="vbs-editor-footer" style="padding: 1rem; border-top: 1px solid var(--border-color); background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div style="display: flex; gap: 0.5rem;" id="quick-fixes-container">
                            <!-- Quick fixes injected dynamically -->
                        </div>
                        <button class="btn btn-primary vbs-save-button-align" id="btn-save-vbs" style="display: none;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            Save Edits
                        </button>
                    </div>
                </div>

                <!-- Empty State for Detail (Desktop Only) -->
                <div id="vbs-detail-empty" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); color: var(--text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <div>Select a table to manage its VBScript</div>
                </div>
            </div>

            <!-- Patch Manager Slide-out Panel -->
            <div class="detail-panel" id="patch-manager-panel">
                <div class="detail-panel-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                         <div style="width: 32px; height: 32px; background: rgba(79, 140, 255, 0.12); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                         </div>
                         <h3 class="card-title" style="margin: 0; font-size: 1.1rem;">Table Patch Manager</h3>
                    </div>
                    <button class="btn-icon" onclick="VbsManagerPage.closePatchManager()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="detail-panel-body" id="patch-manager-body">
                    <!-- Content will be injected here -->
                </div>
            </div>
        `;


        // Load Ace Editor script dynamically if not present
        if (!window.ace) {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.7/ace.js";
            script.onload = () => {
                this.initEditor();
            };
            document.head.appendChild(script);
        } else {
            this.initEditor();
        }

        this.bindEvents();
        this.loadTables().then(() => {
            if (tableId) this.selectTable(tableId);
        });
        this.loadPatchStats(); // Load patching statistics
        this.startStatusPolling(); // Check for ongoing bulk extraction
    },

    initEditor() {
        if (!document.getElementById('code-editor')) return;
        this.state.editor = ace.edit("code-editor");
        this.state.editor.setTheme("ace/theme/tomorrow_night_eighties");
        this.state.editor.session.setMode("ace/mode/vbscript");
        this.state.editor.setOptions({
            fontSize: "14px",
            showPrintMargin: false,
            useSoftTabs: true,
            wrap: true
        });
    },

    bindEvents() {
        document.getElementById('vbs-search').addEventListener('input', (e) => {
            this.renderTableList(e.target.value);
        });

        document.getElementById('btn-bulk-extract').addEventListener('click', async () => {
            await this.performFullSync();
        });

        document.getElementById('btn-save-vbs').addEventListener('click', async () => {
            if (!this.state.selectedTable) return;
            const content = this.state.editor.getValue();

            try {
                const res = await fetch(`/api/vbs-manager/${this.state.selectedTable.table_id}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vbs_content: content })
                });

                if (res.ok) {
                    Toast.success('VBS file saved successfully');
                } else {
                    const data = await res.json();
                    Toast.error(data.detail || 'Failed to save');
                }
            } catch (e) {
                Toast.error('Save error: ' + e.message);
            }
        });
    },

    async loadTables() {
        try {
            const res = await fetch('/api/vbs-manager/status');
            this.state.tables = await res.json();
            this.renderTableList(document.getElementById('vbs-search')?.value || '');
        } catch (e) {
            Toast.error('Failed to load table VBS status: ' + e.message);
        }
    },

    renderTableList(filter = '') {
        const listContainer = document.getElementById('vbs-table-list');
        const search = filter.toLowerCase();

        const filtered = this.state.tables.filter(t =>
            t.display_name.toLowerCase().includes(search) ||
            t.filename.toLowerCase().includes(search)
        );

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">No tables found.</div>';
            return;
        }

        listContainer.innerHTML = filtered.map(t => {
            const isSelected = this.state.selectedTable && this.state.selectedTable.table_id === t.table_id;
            
            let statusBadge = '';
            if (t.vbs_status === 'Missing') {
                statusBadge = '<span class="badge badge-danger">Missing</span>';
            } else if (t.vbs_status === 'Patched') {
                statusBadge = '<span class="badge badge-success">Patched</span>';
            } else if (t.vbs_status === 'Patch Available') {
                statusBadge = '<span class="badge badge-warning">Patch Available</span>';
            } else {
                statusBadge = '<span class="badge badge-info">Extracted</span>';
            }

            return `
                <div class="vbs-list-item ${isSelected ? 'active' : ''}" onclick="VbsManagerPage.selectTable(${t.table_id})">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div style="font-weight: 600; font-size: 0.95rem; color: ${isSelected ? 'var(--accent-blue)' : 'var(--text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                            ${t.display_name}
                        </div>
                        ${statusBadge}
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); font-family: monospace; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${t.filename}
                    </div>
                </div>
            `;
        }).join('');
    },

    async selectTable(id) {
        // Find basic info
        const tableInfo = this.state.tables.find(t => t.table_id === id);
        if (!tableInfo) return;

        this.state.selectedTable = tableInfo;
        document.getElementById('vbs-workspace')?.classList.add('content-active');
        this.renderTableList(document.getElementById('vbs-search').value); // Update active state

        // Show loading state in detail
        document.getElementById('vbs-detail-empty').style.display = 'none';
        const detailWorkspace = document.getElementById('vbs-detail-workspace');
        detailWorkspace.style.display = 'flex';

        document.getElementById('detail-title').textContent = tableInfo.display_name;
        document.getElementById('detail-filename').textContent = tableInfo.filename;

        if (this.state.editor) {
            this.state.editor.setValue("Loading...", -1);
            this.state.editor.setReadOnly(true);
        }
        document.getElementById('btn-save-vbs').style.display = 'none';
        document.getElementById('detail-actions').innerHTML = '';
        document.getElementById('quick-fixes-container').innerHTML = '';

        try {
            const res = await fetch(`/api/vbs-manager/${id}`);
            const details = await res.json();
            this.renderDetailWorkspace(details);
        } catch (e) {
            Toast.error('Failed to load table details: ' + e.message);
        }
    },

    renderDetailWorkspace(details) {
        const actionsContainer = document.getElementById('detail-actions');
        const quickFixesContainer = document.getElementById('quick-fixes-container');
        const saveBtn = document.getElementById('btn-save-vbs');

        actionsContainer.innerHTML = '';
        quickFixesContainer.innerHTML = '';

        if (!details.is_extracted) {
            if (this.state.editor) {
                this.state.editor.setValue("' No VBS sidecar extracted yet. Click Extract to generate one.", -1);
                this.state.editor.setReadOnly(true);
            }
            saveBtn.style.display = 'none';

            actionsContainer.innerHTML = `
                <button class="btn btn-primary btn-sm" onclick="VbsManagerPage.extractSingle(${details.table_id})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Extract VBS
                </button>
            `;
        } else {
            if (this.state.editor) {
                this.state.editor.setValue(details.vbs_content, -1);
                this.state.editor.setReadOnly(false);
            }
            saveBtn.style.display = 'flex';

            // Build Actions
            let actionsHtml = `
                <button class="btn btn-danger btn-sm" onclick="VbsManagerPage.resetVbs(${details.table_id})" title="Delete sidecar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete VBS
                </button>
            `;

            if (details.vbs_status === 'Patch Available') {
                actionsHtml = `
                    <button class="btn btn-primary btn-sm" onclick="VbsManagerPage.installPatch(${details.table_id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Install Patched VBS
                    </button>
                ` + actionsHtml;
            }
            actionsContainer.innerHTML = actionsHtml;

            // Build Quick Fixes
            let romOptions = '<option value="">Select ROM...</option>';
            if (details.roms && details.roms.length > 0) {
                romOptions += details.roms.map(r => `<option value="${r}">${r}</option>`).join('');
            }

            quickFixesContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); width: 80px;">ROM:</span>
                        <select id="rom-swap-select" class="input-field" style="width: auto; min-width: 150px;" ${details.roms.length <= 1 ? 'disabled title="Only one ROM available"' : ''}>
                            ${romOptions}
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="VbsManagerPage.previewFix(${details.table_id}, 'rom_swap')" ${details.roms.length <= 1 ? 'disabled' : ''}>Swap ROM</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary); width: 80px;">ColorDMD:</span>
                        <button class="btn btn-secondary btn-sm" onclick="VbsManagerPage.previewFix(${details.table_id}, 'colordmd')" 
                            ${details.colordmd_enabled ? 'disabled title="ColorDMD is already enabled"' : (!details.has_colordmd ? 'disabled title="Table script does not explicitly support UseColorDMD setting"' : '')}>
                            ${details.colordmd_enabled ? 'ColorDMD Enabled' : 'Enable ColorDMD'}
                        </button>
                    </div>
                </div>
            `;
        }
    },

    async extractSingle(tableId) {
        try {
            Toast.info('Extracting VBS...', 2000);
            const res = await fetch(`/api/vbs-manager/${tableId}/extract`, { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                Toast.success('Extraction successful');
                
                // Refresh Master List
                await this.loadTables();
                // Refresh Patch Modal stats & list if open
                await this.loadPatchStats();
                if (document.getElementById('patch-manager-panel').classList.contains('open')) {
                    this.renderPatchList();
                }

                this.selectTable(tableId); // Reload workspace
            } else {
                // Show modal for graceful permission error
                if (data.detail && data.detail.includes('Permission denied')) {
                    this.showPermissionError(data.detail);
                } else {
                    Toast.error(data.detail || 'Extraction failed');
                }
            }
        } catch (e) {
            Toast.error('Extraction error: ' + e.message);
        }
    },

    showPermissionError(message) {
        console.log("[v2.2.diag] showPermissionError triggered with:", message);
        // Extract the path from the message to show in the copyable command block
        // The message format is: "... using: xattr -d com.apple.quarantine 'PATH'"
        let path = "/Applications/VPinballX_GL.app";
        const match = message.match(/'([^']+)'/);
        if (match) path = match[1];

        const modalHtml = `
            <div class="modal-header">
                <h2 class="modal-title" style="color: var(--accent-red);">Extraction Failed [v2.2.diag]</h2>
                <button class="modal-close" onclick="Modal.hide()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <p>${message}</p>
                <div style="background: var(--bg-main); padding: 1rem; border-radius: 8px; margin-top: 1rem; font-family: monospace; user-select: all; font-size: 0.85rem;">
                    xattr -rc '${path}'
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="Modal.hide()">Got It</button>
            </div>
        `;
        Modal.show(modalHtml);
    },

    async resetVbs(tableId) {
        Modal.confirm('Delete VBS Sidecar', 'Are you sure you want to delete the sidecar VBS file?', async () => {
            try {
                const res = await fetch(`/api/vbs-manager/${tableId}/reset`, { method: 'DELETE' });
                if (res.ok) {
                    Toast.success('VBS file deleted and hash cleared');
                    
                    // Clear editor immediately
                    if (this.state.editor) {
                        this.state.editor.setValue("' VBS sidecar deleted.", -1);
                        this.state.editor.setReadOnly(true);
                    }

                    // Refresh Master List
                    await this.loadTables();
                    // Refresh Patch Modal stats & list if open
                    await this.loadPatchStats();
                    if (document.getElementById('patch-manager-panel').classList.contains('open')) {
                        this.renderPatchList();
                    }
                    
                    this.selectTable(tableId);
                } else {
                    const data = await res.json();
                    Toast.error('Failed to reset: ' + (data.detail || 'Unknown error'));
                }
            } catch (e) {
                Toast.error('Reset error: ' + e.message);
            }
        });
    },

    async installPatch(table_id) {
        try {
            Toast.info('Downloading and applying verified patch...');
            const res = await fetch(`/api/vbs-manager/${table_id}/install-patch`, { method: 'POST' });
            const data = await res.json();
            
            if (res.ok) {
                Toast.success('Official patch installed successfully');
                
                // Refresh Master List
                await this.loadTables();
                // Refresh Patch Modal stats & list if open
                await this.loadPatchStats();
                if (document.getElementById('patch-manager-panel').classList.contains('open')) {
                    this.renderPatchList();
                }
                
                // Refresh the detail view for the selected table
                await this.selectTable(table_id);
            } else {
                Toast.error(data.detail || 'Failed to install patch');
            }
        } catch (e) {
            Toast.error('Patch installation error: ' + e.message);
        }
    },

    async applyVerifiedPatch(tableId) { // Keeping this as a alias if needed by other components
        return this.installPatch(tableId);
    },

    async previewFix(tableId, fixType) {
        let romName = null;
        if (fixType === 'rom_swap') {
            const select = document.getElementById('rom-swap-select');
            romName = select.value;
            if (!romName) {
                Toast.error('Please select a ROM first');
                return;
            }
        }

        try {
            const res = await fetch(`/api/vbs-manager/${tableId}/diff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fix_type: fixType, rom_name: romName })
            });

            const data = await res.json();

            if (!res.ok) {
                Toast.error(data.detail || 'Failed to generate fix');
                return;
            }

            if (!data.changes_found) {
                Toast.info('No changes needed. Target pattern not found.');
                return;
            }

            this.state.originalContent = data.original_content;
            this.state.proposedContent = data.new_content;
            this.showDiffModal(data.diff_lines, tableId);

        } catch (e) {
            Toast.error('Preview error: ' + e.message);
        }
    },

    showDiffModal(diffLines, tableId) {
        // Build a simple visual diff
        let diffHtml = '';
        diffLines.forEach(line => {
            if (line.startsWith('---') || line.startsWith('+++')) return;

            let bg = 'transparent';
            let color = 'inherit';
            if (line.startsWith('+')) {
                bg = 'rgba(16, 185, 129, 0.15)'; // Green
                color = '#10b981';
            } else if (line.startsWith('-')) {
                bg = 'rgba(239, 68, 68, 0.15)'; // Red
                color = '#ef4444';
            } else if (line.startsWith('@@')) {
                bg = 'var(--bg-main)';
                color = 'var(--text-secondary)';
            }

            // Escape HTML
            const safeLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            diffHtml += `<div style="background: ${bg}; color: ${color}; padding: 0 4px; white-space: pre-wrap; word-break: break-all;">${safeLine}</div>`;
        });

        const modalHtml = `
            <div class="modal-header">
                <h2 class="modal-title">Review Changes</h2>
                <button class="modal-close" onclick="Modal.hide()"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <p style="margin-bottom: 1rem; color: var(--text-secondary);">Review the proposed changes before saving.</p>
                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; font-family: monospace; font-size: 0.85rem; max-height: 400px; overflow-y: auto; padding: 0.5rem;">
                    ${diffHtml}
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                <button class="btn btn-primary" onclick="VbsManagerPage.confirmFix(${tableId})">Confirm & Save</button>
            </div>
        `;

        Modal.show(modalHtml);
    },

    async confirmFix(tableId) {
        try {
            const res = await fetch(`/api/vbs-manager/${tableId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vbs_content: this.state.proposedContent })
            });

            if (res.ok) {
                Toast.success('Fix applied successfully');
                Modal.hide();
                this.selectTable(tableId); // Reload to show new code
            } else {
                Toast.error('Failed to save fix');
            }
        } catch (e) {
            Toast.error('Save error: ' + e.message);
        }
    },

    startStatusPolling(forceShowResult = false) {
        if (this.state.pollingInterval) clearInterval(this.state.pollingInterval);

        let wasRunning = false;

        const poll = async () => {
            try {
                const res = await fetch('/api/vbs-manager/bulk-extract/status');
                const status = await res.json();

                const container = document.getElementById('bulk-progress-container');
                const progressBar = document.getElementById('bulk-progress-bar');
                const progressText = document.getElementById('bulk-progress-text');
                const statusLabel = document.getElementById('bulk-status-label');
                const spinner = document.getElementById('bulk-spinner');

                if (status.is_running) {
                    wasRunning = true;
                    if (container) container.classList.add('bulk-progress-visible');
                    const pct = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
                    if (progressBar) progressBar.style.width = pct + '%';
                    if (progressText) progressText.textContent = `${status.current} / ${status.total} (${pct}%)`;
                    if (statusLabel) statusLabel.textContent = 'Synchronizing VBS Scripts...';
                    if (spinner) spinner.style.display = 'block';
                } else {
                    // Only show completion if it was running before OR if we explicitly forced it (user clicked button)
                    if (wasRunning || (forceShowResult && container && !container.classList.contains('bulk-progress-visible'))) {
                        const pct = 100;
                        if (progressBar) progressBar.style.width = pct + '%';
                        if (progressText) progressText.textContent = `${status.total} / ${status.total} (100%)`;
                        if (statusLabel) statusLabel.textContent = 'Sync Complete';
                        if (spinner) spinner.style.display = 'none';
                        if (container) container.classList.add('bulk-progress-visible');
                        
                        Toast.success('Bulk sync complete');
                        
                        // Give the database time to settle, then perform a staggered definitive refresh
                        const performFinalRefreshes = async () => {
                            await new Promise(r => setTimeout(r, 1000));
                            await this.loadTables();
                            await this.loadPatchStats();
                            this.renderPatchList();
                            
                            // Safety pulse at 3 seconds to catch any slow DB commits
                            await new Promise(r => setTimeout(r, 2000));
                            await this.loadTables();
                            await this.loadPatchStats();
                            this.renderPatchList();
                        };
                        performFinalRefreshes();
                        
                        setTimeout(() => {
                           container.classList.remove('bulk-progress-visible');
                        }, 3000);
                    } else {
                        // Not running and wasn't visible/forced, ensure hidden
                        if (container) {
                            container.style.display = 'none';
                            container.classList.remove('bulk-progress-visible');
                        }
                    }
                    clearInterval(this.state.pollingInterval);
                    this.state.pollingInterval = null;
                }
            } catch (e) {
                console.error('Polling error', e);
            }
        };

        // Run once immediately
        poll();
        // Then set interval
        if (!this.state.pollingInterval) {
            this.state.pollingInterval = setInterval(poll, 2000);
        }
    },

    updateLocalTableStatus(tableId, status) {
        const t = this.state.tables.find(x => x.table_id === tableId);
        if (t) t.vbs_status = status;
        this.renderTableList(document.getElementById('vbs-search').value);
    },

    closeDetail() {
        document.getElementById('vbs-workspace')?.classList.remove('content-active');
    },

    // Clean up when leaving page
    unmount() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
        }
        if (this.state.editor) {
            this.state.editor.destroy();
            this.state.editor = null;
        }
    },

    async loadPatchStats() {
        try {
            const response = await fetch('/api/patches/status');
            const patches = await response.json();
            
            // Only count currently available (unpatched) ones
            const available = patches.filter(p => !p.is_patched).length;
            const elAvail = document.getElementById('vbs-count-available');

            if (elAvail) {
                elAvail.textContent = available;
                // Amber if > 0, otherwise default secondary
                if (available > 0) {
                    elAvail.style.color = 'var(--accent-amber)';
                    elAvail.parentElement.style.borderColor = 'var(--accent-amber-glow)';
                    elAvail.parentElement.style.background = 'rgba(245, 158, 11, 0.05)';
                } else {
                    elAvail.style.color = '';
                    elAvail.parentElement.style.borderColor = '';
                    elAvail.parentElement.style.background = '';
                }
            }
            
            this.state._patches = patches; // Cache for manager
        } catch (e) { console.error('Failed to load patch stats', e); }
    },

    openPatchManager() {
        const panel = document.getElementById('patch-manager-panel');
        const body = document.getElementById('patch-manager-body');
        
        body.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: var(--bg-surface); padding: 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
                <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">Refresh VBS Patch Data</div>
                    <p style="color: var(--text-tertiary); font-size: 0.82rem; margin: 0; max-width: 320px;">Download the latest VPX standalone patches database and compare .vbs file hashes to identify available patches.</p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-scan-hashes">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                    Re-Scan
                </button>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <button class="btn btn-primary" id="btn-download-all" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Download All Patches
                </button>
            </div>

            <div id="patches-list-container">
                <div style="text-align: center; padding: 3rem;"><div class="spinner"></div></div>
            </div>
        `;
        
        panel.classList.add('open');
        this.renderPatchList();

        document.getElementById('btn-scan-hashes').onclick = async () => {
            await this.performFullSync('btn-scan-hashes');
        };

        document.getElementById('btn-download-all').onclick = () => this.downloadAllPatches();
    },

    async downloadAllPatches() {
        const btn = document.getElementById('btn-download-all');
        Modal.confirm('Download All Patches', 'Download and apply all currently available VBS patches? This will NOT overwrite your existing patched scripts.', async () => {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div> Working...';

            try {
                const res = await fetch('/api/vbs-manager/patches/apply-all', { method: 'POST' });
                const data = await res.json();

                if (res.ok) {
                    Toast.success(data.message || 'Bulk patching complete');
                    
                    // Full refresh pulse with a small delay for DB/FS settling
                    setTimeout(async () => {
                        await this.loadTables();
                        await this.loadPatchStats();
                        this.renderPatchList();
                    }, 500);
            } else {
                Toast.error('Bulk patching failed: ' + (data.detail || 'Unknown error'));
            }
            } catch (e) {
                Toast.error('Network error during bulk patch: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download All Patches';
            }
        });
    },

    closePatchManager() {
        const panel = document.getElementById('patch-manager-panel');
        if (panel) panel.classList.remove('open');
    },

    async cancelSync() {
        try {
            await fetch('/api/vbs-manager/bulk-extract/cancel', { method: 'POST' });
            this.renderPatchList();
        } catch (e) {
            console.error("Failed to cancel sync", e);
        }
    },

    async renderPatchList() {
        const container = document.getElementById('patches-list-container');
        if (!container) return;

        // 1. Check if bulk sync is currently running to show better loading state
        try {
            const statusRes = await fetch('/api/vbs-manager/bulk-extract/status');
            const syncStatus = await statusRes.json();
            
            if (syncStatus.is_running) {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; color: var(--text-dim); text-align: center;">
                        <div class="spinner" style="width: 32px; height: 32px; margin-bottom: 1.5rem;"></div>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 1.1rem;">Synchronizing Database...</div>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-tertiary);">We are recalculating script hashes. This list will update automatically in a moment.</p>
                        <div style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--glass-bg); border-radius: 20px; font-size: 0.8rem; border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                            ${syncStatus.current} / ${syncStatus.total} processed
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="VbsManagerPage.cancelSync()" style="opacity: 0.7; font-size: 0.8rem;">
                            Skip Sync
                        </button>
                    </div>
                `;
                return;
            }
        } catch (e) { console.error("Failed to check sync status", e); }

        if (!this.state._patches || this.state._patches.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: var(--space-xl) 0;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <div class="empty-state-title">No patchable tables found</div>
                    <div class="empty-state-desc">Match your tables to VPS first to identify available standalone patches.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Table</th>
                        <th>Status</th>
                        <th style="text-align: right">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.state._patches.map(p => `
                        <tr>
                            <td style="font-size: 0.85rem;">
                                <div style="font-weight: 600; color: var(--text-main);">${p.display_name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-tertiary); font-family: monospace; margin-top: 2px;">${p.vbs_hash ? p.vbs_hash.substring(0, 12) : 'No Hash'}</div>
                            </td>
                            <td>
                                ${p.is_patched 
                                    ? '<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Patched</span>' 
                                    : '<span class="badge badge-warning">Available</span>'}
                            </td>
                            <td style="text-align: right">
                                ${p.is_patched 
                                    ? '<button class="btn btn-sm btn-secondary" style="opacity: 0.6;" disabled>Applied</button>' 
                                    : `<button class="btn btn-sm btn-primary" onclick="VbsManagerPage.applyGlobalPatch(${p.table_id})">Apply Patch</button>`}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async applyGlobalPatch(tableId) {
        try {
            Toast.info('Applying patch...');
            const res = await fetch(`/api/patches/apply/${tableId}`, { method: 'POST' });
            if (res.ok) {
                Toast.success('Patch applied successfully');
                await this.loadPatchStats();
                this.renderPatchList();
                
                // If this is the currently selected table, refresh its details
                if (this.state.selectedTable && this.state.selectedTable.table_id === tableId) {
                    this.selectTable(tableId);
                }
                
                // Refresh table list to show updated status badges
                this.loadTables(); 
            } else {
                const err = await res.json();
                Toast.error(err.detail || 'Failed to apply patch');
            }
        } catch (e) { Toast.error('Patch failed: ' + e.message); }
    },

    async performFullSync(triggerBtnId = null) {
        const btn = triggerBtnId ? document.getElementById(triggerBtnId) : document.getElementById('btn-bulk-extract');
        const originalContent = btn ? btn.innerHTML : '';
        
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div> Syncing...';
        }

        try {
            Toast.info('Refreshing table library and VBS patch data...');
            
            // 1. Refresh table library (find new files)
            await fetch('/api/tables/scan', { method: 'POST' });
            
            // 2. Refresh VBS patches from GitHub (get latest hashes.json)
            await fetch('/api/vbs-manager/refresh-patches', { method: 'POST' });
            
            // 3. Start Bulk Extraction/Sync (background task)
            const res = await fetch('/api/vbs-manager/bulk-extract', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                Toast.success('Sync started: ' + data.message);
                this.startStatusPolling(true);
            } else {
                Toast.error(data.message);
            }

            // Immediately refresh the UI to show what we know so far
            await this.loadTables();
            await this.loadPatchStats();
            if (document.getElementById('patch-manager-panel')?.classList.contains('open')) {
                this.renderPatchList();
            }

        } catch (e) {
            Toast.error('Sync failed: ' + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        }
    }
};

// Hook into App router unmount if supported, or handled natively by SPA replacing DOM.
window.VbsManagerPage = VbsManagerPage;
