document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || userRole !== 'therapist') {
        alert('Please sign in with the Therapist role to open this portal.');
        window.location.href = '../landing-page/login.html';
        return;
    }

    const identifier = localStorage.getItem('userIdentifier') || 'Therapist';
    const displayName = identifier.includes('@')
        ? identifier.split('@')[0].replace(/[._]/g, ' ')
        : identifier;
    const formattedName = displayName
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const portalName = document.querySelector('.user-chip strong');
    const portalAvatar = document.querySelector('.user-chip .avatar');
    if (portalName) {
        portalName.textContent = formattedName;
    }
    if (portalAvatar && formattedName) {
        const initials = formattedName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
        portalAvatar.textContent = initials;
    }

    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-panel');

    // Tab Switching Logic
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 1. Remove active state from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // 2. Add active state to clicked item
            item.classList.add('active');
            
            // 3. Get the target view ID
            const targetViewId = `view-${item.getAttribute('data-target')}`;
            
            // 4. Hide all views, show the target view
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetViewId) {
                    view.classList.add('active');
                }
            });
        });
    });

    // Sub-tab logic for "My Clients" filter
    const clientTabs = document.querySelectorAll('.tabs button');
    clientTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            clientTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Report Category Button toggle
    const catBtns = document.querySelectorAll('.cat-btn');
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
});