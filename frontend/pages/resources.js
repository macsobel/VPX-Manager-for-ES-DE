/* ═══════════════════════════════════════════════════════════
   Resources Page
   ═══════════════════════════════════════════════════════════ */

const ResourcesPage = {
    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Resources</h1>
                <p class="page-subtitle">External links and community tools for Visual Pinball</p>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    Community Links
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-md);">
                    <a href="https://vpinball.com/" target="_blank" class="card resource-card" style="text-decoration: none; transition: transform 0.2s, border-color 0.2s;">
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">VPinball.com</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">Tables, media, and a vibrant community.</div>
                    </a>
                    <a href="https://vpuniverse.com/" target="_blank" class="card resource-card" style="text-decoration: none; transition: transform 0.2s, border-color 0.2s;">
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">VP Universe</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">Home to high-quality table releases and backglasses.</div>
                    </a>
                    <a href="https://virtual-pinball-spreadsheet.web.app/" target="_blank" class="card resource-card" style="text-decoration: none; transition: transform 0.2s, border-color 0.2s;">
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">VPS Database</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">The ultimate spreadsheet for table and ROM cross-referencing.</div>
                    </a>
                    <a href="https://github.com/vpinball/vpinball" target="_blank" class="card resource-card" style="text-decoration: none; transition: transform 0.2s, border-color 0.2s;">
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">VPinballX Source</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary);">The open-source core of Visual Pinball.</div>
                    </a>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Essential Tools
                </div>
                <div class="card">
                    <div style="color: var(--text-tertiary); font-size: 0.85rem; line-height: 1.6;">
                        <ul style="padding-left: 20px; display: grid; gap: var(--space-xs);">
                            <li><strong>B2S Server:</strong> Required for active backglass displays.</li>
                            <li><strong>PinMAME:</strong> The engine that emulates original pinball ROMs.</li>
                            <li><strong>FlexDMD:</strong> Modern interface for Dot Matrix Displays.</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    },
};
