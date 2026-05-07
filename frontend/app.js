/* ═══════════════════════════════════════════════════════════
   VPX Manager for ES-DE — SPA Router & App Bootstrap  
   ═══════════════════════════════════════════════════════════ */

const App = {
    pages: {
        dashboard: DashboardPage,
        tables: TablesPage,
        upload: UploadPage,
        media: null, // Handled by TablesPage
        documentation: DocumentationPage,
        resources: ResourcesPage,
        settings: SettingsPage,
        "media-preferences": MediaPreferencesPage,
        patches: null, // Handled by ToolsPage
        tools: ToolsPage,
        "vbs-manager": VbsManagerPage,
        "ini-manager": IniManagerPage,
        "puppack-manager": typeof PupPackManagerPage !== 'undefined' ? PupPackManagerPage : null,
        manuals: ManualsPage,
    },

    currentPage: null,

    async init() {
        Nav.init();
        if (window.Onboarding) Onboarding.init();
        window.addEventListener('hashchange', () => this.route());
        this.route();
        this.updateVersion();
    },

    async updateVersion() {
        try {
            const res = await fetch('/api/system/status');
            const info = await res.json();
            const el = document.querySelector('.sidebar-version');
            if (el) {
                const os = info.platform === 'darwin' ? 'macOS' : (info.platform === 'linux' ? 'Linux' : info.platform);
                const versionPrefix = (info.version && !info.version.toLowerCase().startsWith('v') && !isNaN(info.version.charAt(0))) ? 'v' : '';
                el.textContent = `${versionPrefix}${info.version} · ${os}`;
            }
        } catch (e) {
            console.error('Failed to load version', e);
        }
    },

    route() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';

        // Clean up current page if needed
        if (this.currentPage) {
            const oldPage = this.pages[this.currentPage];
            if (oldPage && typeof oldPage.unmount === 'function') {
                oldPage.unmount();
            }
        }

        // Handle tables/{tableId} route
        const tablesMatch = hash.match(/^tables\/(\d+)$/);
        if (tablesMatch) {
            this.currentPage = 'tables';
            Nav.setActive('tables');
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            
            // Render tables page then show detail
            TablesPage.render().then(() => {
                TablesPage.showDetail(parseInt(tablesMatch[1]));
            });
            return;
        }

        // Handle media/{tableId} route
        const mediaMatch = hash.match(/^media\/(\d+)$/);
        if (mediaMatch) {
            this.currentPage = 'tables';
            Nav.setActive('tables');
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            
            // Render tables page then show media detail
            TablesPage.state.view = 'media';
            TablesPage.render().then(() => {
                TablesPage.showMediaDetail(parseInt(mediaMatch[1]));
            });
            return;
        }

        // Handle upload-to/{tableId} route
        const uploadMatch = hash.match(/^upload-to\/(\d+)$/);
        if (uploadMatch) {
            this.currentPage = 'upload';
            Nav.setActive('upload');
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            
            UploadPage.renderAddFiles(parseInt(uploadMatch[1]));
            return;
        }

        // Handle vbs-manager/{tableId} route
        const vbsMatch = hash.match(/^vbs-manager\/(\d+)$/);
        if (vbsMatch) {
            this.currentPage = 'vbs-manager';
            Nav.setActive('vbs-manager');
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            VbsManagerPage.render(parseInt(vbsMatch[1]));
            return;
        }

        // Handle tables sub-views (deep linking)
        const tablesViewMatch = hash.match(/^tables\/(list|grid|media)$/);
        if (tablesViewMatch) {
            const view = tablesViewMatch[1];
            const viewMap = { 'list': 'table', 'grid': 'card', 'media': 'media' };
            TablesPage.state.view = viewMap[view];
            this.currentPage = 'tables';
            Nav.setActive('tables');
            
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            
            TablesPage.render();
            return;
        }

        // Handle ini-manager/{tableId} route
        const iniMatch = hash.match(/^ini-manager\/(\d+)$/);
        if (iniMatch) {
            this.currentPage = 'ini-manager';
            Nav.setActive('ini-manager');
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            IniManagerPage.render(parseInt(iniMatch[1]));
            return;
        }

        // Handle puppack-manager/{tableId} route
        const puppackMatch = hash.match(/^puppack-manager\/(\d+)$/);
        if (puppackMatch) {
            this.currentPage = 'puppack-manager';
            Nav.setActive('puppack-manager');
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight;
            container.style.animation = '';
            if (typeof PupPackManagerPage !== 'undefined') {
                PupPackManagerPage.render(parseInt(puppackMatch[1]));
            }
            return;
        }

        // Handle simple media route
        if (hash === 'media') {
            this.currentPage = 'tables';
            Nav.setActive('tables');
            TablesPage.state.view = 'media';
            TablesPage.render();
            return;
        }

        const page = this.pages[hash];

        if (page) {
            this.currentPage = hash;
            Nav.setActive(hash);
            // Re-animate the page container
            const container = document.getElementById('page-container');
            container.style.animation = 'none';
            container.offsetHeight; // trigger reflow
            container.style.animation = '';
            page.render();
        } else {
            window.location.hash = 'dashboard';
        }
    },
};

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());

/**
 * Normalizes and compares version strings.
 * Returns true if mathematically equal (e.g. "1.4.0" == "1.4")
 */
window.versionsAreEqual = function(v1, v2) {
    if (v1 === v2) return true;
    if (v1 == null || v2 == null) return v1 === v2;

    const parts1 = String(v1).split('.');
    const parts2 = String(v2).split('.');
    const length = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < length; i++) {
        let p1 = (parts1[i] || '0').trim();
        let p2 = (parts2[i] || '0').trim();

        // If both are strictly numeric, compare as numbers
        if (/^\d+$/.test(p1) && /^\d+$/.test(p2)) {
            if (parseInt(p1, 10) !== parseInt(p2, 10)) return false;
        } else {
            // Otherwise string compare
            if (p1.toLowerCase() !== p2.toLowerCase()) return false;
        }
    }
    return true;
};

/**
 * Robust fetch wrapper that handles non-JSON responses and HTTP errors gracefully.
 */
window.apiFetch = async function(url, options = {}) {
    try {
        const res = await fetch(url, options);
        const contentType = res.headers.get('content-type');
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            // Not JSON, probably an error page or plain text
            const text = await res.text();
            if (!res.ok) {
                // If it looks like HTML, give a cleaner error
                if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
                    throw new Error(`Server returned an HTML error page (Status ${res.status}). Check backend logs.`);
                }
                throw new Error(text || `Server returned ${res.status}: ${res.statusText}`);
            }
            return text; // Return as text if not JSON but OK
        }

        if (!res.ok) {
            // Handle structured error from API if available
            const errorMsg = data.detail || data.error || data.message || `Server error (${res.status})`;
            throw new Error(errorMsg);
        }

        return data;
    } catch (e) {
        // Pass through existing Error objects, wrap others
        if (e instanceof TypeError && e.message === 'Failed to fetch') {
            throw new Error('Network error: Could not connect to the server.');
        }
        throw e;
    }
};
