// signup.js

document.addEventListener('DOMContentLoaded', () => {
    const roleOptions = document.querySelectorAll('.role-option');
    const anonToggleContainer = document.getElementById('anon-section');
    const anonCheckbox = document.getElementById('anonymous');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const usernameField = usernameInput?.closest('.input-field');
    const emailField = emailInput?.closest('.input-field');

    function updateSignupFields(selectedRole) {
        const isStaff = selectedRole === 'admin' || selectedRole === 'therapist';
        const isAnonymous = anonCheckbox?.checked ?? false;

        if (anonToggleContainer) {
            anonToggleContainer.style.display = isStaff ? 'none' : 'block';
        }
        if (isStaff && anonCheckbox) {
            anonCheckbox.checked = false;
        }

        if (usernameField) {
            usernameField.style.display = !isStaff && isAnonymous ? 'block' : 'none';
        }
        if (emailField) {
            emailField.style.display = isStaff || !isAnonymous ? 'block' : 'none';
        }

        if (usernameInput) {
            usernameInput.required = !isStaff && isAnonymous;
        }
        if (emailInput) {
            emailInput.required = isStaff || !isAnonymous;
        }
    }

    roleOptions.forEach(option => {
        option.addEventListener('click', () => {
            roleOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            updateSignupFields(option.dataset.role);
        });
    });

    if (anonCheckbox) {
        anonCheckbox.addEventListener('change', () => {
            const selectedRole = document.querySelector('.role-option.active')?.dataset.role || 'user';
            updateSignupFields(selectedRole);
        });
    }

    updateSignupFields(document.querySelector('.role-option.active')?.dataset.role || 'user');

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const roleElement = document.querySelector('.role-option.active');
            const role = roleElement ? roleElement.getAttribute('data-role') : 'user';
            const isStaff = role === 'admin' || role === 'therapist';
            const isAnonymous = !isStaff && (anonCheckbox?.checked ?? false);

            let identifier = '';
            if (isStaff || !isAnonymous) {
                identifier = emailInput?.value?.trim() || '';
            } else {
                identifier = usernameInput?.value?.trim() || '';
            }

            const password = document.getElementById('password')?.value || '';

            if (!identifier || !password) {
                alert('Please fill in all required fields.');
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role, isAnonymous, identifier, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Signup successful! Redirecting to login...');
                    window.location.href = 'login.html';
                } else {
                    alert(`Error: ${data.message}`);
                }
            } catch (error) {
                console.error('Error connecting to server:', error);
                alert('Could not connect to the server.');
            }
        });
    }
});
