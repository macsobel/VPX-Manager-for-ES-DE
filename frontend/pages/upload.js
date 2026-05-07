/* ═══════════════════════════════════════════════════════════
   Import Table Page — VPinFE-style with VPS search
   ═══════════════════════════════════════════════════════════ */

const UploadPage = {
    _state: {
        vpxFile: null,
        b2sFile: null,
        romFiles: [],
        puppackFile: null,
        musicFile: null,
        altsoundFile: null,
        altcolorFile: null,
        nvramFiles: [],
        vbsFile: null,
        iniFile: null,
        vpsId: '',
        vpsType: '',
        deletedFiles: [], // List of relative paths to delete on server
    },
    _searchTimeout: null,

    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Add New Table</h1>
                <p class="page-subtitle">Add a new table with all its associated files. Each slot guides files to the correct folder</p>
            </div>

            <div class="import-form">
                <div style="display: flex; justify-content: flex-end; margin-bottom: var(--space-md);">
                    <a href="https://virtualpinballspreadsheet.github.io/games?f=vpx" target="_blank" rel="noopener" class="btn btn-secondary" style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; padding: 6px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.03);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        Open Virtual Pinball Spreadsheet
                    </a>
                </div>
                <!-- Step 1: Table Info -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83"/></svg>
                        Step 1: Table Info
                    </div>
                    <div class="card">
                        <div class="import-info-grid">
                            <div class="input-group">
                                <label class="input-label">Table Name *</label>
                                <input class="input-field" id="import-table-name" placeholder="Start typing to search VPS database..." autocomplete="off">
                            </div>
                            <div class="input-group">
                                <label class="input-label">Manufacturer</label>
                                <input class="input-field" id="import-manufacturer" placeholder="e.g. Data East">
                            </div>
                            <div class="input-group">
                                <label class="input-label">Year</label>
                                <input class="input-field" id="import-year" placeholder="e.g. 1993">
                            </div>
                        </div>
                        <div id="vps-match-banner" style="display: none;"></div>
                        <div style="margin-top: var(--space-sm); font-size: 0.78rem; color: var(--text-muted);">
                            Creates folder: <code id="import-folder-preview" style="color: var(--accent-purple);">—</code>
                        </div>
                    </div>
                </div>

                <!-- Step 2: File Upload Slots -->
                <div class="settings-section">
                    <div class="settings-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Step 2: Upload Files
                    </div>

                    <div class="import-slots-grid">
                        ${this._renderFileSlot('vpx', 'Table File (.vpx)', '.vpx', true, 'blue', 'The Visual Pinball X table file', 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5')}
                        ${this._renderFileSlot('b2s', 'Backglass (.directb2s)', '.directb2s', false, 'purple', 'Direct B2S backglass file', 'M4 3h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2zM9 3v18M15 3v18M3 9h6M15 9h6M3 15h6M15 15h6')}
                        ${this._renderFileSlot('rom', 'PinMAME ROMs (.zip)', '.zip', false, 'emerald', 'ROM zip file(s) → pinmame/roms/', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', 0, true)}
                        ${this._renderFileSlot('vbs', 'VBS Script (.vbs)', '.vbs', false, 'purple', 'Extracted table file script', 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')}
                        ${this._renderFileSlot('nvram', 'PinMAME NVRAMs (.nv)', '.nv', false, 'indigo', 'NVRAM file(s) → pinmame/nvram/', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z', 0, true)}
                        ${this._renderFileSlot('ini', 'Table Settings INI (.ini)', '.ini', false, 'emerald', 'Table-specific settings file', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z')}
                        ${this._renderFileSlot('puppack', 'PUP Pack (Archive/Files)', '.zip,.7z,.rar', false, 'amber', 'PuP-Pack arc → extracted to pupvideos/', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', 0, true)}
                        ${this._renderFileSlot('altcolor', 'AltColor (Archive/Files)', '.cRZ,.zip,.7z,.rar,.vni,.pal', false, 'orange', 'Serum or color files → pinmame/altcolor/', 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485', 0, true)}
                        ${this._renderFileSlot('altsound', 'AltSound (Archive/Files)', '.zip,.7z,.rar', false, 'pink', 'Alt sound pack → pinmame/altsound/', 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586v12.828a1 1 0 01-1.707.707L5.586 15z', 0, true)}
                        ${this._renderFileSlot('music', 'Music (Archive/Files)', '.zip,.7z,.rar,.mp3,.ogg,.wav', false, 'cyan', 'Music arc → extracted to music/', 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z', 0, true)}
                    </div>
                </div>

                <!-- Import Options -->
                <div class="file-slot" id="group-scrape-media" style="cursor: pointer;" onclick="document.getElementById('import-scrape-media').click()">
                    <div class="file-slot-header">
                        <div class="file-slot-icon blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </div>
                        <div class="file-slot-info">
                            <div class="file-slot-label" style="display: flex; align-items: center; gap: 10px;">
                                <input type="checkbox" id="import-scrape-media" checked style="width: 16px; height: 16px; accent-color: var(--accent-blue); cursor: pointer;" onclick="event.stopPropagation()">
                                Auto-scrape media on import
                            </div>
                            <div class="file-slot-desc">Fetches media files and metadata for Emulation Station DE from VPMediaDB and ScreenScraper when adding the table.</div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: var(--space-md); align-items: center; margin-top: var(--space-md);">
                    <button class="btn btn-primary btn-lg" id="btn-do-import" disabled>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Add New Table
                    </button>
                    <button class="btn btn-secondary" id="btn-reset-import">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 003.2 7.2M2 12.5a10 10 0 0018.8 4.2"/></svg>
                        Reset
                    </button>
                    <div id="import-status" style="font-size: 0.85rem; color: var(--text-muted);"></div>
                </div>

                <!-- Progress overlay -->
                <div id="import-overlay" class="import-overlay" style="display: none;">
                    <div class="import-overlay-content">
                        <div class="spinner" style="width: 40px; height: 40px;"></div>
                        <div id="import-progress-text" style="font-size: 1.1rem; font-weight: 600;">Importing table...</div>
                    </div>
                </div>
            </div>
        `;

        this._resetState();
        this._bindEvents();
    },

    _renderFileSlot(id, label, accept, required, color, description, iconPath, existingFiles = [], multiple = false) {
        const reqBadge = required ? `<span class="slot-badge required" id="badge-${id}">Required</span>` : `<span class="slot-badge optional" id="badge-${id}">Optional</span>`;

        let existingHtml = '';
        if (existingFiles && existingFiles.length > 0) {
            existingHtml = `
                <div class="existing-files-list">
                    ${existingFiles.map(file => {
                const relPath = this._getRelPathForSlot(id, file);
                const isDeleted = this._state.deletedFiles.includes(relPath);
                return `
                            <div class="existing-file-tag ${isDeleted ? 'to-delete' : ''}" data-rel-path="${relPath}" data-slot="${id}">
                                <span>${file}</span>
                                <button class="btn-remove-existing" title="${isDeleted ? 'Undo delete' : 'Mark for deletion'}">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        return `
            <div class="file-slot file-slot-${color}" id="slot-${id}" data-accept="${accept}" data-slot-id="${id}">
                <div class="file-slot-header">
                    <div class="file-slot-icon ${color}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${iconPath}"/></svg>
                    </div>
                    <div class="file-slot-info">
                        <div class="file-slot-label">${label} ${reqBadge}</div>
                        <div class="file-slot-desc" id="desc-${id}">${description}</div>
                        ${existingHtml}
                    </div>
                </div>
                <button class="slot-clear-btn" id="clear-${id}" style="display: none;" title="Remove file">✕</button>
                <div class="file-slot-control">
                    <label class="file-slot-btn" for="file-${id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Choose File
                    </label>
                    <input type="file" id="file-${id}" accept="${accept}" style="display: none;" data-slot="${id}" ${multiple ? 'multiple' : ''}>
                    <span class="file-slot-drop-hint" id="drop-hint-${id}">or drop ${multiple ? 'files' : 'file'} here</span>
                    <div class="file-slot-status" id="status-${id}">No file selected</div>
                </div>
            </div>
        `;
    },

    _getRelPathForSlot(slotId, filename) {
        if (slotId === 'vpx' || slotId === 'b2s' || slotId === 'vbs' || slotId === 'ini') return filename;
        if (slotId === 'rom') return `pinmame/roms/${filename}`;
        if (slotId === 'puppack') return `pupvideos/${filename}`;
        if (slotId === 'music') return `music/${filename}`;
        if (slotId === 'altsound') return `pinmame/altsound/${filename}`;
        if (slotId === 'altcolor') return `pinmame/altcolor/${filename}`;
        return filename;
    },

    _resetState() {
        this._state = {
            vpxFile: null, b2sFile: null, romFiles: [],
            puppackFile: null, musicFile: null, altsoundFile: null, altcolorFile: null, nvramFiles: [],
            vbsFile: null, iniFile: null,
            vpsId: '', vpsType: '', vpsVersion: '', vpsTableUrl: '', ipdbId: '',
            deletedFiles: [],
        };
        ['vpx', 'b2s', 'rom', 'puppack', 'music', 'altsound', 'altcolor', 'nvram', 'vbs', 'ini'].forEach(id => {
            const status = document.getElementById(`status-${id}`);
            const slot = document.getElementById(`slot-${id}`);
            const hint = document.getElementById(`drop-hint-${id}`);
            if (status) { status.textContent = 'No file selected'; status.classList.remove('has-file'); }
            if (slot) slot.classList.remove('has-file');
            if (hint) hint.style.display = '';
            const input = document.getElementById(`file-${id}`);
            if (input) input.value = '';
        });
        const nameEl = document.getElementById('import-table-name');
        const mfgEl = document.getElementById('import-manufacturer');
        const yearEl = document.getElementById('import-year');
        if (nameEl) nameEl.value = '';
        if (mfgEl) mfgEl.value = '';
        if (yearEl) yearEl.value = '';
        const romBadge = document.getElementById('badge-rom');
        if (romBadge) {
            romBadge.textContent = 'Optional';
            romBadge.className = 'slot-badge optional';
        }
        this._clearVpsMatch();
        this._updateFolderPreview();
        this._updateImportButton();
    },

    /* ── VPS Search ───────────────────────────────────── */

    async _searchVps(query) {
        if (!query || query.length < 2) {
            this._hideSearchResults();
            return;
        }
        try {
            const data = await apiFetch(`/api/vps/search?q=${encodeURIComponent(query)}&limit=8`);
            this._showSearchResults(data.results || []);
        } catch (e) {
            this._hideSearchResults();
        }
    },

    _getOrCreateDropdown() {
        let box = document.getElementById('vps-search-results');
        if (!box) {
            box = document.createElement('div');
            box.id = 'vps-search-results';
            box.className = 'vps-search-results';
            box.style.display = 'none';
            document.body.appendChild(box);
        }
        return box;
    },

    _positionDropdown() {
        const input = document.getElementById('import-table-name');
        const box = this._getOrCreateDropdown();
        if (!input || !box) return;
        const rect = input.getBoundingClientRect();
        box.style.position = 'fixed';
        box.style.top = (rect.bottom + 4) + 'px';
        box.style.left = rect.left + 'px';
        box.style.width = rect.width + 'px';
    },

    _showSearchResults(results) {
        const box = this._getOrCreateDropdown();
        this._positionDropdown();

        if (!results.length) {
            box.innerHTML = '<div class="vps-result-empty">No matches in VPS database</div>';
            box.style.display = 'block';
            return;
        }
        box.innerHTML = results.map(r => `
            <div class="vps-result-item" data-vps='${JSON.stringify(r).replace(/'/g, "&#39;")}'>
                <div class="vps-result-name">${this._esc(r.name)}</div>
                <div class="vps-result-meta">
                    ${r.manufacturer ? `<span>${this._esc(r.manufacturer)}</span>` : ''}
                    ${r.year ? `<span>${r.year}</span>` : ''}
                    ${r.type ? `<span class="vps-result-type">${r.type}</span>` : ''}
                </div>
            </div>
        `).join('');
        box.style.display = 'block';

        // Bind click handlers
        box.querySelectorAll('.vps-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const vps = JSON.parse(item.dataset.vps);
                this._selectVpsResult(vps);
            });
        });
    },

    _hideSearchResults() {
        const box = document.getElementById('vps-search-results');
        if (box) box.style.display = 'none';
    },

    _selectVpsResult(vps) {
        console.log('DEBUG: VPS Result Selected:', vps);
        // Fill in fields
        document.getElementById('import-table-name').value = vps.name || '';
        document.getElementById('import-manufacturer').value = vps.manufacturer || '';
        document.getElementById('import-year').value = vps.year || '';

        // Store VPS match
        this._state.vpsId = vps.vps_id || '';
        this._state.vpsType = vps.type || '';
        this._state.vpsVersion = vps.version || '';
        this._state.vpsTableUrl = vps.table_url || '';
        this._state.ipdbId = vps.ipdb_id || '';

        // Show match banner
        this._showVpsMatchBanner(vps);

        // Update VPX table file guidance
        if (vps.vpx_tables && vps.vpx_tables.length > 0) {
            this._updateVpxGuidance(vps.vpx_tables);
        }

        // Update ROM description if we have ROM info from VPS
        if (vps.roms && vps.roms.length > 0) {
            this._updateRomGuidance(vps.roms);
        }

        // Update AltColor description if we have info from VPS
        if (vps.altcolors && vps.altcolors.length > 0) {
            this._updateAltcolorGuidance(vps.altcolors);
        }

        // Update B2S guidance
        if (vps.b2s && vps.b2s.length > 0) {
            this._updateB2sGuidance(vps.b2s);
        }
        // Update AltSound guidance
        if (vps.altsound && vps.altsound.length > 0) {
            this._updateAltSoundGuidance(vps.altsound);
        }
        // Update PUP Pack guidance
        if (vps.puppack && vps.puppack.length > 0) {
            this._updatePupPackGuidance(vps.puppack);
        }
        // Update Music guidance
        if (vps.music && vps.music.length > 0) {
            this._updateMusicGuidance(vps.music);
        }

        // Update preview and button
        this._hideSearchResults();
        this._updateFolderPreview();
        this._updateImportButton();

        // If a VPX is already uploaded, re-analyze it with the new VPS ID to find NVRAMs and ROMs
        if (this._state.vpxFile) {
            this._reanalyzeVpx(this._state.vpxFile);
        }
    },

    _showVpsMatchBanner(vps) {
        const banner = document.getElementById('vps-match-banner');
        banner.innerHTML = `
            <div class="vps-match-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Matched to VPS: <strong>${this._esc(vps.name)}</strong></span>
                ${vps.manufacturer ? `<span style="color: var(--text-muted);">· ${this._esc(vps.manufacturer)}</span>` : ''}
                ${vps.year ? `<span style="color: var(--text-muted);">· ${vps.year}</span>` : ''}
                ${vps.type ? `<span class="badge badge-info" style="margin-left: 6px;">${vps.type}</span>` : ''}
                <a href="https://virtualpinballspreadsheet.github.io/?game=${encodeURIComponent(vps.vps_id)}&f=vpx" target="_blank" rel="noopener" class="vps-match-link" title="Open in VPS Database">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    View on VPS
                </a>
            </div>
            <button class="vps-match-clear" id="btn-clear-vps" title="Clear VPS match">✕</button>
        `;
        banner.style.display = 'flex';

        document.getElementById('btn-clear-vps').onclick = () => this._clearVpsMatch();
    },

    _clearVpsMatch() {
        this._state.vpsId = '';
        this._state.vpsType = '';
        const banner = document.getElementById('vps-match-banner');
        if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }

        // Reset ROM guidance and badge if NO VPX is currently uploaded
        if (!this._state.vpxFile) {
            this._updateRomGuidance([]);
            this._updateAltcolorGuidance([]);
            this._updateVpxGuidance([]);
            this._updateB2sGuidance([]);
            this._updateAltSoundGuidance([]);
            this._updatePupPackGuidance([]);
            this._updateMusicGuidance([]);
        }
    },

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    },

    /* ── Folder Preview & Import Button ──────────────── */

    _updateFolderPreview() {
        const name = document.getElementById('import-table-name')?.value?.trim() || '';
        const mfg = document.getElementById('import-manufacturer')?.value?.trim() || '';
        const year = document.getElementById('import-year')?.value?.trim() || '';
        const preview = document.getElementById('import-folder-preview');
        if (!preview) return;

        if (!name) {
            preview.textContent = '—';
        } else if (mfg && year) {
            preview.textContent = `${name} (${mfg} ${year})/`;
        } else if (mfg) {
            preview.textContent = `${name} (${mfg})/`;
        } else if (year) {
            preview.textContent = `${name} (${year})/`;
        } else {
            preview.textContent = `${name}/`;
        }
    },

    _updateImportButton() {
        const btn = document.getElementById('btn-do-import');
        if (!btn) return;
        const name = document.getElementById('import-table-name')?.value?.trim();
        const hasVpx = this._state.vpxFile !== null;
        btn.disabled = !(name && hasVpx);
    },

    /* ── File Slot Helpers ───────────────────────────── */

    async _setSlotFile(slotId, fileOrList) {
        const slotMap = {
            vpx: 'vpxFile', b2s: 'b2sFile', rom: 'romFiles',
            puppack: 'puppackFile', music: 'musicFile',
            altsound: 'altsoundFile', altcolor: 'altcolorFile', nvram: 'nvramFiles',
            vbs: 'vbsFile', ini: 'iniFile'
        };
        const stateKey = slotMap[slotId];
        if (!stateKey) return;

        const status = document.getElementById(`status-${slotId}`);
        const slot = document.getElementById(`slot-${slotId}`);
        const hint = document.getElementById(`drop-hint-${slotId}`);
        const clearBtn = document.getElementById(`clear-${slotId}`);

        if (fileOrList) {
            if (clearBtn) clearBtn.style.display = 'flex';

            const isMultipleSlot = ['rom', 'nvram', 'puppack', 'music', 'altsound', 'altcolor'].includes(slotId);

            if (isMultipleSlot) {
                // Handle multiple files
                const files = fileOrList instanceof FileList ? Array.from(fileOrList) : (Array.isArray(fileOrList) ? fileOrList : [fileOrList]);
                this._state[stateKey] = files;
                const count = files.length;

                if (count > 0) {
                    if (count === 1) {
                        const sizeMB = (files[0].size / (1024 * 1024)).toFixed(1);
                        status.innerHTML = `<span class="file-slot-check">✓</span> ${files[0].name} <span style="color: var(--text-muted);">(${sizeMB} MB)</span>`;
                    } else {
                        const totalSize = files.reduce((acc, f) => acc + f.size, 0);
                        const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
                        status.innerHTML = `<span class="file-slot-check">✓</span> ${count} files selected <span style="color: var(--text-muted);">(${sizeMB} MB total)</span>`;
                    }
                    status.classList.add('has-file');
                    slot.classList.add('has-file');
                    if (hint) hint.style.display = 'none';
                }
            } else {
                // Single file slots
                const file = fileOrList instanceof FileList ? fileOrList[0] : fileOrList;
                this._state[stateKey] = file;
                const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                status.innerHTML = `<span class="file-slot-check">✓</span> ${file.name} <span style="color: var(--text-muted);">(${sizeMB} MB)</span>`;
                status.classList.add('has-file');
                slot.classList.add('has-file');
                if (hint) hint.style.display = 'none';
                if (slotId === 'vpx') {
                    this._reanalyzeVpx(file);
                }
            }
        } else {
            if (clearBtn) clearBtn.style.display = 'none';
            if (['rom', 'nvram', 'puppack', 'music', 'altsound', 'altcolor'].includes(slotId)) {
                this._state[stateKey] = [];
            } else {
                this._state[stateKey] = null;
            }

            status.textContent = 'No file selected';
            status.classList.remove('has-file');
            slot.classList.remove('has-file');
            if (hint) hint.style.display = '';
        }
        this._updateImportButton();
    },

    async _reanalyzeVpx(file) {
        const romDesc = document.getElementById('desc-rom');
        if (romDesc) {
            romDesc.innerHTML = 'Analyzing table for required ROMs...';
        }
        console.info('VPIN-MANAGER: Starting VPX parsing for', file.name, 'VPS:', this._state.vpsId);
        try {
            const formData = new FormData();
            formData.append('vpx_file', file);
            if (this._state.vpsId) {
                formData.append('vps_id', this._state.vpsId);
            }
            const data = await apiFetch('/api/upload/parse-vpx', {
                method: 'POST',
                body: formData
            });
            console.info('VPIN-MANAGER: VPX Parse Response:', data);

            if (data.success) {
                if (data.roms && data.roms.length > 0) {
                    this._updateRomGuidance(data.roms);
                } else {
                    this._updateRomGuidance([]);
                }

                if (data.altcolors && data.altcolors.length > 0) {
                    this._updateAltcolorGuidance(data.altcolors);
                } else if (!this._state.vpsId) {
                    this._updateAltcolorGuidance([]);
                }

                if (data.nvram && data.nvram.length > 0) {
                    this._autoPopulateNvram(data.nvram);
                }

                if (data.patch_info && data.patch_info.patch_url) {
                    this._showVbsAutoPatch(data.patch_info.patch_url);
                }

                // NEW: Refresh all other VPS guidance if we have a vpsId
                if (this._state.vpsId) {
                    fetch(`/api/vps/${this._state.vpsId}`)
                        .then(res => res.json())
                        .then(vps => {
                            if (vps.vpx_tables) this._updateVpxGuidance(vps.vpx_tables);
                            if (vps.b2s) this._updateB2sGuidance(vps.b2s);
                            if (vps.altsound) this._updateAltSoundGuidance(vps.altsound);
                            if (vps.puppack) this._updatePupPackGuidance(vps.puppack);
                            if (vps.music) this._updateMusicGuidance(vps.music);
                        }).catch(() => { });
                }
            }
        } catch (err) {
            console.error('VPIN-MANAGER: VPX Parse Error:', err);
            if (romDesc) romDesc.innerHTML = 'ROM zip file(s) → pinmame/roms/';
        }
    },

    _updateVpxGuidance(tables) {
        const el = document.getElementById('desc-vpx');
        if (!tables || tables.length === 0) {
            if (el) el.innerHTML = 'The Visual Pinball X table file';
            return;
        }
        if (el) {
            const html = tables.map(t => {
                const label = t.author || t.version || 'Table File';
                return t.url
                    ? `<a href="${t.url}" target="_blank" rel="noopener" class="rom-link" title="Download VPX from VPS">${this._esc(label)}</a>`
                    : `<span>${this._esc(label)}</span>`;
            }).join(', ');
            el.innerHTML = `Available VPX files: <strong>${html}</strong>`;
        }
    },

    _updateRomGuidance(roms) {
        const romDesc = document.getElementById('desc-rom');
        const romBadge = document.getElementById('badge-rom');

        if (!roms || roms.length === 0) {
            if (romBadge) {
                romBadge.textContent = 'Optional';
                romBadge.className = 'slot-badge optional';
            }
            if (romDesc) romDesc.innerHTML = 'ROM zip file(s) → pinmame/roms/';
            return;
        }

        // If we already have some ROMs with URLs in the description, preserve them
        // This prevents re-analysis (which only finds names) from wiping out VPS-provided download links
        const existingLinks = {};
        if (romDesc && romDesc.innerHTML.includes('rom-link')) {
            const links = romDesc.querySelectorAll('.rom-link');
            links.forEach(l => {
                existingLinks[l.textContent.trim().toLowerCase()] = l.href;
            });
        }

        if (romDesc) {
            const romHtml = roms.map(r => {
                const ver = typeof r === 'string' ? r : r.version;
                let url = typeof r === 'string' ? '' : (r.url || '');

                // Fallback to existing link if we have one for this version
                if (!url && existingLinks[ver.toLowerCase()]) {
                    url = existingLinks[ver.toLowerCase()];
                }

                if (url) {
                    return `<a href="${url}" target="_blank" rel="noopener" class="rom-link" title="Download ROM from VPS">${this._esc(ver)}</a>`;
                }
                return `<span>${this._esc(ver)}</span>`;
            }).join(', ');
            romDesc.innerHTML = `Expected ROMs: <strong>${romHtml}</strong>`;
        }

        if (romBadge) {
            romBadge.textContent = 'Required';
            romBadge.className = 'slot-badge required';
        }
    },

    _updateAltcolorGuidance(altcolors) {
        const altDesc = document.getElementById('desc-altcolor');

        if (!altcolors || altcolors.length === 0) {
            if (altDesc) altDesc.innerHTML = 'Serum or color files → pinmame/altcolor/';
            return;
        }

        if (altDesc) {
            const altHtml = altcolors.map(c => {
                const name = c.fileName || c.version || 'Color File';
                const type = c.type ? `(${c.type})` : '';
                const url = c.url || '';

                if (url) {
                    return `<a href="${url}" target="_blank" rel="noopener" class="rom-link" title="Download AltColor from VPS">${this._esc(name)} ${this._esc(type)}</a>`;
                }
                return `<span>${this._esc(name)} ${this._esc(type)}</span>`;
            }).join(', ');
            altDesc.innerHTML = `Identified AltColor files: <strong>${altHtml}</strong>`;
        }
    },

    _updateB2sGuidance(b2s) {
        const el = document.getElementById('desc-b2s');
        if (!b2s || b2s.length === 0) {
            if (el) el.innerHTML = 'Direct B2S backglass file';
            return;
        }
        if (el) {
            const html = b2s.map(f => {
                const label = f.author || f.version || 'Backglass';
                return f.url
                    ? `<a href="${f.url}" target="_blank" rel="noopener" class="rom-link" title="Download B2S from VPS">${this._esc(label)}</a>`
                    : `<span>${this._esc(label)}</span>`;
            }).join(', ');
            el.innerHTML = `Available B2S files: <strong>${html}</strong>`;
        }
    },

    _updateAltSoundGuidance(altsound) {
        const el = document.getElementById('desc-altsound');
        if (!altsound || altsound.length === 0) {
            if (el) el.innerHTML = 'Alt sound pack → pinmame/altsound/';
            return;
        }
        if (el) {
            const html = altsound.map(f => {
                const label = f.author || f.version || 'AltSound';
                return f.url
                    ? `<a href="${f.url}" target="_blank" rel="noopener" class="rom-link" title="Download AltSound from VPS">${this._esc(label)}</a>`
                    : `<span>${this._esc(label)}</span>`;
            }).join(', ');
            el.innerHTML = `Identified AltSound packs: <strong>${html}</strong>`;
        }
    },

    _updatePupPackGuidance(puppack) {
        const el = document.getElementById('desc-puppack');
        if (!puppack || puppack.length === 0) {
            if (el) el.innerHTML = 'PuP-Pack arc → extracted to pupvideos/';
            return;
        }
        if (el) {
            const html = puppack.map(f => {
                const label = f.author || f.version || 'PUP Pack';
                return f.url
                    ? `<a href="${f.url}" target="_blank" rel="noopener" class="rom-link" title="Download PUP Pack from VPS">${this._esc(label)}</a>`
                    : `<span>${this._esc(label)}</span>`;
            }).join(', ');
            el.innerHTML = `Available PUP Packs: <strong>${html}</strong>`;
        }
    },

    _updateMusicGuidance(music) {
        const el = document.getElementById('desc-music');
        if (!music || music.length === 0) {
            if (el) el.innerHTML = 'Music arc → extracted to music/';
            return;
        }
        if (el) {
            const html = music.map(f => {
                const label = f.author || f.version || 'Music Pack';
                return f.url
                    ? `<a href="${f.url}" target="_blank" rel="noopener" class="rom-link" title="Download Music from VPS">${this._esc(label)}</a>`
                    : `<span>${this._esc(label)}</span>`;
            }).join(', ');
            el.innerHTML = `Available music files: <strong>${html}</strong>`;
        }
    },

    _updateNvramGuidance(nvramList) {
        const el = document.getElementById('desc-nvram');
        if (!nvramList || nvramList.length === 0) {
            if (el) el.innerHTML = 'NVRAM file(s) → pinmame/nvram/';
            return;
        }
        if (el) {
            const html = nvramList.map(n => {
                return `
                    <button class="btn-import-nvram-action" data-nvram="${this._esc(n)}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Import: ${this._esc(n)}
                    </button>`;
            }).join(' ');
            el.innerHTML = `<div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">${html}</div>`;

            // Add listeners to these new buttons
            el.querySelectorAll('.btn-import-nvram-action').forEach(btn => {
                btn.onclick = async (e) => {
                    e.preventDefault();
                    const nvName = btn.getAttribute('data-nvram');
                    await this._importNvram(nvName);
                };
            });
        }
    },

    async _importNvram(name) {
        const url = `/api/upload/import-nvram?name=${encodeURIComponent(name)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const blob = await res.blob();
            const file = new File([blob], name, { type: 'application/octet-stream' });
            this._setSlotFile('nvram', file);
            Toast.success(`NVRAM ${name} imported from master repository!`);
        } catch (err) {
            console.error("NVRAM import failed:", err);
            Toast.error("Failed to import NVRAM.");
        }
    },

    _clearSlot(slotId) {
        console.log('DEBUG: Clearing slot:', slotId);
        const input = document.getElementById(`file-${slotId}`);
        if (input) input.value = '';
        this._setSlotFile(slotId, null);

        // If VPX is cleared, also clear the ROM detection text and reset badge
        if (slotId === 'vpx') {
            this._updateRomGuidance([]);
            this._updateAltcolorGuidance([]);
            this._updateVpxGuidance([]);
            this._updateB2sGuidance([]);
            this._updateAltSoundGuidance([]);
            this._updatePupPackGuidance([]);
            this._updateMusicGuidance([]);
            const hints = document.querySelectorAll('.vbs-patch-hint');
            hints.forEach(h => h.remove());
            console.info('VPIN-MANAGER: VPX cleared, resetting all slot guidance and hints.');
        }
    },

    _showVbsAutoPatch(url) {
        if (this._state.vbsFile) return; // Don't override user's manual VBS

        const slotId = 'vbs';
        const status = document.getElementById(`status-${slotId}`);
        const slot = document.getElementById(`slot-${slotId}`);
        const hint = document.getElementById(`drop-hint-${slotId}`);

        // Hide normal text, show banner
        if (hint) hint.style.display = 'none';

        const banner = document.createElement('div');
        banner.className = 'vbs-patch-hint';
        banner.style.width = '100%';
        banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; border: 1px dashed var(--accent-amber); padding: var(--space-md); border-radius: var(--radius-md); background: rgba(245, 158, 11, 0.05);">
                <span style="font-size: 0.9rem;"><span style="color: var(--accent-amber); font-weight: 700;">⚠ VBS Patch File Available</span><br/><span style="color: var(--text-muted); font-size: 0.8rem;">This is necessary for proper operation.</span></span>
                <button id="btn-auto-patch" class="btn btn-sm" style="background: var(--accent-amber); color: #000; padding: 6px 12px; font-weight: 600;">Import Patched File</button>
            </div>
        `;

        status.innerHTML = '';
        status.appendChild(banner);
        status.classList.add('has-file');

        const btn = document.getElementById('btn-auto-patch');
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.innerHTML = `<div class="spinner" style="width: 14px; height: 14px; display: inline-block;"></div> Fetching...`;
            btn.disabled = true;
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("HTTP " + res.status);
                const blob = await res.blob();
                const filename = url.split('/').pop() || 'patched.vbs';
                const file = new File([blob], filename, { type: 'text/vbscript' });
                this._setSlotFile('vbs', file);
                Toast.success("Patched VBS automatically attached!");
            } catch (err) {
                console.error("Auto patch failed:", err);
                Toast.error("Failed to fetch patch file.");
                btn.innerHTML = 'Import Patched File';
                btn.disabled = false;
            }
        };
    },

    _autoPopulateNvram(matchedFiles) {
        if (!matchedFiles || matchedFiles.length === 0) return;

        const slotId = 'nvram';
        const fileNames = matchedFiles.join(', ');
        const status = document.getElementById(`status-${slotId}`);
        const slot = document.getElementById(`slot-${slotId}`);
        const hint = document.getElementById(`drop-hint-${slotId}`);
        const clearBtn = document.getElementById(`clear-${slotId}`);

        this._state.nvramFiles = matchedFiles;

        status.innerHTML = `<span class="file-slot-check">✓</span> Matched from Repository: <strong>${this._esc(fileNames)}</strong>`;
        status.classList.add('has-file');
        slot.classList.add('has-file');
        if (hint) hint.style.display = 'none';
        if (clearBtn) clearBtn.style.display = 'flex';

        this._updateImportButton();
    },

    /* ── Event Binding ───────────────────────────────── */

    _bindEvents() {
        const nameInput = document.getElementById('import-table-name');

        // VPS search on typing (debounced)
        nameInput.addEventListener('input', () => {
            this._updateFolderPreview();
            this._updateImportButton();
            // If user edits after a VPS match, clear the match
            if (this._state.vpsId) {
                this._clearVpsMatch();
            }
            clearTimeout(this._searchTimeout);
            this._searchTimeout = setTimeout(() => {
                this._searchVps(nameInput.value.trim());
            }, 300);
        });

        // Close search results on blur (with delay for click)
        nameInput.addEventListener('blur', () => {
            setTimeout(() => this._hideSearchResults(), 200);
        });

        // Re-open search on focus if there's text
        nameInput.addEventListener('focus', () => {
            if (nameInput.value.trim().length >= 2 && !this._state.vpsId) {
                this._searchVps(nameInput.value.trim());
            }
        });

        // Other info fields
        ['import-manufacturer', 'import-year'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this._updateFolderPreview();
                    this._updateImportButton();
                });
            }
        });

        // File inputs and Clear buttons
        const slotIds = ['vpx', 'b2s', 'rom', 'puppack', 'music', 'altsound', 'altcolor', 'nvram', 'vbs', 'ini'];

        slotIds.forEach(slotId => {
            const input = document.getElementById(`file-${slotId}`);
            const clearBtn = document.getElementById(`clear-${slotId}`);

            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._clearSlot(slotId);
                });
            }

            if (!input) return;
            input.addEventListener('change', async (e) => {
                await this._setSlotFile(slotId, e.target.files);
            });
        });

        // Drag-and-drop on each slot
        slotIds.forEach(slotId => {
            const slot = document.getElementById(`slot-${slotId}`);
            if (!slot) return;

            slot.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); slot.classList.add('dragover'); });
            slot.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); slot.classList.add('dragover'); });
            slot.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (!slot.contains(e.relatedTarget)) slot.classList.remove('dragover'); });

            slot.addEventListener('drop', async (e) => {
                e.preventDefault(); e.stopPropagation(); slot.classList.remove('dragover');
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    await this._setSlotFile(slotId, files);
                }
            });
        });

        // Reset button
        document.getElementById('btn-reset-import').onclick = () => {
            this._resetState();
            Toast.info('Import form reset');
        };

        // Import button
        document.getElementById('btn-do-import').onclick = () => this._doImport();
    },

    /* ── Import Action ───────────────────────────────── */

    async _doImport() {
        if (!this._state.vpxFile) return;

        const name = document.getElementById('import-table-name').value.trim();
        if (!name) {
            Toast.error('Please enter a table name');
            return;
        }

        const overlay = document.getElementById('import-overlay');
        const progressText = document.getElementById('import-progress-text');
        overlay.style.display = 'flex';
        progressText.textContent = 'Preparing import...';

        try {
            const formData = new FormData();
            formData.append('table_name', name);
            formData.append('manufacturer', document.getElementById('import-manufacturer')?.value?.trim() || '');
            formData.append('year', document.getElementById('import-year')?.value?.trim() || '');
            formData.append('vps_id', this._state.vpsId || '');
            formData.append('table_type', this._state.vpsType || '');
            formData.append('vps_version', this._state.vpsVersion || '');
            formData.append('vps_table_url', this._state.vpsTableUrl || '');
            formData.append('ipdb_id', this._state.ipdbId || '');
            formData.append('vpx_file', this._state.vpxFile);

            const autoScrape = document.getElementById('import-scrape-media')?.checked;
            formData.append('auto_scrape', autoScrape || false);

            if (autoScrape) {
                progressText.textContent = 'Importing table & searching for media...';
            } else {
                progressText.textContent = 'Uploading files...';
            }

            if (this._state.b2sFile) formData.append('directb2s_file', this._state.b2sFile);
            if (this._state.romFiles && this._state.romFiles.length > 0) {
                this._state.romFiles.forEach(f => formData.append('rom_files', f));
            }
            if (this._state.altsoundFile) {
                if (Array.isArray(this._state.altsoundFile)) this._state.altsoundFile.forEach(f => formData.append('altsound_file', f));
                else formData.append('altsound_file', this._state.altsoundFile);
            }
            if (this._state.altcolorFile) {
                if (Array.isArray(this._state.altcolorFile)) this._state.altcolorFile.forEach(f => formData.append('altcolor_file', f));
                else formData.append('altcolor_file', this._state.altcolorFile);
            }
            if (this._state.puppackFile) {
                if (Array.isArray(this._state.puppackFile)) this._state.puppackFile.forEach(f => formData.append('puppack_file', f));
                else formData.append('puppack_file', this._state.puppackFile);
            }
            if (this._state.musicFile) {
                if (Array.isArray(this._state.musicFile)) this._state.musicFile.forEach(f => formData.append('music_file', f));
                else formData.append('music_file', this._state.musicFile);
            }

            if (this._state.vbsFile) formData.append('vbs_file', this._state.vbsFile);
            if (this._state.iniFile) formData.append('ini_file', this._state.iniFile);

            if (this._state.nvramFiles && this._state.nvramFiles.length > 0) {
                const repoNames = [];
                this._state.nvramFiles.forEach(f => {
                    if (typeof f === 'string') {
                        repoNames.push(f);
                    } else {
                        formData.append('uploaded_nvram_files', f);
                    }
                });
                if (repoNames.length > 0) {
                    formData.append('nvram_files', repoNames.join(','));
                }
            }


            const data = await apiFetch('/api/upload/import-table', {
                method: 'POST',
                body: formData,
            });

            if (data.success) {
                const vpsNote = this._state.vpsId ? ' (VPS matched)' : '';
                Toast.success(`Table imported: ${data.folder}${vpsNote}`);

                if (data.scraped && data.scraped.downloaded && data.scraped.downloaded.length > 0) {
                    Toast.success(`Successfully downloaded ${data.scraped.downloaded.length} media assets!`);
                }

                progressText.textContent = 'Import complete! Updating library...';

                // Trigger a table scan refresh
                fetch('/api/tables/scan', { method: 'POST' }).catch(() => { });
                setTimeout(() => {
                    overlay.style.display = 'none';
                    const hasPupPack = this._state.puppackFile && (!Array.isArray(this._state.puppackFile) || this._state.puppackFile.length > 0);
                    if (hasPupPack && data.id) {
                        this._showPupPackPrompt(data.id, name);
                    } else {
                        this._resetState();
                    }
                }, 1500);
            } else {
                Toast.error(data.error || 'Import failed');
                overlay.style.display = 'none';
            }
        } catch (e) {
            Toast.error('Import failed: ' + e.message);
            overlay.style.display = 'none';
        }
    },


    _showPupPackPrompt(tableId, tableName) {
        Modal.show(`
            <h3 class="modal-title">Configure PUP Pack?</h3>
            <p style="margin-bottom: 1.5rem; color: var(--text-secondary); line-height: 1.5;">You uploaded a PUP Pack for <strong>${this._esc(tableName)}</strong>.</p>
            <p style="margin-bottom: 2rem; color: var(--text-secondary); line-height: 1.5;">Would you like to review and configure its screen layouts now?</p>
            <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="Modal.hide(); window.location.hash='#tables';">No, Thanks</button>
                <button class="btn btn-primary" onclick="Modal.hide(); window.location.hash='#puppack-manager/${tableId}';">Yes, Configure</button>
            </div>
        `);
        this._resetState();
    },

    /* ═══════════════════════════════════════════════════
       Add Files to Existing Table Mode
       ═══════════════════════════════════════════════════ */


    async renderAddFiles(tableId) {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Edit Table Files</h1>
                <p class="page-subtitle">Edit and update table files</p>
            </div>
            <div style="margin-bottom: var(--space-lg);">
                <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#tables'">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back to Tables
                </button>
            </div>
            <div id="maintenance-content">
                <div style="text-align: center; padding: 40px;"><div class="spinner"></div></div>
            </div>
        `;

        try {
            const [tableRes, inventoryRes] = await Promise.all([
                fetch(`/api/tables/${tableId}`),
                fetch(`/api/tables/${tableId}/inventory`)
            ]);

            const t = await tableRes.json();
            const invData = await inventoryRes.json();
            const inv = invData.inventory || {};

            // Check for updates
            const isDirect = t.latest_vps_version && t.version && window.isVersionNewer(t.latest_vps_version, t.version) && (!t.ignored_version || window.isVersionNewer(t.latest_vps_version, t.ignored_version));
            const isCommunity = t.is_community_newer && t.community_vps_updated_at > t.vps_updated_at && (!t.ignored_version || window.isVersionNewer(t.community_vps_version, t.ignored_version));

            let html = `
                <div class="import-form">
                    <div class="settings-section">
                        <div class="settings-section-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            Table Info
                        </div>
                        <div class="card">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div style="display: flex; align-items: center; gap: var(--space-md);">
                                    <div class="file-slot-icon blue" style="flex-shrink: 0;">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">${this._esc(t.display_name)}</div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
                                            ${t.author ? `by ${this._esc(t.author)} · ` : ''}
                                            ${t.manufacturer || ''} ${t.year ? `· ${t.year}` : ''}
                                            ${t.vps_id ? ` · <a href="https://virtualpinballspreadsheet.github.io/?game=${t.vps_id}${t.vps_file_id ? `&fileType=table&fileId=${t.vps_file_id}` : ''}&f=vpx" target="_blank" rel="noopener" style="color: var(--accent-blue); text-decoration: none; font-family: monospace; background: rgba(0, 150, 255, 0.1); padding: 2px 4px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">${t.vps_id} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Current Version</div>
                                    <div style="font-weight: 700; color: ${isDirect ? 'var(--accent-amber)' : 'var(--accent-emerald)'}; font-size: 1.2rem;">${t.version || 'Unknown'}</div>
                                </div>
                            </div>

                            ${isDirect ? `
                                <div class="update-banner" style="margin-top: var(--space-md); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-md); padding: var(--space-md); display: flex; justify-content: space-between; align-items: center; animation: pulse-slow 2s infinite;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-amber); color: #000; display: flex; align-items: center; justify-content: center;">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                                        </div>
                                        <div>
                                            <div style="font-weight: 700; color: var(--accent-amber);">Author Update Available: ${t.latest_vps_version}</div>
                                            <div style="font-size: 0.82rem; color: var(--text-muted);">The original creator has published a newer version.</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: var(--space-sm);">
                                        <button class="btn btn-secondary btn-sm" id="btn-ignore-direct">Ignore Version</button>
                                        <a href="${t.vps_file_url}" target="_blank" rel="noopener" class="btn btn-accent btn-sm">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                            Download
                                        </a>
                                    </div>
                                </div>
                            ` : ''}

                            ${isCommunity ? `
                                <div class="update-banner" style="margin-top: var(--space-md); background: rgba(34, 211, 238, 0.1); border: 1px solid rgba(34, 211, 238, 0.2); border-radius: var(--radius-md); padding: var(--space-md); display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-cyan); color: #000; display: flex; align-items: center; justify-content: center;">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                                        </div>
                                        <div>
                                            <div style="font-weight: 700; color: var(--accent-cyan);">Community Newcomer: ${t.community_vps_version} by ${t.community_vps_author}</div>
                                            <div style="font-size: 0.82rem; color: var(--text-muted);">A potentially newer/better recreation exists by another author.</div>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: var(--space-sm);">
                                        <button class="btn btn-secondary btn-sm" id="btn-switch-track">Switch Tracking</button>
                                        <a href="${t.community_vps_url}" target="_blank" rel="noopener" class="btn btn-sm" style="background: var(--accent-cyan); color: #000;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                            View Table
                                        </a>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            File Management
                        </div>
                        <div class="import-slots-grid">
                            ${this._renderFileSlot('vpx', 'Primary Table (.vpx)', '.vpx', false, 'blue', 'Replace existing table file', 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', inv.vpx)}
                            ${this._renderFileSlot('b2s', 'Backglass (.directb2s)', '.directb2s', false, 'purple', 'Direct B2S backglass', 'M4 3h16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2zM9 3v18M15 3v18M3 9h6M15 9h6M3 15h6M15 15h6', inv.backglass)}
                            ${this._renderFileSlot('rom', 'PinMAME ROMs', '.zip', false, 'emerald', 'Add ROM zip(s) → pinmame/roms/', 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', inv.rom, true)}
                            ${this._renderFileSlot('vbs', 'VBS Script (.vbs)', '.vbs', false, 'purple', 'Extracted table file script', 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', inv.vbs)}
                            ${this._renderFileSlot('nvram', 'PinMAME NVRAMs', '.nv', false, 'indigo', 'NVRAM file(s) → pinmame/nvram/', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z', inv.nvram, true)}
                            ${this._renderFileSlot('ini', 'Table Settings (.ini)', '.ini', false, 'emerald', 'Replaces standardized .ini file', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM12 15a3 3 0 100-6 3 3 0 000 6z', inv.ini)}
                            ${this._renderFileSlot('puppack', 'PUP Pack', '.zip', false, 'amber', 'Extract to pupvideos/', 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', inv.puppack)}
                            ${this._renderFileSlot('altcolor', 'AltColor', '.zip', false, 'orange', 'Extract to altcolor/', 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485', inv.altcolor)}
                            ${this._renderFileSlot('altsound', 'AltSound', '.zip', false, 'pink', 'Extract to altsound/', 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5.586v12.828a1 1 0 01-1.707.707L5.586 15z', inv.altsound)}
                            ${this._renderFileSlot('music', 'Music Pack', '.zip', false, 'cyan', 'Extract to music/', 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z', inv.music)}
                        </div>
                    </div>

                    <div style="display: flex; gap: var(--space-md); align-items: center; margin-top: var(--space-lg);">
                        <button class="btn btn-primary btn-lg" id="btn-upload-files" disabled>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            Apply Changes
                        </button>
                        <button class="btn btn-secondary" onclick="window.location.hash='#tables'">
                            Cancel
                        </button>
                    </div>

                    <div id="import-overlay" class="import-overlay" style="display: none;">
                        <div class="import-overlay-content">
                            <div class="spinner" style="width: 40px; height: 40px;"></div>
                            <div id="import-progress-text" style="font-size: 1.1rem; font-weight: 600;">Updating table...</div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('maintenance-content').innerHTML = html;

            // Re-init file state
            this._resetState();
            this._state.vpsId = t.vps_id;

            // If matched to VPS, fetch metadata to show guidance links
            if (t.vps_id) {
                fetch(`/api/vps/${t.vps_id}`)
                    .then(res => res.json())
                    .then(vps => {
                        if (vps.vpx_tables) this._updateVpxGuidance(vps.vpx_tables);
                        if (vps.roms) this._updateRomGuidance(vps.roms);
                        if (vps.altcolors) this._updateAltcolorGuidance(vps.altcolors);
                        if (vps.b2s) this._updateB2sGuidance(vps.b2s);
                        if (vps.altsound) this._updateAltSoundGuidance(vps.altsound);
                        if (vps.puppack) this._updatePupPackGuidance(vps.puppack);
                        if (vps.music) this._updateMusicGuidance(vps.music);
                    })
                    .catch(err => console.error('Failed to fetch VPS guidance for maintenance:', err));
            }

            // NEW: Also analyze existing table for local assets (ROMs, NVRAM, Patches)
            fetch(`/api/tables/${t.id}/analyze`)
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        if (data.roms) this._updateRomGuidance(data.roms);
                        if (data.nvram) this._updateNvramGuidance(data.nvram);
                        if (data.patch_info && data.patch_info.patch_url) {
                            // Don't show auto-patch banner for existing table on initial load
                            // as requested by the user. Only show if replacing VPX.
                            // this._showVbsAutoPatch(data.patch_info.patch_url);
                        }
                        if (data.altcolors) this._updateAltcolorGuidance(data.altcolors);
                    }
                }).catch(err => console.error('Failed to analyze existing table:', err));

            // Bind events for slots
            const slotIds = ['vpx', 'b2s', 'rom', 'puppack', 'music', 'altsound', 'vbs', 'ini'];
            slotIds.forEach(slotId => {
                const input = document.getElementById(`file-${slotId}`);
                if (!input) return;

                // Set allow folder attributes for puppack
                if (slotId === 'puppack') {
                    input.setAttribute('webkitdirectory', '');
                    input.setAttribute('directory', '');
                    input.setAttribute('multiple', '');
                }

                input.addEventListener('change', async (e) => {
                    await this._setSlotFile(slotId, e.target.files);
                    this._updateAddFilesButton();
                });
                const slot = document.getElementById(`slot-${slotId}`);
                if (!slot) return;
                slot.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); slot.classList.add('dragover'); });
                slot.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); slot.classList.add('dragover'); });
                slot.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (!slot.contains(e.relatedTarget)) slot.classList.remove('dragover'); });
                slot.addEventListener('drop', async (e) => {
                    e.preventDefault(); e.stopPropagation(); slot.classList.remove('dragover');

                    let files = [];
                    // Check if it's a folder drop using DataTransferItem API
                    if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                        const items = e.dataTransfer.items;
                        let isFolderDrop = false;

                        // We only process folder drops for puppack, music, altsound, altcolor
                        if (['puppack', 'music', 'altsound', 'altcolor'].includes(slotId)) {
                            for (let i = 0; i < items.length; i++) {
                                const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                                if (item && item.isDirectory) {
                                    isFolderDrop = true;
                                    break;
                                }
                            }
                        }

                        if (isFolderDrop) {
                            Toast.info("Reading folder contents...");
                            files = await this._traverseFileTree(items);
                        } else {
                            files = e.dataTransfer.files;
                        }
                    } else {
                         files = e.dataTransfer?.files;
                    }

                    if (files && files.length > 0) {
                        await this._setSlotFile(slotId, files);
                        this._updateAddFilesButton();
                    }
                });
            });

            // Bind existing file removal
            document.querySelectorAll('.btn-remove-existing').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const tag = btn.closest('.existing-file-tag');
                    const relPath = tag.dataset.relPath;

                    if (this._state.deletedFiles.includes(relPath)) {
                        this._state.deletedFiles = this._state.deletedFiles.filter(p => p !== relPath);
                        tag.classList.remove('to-delete');
                        btn.title = 'Mark for deletion';
                    } else {
                        this._state.deletedFiles.push(relPath);
                        tag.classList.add('to-delete');
                        btn.title = 'Undo delete';
                    }
                    this._updateAddFilesButton();
                };
            });

            // Bind ignore button
            const ignoreBtn = document.getElementById('btn-ignore-direct');
            if (ignoreBtn) {
                ignoreBtn.onclick = async () => {
                    try {
                        const res = await fetch(`/api/tables/${tableId}/ignore`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ version: t.latest_vps_version })
                        });
                        if (res.ok) {
                            Toast.success(`Ignored version ${t.latest_vps_version}`);
                            this.renderAddFiles(tableId);
                        }
                    } catch (e) {
                        Toast.error("Failed to ignore version");
                    }
                };
            }

            // Bind switch track button
            const switchBtn = document.getElementById('btn-switch-track');
            if (switchBtn) {
                switchBtn.onclick = async () => {
                    try {
                        // We use the VPS match API to update the vps_file_id
                        await fetch(`/api/vps/match/${tableId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                vps_id: t.vps_id,
                                vps_file_id: t.community_vps_file_id || t.community_vps_version_id, // we might need to return the ID too
                                name: t.display_name,
                                manufacturer: t.manufacturer,
                                year: t.year,
                                table_type: t.table_type,
                                ipdb_id: t.ipdb_id
                            })
                        });
                        Toast.success(`Switched track to version by ${t.community_vps_author}`);
                        this.renderAddFiles(tableId);
                    } catch (e) {
                        Toast.error("Failed to switch track");
                    }
                };
            }

            document.getElementById('btn-upload-files').onclick = () => this._doAddFiles(tableId);

        } catch (e) {
            document.getElementById('maintenance-content').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">Could not load table data</div>
                    <div class="empty-state-desc">${e.message}</div>
                </div>
            `;
        }
    },

    async _traverseFileTree(items) {
        const files = [];
        const readEntriesPromise = (dirReader) => {
            return new Promise((resolve, reject) => {
                dirReader.readEntries(resolve, reject);
            });
        };

        const traverse = async (entry, path = '') => {
            if (entry.isFile) {
                const file = await new Promise((resolve) => entry.file(resolve));
                // Add the relative path to the file object so the backend knows the structure
                Object.defineProperty(file, 'webkitRelativePath', {
                    value: path + file.name,
                    writable: false
                });
                files.push(file);
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                let entries = await readEntriesPromise(dirReader);
                while (entries.length > 0) {
                    for (const childEntry of entries) {
                        await traverse(childEntry, path + entry.name + '/');
                    }
                    entries = await readEntriesPromise(dirReader);
                }
            }
        };

        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
            if (item) {
                await traverse(item);
            } else if (items[i].getAsFile) {
                files.push(items[i].getAsFile());
            }
        }
        return files;
    },

    _updateAddFilesButton() {
        const btn = document.getElementById('btn-upload-files');
        if (!btn) return;
        const hasAnyStaged = this._state.b2sFile || (this._state.romFiles && this._state.romFiles.length > 0) || this._state.puppackFile ||
            this._state.musicFile || this._state.altsoundFile || this._state.altcolorFile || this._state.vpxFile || this._state.vbsFile || this._state.iniFile;
        const hasAnyDeleted = this._state.deletedFiles && this._state.deletedFiles.length > 0;
        btn.disabled = !(hasAnyStaged || hasAnyDeleted);
    },

    async _doAddFiles(tableId) {
        const overlay = document.getElementById('import-overlay');
        const progressText = document.getElementById('import-progress-text');
        overlay.style.display = 'flex';

        const fileMap = {
            vpx: { files: this._state.vpxFile ? [this._state.vpxFile] : [], type: 'vpx' },
            b2s: { files: this._state.b2sFile ? [this._state.b2sFile] : [], type: 'backglass' },
            vbs: { files: this._state.vbsFile ? [this._state.vbsFile] : [], type: 'vbs' },
            ini: { files: this._state.iniFile ? [this._state.iniFile] : [], type: 'ini' },
            rom: { files: this._state.romFiles, type: 'rom' },
            puppack: { files: this._state.puppackFile ? (Array.isArray(this._state.puppackFile) ? this._state.puppackFile : [this._state.puppackFile]) : [], type: 'puppack' },
            music: { files: this._state.musicFile ? (Array.isArray(this._state.musicFile) ? this._state.musicFile : [this._state.musicFile]) : [], type: 'music' },
            altsound: { files: this._state.altsoundFile ? (Array.isArray(this._state.altsoundFile) ? this._state.altsoundFile : [this._state.altsoundFile]) : [], type: 'altsound' },
            altcolor: { files: this._state.altcolorFile ? (Array.isArray(this._state.altcolorFile) ? this._state.altcolorFile : [this._state.altcolorFile]) : [], type: 'altcolor' },
            nvram: { files: this._state.nvramFiles ? this._state.nvramFiles.filter(f => typeof f !== 'string') : [], type: 'nvram' },
        };

        const itemsToUpload = [];
        Object.values(fileMap).forEach(group => {
            group.files.forEach(file => {
                itemsToUpload.push({ file, type: group.type });
            });
        });

        let uploaded = 0;

        try {
            // 1. Process deletions first
            if (this._state.deletedFiles.length > 0) {
                progressText.textContent = `Cleaning up metadata...`;
                for (const path of this._state.deletedFiles) {
                    await fetch(`/api/tables/${tableId}/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
                }
            }

            // 2. Process uploads
            for (const { file, type } of itemsToUpload) {
                uploaded++;
                progressText.textContent = `Uploading ${uploaded}/${itemsToUpload.length}: ${file.name}...`;
                const formData = new FormData();
                formData.append('file_type', type);
                formData.append('file', file);

                const headers = {};
                // Pass relative path for folder drops so backend can recreate structure
                if (file.webkitRelativePath) {
                    headers['x-webkit-relative-path'] = encodeURIComponent(file.webkitRelativePath);
                }

                const res = await fetch(`/api/upload/file-to-table/${tableId}`, {
                    method: 'POST',
                    headers: headers,
                    body: formData,
                });
                const data = await res.json();
                if (!data.success) {
                    Toast.error(`Failed: ${data.error}`);
                }
            }
            Toast.success(`Changes applied successfully`);
            progressText.textContent = 'Done! Updating library...';

            // Trigger a table scan refresh
            fetch('/api/tables/scan', { method: 'POST' }).catch(() => { });
            setTimeout(() => {
                overlay.style.display = 'none';
                const hasPupPack = this._state.puppackFile && (!Array.isArray(this._state.puppackFile) || this._state.puppackFile.length > 0);
                if (hasPupPack && tableId) {
                    // Re-use the prompt we made earlier, getting the table name if possible
                    const tableName = document.querySelector('.page-header .badge-neutral')?.nextSibling?.textContent?.trim() || "this table";
                    this._showPupPackPrompt(tableId, tableName);
                } else {
                    window.location.hash = '#tables';
                }
            }, 1500);
        } catch (e) {
            Toast.error('Upload failed: ' + e.message);
            overlay.style.display = 'none';
        }
    },
};
