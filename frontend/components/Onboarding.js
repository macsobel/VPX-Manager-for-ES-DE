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
                title: 'Setup Visual Pinball X',
                desc: 'Install the latest macOS or Linux action build and run it once to set up your environment.',
                link: 'https://github.com/vpinball/vpinball/actions',
                external: true
            },
            {
                id: 'esde',
                title: 'Set Up Emulation Station: DE',
                desc: 'Download ES-DE if you want to use the frontend experience and run it once to initialize.',
                link: 'https://es-de.org/#Download',
                external: true
            },
            {
                id: 'settings',
                title: 'Configure VPX Manager Settings',
                desc: 'Configure this tool with your VPX and ES-DE folders on the Settings page.',
                link: '#settings'
            },
            {
                id: 'nvram',
                title: 'Preload Configured NVRAMs',
                desc: 'Download and import NVRAM files using the Tools page.',
                link: '#tools'
            },
            {
                id: 'launcher',
                title: 'Enable ES-DE Integration',
                desc: 'Install the automated VPX Launcher script from the Tools page.',
                link: '#tools'
            },
            {
                id: 'scan',
                title: 'Scan Table Library',
                desc: 'Find your existing .vpx files and populate the database.',
                link: '#tables/list'
            },
            {
                id: 'vps',
                title: 'Match with VPS',
                desc: 'Connect your tables to the VPS for automated media and metadata.',
                link: '#tables/list'
            },
            {
                id: 'media',
                title: 'Scrape Media Files',
                desc: 'Download videos, backglass images, and wheel art.',
                link: '#tables/media'
            },
            {
                id: 'play',
                title: 'Launch & Play',
                desc: 'You\'re all set! Launch a table and enjoy.',
                link: '#tables/list'
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
            this.ensureInBounds();

            // Handle window resize
            window.addEventListener('resize', () => {
                this.ensureInBounds();
            });
        }
    },

    ensureInBounds() {
        const el = document.getElementById('onboarding-widget');
        if (!el) return;

        let x = this.state.pos.x;
        let y = this.state.pos.y;

        const maxX = window.innerWidth - el.offsetWidth;
        const maxY = window.innerHeight - el.offsetHeight;

        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;
        if (x < 0) x = 0;
        if (y < 0) y = 0;

        if (x !== this.state.pos.x || y !== this.state.pos.y) {
            this.state.pos = { x, y };
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            this.save();
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
        // Reset all steps
        this.state.steps.forEach(s => s.completed = false);
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
        if (!el) return;
        const header = el.querySelector('.onboarding-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY;

        header.onmousedown = (e) => {
            isDragging = true;
            startX = e.clientX - el.offsetLeft;
            startY = e.clientY - el.offsetTop;
            header.style.cursor = 'grabbing';

            const onMouseMove = (e) => {
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

            const onMouseUp = () => {
                isDragging = false;
                header.style.cursor = 'grab';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.save();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
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
                <div class="onboarding-title-group" onclick="if(Onboarding.state.minimized) Onboarding.minimize()">
                    <span class="onboarding-icon">🚀</span>
                    <div class="onboarding-text-stack">
                        <h3>First Run Setup Guide</h3>
                        ${this.state.minimized ? `<div class="onboarding-mini-progress">${progress}% Complete</div>` : ''}
                    </div>
                </div>
                <div class="onboarding-actions">
                    <button class="onboarding-btn-min" onclick="Onboarding.minimize()" title="${this.state.minimized ? 'Expand' : 'Minimize'}">
                        ${this.state.minimized ? `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        ` : `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                        `}
                    </button>
                    <button class="onboarding-btn-close" onclick="Onboarding.dismiss()" title="Close Guide">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
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
                            <div class="onboarding-item-main">
                                <div class="onboarding-checkbox" onclick="Onboarding.toggleStep('${step.id}')">
                                    ${step.completed ? '✓' : ''}
                                </div>
                                <div class="onboarding-item-info">
                                    <div class="onboarding-item-title">${step.title}</div>
                                    <div class="onboarding-item-desc">${step.desc}</div>
                                    <a href="${step.link}" class="onboarding-item-link" ${step.external ? 'target="_blank"' : ''}>
                                        ${step.external ? 'Open External Site →' : 'Go to Page →'}
                                    </a>
                                </div>
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

        this.setupDraggable();
    }
};

window.Onboarding = Onboarding;
