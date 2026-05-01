/* ═══════════════════════════════════════════════════════════
   Manuals Page
   ═══════════════════════════════════════════════════════════ */

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const ManualsPage = {
    state: {
        tables: [],
        selectedTable: null,
        pdfDoc: null,
        isFullscreen: false,
        zoomLevel: 1.0,
        canvas: null,
        ctx: null,
        pollingInterval: null
    },

    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 class="page-title">Game Manuals</h1>
                    <p class="page-subtitle">Review the game manuals to better understand the deep rulesets</p>
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
            <div id="manual-bulk-progress-container" style="display: none; margin-bottom: 2rem; background: var(--glass-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border); backdrop-filter: blur(8px);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="spinner-sm" id="manual-bulk-spinner"></div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;" id="manual-bulk-status-label">Processing...</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-cancel-bulk" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Cancel</button>
                </div>
                <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-full); overflow: hidden; height: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div id="manual-bulk-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); position: relative; transition: width 0.3s ease;">
                        <div class="progress-shimmer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
                    </div>
                </div>
            </div>

            <div class="adaptive-split-layout" id="manuals-workspace">
                <!-- Left Panel: Table List -->
                <div class="adaptive-sidebar">
                    <div class="manual-search-container">
                        <div class="search-wrapper" style="max-width: none;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input type="text" id="manual-search" class="search-input" placeholder="Search tables...">
                        </div>
                    </div>

                    <div class="manual-list" id="manual-table-list">
                        <!-- Populated via JS -->
                    </div>
                </div>

                <!-- Right Panel: PDF Viewer / Actions -->
                <div class="adaptive-content">
                    <div class="manual-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <!-- Persistent Back Button Container -->
                            <div id="manual-back-container" style="display: flex; align-items: center;">
                                <button class="mobile-back-btn" onclick="ManualsPage.closeDetail()">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                </button>
                            </div>
                            <div id="manual-actions-left" style="display: flex; gap: 0.75rem; align-items: center;">
                                <!-- Zoom/Nav controls go here -->
                            </div>
                        </div>
                        <div id="manual-actions" style="display: flex; gap: 0.75rem; align-items: center;">
                            <!-- Action buttons go here -->
                        </div>
                    </div>

                    <div class="pdf-viewer-container" id="manual-content-area">
                        <div class="empty-state">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-muted mb-3" style="opacity: 0.3;">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            </svg>
                            <p class="text-muted">Select a table from the list to view its manual</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        await this.loadData();
        this.startPollingStatus();
    },

    setupEventListeners() {
        document.getElementById('manual-search')?.addEventListener('input', (e) => {
            this.renderTableList(e.target.value);
        });

        document.getElementById('btn-bulk-download')?.addEventListener('click', () => {
            this.startBatchDownload();
        });

        document.getElementById('btn-cancel-bulk')?.addEventListener('click', () => {
            this.cancelBatchDownload();
        });
    },

    async loadData() {
        try {
            // Fetch tables and the list of IDs that have manuals
            const [tablesRes, manualsRes] = await Promise.all([
                fetch('/api/tables?limit=1000'),
                fetch('/api/media/tables-with-manuals')
            ]);

            if (!tablesRes.ok || !manualsRes.ok) throw new Error('Failed to load data');

            const tablesData = await tablesRes.json();
            const tables = tablesData.tables || [];
            const manualIds = await manualsRes.json(); // Array of table IDs

            // Combine data
            this.state.tables = tables.map(t => ({
                ...t,
                has_manual: manualIds.includes(t.id)
            }));

            // Sort alphabetical
            this.state.tables.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
            this.renderTableList();
        } catch (error) {
            console.error('Error loading manuals data:', error);
            Toast.show('Failed to load data', 'error');
        }
    },

    renderTableList(searchQuery = '') {
        const listEl = document.getElementById('manual-table-list');
        if (!listEl) return;

        const filtered = this.state.tables.filter(t =>
            (t.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="p-3 text-muted text-center">No tables found</div>';
            return;
        }

        listEl.innerHTML = filtered.map(table => `
            <div class="table-list-item ${this.state.selectedTable?.id === table.id ? 'active' : ''}"
                 onclick="ManualsPage.selectTable(${table.id})">
                <div class="table-info">
                    <div class="table-name">${table.display_name}</div>
                </div>
                ${table.has_manual
                ? '<span class="status-badge status-success">Available</span>'
                : '<span class="status-badge status-error">Missing</span>'
            }
            </div>
        `).join('');
    },

    async selectTable(tableId) {
        const table = this.state.tables.find(t => t.id === tableId);
        if (!table) return;

        this.state.selectedTable = table;
        document.getElementById('manuals-workspace')?.classList.add('content-active');
        this.renderTableList(document.getElementById('manual-search').value);

        const actionsArea = document.getElementById('manual-actions');
        const leftActionsArea = document.getElementById('manual-actions-left');
        const contentArea = document.getElementById('manual-content-area');

        if (leftActionsArea) leftActionsArea.innerHTML = '';
        if (actionsArea) actionsArea.innerHTML = '';

        if (table.has_manual) {
            // Already has manual: Show controls and Delete button
            if (leftActionsArea) {
                const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                leftActionsArea.innerHTML = `
                    ${!isTouchDevice ? `
                    <button class="btn btn-secondary btn-sm" id="btn-fullscreen" title="Toggle Fullscreen">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                        </svg>
                        Fullscreen
                    </button>
                    ` : ''}
                    <div id="zoom-controls" style="display: none; gap: 0.5rem; margin-left: 0.5rem; align-items: center; border-left: 1px solid var(--border-color); padding-left: 0.75rem;">
                        <button class="btn btn-secondary btn-sm" id="pdf-zoom-out" title="Zoom Out">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                        </button>
                        <span id="zoom-percent" style="font-size: 0.8rem; min-width: 40px; text-align: center; color: var(--text-secondary);">100%</span>
                        <button class="btn btn-secondary btn-sm" id="pdf-zoom-in" title="Zoom In">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                        </button>
                        <button class="btn btn-secondary btn-sm" id="pdf-zoom-reset" style="padding: 2px 8px; font-size: 0.7rem;">Reset</button>
                    </div>
                `;
            }
            if (actionsArea) {
                actionsArea.innerHTML = `
                    <button class="btn btn-danger btn-sm" id="btn-delete-manual" style="padding: 6px 12px; gap: 8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete Manual
                    </button>
                `;
            }
            this.renderPdfViewer(table);
        } else {
            // Missing manual: Show Download button
            if (actionsArea) {
                actionsArea.innerHTML = `
                    <button class="btn btn-primary btn-sm" id="btn-download-manual" onclick="ManualsPage.downloadSingleManual(${table.id})" style="padding: 6px 12px; gap: 8px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download Manual
                    </button>
                `;
            }

            contentArea.innerHTML = `
                <div class="empty-state" style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: var(--space-md);">
                    <div style="background: rgba(79, 140, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-blue); margin-bottom: var(--space-md); border: 1px solid rgba(79, 140, 255, 0.2);">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                    </div>
                    <div class="empty-state-title">No manual found for this table</div>
                    <div class="empty-state-desc">Search ScreenScraper to find and download a PDF manual.</div>
                </div>
            `;
        }
    },

    renderPdfViewer(table) {
        const contentArea = document.getElementById('manual-content-area');
        contentArea.innerHTML = '<div class="pdf-loading-overlay"><div class="spinner"></div><span>Loading manual...</span></div>';

        document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());

        document.getElementById('pdf-zoom-in')?.addEventListener('click', () => {
            if (this.state.zoomLevel < 1.0) {
                this.state.zoomLevel = Math.min(1.0, this.state.zoomLevel + 0.25);
                this.renderAllPages();
            }
        });
        document.getElementById('pdf-zoom-out')?.addEventListener('click', () => {
            this.state.zoomLevel = Math.max(0.25, this.state.zoomLevel - 0.25);
            this.renderAllPages();
        });
        document.getElementById('pdf-zoom-reset')?.addEventListener('click', () => {
            this.state.zoomLevel = 1.0;
            this.renderAllPages();
        });

        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            const zoomControls = document.getElementById('zoom-controls');
            if (zoomControls) {
                zoomControls.style.display = document.fullscreenElement ? 'flex' : 'none';
            }

            // Update button label
            const fsBtn = document.getElementById('btn-fullscreen');
            if (fsBtn) {
                const isFs = !!document.fullscreenElement;
                fsBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isFs
                        ? '<path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 4l7-7"></path>'
                        : '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>'}
                    </svg>
                    ${isFs ? 'Exit Fullscreen' : 'Fullscreen'}
                `;
            }

            this.renderAllPages();
        });

        document.getElementById('btn-delete-manual').addEventListener('click', () => this.deleteManual(table.id));

        const url = `/api/media/${table.id}/manual`;

        pdfjsLib.getDocument(url).promise.then(pdfDoc_ => {
            this.state.pdfDoc = pdfDoc_;
            this.renderAllPages();
        }).catch(err => {
            console.error('Error loading PDF:', err);
            contentArea.innerHTML = `
                <div class="empty-state">
                    <p class="text-error">Error loading PDF document.</p>
                    <p class="text-muted text-sm mt-2">${err.message}</p>
                </div>
            `;
        });
    },

    async renderAllPages() {
        const contentArea = document.getElementById('manual-content-area');

        // Save relative scroll position to avoid jumping to top
        const scrollPercent = contentArea.scrollHeight > 0 ? contentArea.scrollTop / contentArea.scrollHeight : 0;

        contentArea.innerHTML = ''; // Clear container

        const containerWidth = contentArea.clientWidth - 40; // Spacing

        // Update zoom percentage label and button states
        const zoomLabel = document.getElementById('zoom-percent');
        if (zoomLabel) zoomLabel.textContent = `${Math.round(this.state.zoomLevel * 100)}%`;

        const zoomInBtn = document.getElementById('pdf-zoom-in');
        if (zoomInBtn) {
            zoomInBtn.disabled = this.state.zoomLevel >= 1.0;
            zoomInBtn.style.opacity = this.state.zoomLevel >= 1.0 ? '0.5' : '1';
        }

        const zoomOutBtn = document.getElementById('pdf-zoom-out');
        if (zoomOutBtn) {
            zoomOutBtn.disabled = this.state.zoomLevel <= 0.25;
            zoomOutBtn.style.opacity = this.state.zoomLevel <= 0.25 ? '0.5' : '1';
        }

        for (let i = 1; i <= this.state.pdfDoc.numPages; i++) {
            const page = await this.state.pdfDoc.getPage(i);

            // Calculate scale to fit width, then apply zoomLevel
            const unscaledViewport = page.getViewport({ scale: 1 });
            const fitScale = containerWidth / unscaledViewport.width;
            const scale = fitScale * this.state.zoomLevel;
            const viewport = page.getViewport({ scale });

            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper';
            pageWrapper.style.marginBottom = '20px';
            pageWrapper.style.display = 'flex';
            pageWrapper.style.justifyContent = 'center';

            const canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            pageWrapper.appendChild(canvas);
            contentArea.appendChild(pageWrapper);

            const renderContext = {
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            };
            await page.render(renderContext).promise;
        }

        // Restore relative scroll position
        if (scrollPercent > 0) {
            contentArea.scrollTop = scrollPercent * contentArea.scrollHeight;
        }
    },

    toggleFullscreen() {
        const content = document.getElementById('manual-content-area');
        if (!content) return;

        if (!document.fullscreenElement) {
            content.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    },

    deleteManual(tableId) {
        const table = this.state.tables.find(t => t.id === tableId);
        if (!table) return;

        Modal.confirm(
            'Delete Manual',
            `Are you sure you want to delete the manual for <strong>${table.display_name}</strong>? This will remove the PDF file from disk.`,
            async () => {
                try {
                    const res = await fetch(`/api/media/${tableId}/manuals`, { method: 'DELETE' });
                    const data = await res.json();

                    if (data.success) {
                        Toast.show('Manual deleted successfully', 'success');
                        await this.loadData();
                        this.selectTable(tableId);
                    } else {
                        Toast.show(data.error || 'Failed to delete manual', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting manual:', error);
                    Toast.show('Error deleting manual', 'error');
                }
            }
        );
    },

    async downloadSingleManual(tableId) {
        try {
            Toast.show('Initiating manual download...', 'info');
            const res = await fetch(`/api/scraper/manuals/${tableId}`, { method: 'POST' });
            const data = await res.json();

            if (data.success && data.downloaded && data.downloaded.length > 0) {
                Toast.show('Manual downloaded successfully', 'success');
                await this.loadData();
                this.selectTable(tableId);
            } else if (data.success) {
                Toast.show(data.message || 'No manual was found to download', 'info');
            } else {
                Toast.show(data.error || 'Failed to download manual', 'error');
            }
        } catch (error) {
            console.error('Error downloading manual:', error);
            Toast.show('Error initiating download', 'error');
        }
    },

    async startBatchDownload() {
        try {
            const res = await fetch('/api/scraper/batch-manuals', { method: 'POST' });
            if (res.ok) {
                Toast.show('Batch download started. Monitoring progress...', 'success');
                this.startPollingStatus();
            } else {
                const data = await res.json();
                Toast.show(data.detail || 'Failed to start batch download', 'error');
            }
        } catch (error) {
            console.error('Error starting batch download:', error);
            Toast.show('Error starting batch download', 'error');
        }
    },

    startPollingStatus() {
        if (this.state.pollingInterval) clearInterval(this.state.pollingInterval);

        this.pollStatus();
        this.state.pollingInterval = setInterval(() => this.pollStatus(), 2000);
    },

    async pollStatus() {
        try {
            const res = await fetch('/api/scraper/manuals-status');
            const data = await res.json();

            const progressContainer = document.getElementById('manual-bulk-progress-container');
            const progressBar = document.getElementById('manual-bulk-progress-bar');
            const statusLabel = document.getElementById('manual-bulk-status-label');

            if (data.batch.running) {
                if (progressContainer) progressContainer.style.display = 'block';

                const percentage = data.batch.total > 0 ? (data.batch.completed / data.batch.total) * 100 : 0;
                if (progressBar) progressBar.style.width = `${percentage}%`;
                if (statusLabel) {
                    statusLabel.innerText = data.batch.total > 0
                        ? `${data.batch.current_table} (${data.batch.completed}/${data.batch.total})`
                        : data.batch.current_table;
                }
            } else {
                if (progressContainer) progressContainer.style.display = 'none';
                if (this.state.pollingInterval && data.batch.total > 0) {
                    // Task just finished
                    await this.loadData();
                    this.renderTableList(document.getElementById('manual-search')?.value || '');
                    this.stopPollingStatus();
                    Toast.show('Batch manual download complete', 'success');
                }
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    },

    stopPollingStatus() {
        if (this.state.pollingInterval) {
            clearInterval(this.state.pollingInterval);
            this.state.pollingInterval = null;
        }
    },

    async cancelBatchDownload() {
        try {
            const res = await fetch('/api/scraper/manuals-cancel', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                Toast.show('Cancellation requested', 'info');
            }
        } catch (error) {
            console.error('Error cancelling download:', error);
        }
    },

    closeDetail() {
        document.getElementById('manuals-workspace')?.classList.remove('content-active');
    },

    unload() {
        this.stopPollingStatus();
    }
};

window.ManualsPage = ManualsPage;
