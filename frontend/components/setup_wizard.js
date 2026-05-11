class SetupWizard {
    static state = {
        currentStep: 1,
        totalSteps: 7,
        config: null
    };

    static async init() {
        if (!localStorage.getItem('vpx_setup_completed')) {
            await this.show();
        }
    }

    static async show() {
        try {
            this.state.config = await apiFetch('/api/settings');
            this.state.currentStep = 1;
            this.render();

            // Set animation class
            requestAnimationFrame(() => {
                const drawer = document.getElementById('setup-wizard-drawer');
                if (drawer) drawer.classList.add('open');
            });

        } catch (e) {
            console.error('Failed to load config for setup wizard', e);
            Toast.show('Failed to start setup guide', 'error');
        }
    }

    static hide() {
        const drawer = document.getElementById('setup-wizard-drawer');
        if (drawer) {
            drawer.classList.remove('open');
            setTimeout(() => {
                if (drawer.parentNode) {
                    drawer.parentNode.removeChild(drawer);
                }
            }, 300);
        }
        localStorage.setItem('vpx_setup_completed', 'true');
    }

    static async finish() {
        localStorage.setItem('vpx_setup_completed', 'true');
        this.hide();
        Toast.show('Setup completed!', 'success');

        // Refresh whatever page we're on to reflect new paths
        if (App.currentPage && App.pages[App.currentPage]) {
            App.pages[App.currentPage].render();
        }
    }

    static next() {
        if (this.state.currentStep < this.state.totalSteps) {
            this.state.currentStep++;
            this.renderContent();
        } else {
            this.finish();
        }
    }

    static prev() {
        if (this.state.currentStep > 1) {
            this.state.currentStep--;
            this.renderContent();
        }
    }

    static async pickPath(inputId) {
        try {
            const res = await apiFetch('/api/settings/pick-path?prompt=Select%20Folder', { method: 'POST' });
            if (res.path) {
                document.getElementById(inputId).value = res.path;
            }
        } catch (e) {
            Toast.show('Folder selection not supported on this platform', 'warning');
        }
    }

    static render() {
        // Remove existing if any
        const existing = document.getElementById('setup-wizard-drawer');
        if (existing) existing.remove();

        const html = `
            <div id="setup-wizard-drawer" class="snapshot-drawer">
                <div class="snapshot-drawer-header">
                    <div>
                        <h2 style="margin:0; font-size: 1.1rem;">Initial Setup Guide</h2>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Configure your environment for the best experience.</span>
                    </div>
                    <button class="btn btn-icon" onclick="SetupWizard.hide()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="wizard-stepper">
                    ${this.renderStepper()}
                </div>

                <div class="snapshot-drawer-body" id="setup-wizard-body" style="padding-top: 0;">
                    <!-- Content injected here -->
                </div>

                <div class="snapshot-drawer-footer" style="justify-content: space-between;">
                    <button class="btn btn-secondary" id="setup-btn-prev" onclick="SetupWizard.prev()" style="display:none;">Back</button>
                    <div style="flex:1;"></div>
                    <button class="btn btn-primary" id="setup-btn-next" onclick="SetupWizard.next()">Next</button>
                </div>
            </div>

            <style>
                .wizard-stepper {
                    display: flex;
                    justify-content: center;
                    padding: var(--space-lg);
                    background: rgba(0,0,0,0.2);
                    border-bottom: 1px solid var(--glass-border);
                    position: relative;
                }

                .wizard-step-line {
                    position: absolute;
                    top: 25px;
                    left: 40px;
                    right: 40px;
                    height: 2px;
                    background: var(--glass-border);
                    z-index: 1;
                }

                .wizard-step-node {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: var(--bg-surface);
                    border: 2px solid var(--glass-border);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: bold;
                    color: var(--text-tertiary);
                    z-index: 2;
                    position: relative;
                    margin: 0 15px;
                }

                .wizard-step-node.active {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: var(--accent-blue);
                    color: var(--accent-blue);
                    box-shadow: 0 0 10px var(--accent-blue-glow);
                }

                .wizard-step-node.completed {
                    background: var(--accent-blue);
                    border-color: var(--accent-blue);
                    color: white;
                }

                .wizard-step-label {
                    position: absolute;
                    bottom: -20px;
                    font-size: 0.7rem;
                    white-space: nowrap;
                    color: var(--text-secondary);
                }

                .wizard-content-step {
                    animation: fadeIn 0.3s ease-out;
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.renderContent();
    }

    static renderStepper() {
        let html = '<div class="wizard-step-line"></div><div style="display:flex; z-index: 2;">';

        for (let i = 1; i <= this.state.totalSteps; i++) {
            let className = 'wizard-step-node';
            if (i < this.state.currentStep) className += ' completed';
            if (i === this.state.currentStep) className += ' active';

            let label = '';
            if (i === this.state.currentStep) {
                const labels = ['', 'Welcome', 'VPX Dir', 'ES-DE Dir', 'ES-DE XML', 'Displays', 'Database', 'Finish'];
                label = `<div class="wizard-step-label">${labels[i]}</div>`;
            }

            html += `<div class="${className}">${i}${label}</div>`;
        }

        html += '</div>';
        return html;
    }

    static renderContent() {
        // Update Stepper visually
        const stepperContainer = document.querySelector('.wizard-stepper');
        if (stepperContainer) {
            stepperContainer.innerHTML = this.renderStepper();
        }

        const body = document.getElementById('setup-wizard-body');
        const btnPrev = document.getElementById('setup-btn-prev');
        const btnNext = document.getElementById('setup-btn-next');

        btnPrev.style.display = this.state.currentStep > 1 ? 'flex' : 'none';
        btnNext.textContent = this.state.currentStep === this.state.totalSteps ? 'Finish Setup' : 'Next';

        let html = '';

        switch (this.state.currentStep) {
            case 1: // Welcome
                html = `
                    <div class="wizard-content-step" style="text-align: center; padding-top: 2rem;">
                        <img src="/static/icon.png" width="80" style="margin-bottom: 1rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                        <h2 style="margin-bottom: 1rem;">Welcome to VPX Manager</h2>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                            This setup guide will help you configure Visual Pinball X, organize your table paths, configure your displays, and optionally integrate with Emulation Station.
                        </p>

                        <div style="text-align: left; background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
                            <h4 style="color: var(--accent-blue); margin-top: 0; margin-bottom: 1rem;">What we'll do:</h4>
                            <ul style="color: var(--text-secondary); line-height: 1.8; margin: 0; padding-left: 1.2rem;">
                                <li>Set up VPX and Emulation Station paths</li>
                                <li>Assign your monitors for Backglass and DMD</li>
                                <li>Scan your existing tables</li>
                                <li>Connect to the Virtual Pinball Spreadsheet</li>
                            </ul>
                        </div>
                    </div>
                `;
                break;

            case 2: // VPX Path
                html = `
                    <div class="wizard-content-step">
                        <h3 style="margin-top: 1rem;"><i class="fas fa-folder-open" style="color: var(--accent-blue); margin-right: 10px;"></i>Visual Pinball Directory</h3>

                        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin-top: 0; margin-bottom: 1rem;">Downloading & Installing VPX</h4>
                            <ol style="color: var(--text-secondary); line-height: 1.8; margin: 0; padding-left: 1.2rem; font-size: 0.9rem;">
                                <li>Download the latest release from the <a href="https://github.com/vpinball/vpinball/releases" target="_blank" style="color: var(--accent-blue);">VPX GitHub Releases</a> page for your OS.</li>
                                <li>Extract the downloaded archive to a location on your system (e.g., <code>~/Applications/VPX</code>).</li>
                                <li>Run the <code>vpx</code> executable once to generate the initial configuration files.</li>
                            </ol>
                        </div>

                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
                            Select the directory where Visual Pinball Standalone is installed (the folder containing the <code>vpx</code> executable).
                        </p>

                        <div class="form-group">
                            <label>VPX Standalone App Path</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-vpx-path" class="input-field" value="${this.state.config.vpx_standalone_app_path || ''}" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-vpx-path')"><i class="fas fa-folder"></i></button>
                            </div>
                        </div>

                        <div class="form-group" style="margin-top: 1.5rem;">
                            <label>Tables Directory (Optional)</label>
                            <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-bottom: 8px;">
                                If your tables are stored outside the main VPX folder, specify that here.
                            </p>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-tables-path" class="input-field" value="${this.state.config.tables_dir || ''}" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-tables-path')"><i class="fas fa-folder"></i></button>
                            </div>
                        </div>
                    </div>
                `;
                // Hook next button to save
                btnNext.onclick = async () => {
                    const vpx = document.getElementById('wiz-vpx-path').value;
                    const tables = document.getElementById('wiz-tables-path').value;
                    if (vpx) {
                        try {
                            const btn = btnNext;
                            const origText = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                            await apiFetch('/api/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ vpx_standalone_app_path: vpx, tables_dir: tables || null })
                            });
                            this.state.config.vpx_standalone_app_path = vpx;
                            this.state.config.tables_dir = tables;
                            btn.innerHTML = origText;
                            this.next();
                        } catch (e) {
                            Toast.show(e.message, 'error');
                            btnNext.innerHTML = 'Next';
                        }
                    } else {
                        this.next();
                    }
                };
                break;

            case 3: // ES-DE Path
                html = `
                    <div class="wizard-content-step">
                        <h3 style="margin-top: 1rem;"><i class="fas fa-gamepad" style="color: var(--accent-purple); margin-right: 10px;"></i>Emulation Station Directory</h3>

                        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin-top: 0; margin-bottom: 1rem;">Downloading & Installing ES-DE</h4>
                            <ol style="color: var(--text-secondary); line-height: 1.8; margin: 0; padding-left: 1.2rem; font-size: 0.9rem;">
                                <li>Download the ES-DE frontend from the <a href="https://es-de.org/" target="_blank" style="color: var(--accent-blue);">official website</a>.</li>
                                <li>Install and launch the application once to let it create its default folders.</li>
                                <li>(Optional) Configure a new system specifically for Virtual Pinball in your <code>es_systems.xml</code> file.</li>
                            </ol>
                        </div>

                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
                            If you use Emulation Station (ES-DE) as your frontend, specify the path to its <code>downloaded_media</code> directory. This allows the manager to directly update your frontend artwork.
                        </p>

                        <div class="form-group">
                            <label>ES-DE Media Directory</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-esde-path" class="input-field" value="${this.state.config.esde_media_dir || ''}" placeholder="e.g. /home/user/ES-DE/downloaded_media" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-esde-path')"><i class="fas fa-folder"></i></button>
                            </div>
                        </div>

                        <div style="margin-top: 2rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-secondary);">
                            <i class="fas fa-info-circle" style="color: var(--accent-blue); margin-right: 5px;"></i>
                            <strong>Note:</strong> You can skip this step if you don't use Emulation Station.
                        </div>
                    </div>
                `;
                btnNext.onclick = async () => {
                    const esde = document.getElementById('wiz-esde-path').value;
                    try {
                        const btn = btnNext;
                        const origText = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                        await apiFetch('/api/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ esde_media_dir: esde || null })
                        });
                        this.state.config.esde_media_dir = esde;
                        btn.innerHTML = origText;
                        this.next();
                    } catch (e) {
                        Toast.show(e.message, 'error');
                        btnNext.innerHTML = 'Next';
                    }
                };
                break;

            case 4: // Gamelist XML Path
                html = `
                    <div class="wizard-content-step">
                        <h3 style="margin-top: 1rem;"><i class="fas fa-file-code" style="color: var(--accent-orange); margin-right: 10px;"></i>Gamelist XML File</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                            To sync table metadata (names, years, manufacturers) directly into Emulation Station, provide the path to the <code>gamelist.xml</code> file for your vpinball system.
                        </p>

                        <div class="form-group">
                            <label>Gamelist XML Path</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-xml-path" class="input-field" value="${this.state.config.esde_gamelists_dir || ''}" placeholder="e.g. ~/.emulationstation/gamelists/vpinball/gamelist.xml" style="flex:1;">
                            </div>
                        </div>
                    </div>
                `;
                btnNext.onclick = async () => {
                    const xml = document.getElementById('wiz-xml-path').value;
                    try {
                        const btn = btnNext;
                        const origText = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                        await apiFetch('/api/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ esde_gamelists_dir: xml || null })
                        });
                        this.state.config.esde_gamelists_dir = xml;
                        btn.innerHTML = origText;
                        this.next();
                    } catch (e) {
                        Toast.show(e.message, 'error');
                        btnNext.innerHTML = 'Next';
                    }
                };
                break;

            case 5: // Displays
                html = `
                    <div class="wizard-content-step">
                        <h3 style="margin-top: 1rem;"><i class="fas fa-desktop" style="color: var(--accent-blue); margin-right: 10px;"></i>Assign Displays</h3>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                            Identify which monitor should display the Backglass and which should display the DMD (if you have one).
                        </p>
                        <div id="wiz-displays-container">
                            <div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading displays...</div>
                        </div>
                    </div>
                `;
                // Fetch displays asynchronously
                setTimeout(async () => {
                    try {
                        const sysDisplays = await apiFetch('/api/displays');
                        const displays = sysDisplays.displays || [];
                        const container = document.getElementById('wiz-displays-container');
                        if (!container) return;

                        if (!displays || displays.length === 0) {
                            container.innerHTML = '<div class="empty-state">No displays detected.</div>';
                            return;
                        }

                        let selectHtml = '';
                        // Find current mappings
                        let currentBg = 0, currentDmd = 0;
                        if (this.state.config.displays) {
                            const bg = this.state.config.displays.find(d => d.role === 'Backglass');
                            if (bg) currentBg = bg.index;
                            const dmd = this.state.config.displays.find(d => d.role === 'DMD');
                            if (dmd) currentDmd = dmd.index;
                        }

                        selectHtml += `<div class="form-group"><label>Backglass Monitor</label><select id="wiz-bg-display" class="input-field">`;
                        selectHtml += `<option value="0">Default (Display 0)</option>`;
                        displays.forEach(d => {
                            if (d.index !== 0) {
                                selectHtml += `<option value="${d.index}" ${currentBg === d.index ? 'selected' : ''}>Display ${d.index} (${d.width}x${d.height})</option>`;
                            }
                        });
                        selectHtml += `</select></div>`;

                        selectHtml += `<div class="form-group" style="margin-top: 1rem;"><label>DMD / Topper Monitor</label><select id="wiz-dmd-display" class="input-field">`;
                        selectHtml += `<option value="-1">None</option>`;
                        displays.forEach(d => {
                            selectHtml += `<option value="${d.index}" ${currentDmd === d.index ? 'selected' : ''}>Display ${d.index} (${d.width}x${d.height})</option>`;
                        });
                        selectHtml += `</select></div>`;

                        container.innerHTML = selectHtml;

                    } catch (e) {
                        const container = document.getElementById('wiz-displays-container');
                        if (container) container.innerHTML = `<div class="empty-state" style="color: var(--accent-red)">Error loading displays</div>`;
                    }
                }, 100);

                btnNext.onclick = async () => {
                    const bgSelect = document.getElementById('wiz-bg-display');
                    const dmdSelect = document.getElementById('wiz-dmd-display');

                    if (bgSelect && dmdSelect) {
                        const displays = [
                            { role: 'Backglass', index: parseInt(bgSelect.value) }
                        ];
                        if (parseInt(dmdSelect.value) >= 0) {
                            displays.push({ role: 'DMD', index: parseInt(dmdSelect.value) });
                        }

                        try {
                            const btn = btnNext;
                            const origText = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                            await apiFetch('/api/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ displays: displays, dmd_enabled: displays.some(d => d.role === 'DMD') })
                            });
                            btn.innerHTML = origText;
                            this.next();
                        } catch (e) {
                            Toast.show('Failed to save displays', 'error');
                            btnNext.innerHTML = 'Next';
                        }
                    } else {
                        this.next(); // Proceed anyway if not loaded
                    }
                };
                break;

            case 6: // Database Scan
                html = `
                    <div class="wizard-content-step" style="text-align: center;">
                        <h3 style="margin-top: 1rem;"><i class="fas fa-database" style="color: var(--accent-purple); margin-right: 10px;"></i>Library Scan</h3>
                        <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 2rem;">
                            Now that your paths are configured, let's scan your VPX directory to build your database and sync any existing tables.
                        </p>

                        <button id="wiz-scan-btn" class="btn btn-primary" style="padding: 12px 24px; font-size: 1.1rem; width: 100%; justify-content: center;">
                            <i class="fas fa-sync-alt" id="wiz-scan-icon"></i> Start Initial Scan
                        </button>

                        <div id="wiz-scan-status" style="margin-top: 1.5rem; font-size: 0.9rem; color: var(--text-tertiary); display:none;">
                            Scanning directories... this may take a few minutes depending on your library size.
                        </div>
                    </div>
                `;

                // Redefine next button logic for this step
                btnNext.onclick = () => this.next(); // Allow skipping

                setTimeout(() => {
                    const scanBtn = document.getElementById('wiz-scan-btn');
                    if (scanBtn) {
                        scanBtn.onclick = async () => {
                            try {
                                scanBtn.disabled = true;
                                document.getElementById('wiz-scan-icon').classList.add('fa-spin');
                                document.getElementById('wiz-scan-status').style.display = 'block';

                                await apiFetch('/api/db/scan', { method: 'POST' });

                                scanBtn.innerHTML = '<i class="fas fa-check"></i> Scan Complete';
                                document.getElementById('wiz-scan-icon').classList.remove('fa-spin');
                                document.getElementById('wiz-scan-status').style.display = 'none';
                                document.getElementById('wiz-scan-status').textContent = 'Database successfully populated!';
                                document.getElementById('wiz-scan-status').style.color = 'var(--accent-emerald)';
                                document.getElementById('wiz-scan-status').style.display = 'block';

                                setTimeout(() => this.next(), 1500);
                            } catch (e) {
                                scanBtn.disabled = false;
                                document.getElementById('wiz-scan-icon').classList.remove('fa-spin');
                                document.getElementById('wiz-scan-status').textContent = 'Scan failed: ' + e.message;
                                document.getElementById('wiz-scan-status').style.color = 'var(--accent-red)';
                            }
                        };
                    }
                }, 100);
                break;

            case 7: // Finish
                html = `
                    <div class="wizard-content-step" style="text-align: center; padding-top: 2rem;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 2px solid var(--accent-emerald); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: var(--accent-emerald); margin: 0 auto 1.5rem auto;">
                            <i class="fas fa-check"></i>
                        </div>
                        <h2 style="margin-bottom: 1rem;">You're All Set!</h2>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                            Your environment is configured and ready to go. You can always adjust these settings later from the Settings page.
                        </p>
                    </div>
                `;
                btnNext.onclick = () => this.finish();
                break;
        }

        if (body) body.innerHTML = html;
    }
}
