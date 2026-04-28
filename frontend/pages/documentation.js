/* ═══════════════════════════════════════════════════════════
   Documentation Page
   ═══════════════════════════════════════════════════════════ */

const DocumentationPage = {
    async render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Documentation</h1>
                <p class="page-subtitle">Guides and technical reference for your VPin library</p>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    Table Structure
                </div>
                <div class="card" id="table-structure-card">
                    <div style="color: var(--text-tertiary); font-size: 0.85rem; line-height: 1.7;">
                        <p style="margin-bottom: var(--space-sm);"><strong style="color: var(--text-secondary);">Self-contained tables</strong> — each folder includes its own ROMs, music, media, and PinMAME data:</p>
                        <div style="background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: var(--space-md); font-family: monospace; font-size: 0.78rem; line-height: 1.8;">
                            Tables/<br>
                            └── Jurassic Park (Data East 1993)/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;├── Jurassic Park (Data East 1993) VPW 1.0.vpx<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;├── Jurassic Park (Data East 1993) VPW 1.0.directb2s<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;├── medias/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--accent-purple);">← wheel.png, bg.png, table.png, table.mp4</span><br>
                            &nbsp;&nbsp;&nbsp;&nbsp;├── music/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;├── pupvideos/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;└── pinmame/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── roms/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: var(--accent-blue);">← ROM .zip files</span><br>
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── altcolor/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── altsound/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── nvram/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── ini/<br>
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── cfg/
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Getting Started Guide
                </div>
                <div class="card">
                    <div style="color: var(--text-tertiary); font-size: 0.85rem; line-height: 1.6;">
                        <p>Follow these essential steps to set up your macOS Pinball environment and get the most out of VPX Manager:</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); margin-top: var(--space-xl);">
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">1. Initialize Visual Pinball X</h4>
                                <p>Visual Pinball X (VPX) on macOS is under active development. Download the latest build from <a href="https://github.com/vpinball/vpinball/actions" target="_blank">GitHub Actions</a> and run it once to create its configuration folders.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">2. Set Up ES-DE (Optional)</h4>
                                <p>If you want a front-end experience, download <a href="https://es-de.org/#Download" target="_blank">ES-DE</a>. Run it once to initialize its directories before linking it to this manager.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">3. Configure App Paths</h4>
                                <p>Head to the <a href="#settings">Settings</a> page and tell VPX Manager where your folders are located. This is the "brain" of your setup.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">4. Sync Essential Assets</h4>
                                <p>Import your existing NVRAM and VBS files using the <a href="#tools">NVRAM Tool</a> to ensure tables run with high scores and correct logic.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">5. Enable ES-DE Integration</h4>
                                <p>Enable seamless ES-DE integration by installing the <a href="#tools">VPX Launcher script</a> from the Tools page.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">6. Scan Table Library</h4>
                                <p>Head to the <a href="#tables/list">Tables</a> page and perform a library scan. The manager will walk through your folders and identify your .vpx files.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">7. Match with VPS</h4>
                                <p>Link your local tables to the <a href="#tables/list">VPS Database</a> to unlock automated media scraping and community metadata.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">8. Scrape Media & Artwork</h4>
                                <p>Use the <a href="#tables/media">Media Scraper</a> to automatically download flyers, backglass images, and wheel art for your library.</p>
                            </div>
                            <div class="doc-step">
                                <h4 style="color: var(--text-primary); margin-bottom: 6px;">9. Launch & Play</h4>
                                <p>With everything configured, you can launch tables directly from the manager or via ES-DE. Enjoy the ultimate macOS pincab experience!</p>
                            </div>
                        </div>

                        <div class="hide-on-mobile" style="margin-top: var(--space-2xl); padding-top: var(--space-xl); border-top: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <h4 style="color: var(--text-primary); margin-bottom: 4px;">Need to see the guide again?</h4>
                                <p>You can restart the interactive setup checklist at any time.</p>
                            </div>
                            <button class="btn btn-primary" onclick="Onboarding.restart()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Restart Setup Guide
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
};
