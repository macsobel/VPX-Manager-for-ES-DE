/* ═══════════════════════════════════════════════════════════
   INI Manager Page
   ═══════════════════════════════════════════════════════════ */

const IniManagerPage = {
    state: {
        tables: [],
        selectedTable: null,
        editor: null,
        originalContent: "",
    },

    async render(tableId = null) {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 class="page-title">INI Manager</h1>
                    <p class="page-subtitle">Manage, generate, and edit table-specific INI files</p>
                </div>
                <div>
                    <button class="btn btn-primary" id="btn-bulk-download">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Bulk Download
                    </button>
                </div>
            </div>

            <!-- Progress Bar Container (Hidden by default) -->
            <div id="bulk-progress-container" style="display: none; margin-bottom: 2rem; background: var(--glass-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border); backdrop-filter: blur(8px);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="spinner-sm" id="bulk-spinner"></div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;" id="bulk-status-label">Processing...</span>
                    </div>
                </div>
                <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-full); overflow: hidden; height: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div id="bulk-progress-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); position: relative;">
                        <div class="progress-shimmer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
                    </div>
                </div>
            </div>

            <!-- Main Layout: Master List vs Detail -->
            <div class="adaptive-split-layout" id="ini-workspace">
                <!-- Left: Master List -->
                <div class="adaptive-sidebar">
                    <div style="padding: 1.25rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
                        <div class="search-wrapper">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" id="ini-search" class="search-input" placeholder="Search tables...">
                        </div>
                    </div>
                    <div id="ini-table-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                        <div style="padding: 2rem; text-align: center;">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>

                <!-- Right: Detail Workspace -->
                <div class="adaptive-content" id="ini-detail-workspace">
                    <!-- Detail Header -->
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary); display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <button class="mobile-back-btn" onclick="IniManagerPage.closeDetail()">
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

                    <!-- Editor Area / Generate Button Area -->
                    <div id="editor-wrapper" style="flex: 1; display: flex; flex-direction: column; position: relative;">
                        <div id="generate-ini-container" style="display: none; flex: 1; align-items: center; justify-content: center; flex-direction: column;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; color: var(--accent-blue);">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="12" y1="18" x2="12" y2="12"></line>
                                <line x1="9" y1="15" x2="15" y2="15"></line>
                            </svg>
                            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">This table does not have a custom INI file.</p>
                            <button class="btn btn-primary" id="btn-generate-ini" onclick="IniManagerPage.generateIni()">
                                Generate INI File
                            </button>
                        </div>
                        <div id="editor-container" style="flex: 1; position: relative; display: none;">
                            <div id="code-editor" style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"></div>
                        </div>
                    </div>

                    <!-- Editor Footer -->
                    <div class="ini-editor-footer" id="editor-footer" style="padding: 1rem; border-top: 1px solid var(--border-color); background: var(--bg-tertiary); display: none; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.75rem; flex: 1;" id="quick-fixes-container">
                            <!-- Row 0: Smart Auto-Fit -->
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <button class="btn btn-secondary btn-sm" onclick="IniManagerPage.applyAutoFit()" title="Automatically fit the table to the screen orientation">Smart Auto-Fit Setup</button>
                                <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: 0.5rem;">Clears manual camera tweaks and uses auto-calculated dimensions</span>
                            </div>

                            <!-- Row 1: Video Preset -->
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <select id="video-preset-select" class="input-field" style="width: auto; min-width: 180px; font-size: 0.85rem; padding: 0.25rem 0.5rem; height: 32px;">
                                    <option value="" selected disabled>Select Video Preset...</option>
                                    <option value="performance">Performance Preset</option>
                                    <option value="quality">High Fidelity (Quality) Preset</option>
                                </select>
                                <button class="btn btn-secondary btn-sm" onclick="IniManagerPage.applyVideoPreset()" title="Apply selected video preset">Apply</button>
                                <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: 0.5rem;">Quickly configure resolution and visual settings</span>
                            </div>

                            <!-- Row 2: Rotation -->
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <select id="rotate-preset-select" class="input-field" style="width: auto; min-width: 180px; font-size: 0.85rem; padding: 0.25rem 0.5rem; height: 32px;">
                                    <option value="" selected disabled>Select Rotation...</option>
                                    <option value="0">0 Degrees</option>
                                    <option value="90">90 Degrees</option>
                                    <option value="180">180 Degrees</option>
                                    <option value="270">270 Degrees</option>
                                </select>
                                <button class="btn btn-secondary btn-sm" onclick="IniManagerPage.applyRotatePreset()" title="Apply selected rotation">Apply</button>
                                <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: 0.5rem;">Fix table orientation for your display</span>
                            </div>

                            <!-- Row 3: Misc Snippets -->
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <button class="btn btn-secondary btn-sm" onclick="IniManagerPage.insertSnippet('volume_max')" title="Set ROM volume to maximum">Max ROM Volume</button>
                                <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: 0.5rem;">Inserts maximum volume command into INI</span>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="btn-save-ini" onclick="IniManagerPage.saveIni()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            Save Edits
                        </button>
                    </div>
                </div>

                <!-- Empty State for Detail (Desktop Only) -->
                <div id="ini-detail-empty" style="flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); color: var(--text-muted);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 1rem; opacity: 0.5;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <div>Select a table to manage its INI file</div>
                </div>
            </div>
        `;

        // Load Ace Editor dynamically if not present
        if (!window.ace) {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.3/ace.js";
            script.onload = () => this.init(tableId);
            document.head.appendChild(script);
        } else {
            this.init(tableId);
        }
    },

    async init(tableId = null) {
        // Setup search
        document.getElementById('ini-search').addEventListener('input', (e) => {
            this.renderTableList(e.target.value);
        });

        // Setup Bulk Download
        document.getElementById('btn-bulk-download').addEventListener('click', () => {
            this.startBatchDownload();
        });

        await this.loadStatus();
        if (tableId) this.selectTable(tableId);
        this.startPollingStatus();
    },

    async loadStatus() {
        try {
            const res = await fetch('/api/ini-manager/status');
            const data = await res.json();

            this.state.tables = data.sort((a, b) => a.display_name.localeCompare(b.display_name));
            this.renderTableList();

        } catch (e) {
            console.error('Failed to load INI status:', e);
            document.getElementById('ini-table-list').innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--accent-red);">
                    Failed to load table list.
                </div>
            `;
        }
    },

    renderTableList(filter = '') {
        const list = document.getElementById('ini-table-list');
        const term = filter.toLowerCase();

        let filtered = this.state.tables;
        if (term) {
            filtered = filtered.filter(t =>
                t.display_name.toLowerCase().includes(term) ||
                t.filename.toLowerCase().includes(term)
            );
        }

        if (filtered.length === 0) {
            list.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No tables found</div>`;
            return;
        }

        list.innerHTML = filtered.map(t => {
            const isSelected = this.state.selectedTable === t.table_id;

            // Status badge logic
            let badgeHtml = '';
            if (t.has_ini) {
                badgeHtml = `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-emerald);">Custom INI</span>`;
            } else {
                badgeHtml = `<span class="badge" style="background: var(--glass-border); color: var(--text-secondary);">Default</span>`;
            }

            return `
                <div class="ini-list-item ${isSelected ? 'active' : ''}" onclick="IniManagerPage.selectTable(${t.table_id})"
                     style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; display: flex; justify-content: space-between; align-items: center; ${isSelected ? 'background: var(--bg-surface); border-left: 3px solid var(--accent-blue);' : ''}">
                    <div style="min-width: 0; flex: 1; margin-right: 1rem;">
                        <div style="font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${t.display_name}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.2rem; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${t.filename}
                        </div>
                    </div>
                    <div>
                        ${badgeHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    async selectTable(tableId) {
        this.state.selectedTable = parseInt(tableId);
        document.getElementById('ini-workspace')?.classList.add('content-active');
        this.renderTableList(document.getElementById('ini-search').value);

        const emptyState = document.getElementById('ini-detail-empty');
        const detailWorkspace = document.getElementById('ini-detail-workspace');

        emptyState.style.display = 'none';
        detailWorkspace.style.display = 'flex';

        try {
            const res = await fetch(`/api/ini-manager/${tableId}`);
            if (!res.ok) throw new Error('Failed to fetch details');

            const details = await res.json();

            // Update Header
            document.getElementById('detail-title').textContent = details.display_name;
            document.getElementById('detail-filename').textContent = details.filename;

            const detailActions = document.getElementById('detail-actions');
            detailActions.innerHTML = '';
            const generateContainer = document.getElementById('generate-ini-container');
            const editorContainer = document.getElementById('editor-container');
            const editorFooter = document.getElementById('editor-footer');

            if (details.has_ini) {
                generateContainer.style.display = 'none';
                editorContainer.style.display = 'block';
                editorFooter.style.display = 'flex';

                detailActions.innerHTML = `
                    <button class="btn btn-danger btn-sm" onclick="IniManagerPage.deleteIni()" title="Delete custom INI file">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Delete INI
                    </button>
                `;

                this.initEditor(details.content);
            } else {
                generateContainer.style.display = 'flex';
                editorContainer.style.display = 'none';
                editorFooter.style.display = 'none';
            }

        } catch (e) {
            console.error('Error fetching table details:', e);
            Toast.error('Failed to load table details');
        }
    },

    initEditor(content) {
        if (!this.state.editor) {
            ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.32.3/");
            this.state.editor = ace.edit("code-editor");
            this.state.editor.setTheme("ace/theme/tomorrow_night");
            this.state.editor.session.setMode("ace/mode/ini");
            this.state.editor.setOptions({
                fontSize: "13px",
                showPrintMargin: false,
                wrap: true,
                useWorker: false
            });
        }

        this.state.originalContent = content;
        this.state.editor.setValue(content, -1);
    },

    async saveIni() {
        if (!this.state.editor || !this.state.selectedTable) return;

        const content = this.state.editor.getValue();
        const btn = document.getElementById('btn-save-ini');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-sm" style="display:inline-block; margin-right:5px;"></span> Saving...`;

        try {
            const res = await fetch(`/api/ini-manager/${this.state.selectedTable}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ini_content: content })
            });

            if (res.ok) {
                Toast.success("INI file saved successfully");
                this.state.originalContent = content;
                await this.loadStatus();
            } else {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to save');
            }
        } catch (e) {
            Toast.error(e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    async generateIni() {
        if (!this.state.selectedTable) return;

        const btn = document.getElementById('btn-generate-ini');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner-sm" style="margin-right: 8px;"></div> Generating...';
        }

        const progressContainer = document.getElementById('bulk-progress-container');
        if (progressContainer) {
            progressContainer.classList.add('bulk-progress-visible');
            progressContainer.style.display = 'block';
            document.getElementById('bulk-status-label').textContent = 'Generating INI File...';
        }

        try {
            const res = await fetch(`/api/ini-manager/${this.state.selectedTable}/generate`, {
                method: 'POST'
            });

            if (res.ok) {
                Toast.success("INI file generated successfully");
                await this.loadStatus();
                // Reload current table to show editor
                this.selectTable(this.state.selectedTable);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Generate INI File';
                }
            } else {
                const data = await res.json();
                throw new Error(data.detail || 'Failed to generate');
            }
        } catch (e) {
            Toast.error(e.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Generate INI File';
            }
        } finally {
            if (progressContainer) {
                progressContainer.classList.remove('bulk-progress-visible');
                setTimeout(() => { progressContainer.style.display = 'none'; }, 300);
            }
        }
    },

    async deleteIni() {
        if (!this.state.selectedTable) return;
        Modal.confirm('Delete INI File', 'Are you sure you want to delete the custom INI file for this table?', async () => {
            try {
                const res = await fetch(`/api/ini-manager/${this.state.selectedTable}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    Toast.success("INI file deleted successfully");
                    await this.loadStatus();
                    this.selectTable(this.state.selectedTable);
                } else {
                    const data = await res.json();
                    throw new Error(data.detail || 'Failed to delete');
                }
            } catch (e) {
                Toast.error(e.message);
            }
        });
    },

    injectBlock(blockId, snippet) {
        if (!this.state.editor) return;

        let content = this.state.editor.getValue();
        const startMarker = `; --- AUTO ${blockId} START ---`;
        const endMarker = `; --- AUTO ${blockId} END ---`;
        const block = `${startMarker}\n${snippet}\n${endMarker}`;

        // Remove previously injected block for this ID
        const regex = new RegExp(`; --- AUTO ${blockId} START ---[\\s\\S]*?; --- AUTO ${blockId} END ---\\n?`, 'g');
        content = content.replace(regex, '');

        // Find existing [Player] tag (case-insensitive)
        const playerRegex = /^\[Player\]\s*$/im;
        const match = content.match(playerRegex);

        if (match) {
            const insertPos = match.index + match[0].length;
            let before = content.substring(0, insertPos);
            let after = content.substring(insertPos);

            if (!after.startsWith('\n')) {
                before += '\n';
            } else {
                before += '\n';
                after = after.substring(1);
            }
            content = before + block + '\n' + after;
        } else {
            if (!content.endsWith('\n') && content.length > 0) {
                content += '\n';
            }
            content += `\n[Player]\n${block}\n`;
        }

        this.state.editor.setValue(content, -1);
        this.state.editor.focus();
    },

    async applyAutoFit() {
        if (!this.state.selectedTable) return;
        Modal.confirm('Smart Auto-Fit', 'This will remove any manual camera/view tweaks from the INI and configure it to automatically scale to the screen on next launch. Continue?', async () => {
            try {
                const res = await fetch(`/api/ini-manager/${this.state.selectedTable}/autofit`, {
                    method: 'POST'
                });

                if (res.ok) {
                    const data = await res.json();
                    Toast.success("Smart Auto-Fit applied successfully");
                    if (this.state.editor) {
                        this.state.editor.setValue(data.content, -1);
                    }
                    this.state.originalContent = data.content;
                } else {
                    const data = await res.json();
                    throw new Error(data.detail || 'Failed to apply Auto-Fit');
                }
            } catch (e) {
                Toast.error(e.message);
            }
        });
    },

    applyVideoPreset() {
        const select = document.getElementById('video-preset-select');
        if (!select || !select.value) return;

        let snippet = "";
        if (select.value === 'performance') {
            snippet = "SyncMode = 2\nMaxFramerate = 60\nMaxPrerenderedFrames = 0\nFXAA = 0\nSharpen = 0\nScaleFXDMD = 0\nDisableAO = 1\nDynamicAO = 0\nSSRefl = 0\nPFReflection = 4";
        } else if (select.value === 'quality') {
            snippet = "SyncMode = 0\nMaxFramerate = 0\nFXAA = 1\nDisableAO = 0\nDynamicAO = 1\nSSRefl = 1";
        }

        if (snippet) {
            this.injectBlock("VIDEO PRESET", snippet);
            Toast.success("Video preset applied in editor. Don't forget to save.");
        }
    },

    applyRotatePreset() {
        const select = document.getElementById('rotate-preset-select');
        if (!select || !select.value) return;

        const snippet = `Rotation = ${select.value}`;
        this.injectBlock("ROTATION", snippet);
        Toast.success("Rotation preset applied in editor. Don't forget to save.");
    },

    insertSnippet(type) {
        if (!this.state.editor) return;

        if (type === 'volume_max') {
            this.injectBlock("MAX VOLUME", "SoundVolume = 100\nMusicVolume = 100");
            Toast.success("Max volume preset applied in editor. Don't forget to save.");
        }
    },

    async startBatchDownload() {
        try {
            const res = await fetch('/api/ini-manager/bulk-generate', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                if (data.count > 0) {
                    Toast.show(`Started generating ${data.count} INI files.`, 'success');
                    this.startPollingStatus();
                } else {
                    Toast.show(data.message, 'info');
                }
            } else {
                Toast.show(data.message || 'Failed to start batch process', 'error');
            }
        } catch (error) {
            console.error('Error starting batch download:', error);
            Toast.show('Error starting batch process', 'error');
        }
    },

    startPollingStatus() {
        if (this.state.pollingInterval) clearInterval(this.state.pollingInterval);

        this.pollStatus();
        this.state.pollingInterval = setInterval(() => this.pollStatus(), 2000);
    },

    async pollStatus() {
        try {
            const res = await fetch('/api/ini-manager/bulk-status');
            const data = await res.json();

            const progressContainer = document.getElementById('bulk-progress-container');
            const progressBar = document.getElementById('bulk-progress-bar');
            const statusLabel = document.getElementById('bulk-status-label');

            if (data.status === 'running') {
                progressContainer.style.display = 'block';
                const percent = (data.current / data.total) * 100;
                progressBar.style.width = `${percent}%`;
                statusLabel.textContent = data.message || 'Processing...';
            } else {
                if (this.state.pollingInterval) {
                    clearInterval(this.state.pollingInterval);
                    this.state.pollingInterval = null;
                    progressContainer.style.display = 'none';
                    if (data.status === 'completed') {
                        Toast.show('Bulk INI generation complete', 'success');
                        this.loadStatus();
                    }
                }
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    },

    closeDetail() {
        document.getElementById('ini-workspace')?.classList.remove('content-active');
    },

    unmount() {
        if (this.state.pollingInterval) clearInterval(this.state.pollingInterval);
        if (this.state.editor) {
            this.state.editor.destroy();
            this.state.editor = null;
        }
    }
};

window.IniManagerPage = IniManagerPage;
