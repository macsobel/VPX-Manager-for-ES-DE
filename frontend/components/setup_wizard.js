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

    static gotoStep(step) {
        if (step >= 1 && step <= this.state.totalSteps) {
            this.state.currentStep = step;
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
                    <button class="btn btn-secondary btn-icon" onclick="SetupWizard.hide()" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                    padding: 2rem 1rem;
                    background: rgba(0,0,0,0.2);
                    border-bottom: 1px solid var(--glass-border);
                    position: relative;
                }

                .wizard-step-line {
                    position: absolute;
                    top: 50%;
                    left: 60px;
                    right: 60px;
                    height: 2px;
                    background: var(--glass-border);
                    transform: translateY(-50%);
                    z-index: 1;
                }

                .wizard-step-node {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--bg-surface);
                    border: 2px solid var(--glass-border);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-tertiary);
                    z-index: 2;
                    position: relative;
                    margin: 0 18px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .wizard-step-node:hover {
                    border-color: var(--accent-blue);
                    color: var(--text-primary);
                }

                .wizard-step-node.active {
                    background: rgba(59, 130, 246, 0.15);
                    border-color: var(--accent-blue);
                    color: var(--accent-blue);
                }

                .wizard-step-node.completed {
                    background: var(--accent-blue);
                    border-color: var(--accent-blue);
                    color: white;
                }

                .wizard-step-label {
                    position: absolute;
                    bottom: -24px;
                    font-size: 0.75rem;
                    white-space: nowrap;
                    color: var(--text-secondary);
                    font-weight: 500;
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
                const labels = ['', 'Welcome', 'VPX Dir', 'ES-DE Dir', 'Displays', 'Scraper', 'Database', 'Finish'];
                label = `<div class="wizard-step-label">${labels[i]}</div>`;
            }

            html += `<div class="${className}" onclick="SetupWizard.gotoStep(${i})">${i}${label}</div>`;
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
                        <img src="/static/favicon.png" width="80" style="margin-bottom: 1rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
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
                        <h4 style="color: var(--text-primary); margin-top: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            <i class="fas fa-layer-group" style="margin-right: 8px;"></i>Visual Pinball Standalone Settings
                        </h4>

                        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin-top: 0; margin-bottom: 1rem;">Step 1: Install VPX macOS Build</h4>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Follow the steps below to download the latest VPX build from the GitHub repository.</p>
                            
                            <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-blue); padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px; font-size: 0.9rem;">
                                <i class="fas fa-lightbulb" style="color: var(--accent-yellow); margin-right: 8px;"></i>
                                <strong>Prefer BGFX builds</strong> over OpenGL builds for best compatibility and rendering.
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <p style="color: var(--text-secondary); font-size: 0.95rem; margin: 0;"><strong>From VPinball Github follow these steps:</strong></p>
                                <a href="https://github.com/vpinball/vpinball" target="_blank" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;"><i class="fas fa-external-link-alt"></i> Open Github</a>
                            </div>

                            <ol style="color: var(--text-secondary); line-height: 1.8; margin: 0; padding-left: 1.2rem; font-size: 0.9rem;">
                                <li>Open the <a href="https://github.com/vpinball/vpinball/actions" target="_blank" style="color: var(--accent-blue);">Actions tab</a></li>
                                <li>Find the <a href="https://github.com/vpinball/vpinball/actions/workflows/build-vpinball.yml" target="_blank" style="color: var(--accent-blue);">workflow that builds VPinball</a></li>
                                <li>Open a successful workflow run</li>
                                <li>Scroll to Artifacts</li>
                                <li>Download and install:
                                    <ul style="margin: 0; padding-left: 1.2rem;">
                                        <li><strong>VPinball_BGFX-macos-arm64</strong> (Apple Silicon, most modern Macs)</li>
                                        <li><strong>OR VPinball_BGFX-macos-x64</strong> (Intel Mac)</li>
                                    </ul>
                                </li>
                            </ol>
                        </div>

                        <div class="input-group" style="margin-bottom: 1.5rem;">
                            <label class="input-label">VPX Standalone App Path</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-vpx-path" class="input-field" value="${this.state.config.vpx_standalone_app_path || ''}" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-vpx-path')"><i class="fas fa-folder"></i> Browse</button>
                            </div>
                            <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">Path to the VPinballX executable or .app bundle</p>
                        </div>

                        <div class="input-group" style="margin-bottom: 1.5rem;">
                            <label class="input-label">VPX Flavor</label>
                            <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                                <span id="label-wiz-flavor-bgfx" style="font-size: 0.85rem; color: ${this.state.config.vpx_use_flavor !== 'GL' ? 'var(--text-primary)' : 'var(--text-tertiary)'}; font-weight: 500;">BGFX</span>
                                <label class="switch">
                                    <input type="checkbox" id="wiz-vpx-flavor" ${this.state.config.vpx_use_flavor === 'GL' ? 'checked' : ''} onchange="document.getElementById('label-wiz-flavor-bgfx').style.color = this.checked ? 'var(--text-tertiary)' : 'var(--text-primary)'; document.getElementById('label-wiz-flavor-gl').style.color = this.checked ? 'var(--text-primary)' : 'var(--text-tertiary)';">
                                    <span class="slider round"></span>
                                </label>
                                <span id="label-wiz-flavor-gl" style="font-size: 0.85rem; color: ${this.state.config.vpx_use_flavor === 'GL' ? 'var(--text-primary)' : 'var(--text-tertiary)'}; font-weight: 500;">GL</span>
                            </div>
                        </div>

                        <div class="input-group" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
                            <label class="input-label">Tables Directory</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-tables-path" class="input-field" value="${this.state.config.tables_dir || ''}" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-tables-path')"><i class="fas fa-folder"></i> Browse</button>
                            </div>
                            <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">
                                Folder containing your VPX tables
                            </p>
                        </div>
                    </div>
                `;
                // Hook next button to save
                btnNext.onclick = async () => {
                    const vpx = document.getElementById('wiz-vpx-path').value;
                    const tables = document.getElementById('wiz-tables-path').value;
                    const flavor = document.getElementById('wiz-vpx-flavor').checked ? 'GL' : 'BGFX';
                    if (vpx) {
                        try {
                            const btn = btnNext;
                            const origText = btn.innerHTML;
                            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                            await apiFetch('/api/settings', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ vpx_standalone_app_path: vpx, tables_dir: tables || null, vpx_use_flavor: flavor })
                            });
                            this.state.config.vpx_standalone_app_path = vpx;
                            this.state.config.tables_dir = tables;
                            this.state.config.vpx_use_flavor = flavor;
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
                        <h4 style="color: var(--text-primary); margin-top: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            <i class="fas fa-desktop" style="margin-right: 8px;"></i>Emulation Station Desktop Edition Settings
                        </h4>

                        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin-top: 0; margin-bottom: 1rem;">Downloading & Installing ES-DE</h4>
                            <ol style="color: var(--text-secondary); line-height: 1.8; margin: 0; padding-left: 1.2rem; font-size: 0.9rem;">
                                <li>Download the ES-DE frontend from the <a href="https://es-de.org/" target="_blank" style="color: var(--accent-blue);">official website</a>.</li>
                                <li>Install and launch the application once to let it create its default folders.</li>
                            </ol>
                        </div>

                        <div class="input-group" style="margin-bottom: 1.5rem;">
                            <label class="input-label">Emulation Station Desktop Edition App Path</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-esde-app-path" class="input-field" value="${this.state.config.esde_app_path || ''}" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-esde-app-path')"><i class="fas fa-folder"></i> Browse</button>
                            </div>
                            <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">Path to the ES-DE executable or .app bundle</p>
                        </div>

                        <div class="input-group" style="margin-bottom: 1.5rem;">
                            <label class="input-label">Media Storage Strategy</label>
                            <select id="wiz-esde-media-strategy" class="input-field" onchange="
                                const mediaDirGroup = document.getElementById('wiz-esde-media-dir-group');
                                if (this.value === 'standard') {
                                    mediaDirGroup.style.display = 'block';
                                } else {
                                    mediaDirGroup.style.display = 'none';
                                }
                            ">
                                <option value="standard" ${this.state.config.media_storage_mode === 'standard' || !this.state.config.media_storage_mode ? 'selected' : ''}>Standard (Store in ES-DE Downloaded Media Directory)</option>
                                <option value="portable" ${this.state.config.media_storage_mode === 'portable' ? 'selected' : ''}>Portable (Store alongside tables in a /media subfolder)</option>
                            </select>
                            <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">Determines how media paths are written to gamelist.xml and where media is stored.</p>
                        </div>

                        <div class="input-group" id="wiz-esde-media-dir-group" style="display: ${this.state.config.media_storage_mode === 'standard' || !this.state.config.media_storage_mode ? 'block' : 'none'};">
                            <label class="input-label">ES-DE Downloaded Media Directory</label>
                            <div style="display:flex; gap: 8px;">
                                <input type="text" id="wiz-esde-media-dir" class="input-field" value="${this.state.config.esde_media_dir || ''}" style="flex:1;">
                                <button class="btn btn-secondary" onclick="SetupWizard.pickPath('wiz-esde-media-dir')"><i class="fas fa-folder"></i> Browse</button>
                            </div>
                            <p style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 4px;">Directory for ES-DE downloaded media</p>
                        </div>
                    </div>
                `;
                btnNext.onclick = async () => {
                    const esdeAppPath = document.getElementById('wiz-esde-app-path').value;
                    const strategy = document.getElementById('wiz-esde-media-strategy').value;
                    const esdeMediaDir = document.getElementById('wiz-esde-media-dir').value;
                    try {
                        const btn = btnNext;
                        const origText = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                        await apiFetch('/api/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                esde_app_path: esdeAppPath || null,
                                media_storage_mode: strategy,
                                esde_media_dir: strategy === 'standard' ? (esdeMediaDir || null) : null
                            })
                        });
                        this.state.config.esde_app_path = esdeAppPath;
                        this.state.config.media_storage_mode = strategy;
                        this.state.config.esde_media_dir = strategy === 'standard' ? esdeMediaDir : this.state.config.esde_media_dir;
                        btn.innerHTML = origText;
                        this.next();
                    } catch (e) {
                        Toast.show(e.message, 'error');
                        btnNext.innerHTML = 'Next';
                    }
                };
                break;

            case 4: // Displays
                html = `
                    <div class="wizard-content-step">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 1rem;">
                            <h4 style="color: var(--text-primary); margin: 0;">
                                <i class="fas fa-desktop" style="margin-right: 8px;"></i>Cabinet Display Profile
                            </h4>
                            <button type="button" class="btn btn-secondary btn-sm" id="wiz-btn-identify" style="font-size: 0.75rem; padding: 4px 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                Identify Displays
                            </button>
                        </div>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                            Assign your physical monitors to their roles for Virtual Pinball rendering.
                        </p>
                        <div id="wiz-displays-container">
                            <div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading displays...</div>
                        </div>
                    </div>
                `;

                setTimeout(() => {
                    const btnIdentify = document.getElementById('wiz-btn-identify');
                    if (btnIdentify) {
                        btnIdentify.onclick = async (e) => {
                            e.preventDefault();
                            btnIdentify.disabled = true;
                            const oldHtml = btnIdentify.innerHTML;
                            btnIdentify.innerHTML = '<div class="spinner" style="width: 12px; height: 12px; border-width: 2px; display: inline-block;"></div>';
                            try {
                                await fetch('/api/displays/identify', { method: 'POST' });
                                Toast.success('Identification overlays sent to all displays');
                            } catch (err) {
                                Toast.error('Failed to trigger display identification');
                            }
                            btnIdentify.disabled = false;
                            btnIdentify.innerHTML = oldHtml;
                        };
                    }
                }, 100);

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
                        let currentPlayfield = '', currentBg = '', currentDmd = '';
                        if (this.state.config.displays) {
                            const pf = this.state.config.displays.find(d => d.role === 'Playfield');
                            if (pf) currentPlayfield = pf.uuid;
                            const bg = this.state.config.displays.find(d => d.role === 'Backglass');
                            if (bg) currentBg = bg.uuid;
                            const dmd = this.state.config.displays.find(d => d.role === 'DMD' || d.role === 'FullDMD');
                            if (dmd) currentDmd = dmd.uuid;
                        }

                        const renderOptions = (selectedUuid) => {
                            let options = `<option value="">-- None Assigned --</option>`;
                            displays.forEach(d => {
                                const isSelected = d.uuid === selectedUuid ? 'selected' : '';
                                const scaleStr = d.scale_factor > 1.0 ? ` (Scale: ${d.scale_factor}x)` : '';
                                options += `<option value="${d.uuid}" ${isSelected}>[ID: ${d.index}] ${d.name} - ${d.width}x${d.height}${scaleStr}</option>`;
                            });
                            return options;
                        };

                        selectHtml += `
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-sm); margin-bottom: 1.5rem;">
                                <div class="input-group">
                                    <label class="input-label">Playfield Display</label>
                                    <select id="wiz-pf-display" class="input-field" data-role="Playfield">${renderOptions(currentPlayfield)}</select>
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Backglass Display</label>
                                    <select id="wiz-bg-display" class="input-field" data-role="Backglass">${renderOptions(currentBg)}</select>
                                </div>
                                <div class="input-group">
                                    <label class="input-label">DMD Display</label>
                                    <select id="wiz-dmd-display" class="input-field" data-role="DMD_FullDMD">${renderOptions(currentDmd)}</select>
                                </div>
                            </div>
                            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-subtle);">
                                <div class="input-group" style="max-width: 400px;">
                                    <label class="input-label">Playfield Orientation</label>
                                    <select class="input-field" id="wiz-master-orientation">
                                        <option value="" ${this.state.config.master_orientation === '' ? 'selected' : ''}>Auto-Detect</option>
                                        <option value="0" ${this.state.config.master_orientation === '0' ? 'selected' : ''}>0 Degrees (Landscape)</option>
                                        <option value="90" ${this.state.config.master_orientation === '90' ? 'selected' : ''}>90 Degrees</option>
                                        <option value="180" ${this.state.config.master_orientation === '180' ? 'selected' : ''}>180 Degrees</option>
                                        <option value="270" ${this.state.config.master_orientation === '270' ? 'selected' : ''}>270 Degrees (Portrait)</option>
                                    </select>
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">Sets default rotation in newly generated INI files. Auto-detects based on server primary monitor if left empty.</div>
                                </div>
                            </div>
                        `;

                        container.innerHTML = selectHtml;

                        // Attach raw displays payload onto container for lookup on save
                        container.sysDisplays = displays;

                    } catch (e) {
                        const container = document.getElementById('wiz-displays-container');
                        if (container) container.innerHTML = `<div class="empty-state" style="color: var(--accent-red)">Error loading displays</div>`;
                    }
                }, 100);

                btnNext.onclick = async () => {
                    const container = document.getElementById('wiz-displays-container');
                    const displaysConfig = [];
                    const sysDisplays = container?.sysDisplays || [];

                    const pfSelect = document.getElementById('wiz-pf-display');
                    const bgSelect = document.getElementById('wiz-bg-display');
                    const dmdSelect = document.getElementById('wiz-dmd-display');
                    const orientSelect = document.getElementById('wiz-master-orientation');

                    const processSelect = (selectElem) => {
                        if (!selectElem) return;
                        const uuid = selectElem.value;
                        const role = selectElem.dataset.role;
                        if (uuid) {
                            const sysDisplay = sysDisplays.find(d => d.uuid === uuid);
                            if (sysDisplay) {
                                const baseConfig = {
                                    index: sysDisplay.index,
                                    name: sysDisplay.name,
                                    uuid: sysDisplay.uuid,
                                    width: sysDisplay.width,
                                    height: sysDisplay.height,
                                    x: sysDisplay.x || 0,
                                    y: sysDisplay.y || 0,
                                    scale_factor: sysDisplay.scale_factor
                                };
                                if (role === 'DMD_FullDMD') {
                                    displaysConfig.push({ ...baseConfig, role: 'DMD' });
                                    displaysConfig.push({ ...baseConfig, role: 'FullDMD' });
                                } else {
                                    displaysConfig.push({ ...baseConfig, role: role });
                                }
                            }
                        }
                    };

                    processSelect(pfSelect);
                    processSelect(bgSelect);
                    processSelect(dmdSelect);

                    try {
                        const btn = btnNext;
                        const origText = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                        await apiFetch('/api/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                displays: displaysConfig,
                                master_orientation: orientSelect?.value || '',
                                dmd_enabled: !!(dmdSelect && dmdSelect.value)
                            })
                        });
                        this.state.config.displays = displaysConfig;
                        this.state.config.master_orientation = orientSelect?.value || '';
                        btn.innerHTML = origText;
                        this.next();
                    } catch (e) {
                        Toast.show('Failed to save displays', 'error');
                        btnNext.innerHTML = 'Next';
                    }
                };
                break;

            case 5: // ScreenScraper Setup
                html = `
                    <div class="wizard-content-step">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 1.5rem; margin-top: 1.5rem;">
                            <h4 style="color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 8px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ScreenScraper Account
                            </h4>
                            <a href="https://www.screenscraper.fr/membreinscription.php" target="_blank" style="font-size: 0.75rem; color: var(--accent-blue); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                                Register for a New Account <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </a>
                        </div>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
                            Log in to your ScreenScraper account to enable downloading metadata, wheel art, videos, and more. A free account is required.
                        </p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
                            <div class="input-group">
                                <label class="input-label">Username</label>
                                <input class="input-field" id="wiz-ss-user" value="${this.state.config.screenscraper_username || ''}" placeholder="ScreenScraper ID">
                            </div>
                            <div class="input-group">
                                <label class="input-label">Password</label>
                                <input class="input-field" type="password" id="wiz-ss-pass" value="${this.state.config.screenscraper_password || ''}" placeholder="••••••••">
                            </div>
                        </div>
                        <div style="margin-top: var(--space-md); display: flex; gap: var(--space-sm); align-items: center;">
                            <button class="btn btn-secondary" id="wiz-btn-test-ss">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                Test Connection
                            </button>
                            <div id="wiz-ss-test-status" style="font-size: 0.85rem;"></div>
                        </div>
                    </div>
                `;

                setTimeout(() => {
                    const btnTest = document.getElementById('wiz-btn-test-ss');
                    if (btnTest) {
                        btnTest.onclick = async () => {
                            const statusDiv = document.getElementById('wiz-ss-test-status');
                            statusDiv.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></div> Testing...';

                            try {
                                const user = document.getElementById('wiz-ss-user').value;
                                const pass = document.getElementById('wiz-ss-pass').value;
                                await apiFetch('/api/settings', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ screenscraper_username: user, screenscraper_password: pass })
                                });
                                const res = await fetch('/api/scraper/test', { method: 'POST' });
                                const result = await res.json();
                                if (result.success) {
                                    statusDiv.innerHTML = `<span style="color: var(--accent-green);">✓ ${result.message}</span>`;
                                } else {
                                    statusDiv.innerHTML = `<span style="color: var(--accent-red);">✗ ${result.message}</span>`;
                                }
                            } catch (e) {
                                statusDiv.innerHTML = `<span style="color: var(--accent-red);">✗ Error: ${e.message}</span>`;
                            }
                        };
                    }
                }, 100);

                btnNext.onclick = async () => {
                    const user = document.getElementById('wiz-ss-user').value;
                    const pass = document.getElementById('wiz-ss-pass').value;
                    try {
                        const btn = btnNext;
                        const origText = btn.innerHTML;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                        await apiFetch('/api/settings', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ screenscraper_username: user, screenscraper_password: pass })
                        });
                        this.state.config.screenscraper_username = user;
                        this.state.config.screenscraper_password = pass;
                        btn.innerHTML = origText;
                        this.next();
                    } catch (e) {
                        Toast.show(e.message, 'error');
                        btnNext.innerHTML = 'Next';
                    }
                };
                break;

            case 6: // Database Scan
                html = `
                    <div class="wizard-content-step" style="text-align: left;">
                        <div style="text-align: center; margin-bottom: 2rem;">
                            <h3 style="margin-top: 1rem; margin-bottom: 0.5rem;"><i class="fas fa-database" style="color: var(--accent-purple); margin-right: 10px;"></i>Library Sync</h3>
                            <p style="color: var(--text-secondary); font-size: 0.95rem; margin: 0;">
                                Keep your library up to date by downloading the latest community databases and syncing your local tables.
                            </p>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 400px; margin: 0 auto;">
                            <div>
                                <button id="wiz-btn-update-db" class="btn btn-primary" style="padding: 14px 24px; font-size: 1.05rem; width: 100%; justify-content: center; margin-bottom: 0.5rem;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    Step 1: Update Databases
                                </button>
                                <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; text-align: center;">Downloads the latest Visual Pinball Spreadsheet</p>
                            </div>

                            <div style="border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                                <button id="wiz-scan-btn" class="btn btn-primary" style="padding: 14px 24px; font-size: 1.05rem; width: 100%; justify-content: center; margin-bottom: 0.5rem;">
                                    <i class="fas fa-sync-alt" id="wiz-scan-icon" style="margin-right: 8px;"></i> Step 2: Scan Tables
                                </button>
                                <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; text-align: center;">Scans your directories and builds your local library</p>
                            </div>
                        </div>

                        <div id="wiz-scan-status" style="margin-top: 2rem; display:none;">
                            <div style="background: var(--glass-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border);">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div class="spinner-sm" id="wiz-scan-spinner"></div>
                                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;" id="wiz-scan-status-label">Scanning tables...</span>
                                    </div>
                                    <span id="wiz-scan-progress-text" style="color: var(--text-tertiary); font-variant-numeric: tabular-nums; font-size: 0.85rem; font-weight: 500;">0 / 0</span>
                                </div>
                                <div style="width: 100%; background-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-full); overflow: hidden; height: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
                                    <div id="wiz-scan-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #60a5fa); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                // Redefine next button logic for this step
                btnNext.onclick = () => this.next(); // Allow skipping

                setTimeout(() => {
                    const updateBtn = document.getElementById('wiz-btn-update-db');
                    if (updateBtn) {
                        updateBtn.onclick = async () => {
                            if (updateBtn.disabled) return;
                            updateBtn.disabled = true;
                            updateBtn.style.opacity = '0.7';
                            Toast.show('Starting database update...', 'info');
                            try {
                                const res = await fetch('/api/db/sync-vps', { method: 'POST' });
                                const data = await res.json();
                                Toast.success(data.message || 'Databases updated successfully!');
                            } catch (e) {
                                Toast.error('Failed to update databases');
                            }
                            updateBtn.disabled = false;
                            updateBtn.style.opacity = '1';
                        };
                    }

                    const scanBtn = document.getElementById('wiz-scan-btn');
                    if (scanBtn) {
                        scanBtn.onclick = async () => {
                            try {
                                scanBtn.disabled = true;
                                document.getElementById('wiz-scan-icon').classList.add('fa-spin');
                                document.getElementById('wiz-scan-status').style.display = 'block';
                                document.getElementById('wiz-scan-spinner').style.display = 'block';
                                document.getElementById('wiz-scan-status-label').textContent = 'Starting scan...';
                                document.getElementById('wiz-scan-progress-bar').style.width = '0%';
                                document.getElementById('wiz-scan-progress-text').textContent = '';

                                await fetch('/api/tables/scan', { method: 'POST' });

                                // Start polling
                                const poll = async () => {
                                    try {
                                        const res = await fetch('/api/tables/scan/status');
                                        const status = await res.json();

                                        document.getElementById('wiz-scan-status-label').textContent = status.message || 'Scanning tables...';

                                        if (status.total > 0) {
                                            const pct = Math.round((status.progress / status.total) * 100);
                                            document.getElementById('wiz-scan-progress-bar').style.width = `${pct}%`;
                                            document.getElementById('wiz-scan-progress-text').textContent = `${status.progress} / ${status.total}`;
                                        }

                                        if (status.status === 'completed' || status.status === 'failed') {
                                            clearInterval(SetupWizard._scanPolling);
                                            document.getElementById('wiz-scan-spinner').style.display = 'none';
                                            document.getElementById('wiz-scan-icon').classList.remove('fa-spin');
                                            
                                            if (status.status === 'failed') {
                                                document.getElementById('wiz-scan-status-label').textContent = 'Scan Failed: ' + (status.error || 'Unknown error');
                                                document.getElementById('wiz-scan-status-label').style.color = 'var(--accent-red)';
                                                scanBtn.disabled = false;
                                            } else {
                                                document.getElementById('wiz-scan-status-label').textContent = 'Scan Complete!';
                                                document.getElementById('wiz-scan-status-label').style.color = 'var(--accent-emerald)';
                                                scanBtn.innerHTML = '<i class="fas fa-check"></i> Scan Complete';
                                                setTimeout(() => this.next(), 1500);
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Scan polling error', e);
                                    }
                                };
                                
                                if (SetupWizard._scanPolling) clearInterval(SetupWizard._scanPolling);
                                SetupWizard._scanPolling = setInterval(poll, 1000);
                                poll();
                            } catch (e) {
                                scanBtn.disabled = false;
                                document.getElementById('wiz-scan-icon').classList.remove('fa-spin');
                                document.getElementById('wiz-scan-status-label').textContent = 'Scan failed: ' + e.message;
                                document.getElementById('wiz-scan-status-label').style.color = 'var(--accent-red)';
                            }
                        };
                    }
                }, 100);
                break;

            case 7: // Finish
                html = `
                    <div class="wizard-content-step" style="text-align: center; padding-top: 2rem;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--accent-emerald); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                        </div>
                        <h2 style="margin-bottom: 1rem;">You're All Set!</h2>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                            Your environment is configured and ready to go. You can always adjust these settings later from the Settings page.
                        </p>
                        <button class="btn btn-secondary" onclick="window.location.hash = 'tables'; SetupWizard.hide();" style="padding: 10px 20px; font-size: 1rem;">
                            Go to Tables
                        </button>
                    </div>
                `;
                btnNext.onclick = () => this.finish();
                break;
        }

        if (body) body.innerHTML = html;
    }
}
