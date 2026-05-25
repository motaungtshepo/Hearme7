const API_BASE = 'http://localhost:5000/api';
let inboxData = { conversations: [], unreadTotal: 0 };
let activeTherapistId = null;
let markingRead = false;

lucide.createIcons();

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function getToken() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');

    if (!token || role !== 'user') {
        alert('Please sign in as a User to view messages.');
        window.location.href = '../landing-page/login.html';
        return null;
    }

    return token;
}

function getConversation(therapistId) {
    return inboxData.conversations.find(
        (entry) => entry.therapistId.toString() === therapistId.toString()
    );
}

function therapistInitials(name) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'TH';
}

async function loadInbox() {
    const token = getToken();
    if (!token) return;

    const response = await fetch(`${API_BASE}/messages/user-inbox`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('Server error. Restart npm start and refresh.');
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Could not load messages.');
    }

    inboxData = data;
    renderInboxList();

    if (inboxData.conversations.length) {
        const keep =
            activeTherapistId &&
            inboxData.conversations.some((c) => c.therapistId.toString() === activeTherapistId);
        showConversation(keep ? activeTherapistId : inboxData.conversations[0].therapistId.toString(), !keep);
    } else {
        showConversation(null, false);
    }
}

function renderInboxList() {
    const inboxList = document.getElementById('inbox-list');
    if (!inboxList) return;

    if (!inboxData.conversations.length) {
        inboxList.innerHTML =
            '<p class="inbox-empty">No messages yet. Contact a therapist from the <a href="experts.html">Experts</a> page.</p>';
        return;
    }

    inboxList.innerHTML = inboxData.conversations
        .map((conversation) => {
            const therapistId = conversation.therapistId.toString();
            const preview = conversation.lastMessage?.content?.slice(0, 50) || '';
            const isActive = activeTherapistId === therapistId;
            const badge =
                conversation.unreadCount > 0
                    ? `<span class="unread-badge">${conversation.unreadCount}</span>`
                    : '';

            return `
                <div class="inbox-item ${isActive ? 'active' : ''}" data-therapist-id="${therapistId}">
                    <div class="chat-avatar">${escapeHtml(therapistInitials(conversation.therapistName))}</div>
                    <div class="inbox-details">
                        <div style="display:flex;justify-content:space-between;gap:8px;">
                            <strong>${escapeHtml(conversation.therapistName)}</strong>
                            <span class="inbox-time">${formatTime(conversation.lastMessage.createdAt)}</span>
                        </div>
                        <p>${escapeHtml(preview)}${preview.length >= 50 ? '...' : ''}</p>
                    </div>
                    ${badge}
                </div>
            `;
        })
        .join('');

    document.querySelectorAll('.inbox-item').forEach((item) => {
        item.addEventListener('click', () => {
            showConversation(item.getAttribute('data-therapist-id'), true);
        });
    });

    lucide.createIcons();
}

function renderChat(conversation) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;

    chatHistory.innerHTML = conversation.messages
        .map((msg) => {
            const isOutgoing = msg.senderRole !== 'therapist';
            return `
                <div class="bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
                    <p>${escapeHtml(msg.content)}</p>
                    <span class="time">${formatTime(msg.createdAt)}</span>
                </div>
            `;
        })
        .join('');

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showConversation(therapistId, markRead) {
    const chatHistory = document.getElementById('chat-history');
    const chatName = document.getElementById('chat-therapist-name');
    const chatMeta = document.getElementById('chat-therapist-meta');
    const chatAvatar = document.getElementById('chat-avatar');
    const replyInput = document.getElementById('user-reply-input');
    const replySend = document.getElementById('user-reply-send');

    if (!therapistId) {
        activeTherapistId = null;
        if (replyInput) replyInput.disabled = true;
        if (replySend) replySend.disabled = true;
        return;
    }

    const conversation = getConversation(therapistId);
    if (!conversation) return;

    activeTherapistId = therapistId;

    document.querySelectorAll('.inbox-item').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-therapist-id') === therapistId);
    });

    if (chatName) chatName.textContent = conversation.therapistName;
    if (chatMeta) chatMeta.textContent = 'Your private conversation';
    if (chatAvatar) chatAvatar.textContent = therapistInitials(conversation.therapistName);
    if (replyInput) {
        replyInput.disabled = false;
        replyInput.value = '';
    }
    if (replySend) replySend.disabled = false;

    renderChat(conversation);

    if (markRead) {
        markConversationRead(therapistId);
    }
}

async function markConversationRead(therapistId) {
    if (markingRead) return;

    const conversation = getConversation(therapistId);
    if (!conversation || conversation.unreadCount === 0) return;

    const token = getToken();
    if (!token) return;

    markingRead = true;

    try {
        const response = await fetch(`${API_BASE}/messages/user-read`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ therapistId })
        });

        if (!response.ok) return;

        conversation.unreadCount = 0;
        conversation.messages.forEach((msg) => {
            if (msg.senderRole === 'therapist') msg.read = true;
        });
        inboxData.unreadTotal = inboxData.conversations.reduce(
            (sum, c) => sum + c.unreadCount,
            0
        );
        renderInboxList();
    } catch (error) {
        console.error('Could not mark as read:', error);
    } finally {
        markingRead = false;
    }
}

async function sendUserMessage() {
    const token = getToken();
    const replyInput = document.getElementById('user-reply-input');
    const replySend = document.getElementById('user-reply-send');

    if (!token || !activeTherapistId || !replyInput) return;

    const content = replyInput.value.trim();
    if (!content) {
        replyInput.focus();
        return;
    }

    if (replySend) replySend.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ therapistId: activeTherapistId, content })
        });

        const data = await response.json();
        if (!response.ok) {
            alert(data.message || 'Could not send message.');
            return;
        }

        const conversation = getConversation(activeTherapistId);
        if (conversation) {
            conversation.messages.push(data.data);
            conversation.lastMessage = data.data;
            renderChat(conversation);
            renderInboxList();
        } else {
            await loadInbox();
        }

        replyInput.value = '';
    } catch (error) {
        console.error(error);
        alert('Could not connect to the server.');
    } finally {
        if (replySend) replySend.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const replyInput = document.getElementById('user-reply-input');
    const replySend = document.getElementById('user-reply-send');

    if (replyInput) {
        replyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendUserMessage();
            }
        });
    }

    if (replySend) {
        replySend.addEventListener('click', sendUserMessage);
    }

    loadInbox().catch((error) => {
        console.error(error);
        const status = document.getElementById('inbox-status');
        if (status) {
            status.textContent = error.message || 'Could not load messages.';
        }
    });
});
