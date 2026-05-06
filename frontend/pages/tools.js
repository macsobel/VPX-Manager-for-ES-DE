/* ═══════════════════════════════════════════════════════════
   Tools Page
   ═══════════════════════════════════════════════════════════ */

const ToolsPage = {
    render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Tools</h1>
                <p class="page-subtitle">Maintenance and tools for your Visual Pinball installation</p>
            </div>

            <div class="settings-grid">
                <!-- VBS Manager Card -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        VBS Manager
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <p style="color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5; font-size: 0.9rem;">
                                Extract and patch VBScript files for your tables. Includes a code editor and automatic patched file detection.
                            </p>
                            <button class="btn btn-primary" onclick="window.location.hash = 'vbs-manager'">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                                Open VBS Manager
                            </button>
                        </div>
                    </div>
                </div>

                <!-- INI Manager Card -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="12" y1="18" x2="12" y2="12"></line>
                            <line x1="9" y1="15" x2="15" y2="15"></line>
                        </svg>
                        INI Manager
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <p style="color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5; font-size: 0.9rem;">
                                Manage and generate table-specific INI files. Includes a code editor and configuration quick-fixes.
                            </p>
                            <button class="btn btn-primary" onclick="window.location.hash = 'ini-manager'">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                                Open INI Manager
                            </button>
                        </div>
                    </div>
                </div>

                <!-- NVRAM Management Card -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                        NVRAM Assistance
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <p style="color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5; font-size: 0.9rem;">
                                Import and store pre-initialized NVRAM files in a master repository. This helps prevent "Factory Settings Restored" errors on certain tables.
                            </p>
                            <button class="btn btn-primary" onclick="ToolsPage.openNvramManager()">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                                Open NVRAM Manager
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ES-DE Integration Card -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        Install Emulation Station Integrations
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <p style="color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5; font-size: 0.9rem;">
                                Configure ES-DE to launch VPX tables and other integrations.
                            </p>
                            <button class="btn btn-primary" id="btn-apply-esde">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                Apply Integration
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Backglass Companion Card -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        ES-DE Backglass Companion (Beta)
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <p style="color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5; font-size: 0.9rem;">
                                A custom SDL2 companion script to show the backglass on a secondary monitor while browsing Emulation Station.
                            </p>
                            <button class="btn btn-primary" onclick="ToolsPage.openBackglassPanel()">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                </svg>
                                Configure Backglass
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- NVRAM Manager Detail Panel -->
            <div class="detail-panel" id="nvram-manager-panel">
                <div class="detail-panel-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                         <div style="width: 32px; height: 32px; background: rgba(16, 185, 129, 0.12); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-emerald);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                            </svg>
                         </div>
                         <h3 class="card-title" style="margin: 0; font-size: 1.1rem;">NVRAM Manager</h3>
                    </div>
                    <button class="btn-icon" onclick="ToolsPage.closeNvramManager()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="detail-panel-body" id="nvram-manager-body"></div>
            </div>

            <!-- Backglass Configuration Panel -->
            <div class="detail-panel" id="backglass-panel">
                <div class="detail-panel-header">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                         <div style="width: 32px; height: 32px; background: rgba(251, 191, 36, 0.12); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-amber);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                            </svg>
                         </div>
                         <h3 class="card-title" style="margin: 0; font-size: 1.1rem;">ES-DE Backglass Companion (Beta)</h3>
                    </div>
                    <button class="btn-icon" onclick="ToolsPage.closeBackglassPanel()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="detail-panel-body" id="backglass-panel-body">
                    <div class="spinner-container"><div class="spinner"></div></div>
                </div>
                <div class="detail-panel-footer" style="padding: 1rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button class="btn btn-secondary" onclick="ToolsPage.closeBackglassPanel()">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-backglass">Save Changes</button>
                </div>
            </div>
        `;
        this.bindEvents();
        this.loadPatchStats();
    },

    bindEvents() {
        const btnEsde = document.getElementById('btn-apply-esde');
        if (btnEsde) {
            btnEsde.onclick = async () => {
                btnEsde.disabled = true;
                btnEsde.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div> Applying...';
                try {
                    const res = await fetch('/api/tools/esde-integration', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        Toast.success(data.message);
                    } else {
                        Toast.error(data.message || 'Failed to apply integration.');
                    }
                } catch (e) {
                    Toast.error('Error applying integration: ' + e.message);
                }
                btnEsde.disabled = false;
                btnEsde.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Apply Integration';
            };
        }

        const btnSaveBackglass = document.getElementById('btn-save-backglass');
        if (btnSaveBackglass) {
            btnSaveBackglass.onclick = () => this.saveBackglassSettings();
        }
    },

    nvramFiles: [],

    openNvramManager() {
        const panel = document.getElementById('nvram-manager-panel');
        const body = document.getElementById('nvram-manager-body');

        body.innerHTML = `
            <div style="padding: 0.5rem; height: 100%; display: flex; flex-direction: column;">
                <p style="margin-bottom: 1rem; line-height: 1.6; color: var(--text-secondary); font-size: 0.92rem;">
                    Upload pre-initialized NVRAM files to your master repository to prevent "Factory Settings Restored" errors during table boots.
                </p>

                <!-- Action Area -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
                    <div style="background: var(--bg-surface); padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                        <a href="https://www.vpforums.org/index.php?app=downloads&showfile=1362" target="_blank" style="color: var(--accent-blue); text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            Get NVRAM Pack
                        </a>
                    </div>
                    <button class="btn btn-primary" id="btn-install-nvrams" style="flex-direction: column; height: auto; padding: 1rem; gap: 0.5rem; font-size: 0.85rem; border-radius: 12px;" onclick="ToolsPage.installNvramFiles()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        Install All NVRAMs
                    </button>
                </div>

                <div id="nvram-dropzone" class="file-slot file-slot-emerald" style="padding: 1.5rem 1rem; border: 2px dashed var(--accent-emerald); border-radius: 16px; text-align: center; cursor: pointer; transition: all 0.2s; background: rgba(16, 185, 129, 0.02); margin-bottom: 1.5rem;">
                    <div style="width: 40px; height: 40px; background: rgba(16, 185, 129, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: var(--accent-emerald);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                    </div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">Drop .nv or .zip files here</div>
                    <input type="file" id="nvram-file-input" accept=".nv,.zip" multiple style="display: none;">
                </div>

                <div id="nvram-upload-progress" style="display: none; margin-bottom: 1.5rem; text-align: center; padding: 1.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px solid var(--glass-border);">
                    <div class="spinner" style="width: 24px; height: 24px; margin: 0 auto 0.75rem;"></div>
                    <div id="nvram-progress-text" style="color: var(--text-primary); font-size: 0.85rem; font-weight: 500;">Processing files...</div>
                </div>

                <!-- File List Section -->
                <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                        <span style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary);">Repository Files</span>
                        <span id="nvram-count" class="badge" style="background: var(--glass-border); color: var(--text-secondary);">0 files</span>
                    </div>
                    <div id="nvram-file-list" style="flex: 1; overflow-y: auto; background: rgba(0,0,0,0.1); border-radius: 12px; border: 1px solid var(--glass-border); padding: 0.5rem;">
                        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-tertiary); font-style: italic; font-size: 0.9rem;">
                            No files uploaded to repository yet.
                        </div>
                    </div>
                </div>
            </div>
        `;

        panel.classList.add('open');

        // Bind events
        const dropzone = document.getElementById('nvram-dropzone');
        const input = document.getElementById('nvram-file-input');

        dropzone.addEventListener('click', () => input.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.background = 'rgba(16, 185, 129, 0.1)';
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.style.background = 'transparent';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.background = 'transparent';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                ToolsPage.uploadNvramFiles(e.dataTransfer.files);
            }
        });

        input.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                ToolsPage.uploadNvramFiles(e.target.files);
            }
        });

        this.loadNvramFiles();
    },

    async loadNvramFiles() {
        try {
            const res = await fetch('/api/tools/nvram/list');
            const data = await res.json();
            this.nvramFiles = data.files || [];
            this.renderNvramFileList();
        } catch (e) {
            console.error('Failed to load NVRAM files:', e);
        }
    },

    renderNvramFileList() {
        const list = document.getElementById('nvram-file-list');
        const count = document.getElementById('nvram-count');
        const btnInstall = document.getElementById('btn-install-nvrams');

        if (!list) return;

        count.textContent = `${this.nvramFiles.length} file${this.nvramFiles.length === 1 ? '' : 's'}`;

        if (btnInstall) {
            btnInstall.disabled = this.nvramFiles.length === 0;
            // Optionally change style if disabled
            btnInstall.style.opacity = this.nvramFiles.length === 0 ? '0.5' : '1';
        }

        if (this.nvramFiles.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; color: var(--text-tertiary); font-style: italic; font-size: 0.9rem;">
                    No files uploaded to repository yet.
                </div>
            `;
            return;
        }

        list.innerHTML = this.nvramFiles.map(file => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; background: var(--bg-surface); border-radius: 8px; margin-bottom: 0.4rem; border: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 0.6rem; overflow: hidden;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file}</span>
                </div>
                <button class="btn-icon" style="padding: 4px; color: var(--text-tertiary);" onclick="ToolsPage.deleteNvramFile('${file}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `).join('');
    },

    async deleteNvramFile(filename) {
        Modal.confirm('Delete NVRAM File', `Are you sure you want to delete <strong>${filename}</strong>?`, async () => {
            try {
                const res = await fetch(`/api/tools/nvram/${filename}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    Toast.success(`Deleted ${filename}`);
                    this.loadNvramFiles();
                } else {
                    Toast.error('Failed to delete: ' + data.error);
                }
            } catch (e) {
                Toast.error('Error deleting file: ' + e.message);
            }
        });
    },

    async installNvramFiles() {
        const btn = document.getElementById('btn-install-nvrams');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; margin-bottom: 0.25rem;"></div> Installing...';

        try {
            const res = await fetch('/api/tools/nvram/install', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                Toast.success(`Successfully installed ${data.installed} NVRAM files across your table library.`);
                if (data.failures && data.failures.length > 0) {
                    console.warn('Individual install failures:', data.failures);
                }
            } else {
                Toast.error('Installation failed: ' + data.error);
            }
        } catch (e) {
            Toast.error('Error during installation: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    },

    closeNvramManager() {
        document.getElementById('nvram-manager-panel').classList.remove('open');
    },

    async uploadNvramFiles(files) {
        const progress = document.getElementById('nvram-upload-progress');
        const progressText = document.getElementById('nvram-progress-text');
        const dropzone = document.getElementById('nvram-dropzone');

        progress.style.display = 'block';
        dropzone.style.display = 'none';

        try {
            let totalAdded = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                progressText.textContent = `Uploading ${i + 1}/${files.length}: ${file.name}...`;

                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/tools/nvram/upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (data.success) {
                    totalAdded += data.added || 1;
                } else {
                    Toast.error(`Failed to process ${file.name}: ${data.error}`);
                }
            }

            if (totalAdded > 0) {
                Toast.success(`Successfully added ${totalAdded} NVRAM files to repository`);
                this.loadNvramFiles();
            }
        } catch (e) {
            Toast.error('Upload failed: ' + e.message);
        } finally {
            progress.style.display = 'none';
            dropzone.style.display = 'block';
            document.getElementById('nvram-file-input').value = '';
        }
    },

    async openBackglassPanel() {
        const panel = document.getElementById('backglass-panel');
        const body = document.getElementById('backglass-panel-body');
        panel.classList.add('open');

        try {
            const res = await fetch('/api/backglass/settings');
            const settings = await res.json();
            this.currentBackglassSettings = settings;

            body.innerHTML = `
                <div style="padding: 1rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                        <div>
                            <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">Enable Backglass Companion</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary);">Automatically start with Emulation Station</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="bg-enabled" ${settings.enabled ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>

                    <div class="settings-group" style="margin-bottom: 2rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                            <label class="settings-label" style="margin: 0;">Target Display</label>
                            <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.75rem; height: 28px;" onclick="ToolsPage.identifyScreens()">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Identify Monitors
                            </button>
                        </div>
                        
                        <div id="display-selector" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem;">
                            ${settings.displays.map(display => `
                                <button class="display-btn ${settings.screen_name ? (settings.screen_name === display.name ? 'active' : '') : (settings.screen_index === display.index ? 'active' : '')}" data-index="${display.index}" data-name="${display.name}" style="padding: 1rem 0.5rem; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.03); color: var(--text-secondary); border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                    <div style="font-size: 0.6rem; opacity: 0.5; margin-bottom: 2px; letter-spacing: 0.05em;">MONITOR ${display.index}</div>
                                    <div style="font-size: 0.8rem; font-weight: 800; text-align: center; word-break: break-word;">${display.name}</div>
                                </button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="bg-screen-index" value="${settings.screen_index}">
                        <input type="hidden" id="bg-screen-name" value="${settings.screen_name}">
                        <p style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 1rem;">Click 'Identify' to see numbers on your screens, then select the one for your backglass.</p>
                    </div>

                </div>
            `;

            // Bind display buttons
            const displayBtns = document.querySelectorAll('.display-btn');
            const hiddenInput = document.getElementById('bg-screen-index');
            const hiddenNameInput = document.getElementById('bg-screen-name');
            displayBtns.forEach(btn => {
                btn.onclick = () => {
                    displayBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    hiddenInput.value = btn.dataset.index;
                    hiddenNameInput.value = btn.dataset.name;
                };
            });


        } catch (e) {
            body.innerHTML = `<div class="error-state">Failed to load settings: ${e.message}</div>`;
        }
    },


    async saveBackglassSettings() {
        const btn = document.getElementById('btn-save-backglass');
        btn.disabled = true;
        btn.innerText = 'Saving...';

        const settings = {
            enabled: document.getElementById('bg-enabled').checked,
            screen_index: parseInt(document.getElementById('bg-screen-index').value),
            screen_name: document.getElementById('bg-screen-name').value
        };

        try {
            const res = await fetch('/api/backglass/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.success) {
                Toast.success('Backglass settings saved');
                this.closeBackglassPanel();
            } else {
                Toast.error('Failed to save settings');
            }
        } catch (e) {
            Toast.error('Error saving settings: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Save Changes';
        }
    },

    closeBackglassPanel() {
        document.getElementById('backglass-panel').classList.remove('open');
    },

    async identifyScreens() {
        try {
            await fetch('/api/backglass/identify', { method: 'POST' });
            Toast.info('Check your monitors for identification numbers');
        } catch (e) {
            Toast.error('Failed to trigger screen identification');
        }
    }
};
