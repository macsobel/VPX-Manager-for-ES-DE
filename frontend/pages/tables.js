/* ═══════════════════════════════════════════════════════════
   Tables Page — Browse, Search, Filter, Detail View
   ═══════════════════════════════════════════════════════════ */

const TablesPage = {
    state: {
        tables: [],
        total: 0,
        search: '',
        sort_by: 'display_name',
        sort_dir: 'asc',
        manufacturer: '',
        year: '',
        view: 'table', // 'table', 'card', or 'media'
        offset: 0,
        limit: 50,
        filters: { manufacturers: [], years: [], types: [] },
        mediaFilter: 'all', // 'all' or 'missing'
        scraper: {
            batchRunning: false,
            quota: null
        }
    },

    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 class="page-title">Tables</h1>
                    <p class="page-subtitle">Browse and manage your VPX table library</p>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn btn-primary" id="btn-add-table">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add New Table
                    </button>
                    <div id="quota-display" class="scraper-status-bubble ${this.state.view === 'media' ? '' : 'hidden'}" style="${this.state.view !== 'media' ? 'display: none;' : ''}">
                        <div class="spinner" style="width: 12px; height: 12px;"></div>
                        <span>Checking quota...</span>
                    </div>
                </div>
            </div>
            <div class="toolbar">
                <div class="search-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="search-input" id="table-search" placeholder="Search tables..." value="${this.state.search}">
                </div>
                
                <div id="media-filters" class="filter-chips ${this.state.view === 'media' ? '' : 'hidden'}" style="${this.state.view !== 'media' ? 'display: none;' : ''}">
                    <button class="filter-chip ${this.state.mediaFilter === 'all' ? 'active' : ''}" data-filter="all">All Tables</button>
                    <button class="filter-chip ${this.state.mediaFilter === 'missing' ? 'active' : ''}" data-filter="missing">Missing Media</button>
                </div>

                <select class="input-field" id="filter-manufacturer" style="width: auto; min-width: 150px; ${this.state.view === 'media' ? 'display: none;' : ''}">
                    <option value="">All Manufacturers</option>
                </select>
                <select class="input-field" id="filter-year" style="width: auto; min-width: 120px; ${this.state.view === 'media' ? 'display: none;' : ''}">
                    <option value="">All Years</option>
                </select>
                
                <div class="toolbar-right">
                    <div class="btn-group">
                        <button class="btn-icon ${this.state.view === 'table' ? 'active' : ''}" id="view-table" title="Table view">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                        <button class="btn-icon ${this.state.view === 'card' ? 'active' : ''}" id="view-card" title="Card view">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        </button>
                        <button class="btn-icon ${this.state.view === 'media' ? 'active' : ''}" id="view-media-grid" title="Media view">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </button>
                    </div>
                    <button class="btn btn-primary ${this.state.view === 'media' ? 'hidden' : ''}" id="btn-scan-tables" style="${this.state.view === 'media' ? 'display: none;' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Scan
                    </button>
                    <button class="btn btn-primary ${this.state.view === 'media' ? '' : 'hidden'}" id="btn-scrape-all" style="${this.state.view !== 'media' ? 'display: none;' : ''}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15l-5-5L5 21"/><circle cx="8.5" cy="8.5" r="1.5"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                        Scrape All Missing
                    </button>
                </div>
            </div>

            <!-- Scan Progress Container -->
            <div id="scan-progress-container" style="display: none; margin-bottom: 2rem; background: var(--glass-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border); backdrop-filter: blur(8px);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="spinner-sm" id="scan-spinner"></div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;" id="scan-status-label">Scanning tables...</span>
                    </div>
                    <span id="scan-progress-text" style="color: var(--text-tertiary); font-variant-numeric: tabular-nums; font-size: 0.85rem; font-weight: 500;">0 / 0</span>
                </div>
                <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-full); overflow: hidden; height: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div id="scan-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;">
                        <div class="progress-shimmer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
                    </div>
                </div>
            </div>

            <!-- Batch Scraper Progress Container -->
            <div id="batch-progress-container" style="display: none; margin-bottom: var(--space-lg);">
                <div class="card" style="padding: var(--space-md); border-color: var(--accent-blue);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
                        <div style="font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                            <div class="spinner" style="width: 14px; height: 14px;"></div>
                            <span id="batch-status-text">Scraping all missing media...</span>
                        </div>
                        <button class="btn btn-danger btn-sm" id="btn-cancel-batch" style="padding: 4px 10px; font-size: 0.75rem;">Cancel</button>
                    </div>
                    <div class="scraper-progress-bar">
                        <div class="scraper-progress-fill" id="batch-progress-fill"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-tertiary);">
                        <span id="batch-progress-text">0 / 0 tables</span>
                        <span id="batch-current-table"></span>
                    </div>
                </div>
            </div>
            <div id="tables-content">
                <div style="text-align: center; padding: var(--space-xl);"><div class="spinner"></div></div>
            </div>
            <div id="tables-pagination" style="margin-top: var(--space-lg); display: flex; justify-content: space-between; align-items: center;"></div>

            <!-- Detail Panel -->
            <div class="detail-panel" id="detail-panel">
                <div class="detail-panel-header">
                    <h3 class="card-title" id="detail-title">Table Details</h3>
                    <button class="btn-icon" id="close-detail">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="detail-panel-body" id="detail-body"></div>
            </div>
        `;

        this.loadFilters();
        this.loadTables();
        
        // Restore scroll position from localStorage if available
        const savedScroll = localStorage.getItem('tables_scroll_pos');
        if (savedScroll) {
            setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 100);
        }

        // Save scroll position to localStorage
        window.onscroll = () => {
            if (window.location.hash === '#tables') {
                localStorage.setItem('tables_scroll_pos', window.scrollY);
            }
        };
        this.bindEvents();
        if (this.state.view === 'media') this.updateQuota();
        this.startStatusPolling();
    },

    unmount() {
        if (this._polling) {
            clearInterval(this._polling);
            this._polling = null;
        }
    },

    async loadFilters() {
        try {
            const res = await fetch('/api/tables/filters');
            const data = await res.json();
            this.state.filters = data;

            const mfgSelect = document.getElementById('filter-manufacturer');
            data.manufacturers.forEach(m => {
                if (m) mfgSelect.innerHTML += `<option value="${m}" ${this.state.manufacturer === m ? 'selected' : ''}>${m}</option>`;
            });

            const yearSelect = document.getElementById('filter-year');
            data.years.forEach(y => {
                if (y) yearSelect.innerHTML += `<option value="${y}" ${this.state.year === y ? 'selected' : ''}>${y}</option>`;
            });
        } catch (e) { /* filters optional */ }
    },

    async loadTables() {
        const params = new URLSearchParams({
            search: this.state.search,
            manufacturer: this.state.manufacturer,
            year: this.state.year,
            sort_by: this.state.sort_by,
            sort_dir: this.state.sort_dir,
            limit: this.state.limit,
            offset: this.state.offset,
        });

        const scrollPos = window.scrollY;
        try {
            const res = await fetch(`/api/tables?${params}`);
            const data = await res.json();
            this.state.tables = data.tables;
            this.state.total = data.total;

            if (this.state.view === 'table') {
                this.renderTableView();
            } else if (this.state.view === 'card') {
                this.renderCardView();
            } else if (this.state.view === 'media') {
                this.loadMissing(this.state.mediaFilter);
            }
            this.renderPagination();
            if (scrollPos > 0) {
                window.scrollTo(0, scrollPos);
            }
        } catch (e) {
            document.getElementById('tables-content').innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <div class="empty-state-title">Could not load tables</div>
                    <div class="empty-state-desc">${e.message}</div>
                </div>
            `;
        }
    },

    renderTableView() {
        const content = document.getElementById('tables-content');
        if (!this.state.tables.length) {
            content.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <div class="empty-state-title">No tables found</div>
                    <div class="empty-state-desc">Scan your tables directory or upload some .vpx files to get started</div>
                </div>
            `;
            return;
        }

        const sortIcon = (col) => {
            if (this.state.sort_by !== col) return '';
            return this.state.sort_dir === 'asc' ? ' ↑' : ' ↓';
        };

        content.innerHTML = `
            <div class="data-table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th data-sort="display_name" class="col-name ${this.state.sort_by === 'display_name' ? 'sorted' : ''}">Name${sortIcon('display_name')}</th>
                            <th data-sort="version" class="col-version ${this.state.sort_by === 'version' ? 'sorted' : ''}">Version${sortIcon('version')}</th>
                            <th data-sort="manufacturer" class="col-manufacturer ${this.state.sort_by === 'manufacturer' ? 'sorted' : ''}">Manufacturer${sortIcon('manufacturer')}</th>
                            <th data-sort="year" class="col-year ${this.state.sort_by === 'year' ? 'sorted' : ''}">Year${sortIcon('year')}</th>
                            <th data-sort="rating" class="col-rating ${this.state.sort_by === 'rating' ? 'sorted' : ''}">Rating${sortIcon('rating')}</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.state.tables.map(t => `
                            <tr data-id="${t.id}" style="cursor: pointer;">
                                <td class="col-name" style="font-weight: 600; color: var(--text-primary);">${this.escHtml(t.display_name)}</td>
                                 <td class="col-version">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        ${(() => {
                                            const hasDirect = t.latest_vps_version && t.version && window.isVersionNewer(t.latest_vps_version, t.version) && (!t.ignored_version || window.isVersionNewer(t.latest_vps_version, t.ignored_version));
                                            const hasCommunity = t.is_community_newer && t.community_vps_updated_at > t.vps_updated_at && (!t.ignored_version || window.isVersionNewer(t.community_vps_version, t.ignored_version));
                                            
                                            const badgeClass = t.version ? (hasDirect ? 'badge-warning' : (hasCommunity ? 'badge-info' : 'badge-success')) : 'badge-neutral';
                                            return `
                                                <span class="badge ${badgeClass}">
                                                    ${t.version || 'Unknown'}
                                                </span>
                                                ${hasDirect ? `
                                                    <span title="Direct Update: ${t.latest_vps_version}" style="color: var(--accent-amber); display: flex;">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                    </span>
                                                ` : ''}
                                                ${hasCommunity ? `
                                                    <span title="New Community Recreation: ${t.community_vps_version} by ${t.community_vps_author}" style="color: var(--accent-cyan); display: flex;">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                                                    </span>
                                                ` : ''}
                                            `;
                                        })()}
                                    </div>
                                </td>
                                <td class="col-manufacturer">${t.manufacturer || '—'}</td>
                                <td class="col-year">${t.year || '—'}</td>
                                <td class="col-rating">${t.rating ? '★'.repeat(t.rating) : '<span style="color: var(--text-muted);">—</span>'}</td>
                                <td class="col-actions">
                                    <div class="btn-group">
                                        <button class="btn-icon btn-detail" data-id="${t.id}" title="Details">
                                            <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M128,256C57.4,256,0,198.6,0,128S57.4,0,128,0s128,57.4,128,128S198.6,256,128,256z M128,20c-59.7,0-108,48.3-108,108s48.3,108,108,108c59.7,0,108-48.3,108-108S187.7,20,128,20z"/><g transform="matrix(0.6 0 0 0.6 51.2 51.2)"><path d="M143,11c-8.1,2.6-11.2,5.3-12.9,11.2c-2.1,6.9-0.9,13.2,3.1,17.2l2.5,2.5l6.9-0.3c8.4-0.4,10.4-1.2,14.2-5.4c4.1-4.5,5.7-9.1,5.7-15.4c0-6-1.2-8.7-4.3-10.1C155.4,10,147.4,10,143,11z"/><path d="M142,78c-8.9,2-28.9,15-42.4,28c-4.2,4-4.9,5-5.6,8c-1.5,6.4-0.4,9.1,2.6,6.4c0.7-0.7,3.6-2.7,6.2-4.4c10.2-6.7,15.5-7.5,15.5-2.1c0,1.1-2,11.6-4.4,23.4c-15.9,77.3-17.4,85.6-17.4,93.9c0.1,7,2.1,12.9,5.1,14.4c7.1,3.7,24.5-4.8,40.2-19.8c8.6-8.2,13.2-13.9,14-17.4c0.8-3.5,0.9-9.1,0.1-9.6c-0.3-0.2-2.6,1.7-5.1,4.1c-11.1,10.9-19.4,15.1-22.5,11.2c-2.6-3.2-1.2-11.8,8.9-59.6c12.1-57.1,13.2-63.5,12.2-70.7c-0.4-2.7-2.6-6.1-3.9-5.9C145,78,143.5,78,142,78z"/></g></svg>
                                        </button>
                                        <button class="btn-icon btn-media" data-id="${t.id}" title="Media Management">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        </button>
                                        ${t.vps_id ? `
                                            <a href="https://virtualpinballspreadsheet.github.io/?game=${t.vps_id}&f=vpx" target="_blank" class="btn-icon btn-vps-link" title="View on VPS">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-6.6 4.6L21 3"/></svg>
                                            </a>
                                        ` : `
                                            <button class="btn-icon btn-match" data-id="${t.id}" title="Match VPS">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                            </button>
                                        `}
                                        <button class="btn-icon btn-send-mobile" data-id="${t.id}" title="Send to Mobile" style="color: var(--accent-blue);">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                        </button>
                                        <button class="btn-icon btn-play" data-id="${t.id}" title="Play Table" style="color: var(--accent-emerald);">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Bind sort headers
        content.querySelectorAll('th[data-sort]').forEach(th => {
            th.onclick = () => {
                const col = th.dataset.sort;
                if (this.state.sort_by === col) {
                    this.state.sort_dir = this.state.sort_dir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.state.sort_by = col;
                    this.state.sort_dir = 'asc';
                }
                this.loadTables();
            };
        });

        // Bind row clicks
        content.querySelectorAll('tr[data-id]').forEach(row => {
            row.onclick = (e) => {
                if (e.target.closest('button')) return;
                this.showDetail(parseInt(row.dataset.id));
            };
        });

        // Bind detail buttons
        content.querySelectorAll('.btn-detail').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showDetail(parseInt(btn.dataset.id));
            };
        });

        // Bind media buttons
        content.querySelectorAll('.btn-media').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showMediaDetail(parseInt(btn.dataset.id));
            };
        });

        // Bind match buttons
        content.querySelectorAll('.btn-match').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showVPSMatch(parseInt(btn.dataset.id));
            };
        });

        // Bind send-mobile buttons
        content.querySelectorAll('.btn-send-mobile').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showSendToMobileModal(parseInt(btn.dataset.id));
            };
        });

        // Bind play buttons
        content.querySelectorAll('.btn-play').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.playTable(parseInt(btn.dataset.id));
            };
        });
    },

    renderCardView() {
        const content = document.getElementById('tables-content');
        if (!this.state.tables.length) {
            content.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <div class="empty-state-title">No tables found</div>
                    <div class="empty-state-desc">Scan your tables directory or upload some .vpx files to get started</div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="table-cards-grid">
                ${this.state.tables.map((t, i) => `
                    <div class="table-card" data-id="${t.id}" style="animation-delay: ${i * 30}ms; ${t.has_fanart ? `background-image: url('/api/media/${t.id}/serve/fanart?t=${Date.now()}');` : ''}">
                        <div class="table-card-name">${this.escHtml(t.display_name)}</div>
                        <div class="table-card-meta">
                            ${t.manufacturer ? `<span>${t.manufacturer}</span>` : ''}
                            ${t.year ? `<span>${t.year}</span>` : ''}
                            <span>${t.filename}</span>
                        </div>
                        <div class="table-card-badges">
                            ${t.has_b2s ? '<span class="badge badge-success">Backglass</span>' : ''}
                            ${t.has_rom ? '<span class="badge badge-info">ROM</span>' : ''}
                            ${t.has_pup ? '<span class="badge badge-warning">PUP</span>' : ''}
                            ${t.has_altcolor ? '<span class="badge badge-orange">Color DMD</span>' : ''}
                            ${t.has_altsound ? '<span class="badge badge-pink">Alt Sound</span>' : ''}
                            ${t.has_music ? '<span class="badge badge-teal">Music</span>' : ''}
                            ${t.vps_id ? `
                                <a href="https://virtualpinballspreadsheet.github.io/?game=${t.vps_id}&f=vpx" target="_blank" class="badge badge-info" title="View on VPS" style="cursor: pointer; text-decoration: none;">
                                    VPS <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-left: 2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-6.6 4.6L21 3"/></svg>
                                </a>
                            ` : `<button class="badge badge-warning btn-match-card" data-id="${t.id}">Unmatched</button>`}
                        </div>
                        ${t.rating ? `<div class="table-card-rating">${'★'.repeat(t.rating)}</div>` : ''}
                        <button class="btn-icon btn-files" data-id="${t.id}" title="File Manager" style="position: absolute; bottom: 12px; right: 88px; background: rgba(148, 163, 184, 0.2); border-color: var(--text-tertiary); border-radius: 50%; width: 34px; height: 34px; z-index: 2; color: var(--text-secondary);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        <button class="btn-icon btn-send-mobile" data-id="${t.id}" title="Send to Mobile" style="position: absolute; bottom: 12px; right: 50px; background: rgba(59, 130, 246, 0.2); border-color: var(--accent-blue); border-radius: 50%; width: 34px; height: 34px; z-index: 2; color: var(--accent-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                        </button>
                        <button class="btn-icon btn-play" data-id="${t.id}" title="Play Table" style="position: absolute; bottom: 12px; right: 12px; background: rgba(16, 185, 129, 0.2); border-color: var(--accent-emerald); border-radius: 50%; width: 34px; height: 34px; z-index: 2; color: var(--accent-emerald);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        content.querySelectorAll('.table-card').forEach(card => {
            card.onclick = () => this.showDetail(parseInt(card.dataset.id));
        });

        // Bind file manager buttons for cards
        content.querySelectorAll('.btn-files').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                window.location.hash = `#upload-to/${btn.dataset.id}`;
            };
        });

        // Bind send-mobile buttons for cards
        content.querySelectorAll('.btn-send-mobile').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.showSendToMobileModal(parseInt(btn.dataset.id));
            };
        });

        // Bind play buttons for cards
        content.querySelectorAll('.btn-play').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.playTable(parseInt(btn.dataset.id));
            };
        });

        // Bind match buttons for cards
        content.querySelectorAll('.btn-match-card').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                // Get ID from button dataset, or fallback to parent card dataset
                const tableId = btn.dataset.id || btn.closest('.table-card').dataset.id;
                this.showVPSMatch(parseInt(tableId));
            };
        });
    },

    renderPagination() {
        const container = document.getElementById('tables-pagination');
        const totalPages = Math.ceil(this.state.total / this.state.limit);
        const currentPage = Math.floor(this.state.offset / this.state.limit) + 1;

        container.innerHTML = `
            <span style="color: var(--text-tertiary); font-size: 0.85rem;">
                Showing ${this.state.offset + 1}–${Math.min(this.state.offset + this.state.limit, this.state.total)} of ${this.state.total} tables
            </span>
            <div class="btn-group">
                <button class="btn btn-secondary" id="prev-page" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
                <span style="padding: var(--space-sm) var(--space-md); color: var(--text-secondary); font-size: 0.85rem;">
                    Page ${currentPage} of ${totalPages || 1}
                </span>
                <button class="btn btn-secondary" id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
            </div>
        `;

        document.getElementById('prev-page').onclick = () => {
            this.state.offset = Math.max(0, this.state.offset - this.state.limit);
            this.loadTables();
        };
        document.getElementById('next-page').onclick = () => {
            this.state.offset += this.state.limit;
            this.loadTables();
        };
    },

    async showSendToMobileModal(tableId) {
        try {
            const res = await fetch(`/api/tables/${tableId}`);
            if (!res.ok) throw new Error('Failed to load table info');
            const table = await res.json();

            const iosAppUrl = encodeURIComponent("https://apps.apple.com/us/app/visual-pinball/id6547859926");
            const androidAppUrl = encodeURIComponent("https://github.com/vpinball/vpinball/releases");
            const iosQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${iosAppUrl}`;
            const androidQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${androidAppUrl}`;

            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            const isFirefox = /Firefox/.test(navigator.userAgent);
            const isSafari = /Apple/.test(navigator.vendor) && /Safari/.test(navigator.userAgent) && !isChrome;
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            const choices = [
                { label: 'Cancel', class: 'btn-secondary', onClick: () => { Modal.hide(); } }
            ];

            // AirDrop only makes sense if we are local on a Mac
            if (isLocal && (isSafari || (!isFirefox && !isChrome && navigator.canShare))) {
                choices.push({
                    label: 'AirDrop',
                    class: 'btn-primary',
                    onClick: () => this.handleMobileExport(tableId, table.display_name, 'share')
                });
            }

            if (isLocal && isChrome) {
                // Local Chromium users get the direct 'Generate' action
                choices.push({
                    label: 'Generate Mobile Table File',
                    class: 'btn-primary',
                    onClick: () => this.handleMobileExport(tableId, table.display_name, 'generate')
                });
            } else {
                // Remote users or other local browsers get the standard download
                choices.push({
                    label: 'Download .vpxz',
                    class: 'btn-primary',
                    onClick: () => this.handleMobileExport(tableId, table.display_name, 'download')
                });
            }

            Modal.show(`
                <h3 class="modal-title">Send to Mobile</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 20px;">
                    This will package <strong>${this.escHtml(table.display_name)}</strong> (including the table file and required ROMs) into a single <code>.vpxz</code> file for the VPX Standalone mobile app.
                </p>
                <div style="text-align: center; margin-bottom: 15px; font-weight: 600; color: var(--text-primary); font-size: 0.95rem; letter-spacing: 0.5px;">
                    Visual Pinball Mobile
                </div>
                <div style="display: flex; gap: 40px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap;">
                    <div style="text-align: center;">
                        <img src="${iosQrUrl}" alt="iOS App Store" style="border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 8px;" />
                        <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">iOS (App Store)</div>
                    </div>
                    <div style="text-align: center;">
                        <img src="${androidQrUrl}" alt="Android GitHub" style="border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 8px;" />
                        <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Android (GitHub)</div>
                    </div>
                </div>
                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;" id="mobile-export-actions">
                    ${choices.map((c, i) => `
                        <button class="btn ${c.class || 'btn-secondary'}" id="modal-export-btn-${i}">${c.label}</button>
                    `).join('')}
                </div>
            `);

            choices.forEach((c, i) => {
                document.getElementById(`modal-export-btn-${i}`).onclick = () => {
                    if (c.onClick) c.onClick();
                };
            });
        } catch (e) {
            Toast.error('Failed to prepare mobile export: ' + e.message);
        }
    },

    async handleMobileExport(tableId, tableName, mode) {
        // Switch modal to loading state
        document.getElementById('modal-content').innerHTML = `
            <h3 class="modal-title">Packaging ${this.escHtml(tableName)}...</h3>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; gap: 20px;">
                <div class="spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">Compressing table and ROMs. This may take a minute.</p>
            </div>
        `;

        try {
            const res = await fetch(`/api/tables/${tableId}/export-mobile`, { method: 'POST' });
            const data = await res.json();
            if (!data.success) throw new Error('Export failed');

            const filename = data.filename;
            const size = data.size;
            const isLarge = size > 50 * 1024 * 1024; // > 50MB
            const downloadUrl = `/api/tables/downloads/${encodeURIComponent(filename)}`;
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            const isSafari = /Apple/.test(navigator.vendor) && /Safari/.test(navigator.userAgent) && !isChrome;

            // Direct Actions for Download/Generate modes
            if (mode === 'download') {
                await this.triggerDownload(downloadUrl, filename);
                Modal.hide();
                Toast.success('Download started');
                return;
            }

            if (mode === 'generate') {
                await fetch('/api/tables/reveal-builds', { method: 'POST' });
                Modal.hide();
                Toast.success('Opening Builds folder...');
                return;
            }

            const showWarning = isLarge && !isSafari;
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            // Share Mode: Show the secondary "Package Ready" screen
            document.getElementById('modal-content').innerHTML = `
                <h3 class="modal-title">Package Ready</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 20px;">
                    The package for <strong>${this.escHtml(tableName)}</strong> is ready (${(size / (1024 * 1024)).toFixed(1)} MB).
                </p>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0 20px 0; gap: 15px;">
                    <div style="color: ${showWarning ? 'var(--accent-amber)' : 'var(--accent-emerald)'}; background: ${showWarning ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; padding: 20px; border-radius: 50%; border: 2px solid ${showWarning ? 'var(--accent-amber)' : 'var(--accent-emerald)'};">
                        ${showWarning ? 
                            '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' :
                            '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
                        }
                    </div>
                    <p style="font-weight: 600; color: var(--text-primary); text-align: center;">
                        ${showWarning ? 'Large File Detected' : 'Table packaged successfully'}
                    </p>
                    ${isLocal ? `
                        <button class="btn btn-secondary" id="btn-reveal-folder" style="margin-top: 5px; border-style: dashed; background: rgba(255,255,255,0.05);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            Reveal in Finder
                        </button>
                    ` : ''}
                    ${isSafari ? `
                        <p style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center; max-width: 320px; line-height: 1.5;">
                            When you AirDrop to your phone, the file will be saved in your <strong>Downloads</strong> folder within the <strong>Files</strong> app.
                        </p>
                    ` : (showWarning ? `
                        <p style="font-size: 0.8rem; color: var(--text-tertiary); text-align: center; max-width: 300px;">
                            Browsers often block AirDrop/Sharing for files over 50MB. Please use the <strong>Download</strong> link instead.
                        </p>
                    ` : '')}
                    ${(!isLocal && isChrome) ? `
                        <div style="margin-top: 10px; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.75rem; color: var(--text-tertiary); max-width: 340px;">
                            <strong style="color: var(--text-secondary); display: block; margin-bottom: 4px;">Remote Chrome User:</strong>
                            Chrome may rename this download to a random ID. The original file is stored on your <strong>Server Mac</strong> at:<br/>
                            <code style="display: block; margin-top: 6px; color: var(--accent-emerald); word-break: break-all;">~/Library/Application Support/VPX Manager for ES-DE/Mobile Builds/</code>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" id="btn-share-cancel">Cancel</button>
                    <button class="btn btn-primary" id="btn-share-download-vpxz">
                        Download .vpxz
                    </button>
                    <button class="btn btn-primary" id="btn-share-trigger" style="${showWarning ? 'background: var(--accent-amber); border-color: var(--accent-amber); color: #000;' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        ${isSafari ? 'AirDrop' : 'Try AirDrop'}
                    </button>
                </div>
            `;

            document.getElementById('btn-share-cancel').onclick = () => Modal.hide();
            if (isLocal) {
                document.getElementById('btn-reveal-folder').onclick = async () => {
                    await fetch('/api/tables/reveal-builds', { method: 'POST' });
                    Modal.hide();
                    Toast.success('Opening Builds folder...');
                };
            }
            document.getElementById('btn-share-download-vpxz').onclick = async () => {
                await this.triggerDownload(downloadUrl, filename);
                Modal.hide();
                Toast.success('Download started');
            };
            document.getElementById('btn-share-trigger').onclick = async () => {
                const triggerBtn = document.getElementById('btn-share-trigger');
                triggerBtn.disabled = true;
                triggerBtn.innerHTML = '<div class="spinner-sm"></div> Preparing...';
                
                try {
                    // Fetch blob ONLY when they explicitly try to share
                    const fileRes = await fetch(downloadUrl);
                    const blob = await fileRes.blob();
                    const file = new File([blob], filename, { type: 'application/zip' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: tableName,
                            text: 'VPX Table Package',
                            files: [file]
                        });
                        Modal.hide();
                        Toast.success('Shared successfully!');
                    } else {
                        throw new Error("Sharing files is not supported on this browser.");
                    }
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        Toast.error('Sharing failed: ' + err.message);
                    }
                    triggerBtn.disabled = false;
                    triggerBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Try AirDrop';
                }
            };
        } catch (e) {
            Modal.hide();
            Toast.error('Export error: ' + e.message);
        }
    },

    async playTable(tableId) {
        try {
            Toast.info('Launching...');
            const res = await fetch(`/api/tables/${tableId}/launch`, { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                Toast.success('Command sent to host!');
            } else {
                Toast.error(data.error || 'Failed to launch table');
            }
        } catch (e) {
            Toast.error('Error launching table: ' + e.message);
        }
    },

    async showDetail(tableId) {
        const panel = document.getElementById('detail-panel');
        const body = document.getElementById('detail-body');
        const title = document.getElementById('detail-title');

        body.innerHTML = '<div class="spinner"></div> Loading...';
        panel.classList.add('open');

        try {
            const res = await fetch(`/api/tables/${tableId}`);
            const t = await res.json();

            title.textContent = t.display_name;
            body.innerHTML = `
                <div style="margin-bottom: var(--space-md);">
                    <div class="input-label">Rating</div>
                    <div id="rating-stars" class="rating-stars" style="font-size: 1.5rem; cursor: pointer; display: flex; gap: 4px; align-items: center;">
                        <span data-rating="0" title="No Rating" style="color: ${(t.rating || 0) === 0 ? 'var(--accent-red)' : 'var(--text-muted)'}; margin-right: 8px; font-size: 1.2rem; display: flex; align-items: center;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        </span>
                        ${[1, 2, 3, 4, 5].map(n => `<span data-rating="${n}" style="color: ${n <= (t.rating || 0) ? 'var(--accent-amber)' : 'var(--text-muted)'}">★</span>`).join('')}
                    </div>
                </div>

                <div style="margin-bottom: var(--space-md);">
                    <div class="input-label">Description</div>
                    <textarea class="input-field" id="detail-notes" rows="4" style="resize: vertical; font-size: 0.9rem; line-height: 1.5;">${t.notes || ''}</textarea>
                </div>

                <div style="margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--glass-border);">
                    <div class="input-label" style="margin-bottom: var(--space-sm);">Metadata</div>
                    <div class="input-group">
                        <div class="input-label">Display Name</div>
                        <input class="input-field" id="detail-name" value="${this.escHtml(t.display_name)}">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-top: var(--space-md);">
                        <div class="input-group">
                            <div class="input-label">Manufacturer</div>
                            <input class="input-field" id="detail-manufacturer" value="${this.escHtml(t.manufacturer || '')}">
                        </div>
                        <div class="input-group">
                            <div class="input-label">Year</div>
                            <input class="input-field" id="detail-year" value="${this.escHtml(t.year || '')}">
                        </div>
                    </div>
                </div>

                <div style="margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--glass-border);">
                    <div class="input-label" style="margin-bottom: var(--space-sm);">File Information</div>
                    <div style="font-size: 0.82rem; color: var(--text-tertiary); display: grid; gap: var(--space-xs);">
                        <div><strong>File:</strong> ${t.filename}</div>
                        <div><strong>Version:</strong> <span class="badge ${t.version ? (t.latest_vps_version && window.isVersionNewer(t.latest_vps_version, t.version) && (!t.ignored_version || window.isVersionNewer(t.latest_vps_version, t.ignored_version)) ? 'badge-warning' : 'badge-success') : 'badge-neutral'}">${t.version || 'Unknown'}</span></div>
                        
                        ${t.latest_vps_version && window.isVersionNewer(t.latest_vps_version, t.version) && (!t.ignored_version || window.isVersionNewer(t.latest_vps_version, t.ignored_version)) ? `
                        <div style="color: var(--accent-amber); font-weight: 600; margin-top: 12px;">
                            <div style="margin-bottom: 8px;"><strong>Direct Update:</strong> ${t.latest_vps_version} (same author)</div>
                            <div style="display: flex; gap: var(--space-xs);">
                                <button class="btn btn-secondary btn-sm" id="btn-detail-ignore-direct">Ignore Update</button>
                                ${t.vps_file_url ? `<a href="${t.vps_file_url}" target="_blank" rel="noopener" class="btn btn-accent btn-sm">Download File</a>` : ''}
                            </div>
                        </div>
                        ` : ''}

                        ${t.is_community_newer && t.community_vps_updated_at > t.vps_updated_at && (!t.ignored_version || window.isVersionNewer(t.community_vps_version, t.ignored_version)) ? `
                        <div style="color: var(--accent-cyan); font-weight: 600; margin-top: 12px;">
                            <div style="margin-bottom: 8px;"><strong>Community Newcomer:</strong> ${t.community_vps_version} (by ${t.community_vps_author})</div>
                            <div style="display: flex; gap: var(--space-xs);">
                                <button class="btn btn-secondary btn-sm" id="btn-detail-ignore-community">Ignore Update</button>
                                ${t.community_vps_url ? `<a href="${t.community_vps_url}" target="_blank" rel="noopener" class="btn btn-accent btn-sm" style="background: var(--accent-cyan); color: #000;">Download File</a>` : ''}
                            </div>
                        </div>
                        ` : ''}

                        <div style="margin-top: 4px;"><strong>Author:</strong> ${t.author || 'Unknown'}</div>
                        
                        ${t.vps_id ? `
                        <div style="margin-bottom: 4px;">
                            <a href="https://virtualpinballspreadsheet.github.io/?game=${t.vps_id}${t.vps_file_id ? `&fileType=table&fileId=${t.vps_file_id}` : ''}&f=vpx" target="_blank" rel="noopener" class="link" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.82rem; color: var(--accent-blue);">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                View on VPS
                            </a>
                        </div>
                        ` : ''}

                        <div><strong>Path:</strong> ${t.folder_path}</div>
                        <div><strong>VPS ID:</strong> ${t.vps_id || 'Not matched'}</div>
                        <div><strong>IPDB ID:</strong> ${t.ipdb_id ? `<a href="https://www.ipdb.org/machine.cgi?id=${t.ipdb_id}" target="_blank" rel="noopener" class="link" style="color: var(--accent-blue); text-decoration: underline;">${t.ipdb_id}</a>` : 'N/A'}</div>
                        <div><strong>Added:</strong> ${t.date_added ? new Date(t.date_added).toLocaleDateString() : 'Unknown'}</div>
                    </div>
                </div>

                <div style="margin-top: var(--space-md); margin-bottom: var(--space-sm);">
                    <button class="btn btn-success" id="btn-detail-play" style="width: 100%; height: 44px; font-size: 1rem; background: linear-gradient(135deg, var(--accent-emerald), #059669); border: none; box-shadow: 0 4px 12px var(--accent-emerald-glow);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Play Table
                    </button>
                </div>

                <div style="margin-top: var(--space-sm);">
                    <button class="btn btn-secondary" id="btn-view-media" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15l-5-5L5 21"/><circle cx="8.5" cy="8.5" r="1.5"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                        Manage Table Media
                    </button>
                </div>

                <div style="margin-top: var(--space-sm);">
                    <button class="btn btn-secondary" id="btn-add-files" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Edit Table Files
                    </button>
                </div>

                <div style="margin-top: var(--space-sm); display: flex; gap: var(--space-sm);">
                    <button class="btn btn-secondary" id="btn-manage-vbs" style="flex: 1; height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Manage VBS
                    </button>
                    <button class="btn btn-secondary" id="btn-manage-ini" style="flex: 1; height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                        Manage INI
                    </button>
                </div>

                <div style="margin-top: var(--space-md); display: flex; gap: var(--space-sm); align-items: stretch;">
                    <button class="btn btn-primary" id="btn-save-detail" style="flex: 1; justify-content: center;">Save Changes</button>
                    ${t.vps_id ? `
                        <button class="btn btn-danger" id="btn-detail-unmatch" title="Drop VPS Match" style="padding: 0 12px; height: 38px; display: flex; align-items: center; justify-content: center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.84 18.84A8 8 0 0 1 12 12M5.11 5.11a8 8 0 0 0 11.23 11.23"></path><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                        </button>
                    ` : `
                        <button class="btn btn-accent" id="btn-detail-match" title="Match to VPS" style="padding: 0 12px; height: 38px; display: flex; align-items: center; justify-content: center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        </button>
                    `}
                    <button class="btn btn-danger" id="btn-delete-table" title="Delete Table from Disk" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.2); padding: 0 12px; height: 38px; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></polyline></svg>
                    </button>
                </div>
            `;

            // Bind events
            document.getElementById('btn-detail-play').onclick = () => this.playTable(tableId);

            // Rating stars
            let currentRating = t.rating || 0;
            document.querySelectorAll('#rating-stars span').forEach(star => {
                star.onclick = () => {
                    currentRating = parseInt(star.dataset.rating);
                    document.querySelectorAll('#rating-stars span').forEach(s => {
                        const sRating = parseInt(s.dataset.rating);
                        if (sRating === 0) {
                            // The "No Rating" icon
                            s.style.color = (currentRating === 0) ? 'var(--accent-red)' : 'var(--text-muted)';
                        } else {
                            // The stars
                            if (currentRating === 0) {
                                s.style.color = 'var(--text-muted)';
                            } else {
                                s.style.color = sRating <= currentRating ? 'var(--accent-amber)' : 'var(--text-muted)';
                            }
                        }
                    });
                };
            });

            // Ignore updates
            const btnIgnoreDirect = document.getElementById('btn-detail-ignore-direct');
            if (btnIgnoreDirect) {
                btnIgnoreDirect.onclick = async () => {
                    try {
                        const res = await fetch(`/api/tables/${tableId}/ignore`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ version: t.latest_vps_version })
                        });
                        if (res.ok) {
                            Toast.success(`Ignored version ${t.latest_vps_version}`);
                            this.showDetail(tableId);
                            this.loadTables();
                        }
                    } catch (e) {
                        Toast.error("Failed to ignore version");
                    }
                };
            }

            const btnIgnoreCommunity = document.getElementById('btn-detail-ignore-community');
            if (btnIgnoreCommunity) {
                btnIgnoreCommunity.onclick = async () => {
                    try {
                        const res = await fetch(`/api/tables/${tableId}/ignore`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ version: t.community_vps_version })
                        });
                        if (res.ok) {
                            Toast.success(`Ignored version ${t.community_vps_version}`);
                            this.showDetail(tableId);
                            this.loadTables();
                        }
                    } catch (e) {
                        Toast.error("Failed to ignore version");
                    }
                };
            }

            // Save
            document.getElementById('btn-save-detail').onclick = async () => {
                try {
                    await fetch(`/api/tables/${tableId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            display_name: document.getElementById('detail-name').value,
                            manufacturer: document.getElementById('detail-manufacturer').value,
                            year: document.getElementById('detail-year').value,
                            rating: currentRating,
                            notes: document.getElementById('detail-notes').value,
                        }),
                    });
                    Toast.success('Table updated');
                    this.loadTables();
                } catch (e) {
                    Toast.error('Failed to save: ' + e.message);
                }
            };

            // Delete
            document.getElementById('btn-delete-table').onclick = () => {
                Modal.confirm('Delete Table', `
                    Are you sure you want to remove <strong>${this.escHtml(t.display_name)}</strong> from the database?
                    <div style="margin-top: 15px; display: flex; align-items: center; gap: 8px; padding: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 8px;">
                        <input type="checkbox" id="delete-disk-files" checked style="width: 16px; height: 16px; cursor: pointer;">
                        <label for="delete-disk-files" style="font-size: 0.85rem; cursor: pointer; color: var(--text-primary); font-weight: 500;">Also delete table folder and media from disk</label>
                    </div>
                `, async () => {
                    const deleteFiles = document.getElementById('delete-disk-files')?.checked || false;
                    try {
                        const res = await fetch(`/api/tables/${tableId}?delete_files=${deleteFiles}`, { method: 'DELETE' });
                        
                        let data;
                        try {
                            data = await res.json();
                        } catch (parseError) {
                            throw new Error(res.ok ? 'Server returned invalid response' : `Server error: ${res.status} ${res.statusText}`);
                        }

                        if (res.ok && data.success) {
                            Toast.success(data.message || 'Table removed');
                            panel.classList.remove('open');
                            this.loadTables();
                        } else {
                            Toast.error(data.error || data.detail || 'Failed to remove table');
                        }
                    } catch (e) {
                        Toast.error('Failed to delete: ' + e.message);
                    }
                });
            };

            // VPS Match
            const matchBtn = document.getElementById('btn-detail-match');
            if (matchBtn) {
                matchBtn.onclick = () => {
                    panel.classList.remove('open');
                    this.showVPSMatch(tableId);
                };
            }

            // VPS Unmatch
            const unmatchBtn = document.getElementById('btn-detail-unmatch');
            if (unmatchBtn) {
                unmatchBtn.onclick = () => {
                    Modal.confirm('Remove VPS Match', 'Are you sure you want to remove the VPS match for this table?', async () => {
                        try {
                            const res = await fetch(`/api/vps/unmatch/${tableId}`, { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                                Toast.success('VPS match removed');
                                panel.classList.remove('open');
                                this.loadTables();
                            } else {
                                Toast.error('Unmatch failed: ' + (data.message || 'Unknown error'));
                            }
                        } catch (e) {
                            Toast.error('Unmatch failed: ' + e.message);
                        }
                    });
                };
            }

            // Add Files — navigate to upload page with table context
                document.getElementById('btn-add-files').onclick = () => {
                    panel.classList.remove('open');
                    window.location.hash = `#upload-to/${tableId}`;
                };

                // View Media — show media detail in current panel
                document.getElementById('btn-view-media').onclick = () => {
                    this.showMediaDetail(tableId);
                };

                // Manage VBS
                document.getElementById('btn-manage-vbs').onclick = () => {
                    panel.classList.remove('open');
                    window.location.hash = `#vbs-manager/${tableId}`;
                };

                // Manage INI
                document.getElementById('btn-manage-ini').onclick = () => {
                    panel.classList.remove('open');
                    window.location.hash = `#ini-manager/${tableId}`;
                };
        } catch (e) {
            body.innerHTML = `<span style="color: var(--accent-red);">Failed to load: ${e.message}</span>`;
        }
    },

    async showVPSMatch(tableId) {
        console.log('DEBUG: showVPSMatch called for tableId:', tableId);
        if (!tableId || isNaN(tableId)) {
            console.error('ERROR: Invalid tableId passed to showVPSMatch');
            Toast.error('Invalid table ID');
            return;
        }
        try {
            const res = await fetch(`/api/vps/suggestions/${tableId}`);
            let data;
            try {
                data = await res.json();
            } catch (parseError) {
                const text = await res.text();
                if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
                    throw new Error(`Server returned an HTML error page (Status ${res.status}). Check backend logs.`);
                }
                throw new Error(`Invalid server response (Status ${res.status}): ${text.substring(0, 100)}`);
            }
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            console.log('DEBUG: VPS suggestions data:', data);

            let searchHtml = `
                <h3 class="modal-title">Match "${this.escHtml(data.table_name)}" to VPS</h3>
                <div class="input-group">
                    <input class="input-field" id="vps-search-input" placeholder="Search VPS database..." value="${data.table_name}">
                </div>
                <div class="vps-suggestion-list" id="vps-suggestions">
                    ${(data.suggestions && data.suggestions.length) ? data.suggestions.map(s => `
                        <div class="vps-suggestion" data-vps='${JSON.stringify(s).replace(/'/g, "&#39;")}'>
                            <div>
                                <div class="vps-suggestion-name">${this.escHtml(s.name)}</div>
                                <div class="vps-suggestion-meta">${s.manufacturer || ''} ${s.year || ''} · ${s.type || ''} · v${s.version || 'Unknown'} by ${s.vps_author || 'Unknown'}</div>
                            </div>
                            <span class="vps-suggestion-score">${Math.round(s.score * 100)}%</span>
                        </div>
                    `).join('') : '<div style="color: var(--text-muted); text-align: center; padding: var(--space-lg);">No suggestions found. Try syncing the VPS database first.</div>'}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                </div>
            `;

            Modal.show(searchHtml);

            // Bind suggestion clicks
            document.querySelectorAll('.vps-suggestion').forEach(el => {
                el.onclick = async () => {
                    const vps = JSON.parse(el.dataset.vps);
                    try {
                        await fetch(`/api/vps/match/${tableId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                vps_id: vps.vps_id,
                                vps_file_id: vps.vps_file_id,
                                name: vps.name,
                                manufacturer: vps.manufacturer,
                                year: vps.year,
                                theme: vps.theme,
                                table_type: vps.type,
                                ipdb_id: String(vps.ipdb_id || ''),
                            }),
                        });
                        Toast.success(`Matched to "${vps.name}"`);
                        Modal.hide();
                        this.loadTables();
                        if (document.getElementById('detail-panel').classList.contains('open')) {
                            this.showMediaDetail(tableId);
                        }
                    } catch (e) {
                        Toast.error('Match failed: ' + e.message);
                    }
                };
            });

            // Live search
            const searchInput = document.getElementById('vps-search-input');
            let debounce;
            searchInput.oninput = () => {
                clearTimeout(debounce);
                debounce = setTimeout(async () => {
                    const q = searchInput.value.trim();
                    if (!q) return;
                    try {
                        const res = await fetch(`/api/vps/search?q=${encodeURIComponent(q)}&limit=15`);
                        const sdata = await res.json();
                        const list = document.getElementById('vps-suggestions');
                        if (sdata.results.length) {
                            list.innerHTML = sdata.results.map(s => `
                                <div class="vps-suggestion" data-vps='${JSON.stringify(s).replace(/'/g, "&#39;")}'>
                                    <div>
                                        <div class="vps-suggestion-name">${this.escHtml(s.name)}</div>
                                        <div class="vps-suggestion-meta">${s.manufacturer || ''} ${s.year || ''} · ${s.type || ''}</div>
                                    </div>
                                    <span class="vps-suggestion-score">${Math.round(s.score * 100)}%</span>
                                </div>
                            `).join('');
                            // Rebind clicks
                            list.querySelectorAll('.vps-suggestion').forEach(el => {
                                el.onclick = async () => {
                                    const vps = JSON.parse(el.dataset.vps);
                                    try {
                                        await fetch(`/api/vps/match/${tableId}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                vps_id: vps.vps_id,
                                                name: vps.name,
                                                manufacturer: vps.manufacturer,
                                                year: vps.year,
                                                theme: vps.theme,
                                                table_type: vps.type,
                                                ipdb_id: String(vps.ipdb_id || ''),
                                            }),
                                        });
                                        Toast.success(`Matched to "${vps.name}"`);
                                        Modal.hide();
                                        this.loadTables();
                                        if (document.getElementById('detail-panel').classList.contains('open')) {
                                            this.showMediaDetail(tableId);
                                        }
                                    } catch (e) {
                                        Toast.error('Match failed: ' + e.message);
                                    }
                                };
                            });
                        } else {
                            list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: var(--space-lg);">No results found</div>';
                        }
                    } catch (e) { /* ignore */ }
                }, 300);
            };
            
            // Automatically trigger fallback search if no initial suggestions were found
            if (data.suggestions && !data.suggestions.length && searchInput.value) {
                searchInput.dispatchEvent(new Event('input'));
            }
        } catch (e) {
            Toast.error('Could not load VPS suggestions: ' + e.message);
        }
    },

    bindEvents() {
        // Search
        let searchDebounce;
        document.getElementById('table-search').oninput = (e) => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                this.state.search = e.target.value;
                this.state.offset = 0;
                this.loadTables();
            }, 300);
        };

        // Filters
        document.getElementById('filter-manufacturer').onchange = (e) => {
            this.state.manufacturer = e.target.value;
            this.state.offset = 0;
            this.loadTables();
        };

        document.getElementById('filter-year').onchange = (e) => {
            this.state.year = e.target.value;
            this.state.offset = 0;
            this.loadTables();
        };

        // Media filter chips
        document.querySelectorAll('#media-filters .filter-chip').forEach(chip => {
            chip.onclick = () => {
                document.querySelectorAll('#media-filters .filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.state.mediaFilter = chip.dataset.filter;
                this.loadMissing(this.state.mediaFilter);
            };
        });

        // View toggle (Use hash navigation for deep linking)
        document.getElementById('view-table').onclick = () => {
            window.location.hash = '#tables/list';
        };
        document.getElementById('view-card').onclick = () => {
            window.location.hash = '#tables/grid';
        };
        document.getElementById('view-media-grid').onclick = () => {
            window.location.hash = '#tables/media';
        };

        // Scraper buttons
        const btnScrapeAll = document.getElementById('btn-scrape-all');
        if (btnScrapeAll) btnScrapeAll.onclick = () => this.scrapeAll();

        const btnCancelBatch = document.getElementById('btn-cancel-batch');
        if (btnCancelBatch) btnCancelBatch.onclick = async () => {
            await fetch('/api/scraper/cancel', { method: 'POST' });
            Toast.info('Cancellation requested...');
        };

        // Scan
        document.getElementById('btn-scan-tables').onclick = async () => {
            const btn = document.getElementById('btn-scan-tables');
            btn.disabled = true;
            Toast.info('Scan started in background...');
            try {
                await fetch('/api/tables/scan', { method: 'POST' });
                TablesPage.pollScanStatus();
            } catch (e) {
                Toast.error('Scan failed: ' + e.message);
                btn.disabled = false;
            }
        };

        // Close detail
        document.getElementById('close-detail').onclick = () => {
            document.getElementById('detail-panel').classList.remove('open');
        };

        // Add New Table
        document.getElementById('btn-add-table').onclick = () => {
            window.location.hash = '#upload';
        };
    },

    // ═══════════════════════════════════════════════════════════
    // Media & Scraper Integration (Ported from MediaPage)
    // ═══════════════════════════════════════════════════════════

    async updateQuota() {
        try {
            const res = await fetch('/api/scraper/status?include_quota=true');
            const data = await res.json();
            this.state.scraper.quota = data.quota;
            this.state.scraper.has_credentials = data.has_credentials;
            
            const display = document.getElementById('quota-display');
            if (!display) return;

            if (data.quota.authenticated) {
                display.innerHTML = `
                    <div class="dot" style="background: var(--accent-emerald);"></div>
                    <span>ScreenScraper: <strong>${data.quota.requests_today} / ${data.quota.max_requests}</strong> requests</span>
                `;
                display.classList.add('active');
            } else {
                display.innerHTML = `
                    <div class="dot" style="background: var(--accent-red);"></div>
                    <span>ScreenScraper: <strong>Disabled</strong> (check Settings)</span>
                `;
                display.classList.remove('active');
            }
        } catch (e) { console.error('Quota update failed', e); }
    },

    async loadMissing(filterType = 'missing') {
        const content = document.getElementById('tables-content');
        content.innerHTML = '<div style="text-align: center; padding: var(--space-xl);"><div class="spinner"></div></div>';
        
        try {
            const res = await fetch('/api/media/missing');
            const data = await res.json();
            
            let tables = data.tables;
            
            if (this.state.search) {
                const q = this.state.search.toLowerCase();
                tables = tables.filter(t => t.display_name.toLowerCase().includes(q) || t.filename.toLowerCase().includes(q));
            }

            if (filterType === 'missing') {
                tables = tables.filter(t => t.missing_types && t.missing_types.length > 0);
            }
            
            this.renderMediaGrid(tables);
        } catch (e) {
            this.renderEmptyState(e.message);
        }
    },

    renderMediaGrid(tables) {
        const content = document.getElementById('tables-content');
        if (!tables.length) {
            this.renderEmptyState('No tables match this filter');
            return;
        }

        const mediaTypes = [
            { id: 'screenshots', label: 'Screenshot' },
            { id: 'covers', label: 'Cover' },
            { id: 'fanart', label: 'Fanart' },
            { id: 'marquees', label: 'Marquee' },
            { id: 'videos', label: 'Video' },
            { id: 'manuals', label: 'Manual' },
        ];

        content.innerHTML = `
            <div class="media-grid">
                ${tables.map((t, i) => `
                    <div class="media-card" style="animation-delay: ${i * 30}ms;" id="table-card-${t.id}">
                        <div class="media-card-header">
                            <div class="media-card-title" title="${t.filename}">${t.display_name}</div>
                            <div class="media-card-actions-top">
                                ${!t.vps_id ? `
                                    <button class="btn btn-icon btn-match" data-id="${t.id}" title="Match VPS">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                    </button>
                                ` : ''}
                                <button class="btn btn-icon btn-scrape-unified" data-id="${t.id}" title="Scrape Media">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                </button>
                                <button class="btn btn-icon btn-delete-all-media" data-id="${t.id}" title="Delete All Media" style="color: var(--accent-red); background: rgba(239, 68, 68, 0.1);">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                        <div class="media-types-grid" style="grid-template-columns: repeat(3, 1fr);">
                            ${mediaTypes.map(type => {
                                const hasEsde = t.existing_types && t.existing_types.includes(type.id);
                                let statusClass = hasEsde ? 'present' : 'missing';
                                let icon = hasEsde ? '✓' : '✗';

                                return `
                                    <div class="media-type-cell ${statusClass}" data-type="${type.id}" title="${type.label}">
                                        <span class="status-icon">${icon}</span>
                                        <span style="font-size: 0.75rem;">${type.label}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        content.querySelectorAll('.media-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('button')) return;
                this.showMediaDetail(parseInt(card.id.replace('table-card-', '')));
            };
        });

        content.querySelectorAll('.btn-scrape-unified').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.handleScrapeClick(parseInt(btn.dataset.id)); }
        });
        content.querySelectorAll('.btn-delete-all-media').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.handleDeleteMediaClick(parseInt(btn.dataset.id)); }
        });
        content.querySelectorAll('.btn-match').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); this.showVPSMatch(parseInt(btn.dataset.id)); }
        });
    },

    async validateScrapeConditions(tables) {
        // Force a quota check if we don't have a confirmed authenticated state yet
        if (!this.state.scraper.quota || !this.state.scraper.quota.authenticated) {
            await this.updateQuota();
        }

        return new Promise((resolve) => {
            const hideScreenScraperWarning = localStorage.getItem('hideScreenScraperWarning') === 'true';
            
            // Final check: do we actually have any credentials saved in config?
            // This flag is now directly reported by the backend regardless of API status
            const hasCreds = this.state.scraper.has_credentials || this.state.scraper.quota?.has_credentials;
            const missingScreenScraper = !hasCreds && !hideScreenScraperWarning;
            
            const tablesMissingVps = tables.filter(t => !t.vps_id);
            const missingVps = tablesMissingVps.length > 0;

            if (!missingScreenScraper && !missingVps) {
                resolve(true);
                return;
            }

            let messageHtml = '<p>You are about to scrape media, but we noticed the following that would provide a better download experience:</p><ul style="text-align: left; padding-left: 20px;">';
            
            if (missingScreenScraper) {
                messageHtml += '<li style="margin-bottom: 10px;">🔴 <strong>No Screenscraper credentials saved in Settings:</strong> wheels, marquees, fanart, videos, and manuals may be skipped.</li>';
            }
            if (missingVps) {
                messageHtml += `<li style="margin-bottom: 10px;">🔴 <strong>No VPS ID match:</strong> please match tables to be scanned with a VPS ID or table media from VPinMediaDB will be skipped.</li>`;
            }
            
            messageHtml += '</ul>';

            if (missingScreenScraper) {
                messageHtml += `
                    <div style="margin-top: 15px; text-align: left; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <label style="display: flex; align-items: center; cursor: pointer; margin: 0; font-size: 0.9em; color: var(--text-secondary);">
                            <input type="checkbox" id="scrape-opt-out-checkbox" style="margin-right: 8px;">
                            Don't remind me about ScreenScraper again
                        </label>
                    </div>
                `;
            }

            Modal.choice(
                'Missing Scraper Configuration',
                messageHtml,
                [
                    { 
                        label: 'Cancel', 
                        class: 'btn-secondary', 
                        onClick: () => resolve(false) 
                    },
                    { 
                        label: 'Continue Anyway', 
                        class: 'btn-warning', 
                        onClick: () => {
                            const checkbox = document.getElementById('scrape-opt-out-checkbox');
                            if (checkbox && checkbox.checked) {
                                localStorage.setItem('hideScreenScraperWarning', 'true');
                            }
                            resolve(true);
                        } 
                    }
                ]
            );
        });
    },

    async handleScrapeClick(tableId, tableData = null) {
        let table = tableData || this.state.tables.find(t => t.id === tableId);
        
        if (!table) {
            // Fetch minimal info if not found
            try {
                const res = await fetch(`/api/tables/${tableId}`);
                table = await res.json();
            } catch (e) {
                return Toast.error('Table not found');
            }
        }

        const canProceed = await this.validateScrapeConditions([table]);
        if (!canProceed) return;

        try {
            const res = await fetch(`/api/media/${tableId}`);
            const status = await res.json();
            
            const hasExisting = status.existing_types && status.existing_types.length > 0;
            
            if (!hasExisting) {
                // If no media, just trigger the missing only scrape directly
                this.triggerTableScrape(tableId, true);
                return;
            }

            // Conflict resolution modal
            Modal.choice(
                'Scrape Media',
                `Existing media found for <strong>${this.escHtml(table.display_name)}</strong>. Would you like to download only the missing assets or overwrite everything?`,
                [
                    { label: 'Cancel', class: 'btn-secondary', onClick: () => {} },
                    { label: 'Download Missing Only', class: 'btn-primary', onClick: () => this.triggerTableScrape(tableId, true) },
                    { label: 'Overwrite All', class: 'btn-danger', onClick: () => this.triggerTableScrape(tableId, false) }
                ]
            );
        } catch (e) {
            Toast.error('Failed to get media status: ' + e.message);
        }
    },

    async triggerTableScrape(tableId, missingOnly) {
        const card = document.getElementById(`table-card-${tableId}`);
        const btnUnified = card?.querySelector('.btn-scrape-unified');
        const btnSingle = document.getElementById('btn-scrape-single');
        
        const progContainer = document.getElementById('scrape-progress-container');
        const progBar = document.getElementById('scrape-progress-bar');
        const statusLabel = document.getElementById('scrape-status-label');

        try {
            Toast.info(missingOnly ? 'Downloading missing media...' : 'Overwriting all media...');
            
            if (btnUnified) {
                btnUnified.disabled = true;
                btnUnified.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div>';
            }
            if (btnSingle) {
                btnSingle.disabled = true;
                btnSingle.innerHTML = '<div class="spinner-sm"></div> Scraping...';
            }

            if (progContainer) {
                progContainer.style.display = 'block';
                if (progBar) progBar.style.width = '10%';
                if (statusLabel) statusLabel.textContent = 'Connecting to sources...';
            }

            // Fake crawl for indeterminate progress
            let progress = 10;
            const crawlInterval = setInterval(() => {
                if (progress < 90 && progBar) {
                    progress += (90 - progress) * 0.05;
                    progBar.style.width = `${Math.round(progress)}%`;
                    if (progress > 40 && statusLabel) statusLabel.textContent = 'Downloading assets...';
                    if (progress > 70 && statusLabel) statusLabel.textContent = 'Processing & saving...';
                }
            }, 800);

            const res = await fetch(`/api/scraper/download/${tableId}?missing_only=${missingOnly}`, { method: 'POST' });
            const data = await res.json();
            
            clearInterval(crawlInterval);
            if (progBar) progBar.style.width = '100%';
            if (statusLabel) statusLabel.textContent = 'Complete!';
            
            if (data.success) {
                const count = data.downloaded ? data.downloaded.length : 0;
                if (count > 0) Toast.success(`Downloaded ${count} file(s)`);
                else Toast.info('No new media found to download');
            } else {
                Toast.error(data.error || 'Scrape failed');
            }
            
            this.updateQuota();
            this.loadMissing(this.state.mediaFilter);
            this.loadTables();

            // Refresh the detail panel if it's currently open for this table
            const panel = document.getElementById('detail-panel');
            if (panel && panel.classList.contains('open')) {
                const title = document.getElementById('detail-title')?.textContent || '';
                if (title.includes('Media:')) {
                    // Wait a bit for the user to see the 100% bar before refreshing content
                    setTimeout(() => {
                        this.showMediaDetail(tableId);
                    }, 1500);
                }
            }

            // Reset buttons
            if (btnUnified) {
                btnUnified.disabled = false;
                btnUnified.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
            }
            if (btnSingle) {
                btnSingle.disabled = false;
                btnSingle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg> Scrape Media';
            }
            
            // Hide progress after delay
            setTimeout(() => {
                if (progContainer) progContainer.style.display = 'none';
            }, 3000);

        } catch (e) {
            Toast.error('Scrape failed: ' + e.message);
            if (btnUnified) {
                btnUnified.disabled = false;
                btnUnified.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
            }
            if (btnSingle) {
                btnSingle.disabled = false;
                btnSingle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg> Scrape Media';
            }
            if (progContainer) progContainer.style.display = 'none';
        }
    },

    async handleDeleteMediaClick(tableId) {
        const table = this.state.tables.find(t => t.id === tableId);
        if (!table) return;

        Modal.confirm(
            'Delete All Media',
            `Are you sure you want to delete <strong>all media files</strong> for <strong>${this.escHtml(table.display_name)}</strong>? This cannot be undone.`,
            async () => {
                try {
                    const res = await fetch(`/api/media/${tableId}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        Toast.success('Media deleted');
                        this.loadMissing(this.state.mediaFilter);
                    } else {
                        Toast.error(data.error || 'Delete failed');
                    }
                } catch (e) {
                    Toast.error('Delete failed: ' + e.message);
                }
            }
        );
    },

    async scrapeSingleTable(tableId) {
        try {
            Toast.info('Searching ScreenScraper...');
            const card = document.getElementById(`table-card-${tableId}`);
            const btn = card.querySelector('.btn-scrape-ss');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div>';

            const res = await fetch(`/api/scraper/search/${tableId}`);
            const data = await res.json();

            if (!data.success) {
                Toast.error(data.message || 'Game not found');
                btn.disabled = false;
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
                return;
            }

            Modal.confirm(
                'Match Found',
                `Found ScreenScraper match: <strong>"${this.escHtml(data.game_name)}"</strong> on ${data.system}.<br><br>Download up to <strong>${data.media_count}</strong> media assets?`,
                async () => {
                    const cells = card.querySelectorAll('.media-type-cell.missing');
                    cells.forEach(c => {
                        c.classList.add('downloading');
                        c.querySelector('.status-icon').innerHTML = '<div class="spinner"></div>';
                    });

                    const progressBox = document.getElementById('batch-progress-container');
                    if (progressBox) {
                        progressBox.style.display = 'block';
                        document.getElementById('batch-progress-fill').style.width = '100%';
                        document.getElementById('batch-progress-text').innerText = 'Downloading...';
                        document.getElementById('batch-current-table').innerText = data.game_name || 'Media';
                    }
                    
                    const dlRes = await fetch(`/api/scraper/download/${tableId}`, { method: 'POST' });
                    const dlData = await dlRes.json();
                    
                    if (progressBox) progressBox.style.display = 'none';
                    
                    if (dlData.success) { Toast.success(`Downloaded ${dlData.total_downloaded} files`); }
                    else { Toast.error(dlData.error || 'Download failed'); }
                    
                    this.updateQuota();
                    this.loadMissing(this.state.mediaFilter);
                }
            );
            
            // Note: Scraper button reset logic is now implicitly handled by the Modal not executing the callback if cancelled.
            // However, to be safe and match previous behavior if cancelled, we should reset the button if the modal is hidden.
            // But Modal.confirm doesn't have a cancel callback currently. Let's add it if needed, or just let the button stay spinning.
            // Actually, let's just ensure the button is always reset after the modal shown.
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
        } catch (e) { Toast.error('ScreenScraper failed: ' + e.message); }
    },

    async scrapeVPinMediaDB(tableId) {
        try {
            Toast.info('Connecting to vpinmediadb...');
            const card = document.getElementById(`table-card-${tableId}`);
            const btn = card.querySelector('.btn-scrape-vpmdb');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px;"></div>';

            const progressBox = document.getElementById('batch-progress-container');
            if (progressBox) {
                progressBox.style.display = 'block';
                document.getElementById('batch-progress-fill').style.width = '100%';
                document.getElementById('batch-progress-text').innerText = 'Checking VPinMediaDB';
                document.getElementById('batch-current-table').innerText = 'Fetching Assets...';
            }
            
            const dlRes = await fetch(`/api/scraper/download-vpmdb/${tableId}`, { method: 'POST' });
            const dlData = await dlRes.json();
            
            if (progressBox) progressBox.style.display = 'none';
            
            if (dlData.success) { Toast.success(dlData.message); }
            else { Toast.error(dlData.message || 'Download from vpinmediadb failed'); }
            
            this.loadMissing(this.state.mediaFilter);
        } catch (e) { Toast.error('vpinmediadb failed: ' + e.message); }
    },

    async scrapeAll() {
        const canProceed = await this.validateScrapeConditions(this.state.tables);
        if (!canProceed) return;

        Modal.choice(
            'Batch Scrape Media',
            'Select a scraping strategy for your entire table collection.<br><br><small style="color: var(--text-tertiary);">Note: Overwriting everything will consume more ScreenScraper requests and take longer.</small>',
            [
                { label: 'Cancel', class: 'btn-secondary' },
                { 
                    label: 'Download Missing Only', 
                    class: 'btn-primary', 
                    onClick: () => this.triggerBatchScrape(true) 
                },
                { 
                    label: 'Overwrite All Media', 
                    class: 'btn-danger', 
                    onClick: () => this.triggerBatchScrape(false) 
                }
            ]
        );
    },

    async triggerBatchScrape(missingOnly) {
        try {
            const res = await fetch(`/api/scraper/download-all?missing_only=${missingOnly}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                Toast.success(data.message);
                document.getElementById('batch-progress-container').style.display = 'block';
            } else { Toast.error(data.message); }
        } catch (e) { Toast.error('Batch scrape failed: ' + e.message); }
    },

    startStatusPolling() {
        if (this._polling) return;
        this._polling = setInterval(async () => {
            try {
                // Poll for batch status, but do NOT include quota info to save API requests
                const res = await fetch('/api/scraper/status?include_quota=false');
                const data = await res.json();
                
                const progressBox = document.getElementById('batch-progress-container');
                if (!progressBox) return;

                if (data.batch.running) {
                    progressBox.style.display = 'block';
                    const pct = (data.batch.completed / data.batch.total) * 100;
                    document.getElementById('batch-progress-fill').style.width = `${pct}%`;
                    document.getElementById('batch-progress-text').innerText = `${data.batch.completed} / ${data.batch.total} tables`;
                    document.getElementById('batch-current-table').innerText = data.batch.current_table || 'Finishing...';
                    this.state.scraper.batchRunning = true;
                } else {
                    if (this.state.scraper.batchRunning) {
                        progressBox.style.display = 'none';
                        this.state.scraper.batchRunning = false;
                        Toast.success('Batch scrape complete!');
                        if (this.state.view === 'media') this.loadMissing(this.state.mediaFilter);
                        this.updateQuota();
                    }
                    // If we've been idle for a while, we could stop polling, 
                    // but for now, 2s interval is quick and responsive.
                }
            } catch (e) {}
        }, 2000);
    },

    pollScanStatus() {
        if (this._scanPolling) {
            clearInterval(this._scanPolling);
            this._scanPolling = null;
        }

        let wasRunning = false;

        const poll = async () => {
            try {
                const res = await fetch('/api/tables/scan/status');
                const status = await res.json();

                const container = document.getElementById('scan-progress-container');
                const progressBar = document.getElementById('scan-progress-bar');
                const progressText = document.getElementById('scan-progress-text');
                const statusLabel = document.getElementById('scan-status-label');
                const spinner = document.getElementById('scan-spinner');

                if (status.status === 'running') {
                    wasRunning = true;
                    if (container) container.style.display = 'block';
                    const pct = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
                    if (progressBar) progressBar.style.width = pct + '%';
                    if (progressText) progressText.textContent = `${status.current} / ${status.total}`;
                    if (statusLabel) statusLabel.textContent = status.message || 'Scanning tables...';
                    if (spinner) spinner.style.display = 'block';
                } else {
                    // Handle completed or failed states
                    if (wasRunning || status.status === 'completed' || status.status === 'failed') {
                        const pct = 100;
                        if (progressBar) progressBar.style.width = pct + '%';
                        if (progressText) progressText.textContent = `${status.total || 0} / ${status.total || 0}`;
                        if (statusLabel) statusLabel.textContent = status.status === 'failed' ? 'Scan Failed' : 'Scan Complete';
                        if (spinner) spinner.style.display = 'none';
                        
                        if (status.status === 'failed') {
                            Toast.error(status.error || 'Scan failed');
                        } else if (wasRunning) {
                            Toast.success('Scan complete');
                        }
                        
                        // Reload tables and re-enable button
                        setTimeout(async () => {
                            await this.loadTables();
                            const btn = document.getElementById('btn-scan-tables');
                            if (btn) btn.disabled = false;
                        }, 500);
                        
                        setTimeout(() => {
                            if (container) container.style.display = 'none';
                        }, 3000);
                    } else {
                        // Just ensure button is enabled if idle
                        const btn = document.getElementById('btn-scan-tables');
                        if (btn) btn.disabled = false;
                    }

                    clearInterval(this._scanPolling);
                    this._scanPolling = null;
                }
            } catch (e) {
                console.error('Scan polling error', e);
            }
        };

        // Run once immediately
        poll();
        
        // Then set interval
        if (!this._scanPolling) {
            this._scanPolling = setInterval(poll, 1000);
        }
    },

    unmount() {
        if (this._scanPolling) {
            clearInterval(this._scanPolling);
            this._scanPolling = null;
        }
        if (this._polling) {
            clearInterval(this._polling);
            this._polling = null;
        }
    },

    renderEmptyState(desc) {
        document.getElementById('tables-content').innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <div class="empty-state-title">No tables found</div>
                <div class="empty-state-desc">${desc || 'All media is present'}</div>
            </div>
        `;
    },

    async showMediaDetail(tableId) {
        const panel = document.getElementById('detail-panel');
        const body = document.getElementById('detail-body');
        const title = document.getElementById('detail-title');

        body.innerHTML = '<div class="spinner"></div> Loading...';
        panel.classList.add('open');

        try {
            const [resTable, resMedia] = await Promise.all([
                fetch(`/api/tables/${tableId}?t=${Date.now()}`),
                fetch(`/api/media/${tableId}?t=${Date.now()}`)
            ]);
            
            const tableData = await resTable.json();
            const mediaData = await resMedia.json();

            title.textContent = `Media: ${tableData.display_name}`;

            let html = `
                <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                    <button class="btn btn-secondary" id="btn-back-to-data" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        View Table Details
                    </button>
                    <button class="btn btn-primary" id="btn-scrape-single" style="width: 100%;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        Scrape Media
                    </button>

                    <!-- Individual Scrape Progress Bar -->
                    <div id="scrape-progress-container" style="display: none; background: var(--glass-bg); padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border); backdrop-filter: blur(8px);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div class="spinner-sm" id="scrape-spinner" style="width: 14px; height: 14px;"></div>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;" id="scrape-status-label">Scraping media...</span>
                            </div>
                        </div>
                        <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-full); overflow: hidden; height: 8px; border: 1px solid rgba(255, 255, 255, 0.05);">
                            <div id="scrape-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;">
                                <div class="progress-shimmer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        ${!tableData.vps_id ? `<button class="btn btn-secondary btn-sm" id="btn-match-vps-detail" style="border-style: dashed; opacity: 0.8;">Match VPS</button>` : ''}
                        ${tableData.vps_id ? `<a href="https://virtualpinballspreadsheet.github.io/?game=${tableData.vps_id}&f=vpx" target="_blank" class="btn btn-secondary btn-sm">VPS</a>` : ''}
                        ${tableData.vps_id ? `<a href="https://github.com/superhac/vpinmediadb/tree/main/${tableData.vps_id}" target="_blank" class="btn btn-secondary btn-sm">VPinMediaDB</a>` : ''}
                        ${tableData.ss_id ? 
                            `<a href="https://www.screenscraper.fr/gameinfos.php?platid=198&gameid=${tableData.ss_id}" target="_blank" class="btn btn-secondary btn-sm">ScreenScraper</a>` : 
                            `<button class="btn btn-secondary btn-sm" id="btn-match-ss" style="border-style: dashed; opacity: 0.8;">Match ScreenScraper</button>`
                        }
                    </div>
            `;

            const mediaTypes = [
                { id: 'screenshots', label: 'Screenshot / Playfield' },
                { id: 'covers', label: 'Cover' },
                { id: 'fanart', label: 'Fanart / Backglass' },
                { id: 'marquees', label: 'Marquee / Wheel' },
                { id: 'videos', label: 'Video' },
                { id: 'manuals', label: 'Manual' },
            ];

            mediaTypes.forEach(type => {
                const isPresent = mediaData.existing_types && mediaData.existing_types.includes(type.id);
                let contentHtml = '';
                if (isPresent) {
                    let previewUrl = `/api/media/${tableId}/serve/${type.id}?t=${Date.now()}`;
                    if (['covers', 'screenshots', 'fanart', 'marquees'].includes(type.id)) {
                        contentHtml = `
                            <div class="media-preview-container" style="position: relative; width: 100%; height: 120px; background: var(--bg-tertiary); border-radius: var(--radius-sm); overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                <img src="${previewUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                                <div class="media-preview-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0; transition: opacity 0.2s;">
                                    <button class="btn btn-secondary btn-sm btn-rotate" data-type="${type.id}" data-angle="270" title="Rotate Left">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
                                    </button>
                                    <button class="btn btn-secondary btn-sm btn-rotate" data-type="${type.id}" data-angle="90" title="Rotate Right">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                                    </button>
                                    <button class="btn btn-secondary btn-sm btn-replace" data-type="${type.id}">Replace</button>
                                    <button class="btn btn-danger btn-sm btn-delete-media" data-type="${type.id}">Delete</button>
                                </div>
                            </div>
                        `;
                    } else if (type.id === 'videos') {
                        contentHtml = `
                            <div class="media-preview-container" style="position: relative; width: 100%; background: var(--bg-tertiary); border-radius: var(--radius-sm); overflow: hidden;">
                                <video controls style="width: 100%; max-height: 200px; display: block; background: #000;" preload="metadata">
                                    <source src="${previewUrl}">
                                    Your browser does not support video.
                                </video>
                                <div class="media-preview-overlay" style="position: absolute; top: 0; right: 0; padding: 6px; display: flex; gap: 6px; background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent); border-bottom-left-radius: 8px;">
                                    <button class="btn btn-secondary btn-sm btn-rotate" data-type="${type.id}" data-angle="270" title="Rotate Left" style="padding: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
                                    </button>
                                    <button class="btn btn-secondary btn-sm btn-rotate" data-type="${type.id}" data-angle="90" title="Rotate Right" style="padding: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                                    </button>
                                    <button class="btn btn-secondary btn-sm btn-replace" data-type="${type.id}">Replace</button>
                                    <button class="btn btn-danger btn-sm btn-delete-media" data-type="${type.id}">Delete</button>
                                </div>
                            </div>`;
                    } else if (type.id === 'manuals') {
                        contentHtml = `
                            <div class="media-preview-container" style="position: relative; width: 100%; height: 80px; background: var(--bg-tertiary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; gap: 12px;">
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="1.5" style="flex-shrink:0;">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <text x="6" y="19" font-family="sans-serif" font-size="5" fill="#e74c3c" stroke="none">PDF</text>
                                </svg>
                                <div style="display:flex; flex-direction:column; gap:2px;">
                                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Manual (PDF)</span>
                                    <span style="font-size: 0.75rem; color: var(--text-secondary);">Downloaded</span>
                                </div>
                                <div class="media-preview-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; gap: 10px; opacity: 0; transition: opacity 0.2s;">
                                    <button class="btn btn-secondary btn-sm btn-replace" data-type="${type.id}">Replace</button>
                                    <button class="btn btn-danger btn-sm btn-delete-media" data-type="${type.id}">Delete</button>
                                </div>
                            </div>`;
                    } else {
                        contentHtml = `<div class="media-preview-container" style="position: relative; width: 100%; height: 60px; background: var(--bg-tertiary); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;">
                             <span style="font-size: 0.8rem; color: var(--text-secondary);">File Present</span>
                             <div class="media-preview-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; gap: 10px; opacity: 0; transition: opacity 0.2s;">
                                <button class="btn btn-secondary btn-sm btn-replace" data-type="${type.id}">Replace</button>
                                <button class="btn btn-danger btn-sm btn-delete-media" data-type="${type.id}">Delete</button>
                             </div>
                        </div>`;
                    }
                } else {
                    contentHtml = `<div class="empty-state drop-zone" data-type="${type.id}" style="padding: var(--space-sm); border: 2px dashed var(--glass-border); text-align: center; cursor: pointer;">Upload File</div>`;
                }

                html += `<div class="input-group"><label class="input-label">${type.label}</label>${contentHtml}<input type="file" id="file-input-${type.id}" style="display: none;"></div>`;
            });

            html += '</div>';
            body.innerHTML = html;

            document.getElementById('btn-back-to-data').onclick = () => this.showDetail(tableId);
            
            document.getElementById('btn-scrape-single').onclick = () => {
                this.handleScrapeClick(tableId, tableData);
            };

            const matchBtn = document.getElementById('btn-match-ss');
            if (matchBtn) {
                matchBtn.onclick = () => {
                    Modal.prompt('Match ScreenScraper', 'Enter the ScreenScraper ID for this table (e.g. 189181):', '', async (val) => {
                        if (!val) return;
                        try {
                            const res = await fetch(`/api/tables/${tableId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ss_id: val.trim() })
                            });
                            if (res.ok) {
                                Toast.success('ScreenScraper ID updated');
                                // Force a background reload of the main list too
                                this.loadTables(false);
                                this.showMediaDetail(tableId);
                            }
                        } catch (e) {
                            Toast.error('Failed to update ID: ' + e.message);
                        }
                    });
                };
            }
            
            const matchVpsBtn = document.getElementById('btn-match-vps-detail');
            if (matchVpsBtn) {
                matchVpsBtn.onclick = () => {
                    this.showVPSMatch(tableId);
                };
            }

            body.querySelectorAll('.media-preview-container').forEach(c => {
                const overlay = c.querySelector('.media-preview-overlay');
                if (overlay) {
                    c.onmouseenter = () => overlay.style.opacity = '1';
                    c.onmouseleave = () => overlay.style.opacity = '0';
                }
            });

            body.querySelectorAll('.btn-replace, .drop-zone').forEach(el => {
                el.onclick = () => document.getElementById(`file-input-${el.dataset.type}`).click();
            });

            body.querySelectorAll('.btn-rotate').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const typeId = btn.dataset.type;
                    const angle = btn.dataset.angle;
                    try {
                        Toast.info('Rotating...');
                        const res = await fetch(`/api/media/${tableId}/rotate/${typeId}?angle=${angle}`, { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                            Toast.success('Media rotated');
                            // We need to reload the media detail to see the change
                            this.showMediaDetail(tableId);
                        } else {
                            Toast.error(data.detail || 'Rotation failed');
                        }
                    } catch (err) {
                        Toast.error('Rotation failed: ' + err.message);
                    }
                };
            });

            body.querySelectorAll('input[type="file"]').forEach(input => {
                input.onchange = (e) => { if (e.target.files.length) this.uploadMedia(tableId, input.id.replace('file-input-', ''), e.target.files[0]); };
            });

            body.querySelectorAll('.btn-delete-media').forEach(btn => {
                btn.onclick = () => {
                    Modal.confirm('Delete Media', 'Are you sure you want to delete this media file?', async () => {
                        await fetch(`/api/media/${tableId}/${btn.dataset.type}`, { method: 'DELETE' });
                        this.showMediaDetail(tableId);
                        if (this.state.view === 'media') this.loadMissing(this.state.mediaFilter);
                    });
                };
            });
        } catch (e) { body.innerHTML = `<span style="color: var(--accent-red);">Load failed: ${e.message}</span>`; }
    },

    async uploadMedia(tableId, typeId, file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            Toast.info('Uploading...');
            const res = await fetch(`/api/media/${tableId}/upload?media_type=${typeId}`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                Toast.success('Media uploaded');
                this.showMediaDetail(tableId);
                if (this.state.view === 'media') this.loadMissing(this.state.mediaFilter);
            } else { Toast.error(data.error); }
        } catch (err) { Toast.error('Upload failed: ' + err.message); }
    },

    async triggerDownload(url, filename) {
        Toast.info('Preparing download...');
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Download request failed');
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch (e) {
            Toast.error('Download failed: ' + e.message);
        }
    },

    escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },
};
