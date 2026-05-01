/* ═══════════════════════════════════════════════════════════
   Sidebar Navigation Controller
   ═══════════════════════════════════════════════════════════ */

const Nav = {
    init() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) {
                    window.location.hash = page;
                }
            });
        });
    },

    setActive(page) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });
    },
};
