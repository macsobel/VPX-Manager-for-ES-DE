/**
 * Onboarding Checklist Component
 * A floating, draggable guide for first-time users.
 */
const Onboarding = {
    state: {
        visible: false,
        minimized: false,
        dragged: false,
        pos: { x: window.innerWidth - 320, y: 80 },
        steps: [
            { 
                id: 'vpx', 
                title: 'Initialize Visual Pinball X', 
                desc: 'Install the latest macOS build and run it once to set up your environment.',
                link: 'https://github.com/vpinball/vpinball/actions',
                external: true
            },
            { 
                id: 'esde', 
                title: 'Set Up EmulationStation DE', 
                desc: 'Download ES-DE if you want a frontend experience and run it once to initialize.',
                link: 'https://es-de.org/#Download',
                external: true
            },
            { 
                id: 'settings', 
                title: 'Configure App Paths', 
                desc: 'Connect the manager to your VPX and ES-DE folders on the Settings page.',
                link: '#settings'
            },
            { 
                id: 'nvram', 
                title: 'Sync Essential Assets', 
                desc: 'Import your existing NVRAM and VBS files using the Tools page.',
                link: '#tools'
            },
            { 
                id: 'launcher', 
                title: 'Enable ES-DE Integration', 
                desc: 'Install the VPX Launcher script from the Tools page.',
                link: '#tools'
            },
            { 
                id: 'scan', 
                title: 'Scan Table Library', 
                desc: 'Find your .vpx files and populate the database.',
                link: '#tables'
            },
            { 
                id: 'vps', 
                title: 'Match with VPS', 
                desc: 'Connect your tables to the VPS for automated media and metadata.',
                link: '#tables'
            },
            { 
                id: 'media', 
                title: 'Scrape Artwork', 
                desc: 'Download flyers, backglass images, and wheel art.',
                link: '#scraper'
            },
            { 
                id: 'play', 
                title: 'Launch & Play', 
                desc: 'You\'re all set! Launch a table and enjoy.',
                link: '#tables'
            }
        ]
    },

    init() {
        // Load state from localStorage
        const saved = localStorage.getItem('vpx_onboarding_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.state.steps = this.state.steps.map(s => ({
                ...s,
                completed: !!parsed.completedSteps?.includes(s.id)
            }));
            this.state.visible = !parsed.dismissed;
            this.state.minimized = !!parsed.minimized;
            if (parsed.pos) this.state.pos = parsed.pos;
        } else {
            // First time run
            this.state.visible = true;
        }

        if (this.state.visible) {
            this.render();
            this.setupDraggable();
        }
    },

    save() {
        const completedSteps = this.state.steps.filter(s => s.completed).map(s => s.id);
        localStorage.setItem('vpx_onboarding_state', JSON.stringify({
            completedSteps,
            dismissed: !this.state.visible,
            minimized: this.state.minimized,
            pos: this.state.pos
        }));
    },

    toggleStep(id) {
        const step = this.state.steps.find(s => s.id === id);
        if (step) {
            step.completed = !step.completed;
            this.render();
            this.save();
        }
    },

    minimize() {
        this.state.minimized = !this.state.minimized;
        this.render();
        this.save();
    },

    dismiss() {
        this.state.visible = false;
        const el = document.getElementById('onboarding-widget');
        if (el) el.remove();
        this.save();
    },

    restart() {
        this.state.visible = true;
        this.state.minimized = false;
        this.render();
        this.setupDraggable();
        this.save();
        
        // Show a success toast if available
        if (window.Toast) {
            Toast.show('Setup Guide restarted!', 'success');
        }
    },

    setupDraggable() {
        const el = document.getElementById('onboarding-widget');
        const header = el.querySelector('.onboarding-header');
        
        let isDragging = false;
        let startX, startY;

        header.onmousedown = (e) => {
            isDragging = true;
            startX = e.clientX - el.offsetLeft;
            startY = e.clientY - el.offsetTop;
            header.style.cursor = 'grabbing';
        };

        document.onmousemove = (e) => {
            if (!isDragging) return;
            let x = e.clientX - startX;
            let y = e.clientY - startY;
            
            // Constrain to window
            x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
            
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            this.state.pos = { x, y };
        };

        document.onmouseup = () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'grab';
                this.save();
            }
        };
    },

    render() {
        let el = document.getElementById('onboarding-widget');
        if (!el) {
            el = document.createElement('div');
            el.id = 'onboarding-widget';
            document.body.appendChild(el);
        }

        el.className = `onboarding-checklist glass ${this.state.minimized ? 'minimized' : ''}`;
        el.style.left = this.state.pos.x + 'px';
        el.style.top = this.state.pos.y + 'px';

        const completedCount = this.state.steps.filter(s => s.completed).length;
        const totalCount = this.state.steps.length;
        const progress = Math.round((completedCount / totalCount) * 100);

        el.innerHTML = `
            <div class="onboarding-header">
                <div class="onboarding-title-group">
                    <span class="onboarding-icon">🚀</span>
                    <h3>Setup Mission</h3>
                </div>
                <div class="onboarding-actions">
                    <button class="onboarding-btn-min" onclick="Onboarding.minimize()">
                        ${this.state.minimized ? '▢' : '—'}
                    </button>
                    <button class="onboarding-btn-close" onclick="Onboarding.dismiss()">×</button>
                </div>
            </div>
            
            <div class="onboarding-content">
                <div class="onboarding-progress-container">
                    <div class="onboarding-progress-text">
                        <span>Mission Progress</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="onboarding-progress-bar">
                        <div class="onboarding-progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>

                <ul class="onboarding-list">
                    ${this.state.steps.map(step => `
                        <li class="onboarding-item ${step.completed ? 'completed' : ''}">
                            <div class="onboarding-checkbox" onclick="Onboarding.toggleStep('${step.id}')">
                                ${step.completed ? '✓' : ''}
                            </div>
                            <div class="onboarding-text">
                                <div class="onboarding-step-title">${step.title}</div>
                                <div class="onboarding-step-desc">${step.desc}</div>
                                <a href="${step.link}" 
                                   ${step.external ? 'target="_blank"' : ''} 
                                   class="onboarding-step-action">
                                   ${step.external ? 'Open External Site' : 'Go to Page'} →
                                </a>
                            </div>
                        </li>
                    `).join('')}
                </ul>

                ${completedCount === totalCount ? `
                    <div class="onboarding-success">
                        Mission Accomplished! You\'re ready to play.
                        <button class="btn btn-primary" style="width: 100%; margin-top: 12px;" onclick="Onboarding.dismiss()">Finish Guide</button>
                    </div>
                ` : ''}
            </div>
        `;
    }
};

window.Onboarding = Onboarding;
