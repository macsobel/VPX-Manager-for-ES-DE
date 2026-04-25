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
                    Getting Started
                </div>
                <div class="card">
                    <div style="color: var(--text-tertiary); font-size: 0.85rem; line-height: 1.6;">
                        <p>To get the most out of VPX Manager, ensure your table directory follows the structure shown above. This allows the manager to automatically detect and link all related files (backglass, media, and ROMs) for each table.</p>
                        <p style="margin-top: var(--space-md);">For further assistance, check the <strong>Resources</strong> page for community links and tools.</p>
                    </div>
                </div>
            </div>
        `;
    },
};
