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
        pageNum: 1,
        pageRendering: false,
        pageNumPending: null,
        scale: 1.5,
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
                    <p class="page-subtitle">Review PDF manuals downloaded from media files</p>
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

            <div class="manuals-layout">
                <!-- Left Panel: Table List -->
                <div class="manual-sidebar">
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
                <div class="manual-content">
                    <div class="manual-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-tertiary);">
                        <div id="manual-actions-left" style="display: flex; gap: 0.75rem; align-items: center;">
                            <!-- Zoom/Nav controls go here -->
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
        this.renderTableList(document.getElementById('manual-search').value);

        const actionsArea = document.getElementById('manual-actions');
        const leftActionsArea = document.getElementById('manual-actions-left');
        const contentArea = document.getElementById('manual-content-area');

        if (leftActionsArea) leftActionsArea.innerHTML = '';
        if (actionsArea) actionsArea.innerHTML = '';

        if (table.has_manual) {
            // Already has manual: Show controls and Delete button
            if (leftActionsArea) {
                leftActionsArea.innerHTML = `
                    <button class="btn btn-secondary btn-sm" id="pdf-zoom-out" title="Zoom Out">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </button>
                    <button class="btn btn-secondary btn-sm" id="pdf-zoom-in" title="Zoom In">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </button>
                    <div style="width: 1px; height: 20px; background: var(--border-color); margin: 0 0.5rem;"></div>
                    <button class="btn btn-secondary btn-sm" id="pdf-prev">Prev</button>
                    <span class="page-info" style="font-size:0.85rem; min-width:60px; text-align:center;">
                        <span id="pdf-page-num">1</span> / <span id="pdf-page-count">0</span>
                    </span>
                    <button class="btn btn-secondary btn-sm" id="pdf-next">Next</button>
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
        contentArea.innerHTML = '<canvas id="pdf-canvas" style="direction: ltr;"></canvas>';

        this.state.canvas = document.getElementById('pdf-canvas');
        this.state.ctx = this.state.canvas.getContext('2d');
        this.state.pageNum = 1;

        // Remove old listeners to prevent duplicates
        const prevBtn = document.getElementById('pdf-prev');
        const nextBtn = document.getElementById('pdf-next');
        const zoomInBtn = document.getElementById('pdf-zoom-in');
        const zoomOutBtn = document.getElementById('pdf-zoom-out');

        const newPrev = prevBtn.cloneNode(true);
        const newNext = nextBtn.cloneNode(true);
        const newZoomIn = zoomInBtn.cloneNode(true);
        const newZoomOut = zoomOutBtn.cloneNode(true);
        const deleteBtn = document.getElementById('btn-delete-manual');
        const newDelete = deleteBtn.cloneNode(true);

        prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        nextBtn.parentNode.replaceChild(newNext, nextBtn);
        zoomInBtn.parentNode.replaceChild(newZoomIn, zoomInBtn);
        zoomOutBtn.parentNode.replaceChild(newZoomOut, zoomOutBtn);
        deleteBtn.parentNode.replaceChild(newDelete, deleteBtn);

        document.getElementById('pdf-prev').addEventListener('click', () => this.onPrevPage());
        document.getElementById('pdf-next').addEventListener('click', () => this.onNextPage());
        document.getElementById('pdf-zoom-in').addEventListener('click', () => { this.state.scale += 0.25; this.renderPage(this.state.pageNum); });
        document.getElementById('pdf-zoom-out').addEventListener('click', () => { this.state.scale = Math.max(0.5, this.state.scale - 0.25); this.renderPage(this.state.pageNum); });
        document.getElementById('btn-delete-manual').addEventListener('click', () => this.deleteManual(table.id));

        const url = `/api/media/${table.id}/manual`;

        pdfjsLib.getDocument(url).promise.then(pdfDoc_ => {
            this.state.pdfDoc = pdfDoc_;
            document.getElementById('pdf-page-count').textContent = this.state.pdfDoc.numPages;
            this.renderPage(this.state.pageNum);
        }).catch(err => {
            console.error('Error loading PDF:', err);
            contentArea.innerHTML = `
                <div class="empty-state">
                    <p class="text-error">Error loading PDF document.</p>
                    <p class="text-muted text-sm mt-2">${err.message}</p>
                </div>
            `;
            actionsArea.style.display = 'none';
        });
    },

    renderPage(num) {
        this.state.pageRendering = true;
        this.state.pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({scale: this.state.scale});
            this.state.canvas.height = viewport.height;
            this.state.canvas.width = viewport.width;

            const renderContext = {
                canvasContext: this.state.ctx,
                viewport: viewport
            };
            const renderTask = page.render(renderContext);

            renderTask.promise.then(() => {
                this.state.pageRendering = false;
                if (this.state.pageNumPending !== null) {
                    this.renderPage(this.state.pageNumPending);
                    this.state.pageNumPending = null;
                }
            });
        });

        document.getElementById('pdf-page-num').textContent = num;
    },

    queueRenderPage(num) {
        if (this.state.pageRendering) {
            this.state.pageNumPending = num;
        } else {
            this.renderPage(num);
        }
    },

    onPrevPage() {
        if (this.state.pageNum <= 1) return;
        this.state.pageNum--;
        this.queueRenderPage(this.state.pageNum);
    },

    onNextPage() {
        if (this.state.pageNum >= this.state.pdfDoc.numPages) return;
        this.state.pageNum++;
        this.queueRenderPage(this.state.pageNum);
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

            if (data.success) {
                Toast.show('Manual downloaded successfully', 'success');
                await this.loadData();
                this.selectTable(tableId);
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

    unload() {
        this.stopPollingStatus();
    }
};

window.ManualsPage = ManualsPage;
