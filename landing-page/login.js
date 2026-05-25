// login.js

document.addEventListener('DOMContentLoaded', () => {
    const roleOptions = document.querySelectorAll('.role-option');
    const anonToggleContainer = document.querySelector('.anon-toggle');
    const anonCheckbox = document.getElementById('anonymous');
    const identifierInput = document.getElementById('email');

    function updateLoginFields(selectedRole) {
        const isStaff = selectedRole === 'admin' || selectedRole === 'therapist';

        if (anonToggleContainer) {
            anonToggleContainer.style.display = isStaff ? 'none' : 'flex';
        }
        if (isStaff && anonCheckbox) {
            anonCheckbox.checked = false;
        }

        if (identifierInput) {
            const isAnonymous = !isStaff && (anonCheckbox?.checked ?? false);
            identifierInput.type = isAnonymous ? 'text' : 'email';
            identifierInput.placeholder = isAnonymous
                ? 'Enter your username'
                : 'Enter your email';
        }
    }

    roleOptions.forEach(option => {
        option.addEventListener('click', () => {
            roleOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            updateLoginFields(option.dataset.role);
        });
    });

    if (anonCheckbox) {
        anonCheckbox.addEventListener('change', () => {
            const selectedRole = document.querySelector('.role-option.active')?.dataset.role || 'user';
            updateLoginFields(selectedRole);
        });
    }

    updateLoginFields(document.querySelector('.role-option.active')?.dataset.role || 'user');

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const roleElement = document.querySelector('.role-option.active');
            const role = roleElement ? roleElement.getAttribute('data-role') : 'user';
            const identifier = identifierInput?.value?.trim() || '';
            const password = document.getElementById('password')?.value || '';

            if (!identifier || !password) {
                alert('Please fill in all required fields.');
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role, identifier, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Login successful! Welcome back to HearMe.');

                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userRole', data.user.role);
                    localStorage.setItem('userIdentifier', data.user.identifier);

                    window.location.href = '../user-profiles/community-feeds.html';
                } else {
                    alert(`Login failed: ${data.message}`);
                }
            } catch (error) {
                console.error('Error connecting to server:', error);
                alert('Could not connect to the server.');
            }
        });
    }
});
