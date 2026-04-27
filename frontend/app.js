/* ═══════════════════════════════════════════════════════════
   VPX Manager for ES-DE — SPA Router & App Bootstrap  
   ═══════════════════════════════════════════════════════════ */

const App = {
    pages: {
        dashboard: DashboardPage,
        tables: TablesPage,
        upload: UploadPage,
        media: null, // Handled by TablesPage
        collections: CollectionsPage,
        documentation: DocumentationPage,
        resources: ResourcesPage,
        settings: SettingsPage,
        "media-preferences": MediaPreferencesPage,
        patches: null, // Handled by ToolsPage
        tools: ToolsPage,
        "vbs-manager": VbsManagerPage,
        "ini-manager": IniManagerPage,
        manuals: ManualsPage,
    },

    currentPage: null,

    init() {
        Nav.init();
        if (window.Onboarding) Onboarding.init();
        window.addEventListener('hashchange', () => this.route());
        this.route();
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
