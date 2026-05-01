/* ═══════════════════════════════════════════════════════════
   Media Preferences Page
   ═══════════════════════════════════════════════════════════ */

const MediaPreferencesPage = {
    defaultPreferences: null, // Fetched from backend

    categories: [
        { id: "covers", name: "Covers" },
        { id: "fanart", name: "Fanart" },
        { id: "manuals", name: "Manuals" },
        { id: "marquees", name: "Marquees" },
        { id: "screenshots", name: "Screenshots" },
        { id: "videos", name: "Videos" }
    ],

    sources: [], // Fetched from backend

    currentPreferences: {},

    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <style>
                @media (max-width: 768px) {
                    .media-pref-header-actions {
                        flex-direction: column;
                        width: 100%;
                    }
                    .media-pref-header-actions button {
                        width: 100%;
                        justify-content: center;
                    }
                    .preference-item {
                        flex-direction: column;
                        align-items: stretch !important;
                        gap: var(--space-md) !important;
                        padding: var(--space-md) !important;
                    }
                    .preference-item-index {
                        margin-bottom: -5px;
                    }
                    .preference-item select {
                        width: 100% !important;
                    }
                    .preference-item-actions {
                        display: flex !important;
                        flex-direction: row !important;
                        justify-content: center !important;
                        gap: var(--space-lg) !important;
                        padding-top: var(--space-sm);
                    }
                    .preference-item-actions button {
                        width: auto !important;
                        padding: 8px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }
                }
            </style>
            <div class="page-header">
                <div style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-sm);">
                    <button class="btn btn-secondary" onclick="window.location.hash = 'settings'" style="padding: 6px; border-radius: 50%;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    </button>
                    <h1 class="page-title" style="margin: 0;">Media Download Preferences</h1>
                </div>
                <p class="page-subtitle">Configure priority order for media downloads by category.</p>
            </div>

            <div class="card" style="margin-bottom: var(--space-xl);">
                <div class="media-pref-header-actions" style="display: flex; justify-content: flex-end; margin-bottom: var(--space-md); gap: var(--space-sm);">
                    <button class="btn btn-secondary" id="btn-reset-defaults">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        Restore Defaults
                    </button>
                    <button class="btn btn-primary" id="btn-save-preferences">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save Preferences
                    </button>
                </div>

                <div id="preferences-container" style="display: grid; gap: var(--space-lg);">
                    <div style="text-align: center;"><div class="spinner"></div></div>
                </div>
            </div>
        `;

        await this.loadPreferences();
        this.renderPreferences();
        this.bindEvents();
    },

    async loadPreferences() {
        try {
            // Fetch current settings, defaults, and source definitions
            const [settingsRes, defaultsRes, sourcesRes] = await Promise.all([
                fetch('/api/settings'),
                fetch('/api/settings/defaults'),
                fetch('/api/scraper/sources')
            ]);
            
            const settingsData = await settingsRes.json();
            const defaultsData = await defaultsRes.json();
            const sourcesData = await sourcesRes.json();
            
            this.sources = sourcesData;
            this.defaultPreferences = defaultsData.media_preferences;

            // Deep copy to avoid reference issues
            if (settingsData.media_preferences && Object.keys(settingsData.media_preferences).length > 0) {
                this.currentPreferences = JSON.parse(JSON.stringify(settingsData.media_preferences));
            } else {
                this.currentPreferences = JSON.parse(JSON.stringify(this.defaultPreferences));
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
            this.currentPreferences = this.currentPreferences || {};
        }
    },

    renderPreferences() {
        const container = document.getElementById('preferences-container');
        if (!container) return;

        let html = '';

        for (const category of this.categories) {
            const prefs = this.currentPreferences[category.id] || [];

            html += `
                <div class="settings-section" style="background: var(--bg-primary); border-radius: 8px; padding: var(--space-md); border: 1px solid var(--border-color);">
                    <div style="font-weight: 600; font-size: 1.1rem; color: var(--text-primary); margin-bottom: var(--space-md); border-bottom: 1px solid var(--border-color); padding-bottom: var(--space-sm);">
                        ${category.name}
                    </div>

                    <div class="preference-list" id="pref-list-${category.id}" style="display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-md);">
                        ${prefs.map((pref, idx) => this.renderPreferenceItem(category.id, idx, pref)).join('')}
                        ${prefs.length === 0 ? '<div style="color: var(--text-tertiary); font-style: italic; padding: var(--space-sm);">No sources configured for this category.</div>' : ''}
                    </div>

                    <button class="btn btn-secondary btn-sm" onclick="MediaPreferencesPage.addPreference('${category.id}')" style="margin-top: var(--space-sm);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add Source Priority
                    </button>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    renderPreferenceItem(categoryId, index, pref) {
        const sourceOptions = this.sources.map(s =>
            `<option value="${s.id}" ${s.id === pref.source ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        const currentSource = this.sources.find(s => s.id === pref.source) || this.sources[0];
        const keyOptions = currentSource.keys.map(k =>
            `<option value="${k}" ${k === pref.key ? 'selected' : ''}>${k}</option>`
        ).join('');

        return `
            <div class="preference-item" style="display: flex; align-items: center; gap: var(--space-sm); background: var(--bg-secondary); padding: var(--space-sm) var(--space-md); border-radius: 6px; border: 1px solid var(--border-color);">
                <div class="preference-item-index" style="font-weight: bold; color: var(--text-secondary); width: 24px;">#${index + 1}</div>

                <select class="input-field" style="width: 200px;"
                        onchange="MediaPreferencesPage.updateSource('${categoryId}', ${index}, this.value)">
                    ${sourceOptions}
                </select>

                <select class="input-field" style="flex: 1;"
                        onchange="MediaPreferencesPage.updateKey('${categoryId}', ${index}, this.value)"
                        id="pref-key-${categoryId}-${index}">
                    ${keyOptions}
                </select>

                <div class="preference-item-actions" style="display: flex; gap: 4px;">
                    <button class="btn btn-secondary" style="padding: 4px; border: none; background: transparent;"
                            onclick="MediaPreferencesPage.movePreference('${categoryId}', ${index}, -1)"
                            ${index === 0 ? 'disabled style="opacity: 0.3; padding: 4px; border: none; background: transparent;"' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    <button class="btn btn-secondary" style="padding: 4px; border: none; background: transparent;"
                            onclick="MediaPreferencesPage.movePreference('${categoryId}', ${index}, 1)"
                            ${index === this.currentPreferences[categoryId].length - 1 ? 'disabled style="opacity: 0.3; padding: 4px; border: none; background: transparent;"' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <button class="btn btn-secondary" style="padding: 4px; border: none; background: transparent; color: var(--accent-red);"
                            onclick="MediaPreferencesPage.removePreference('${categoryId}', ${index})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
        `;
    },

    updateSource(categoryId, index, newSource) {
        this.currentPreferences[categoryId][index].source = newSource;
        const sourceObj = this.sources.find(s => s.id === newSource);
        this.currentPreferences[categoryId][index].key = sourceObj.keys[0]; // Reset key
        this.renderPreferences(); // Re-render to update the keys dropdown
    },

    updateKey(categoryId, index, newKey) {
        this.currentPreferences[categoryId][index].key = newKey;
    },

    movePreference(categoryId, index, direction) {
        const prefs = this.currentPreferences[categoryId];
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= prefs.length) return;

        const temp = prefs[index];
        prefs[index] = prefs[newIndex];
        prefs[newIndex] = temp;

        this.renderPreferences();
    },

    addPreference(categoryId) {
        if (!this.currentPreferences[categoryId]) {
            this.currentPreferences[categoryId] = [];
        }

        const defaultSource = this.sources[0];
        this.currentPreferences[categoryId].push({
            source: defaultSource.id,
            key: defaultSource.keys[0]
        });

        this.renderPreferences();
    },

    removePreference(categoryId, index) {
        this.currentPreferences[categoryId].splice(index, 1);
        this.renderPreferences();
    },

    bindEvents() {
        document.getElementById('btn-reset-defaults').onclick = () => {
            Modal.confirm(
                'Restore Defaults',
                'Are you sure you want to reset all media preferences to their defaults? This will not be saved until you click the <strong>Save Preferences</strong> button.',
                () => {
                    this.currentPreferences = JSON.parse(JSON.stringify(this.defaultPreferences));
                    this.renderPreferences();
                    Toast.info("Preferences reset to defaults (not saved yet)");
                }
            );
        };

        document.getElementById('btn-save-preferences').onclick = async () => {
            const btn = document.getElementById('btn-save-preferences');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; display: inline-block;"></div> Saving...';

            try {
                const body = {
                    media_preferences: this.currentPreferences
                };

                await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                Toast.success('Media preferences saved successfully');
            } catch (e) {
                Toast.error('Failed to save preferences: ' + e.message);
                console.error(e);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Preferences';
            }
        };
    }
};
