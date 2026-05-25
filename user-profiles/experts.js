lucide.createIcons();

function getExpertName(card) {
    return card?.querySelector('.expert-title h3')?.textContent?.trim() || 'this expert';
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
    const contactTitle = document.getElementById('contact-modal-title');
    const contactSubtitle = document.getElementById('contact-modal-subtitle');
    const contactMessage = document.getElementById('contact-message');
    const scheduleTitle = document.getElementById('schedule-modal-title');
    const scheduleSubtitle = document.getElementById('schedule-modal-subtitle');

    wireModal(contactModal, ['contact-modal-close', 'contact-modal-cancel', 'contact-modal-backdrop']);
    wireModal(scheduleModal, ['schedule-modal-close', 'schedule-modal-cancel', 'schedule-modal-backdrop']);

    document.querySelectorAll('.contact-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.expert-card');
            const expertName = getExpertName(card);

            if (contactTitle) {
                contactTitle.textContent = `Contact ${expertName}`;
            }
            if (contactSubtitle) {
                contactSubtitle.textContent =
                    'Send a private message to start the conversation. They typically reply within 24 hours.';
            }
            if (contactMessage) {
                contactMessage.value = '';
            }

            openModal(contactModal);
        });
    });

    document.querySelectorAll('.schedule-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.expert-card');
            const expertName = getExpertName(card);

            if (scheduleTitle) {
                scheduleTitle.textContent = `Schedule with ${expertName}`;
            }
            if (scheduleSubtitle) {
                scheduleSubtitle.textContent =
                    'Pick a preferred date and time. The expert will confirm your session by email.';
            }

            openModal(scheduleModal);
        });
    });

    const contactSend = document.getElementById('contact-modal-send');
    if (contactSend) {
        contactSend.addEventListener('click', () => {
            const message = contactMessage?.value?.trim();
            if (!message) {
                contactMessage?.focus();
                return;
            }

            const expertName = contactTitle?.textContent?.replace(/^Contact\s+/, '') || 'the expert';
            closeModal(contactModal);
            alert(`Your message to ${expertName} was sent. They will get back to you soon.`);
        });
    }

    const scheduleConfirm = document.getElementById('schedule-modal-confirm');
    if (scheduleConfirm) {
        scheduleConfirm.addEventListener('click', () => {
            const date = document.getElementById('schedule-date')?.value;
            const time = document.getElementById('schedule-time')?.value;

            if (!date || !time) {
                alert('Please choose both a date and a time.');
                return;
            }

            const expertName = scheduleTitle?.textContent?.replace(/^Schedule with\s+/, '') || 'the expert';
            closeModal(scheduleModal);
            alert(`Session request sent to ${expertName} for ${date} at ${time}.`);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (contactModal && !contactModal.hidden) closeModal(contactModal);
        if (scheduleModal && !scheduleModal.hidden) closeModal(scheduleModal);
    });
});
