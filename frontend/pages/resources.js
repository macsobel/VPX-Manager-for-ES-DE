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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Software Downloads
                </div>
                <div class="resources-grid">
                    <a href="https://github.com/vpinball/vpinball" target="_blank" class="card resource-card">
                        <div class="resource-title">Visual Pinball Standalone</div>
                        <div class="resource-desc">GitHub releases and source code for VPX on macOS and Linux.</div>
                    </a>
                    <a href="https://es-de.org/" target="_blank" class="card resource-card">
                        <div class="resource-title">Emulation Station Desktop Edition</div>
                        <div class="resource-desc">Game launcher frontend for the desktop or a virtual pinball cabinet. Works with VPX tables when paired with a launch script.</div>
                    </a>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    Community Hubs & Databases
                </div>
                <div class="resources-grid">
                    <a href="https://vpuniverse.com/" target="_blank" class="card resource-card">
                        <div class="resource-title">VP Universe</div>
                        <div class="resource-desc">Table downloads, backglasses, and an active community forum.</div>
                    </a>
                    <a href="https://www.vpforums.org/" target="_blank" class="card resource-card">
                        <div class="resource-title">VP Forums</div>
                        <div class="resource-desc">Long-running forum with a large table archive and modding discussions.</div>
                    </a>
                    <a href="https://virtualpinballspreadsheet.github.io/" target="_blank" class="card resource-card">
                        <div class="resource-title">VPS Database</div>
                        <div class="resource-desc">Spreadsheet tracking every known table, ROM, and support file.</div>
                    </a>
                    <a href="https://github.com/superhac/vpinmediadb" target="_blank" class="card resource-card">
                        <div class="resource-title">VPin Media DB</div>
                        <div class="resource-desc">An open media database for wheel art, backglasses, and table videos developed by community member superhac.</div>
                    </a>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    Development & Reference
                </div>
                <div class="resources-grid">
                    <a href="https://github.com/jsm174/vpx-standalone-scripts" target="_blank" class="card resource-card">
                        <div class="resource-title">VBS Standalone Scripts</div>
                        <div class="resource-desc">jsm174's patched VBScript files needed to run certain tables outside of Windows.</div>
                    </a>
                    <a href="https://github.com/dekay/vpinball-wiki/wiki" target="_blank" class="card resource-card">
                        <div class="resource-title">VPinball Wiki</div>
                        <div class="resource-desc">Setup guides, troubleshooting, and config references for standalone VPX maintained by community member dekay.</div>
                    </a>
                    <a href="https://www.majorfrenchy.com/" target="_blank" class="card resource-card">
                        <div class="resource-title">Major Frenchy's Guides</div>
                        <div class="resource-desc">Video walkthroughs covering VPX setup, cab builds, and table configuration.</div>
                    </a>
                    <a href="https://discord.com/channels/652274650524418078/1076655472846831667" target="_blank" class="card resource-card">
                        <div class="resource-title">VPinball Standalone Discord</div>
                        <div class="resource-desc">The most active Visual Pinball standalone discussion online.</div>
                    </a>
                    <a href="https://www.reddit.com/r/virtualpinball/" target="_blank" class="card resource-card">
                        <div class="resource-title">Reddit r/virtualpinball</div>
                        <div class="resource-desc">A subreddit for virtual pinball news, builds, and troubleshooting.</div>
                    </a>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    Alternative Launchers & Managers
                </div>
                <div class="resources-grid">
                    <a href="https://github.com/superhac/vpinfe" target="_blank" class="card resource-card">
                        <div class="resource-title">vpinfe</div>
                        <div class="resource-desc">A light-weight, browser-based table launcher for macOS, Linux, and Windows.</div>
                    </a>
                    <a href="https://github.com/AAmanzi/vpx-micro-frontend" target="_blank" class="card resource-card">
                        <div class="resource-title">VPX Micro Frontend</div>
                        <div class="resource-desc">An easy-to-use browser-based table picker for quick VPX launches.</div>
                    </a>
                </div>
            </div>
        `;
    },
};
