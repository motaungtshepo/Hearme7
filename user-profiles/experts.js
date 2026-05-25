const API_BASE = 'http://localhost:5000/api';
const AVATAR_CLASSES = ['avatar-pink', 'avatar-purple'];

let selectedTherapistId = null;

lucide.createIcons();

function getToken() {
    return localStorage.getItem('token');
}

function requireUserLogin() {
    const token = getToken();
    const role = localStorage.getItem('userRole');

    if (!token || role !== 'user') {
        alert('Please sign in as a User to contact therapists.');
        window.location.href = '../landing-page/login.html';
        return null;
    }

    return token;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderTherapistCard(therapist, index) {
    const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
    const badges = therapist.specialties
        .map((specialty) => `<span class="badge">${escapeHtml(specialty)}</span>`)
        .join('');

    return `
        <div class="expert-card" data-therapist-id="${therapist.id}">
            <div class="expert-avatar ${avatarClass}">${escapeHtml(therapist.initials)}</div>
            <div class="expert-details">
                <div class="expert-header">
                    <div class="expert-title">
                        <h3>${escapeHtml(therapist.name)}</h3>
                        <i data-lucide="check-circle-2" class="verified-icon"></i>
                    </div>
                    <div class="expert-location-status">
                        <span class="status-badge available">Available Now</span>
                    </div>
                </div>

                <div class="expert-stats">
                    <span class="rating"><i data-lucide="star" class="star-icon"></i> HearMe Verified</span>
                </div>

                <div class="specialty-badges">${badges}</div>

                <p class="expert-bio">${escapeHtml(therapist.bio)}</p>

                <div class="expert-actions">
                    <button type="button" class="btn btn-primary contact-btn">
                        <i data-lucide="message-circle"></i> Contact
                    </button>
                    <button type="button" class="btn btn-outline schedule-btn">
                        <i data-lucide="calendar"></i> Schedule
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function loadTherapists() {
    const list = document.getElementById('experts-list');
    const status = document.getElementById('experts-status');

    if (!list) return;

    try {
        const response = await fetch(`${API_BASE}/therapists`);
        const contentType = response.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
            throw new Error(
                'Server returned an invalid response. Stop npm start (Ctrl+C), run npm start again, then refresh this page.'
            );
        }

        const therapists = await response.json();

        if (!response.ok) {
            throw new Error(therapists.message || 'Could not load therapists.');
        }

        if (!therapists.length) {
            list.innerHTML =
                '<p class="experts-status">No registered therapists yet. Ask your therapist to sign up with the Therapist role.</p>';
            return;
        }

        list.innerHTML = therapists.map(renderTherapistCard).join('');
        lucide.createIcons();
        bindExpertActions();
    } catch (error) {
        console.error(error);
        if (status) {
            status.textContent = 'Could not load therapists. Make sure the server is running.';
        }
    }
}

function openModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}

function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector('.contact-modal:not([hidden])')) {
        document.body.style.overflow = '';
    }
}

function wireModal(modal, closeIds) {
    if (!modal) return;

    closeIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => closeModal(modal));
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('contact-modal-backdrop')) {
            closeModal(modal);
        }
    });
}

function bindExpertActions() {
    const contactModal = document.getElementById('contact-modal');
    const scheduleModal = document.getElementById('schedule-modal');
    const contactTitle = document.getElementById('contact-modal-title');
    const contactSubtitle = document.getElementById('contact-modal-subtitle');
    const contactMessage = document.getElementById('contact-message');
    const scheduleTitle = document.getElementById('schedule-modal-title');
    const scheduleSubtitle = document.getElementById('schedule-modal-subtitle');

    document.querySelectorAll('.contact-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const token = requireUserLogin();
            if (!token) return;

            const card = btn.closest('.expert-card');
            selectedTherapistId = card?.dataset.therapistId || null;
            const expertName = card?.querySelector('.expert-title h3')?.textContent?.trim() || 'this expert';

            if (!selectedTherapistId) return;

            if (contactTitle) contactTitle.textContent = `Contact ${expertName}`;
            if (contactSubtitle) {
                contactSubtitle.textContent =
                    'Send a private message. Your therapist will see it in their portal inbox.';
            }
            if (contactMessage) contactMessage.value = '';

            openModal(contactModal);
        });
    });

    document.querySelectorAll('.schedule-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const token = requireUserLogin();
            if (!token) return;

            const card = btn.closest('.expert-card');
            const expertName = card?.querySelector('.expert-title h3')?.textContent?.trim() || 'this expert';

            if (scheduleTitle) scheduleTitle.textContent = `Schedule with ${expertName}`;
            if (scheduleSubtitle) {
                scheduleSubtitle.textContent =
                    'Pick a preferred date and time. The expert will confirm your session by email.';
            }

            openModal(scheduleModal);
        });
    });

    const contactSend = document.getElementById('contact-modal-send');
    if (contactSend) {
        contactSend.onclick = async () => {
            const token = requireUserLogin();
            if (!token) return;

            const message = contactMessage?.value?.trim();
            if (!message) {
                contactMessage?.focus();
                return;
            }

            if (!selectedTherapistId) {
                alert('Please choose a therapist again.');
                return;
            }

            contactSend.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        therapistId: selectedTherapistId,
                        content: message
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.message || 'Could not send message.');
                    return;
                }

                const expertName =
                    contactTitle?.textContent?.replace(/^Contact\s+/, '') || 'the therapist';
                closeModal(contactModal);
                alert(
                    `Your message to ${expertName} was sent. Check their reply under Messages in the sidebar.`
                );
            } catch (error) {
                console.error(error);
                alert('Could not connect to the server.');
            } finally {
                contactSend.disabled = false;
            }
        };
    }

    const scheduleConfirm = document.getElementById('schedule-modal-confirm');
    if (scheduleConfirm) {
        scheduleConfirm.onclick = () => {
            const date = document.getElementById('schedule-date')?.value;
            const time = document.getElementById('schedule-time')?.value;

            if (!date || !time) {
                alert('Please choose both a date and a time.');
                return;
            }

            const expertName =
                scheduleTitle?.textContent?.replace(/^Schedule with\s+/, '') || 'the expert';
            closeModal(scheduleModal);
            alert(`Session request sent to ${expertName} for ${date} at ${time}.`);
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tags = document.querySelectorAll('.filter-tags .tag');

    tags.forEach((tag) => {
        tag.addEventListener('click', () => {
            tags.forEach((t) => t.classList.remove('active'));
            tag.classList.add('active');
        });
    });

    const nearMeBtn = document.getElementById('near-me-btn');
    const locationErrorAlert = document.getElementById('location-error');

    if (locationErrorAlert) {
        locationErrorAlert.style.display = 'flex';
    }

    if (nearMeBtn && locationErrorAlert) {
        nearMeBtn.addEventListener('click', () => {
            const isHidden =
                locationErrorAlert.style.display === 'none' ||
                locationErrorAlert.style.display === '';
            locationErrorAlert.style.display = isHidden ? 'flex' : 'none';
        });
    }

    const contactModal = document.getElementById('contact-modal');
    const scheduleModal = document.getElementById('schedule-modal');

    wireModal(contactModal, ['contact-modal-close', 'contact-modal-cancel', 'contact-modal-backdrop']);
    wireModal(scheduleModal, ['schedule-modal-close', 'schedule-modal-cancel', 'schedule-modal-backdrop']);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (contactModal && !contactModal.hidden) closeModal(contactModal);
        if (scheduleModal && !scheduleModal.hidden) closeModal(scheduleModal);
    });

    loadTherapists();
});
