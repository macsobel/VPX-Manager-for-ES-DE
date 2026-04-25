/* ═══════════════════════════════════════════════════════════
   Modal Dialog System
   ═══════════════════════════════════════════════════════════ */

const Modal = {
    show(contentHtml) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = contentHtml;
        overlay.classList.remove('hidden');

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) this.hide();
        };

        // Close on Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    hide() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    alert(title, message, onOk) {
        this.show(`
            <h3 class="modal-title">${title}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">${message}</p>
            <div class="modal-actions">
                <button class="btn btn-primary" id="modal-ok-btn">OK</button>
            </div>
        `);
        document.getElementById('modal-ok-btn').onclick = () => {
            if (onOk) onOk();
            this.hide();
        };
    },

    confirm(title, message, onConfirm) {
        this.show(`
            <h3 class="modal-title">${title}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">${message}</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                <button class="btn btn-danger" id="modal-confirm-btn">Confirm</button>
            </div>
        `);
        document.getElementById('modal-confirm-btn').onclick = () => {
            onConfirm();
            this.hide();
        };
    },
 
    choice(title, message, choices) {
        // choices: [{ label: '...', class: '...', onClick: () => {} }]
        this.show(`
            <h3 class="modal-title">${title}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">${message}</p>
            <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                ${choices.map((c, i) => `
                    <button class="btn ${c.class || 'btn-secondary'}" id="modal-choice-btn-${i}">${c.label}</button>
                `).join('')}
            </div>
        `);
        choices.forEach((c, i) => {
            document.getElementById(`modal-choice-btn-${i}`).onclick = () => {
                if (c.onClick) c.onClick();
                this.hide();
            };
        });
    },

    prompt(title, message, defaultValue, onConfirm) {
        this.show(`
            <h3 class="modal-title">${title}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: var(--space-md);">${message}</p>
            <input type="text" id="modal-prompt-input" class="input-field" value="${defaultValue || ''}" style="width: 100%; margin-bottom: var(--space-lg);" autofocus placeholder="Enter value...">
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="Modal.hide()">Cancel</button>
                <button class="btn btn-primary" id="modal-prompt-confirm">Submit</button>
            </div>
        `);
        
        const input = document.getElementById('modal-prompt-input');
        // Small delay to ensure DOM is ready for focus
        setTimeout(() => {
            input.focus();
            if (defaultValue) input.select();
        }, 50);
        
        const handleConfirm = () => {
            const val = input.value;
            onConfirm(val);
            this.hide();
        };

        document.getElementById('modal-prompt-confirm').onclick = handleConfirm;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') handleConfirm();
        };
    },
};
