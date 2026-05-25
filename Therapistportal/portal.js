const API_BASE = 'http://localhost:5000/api';
let inboxData = { conversations: [], unreadTotal: 0 };
let activeClientId = null;
let markingRead = false;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function clientLabel(identifier) {
    if (!identifier) return 'Client';
    if (identifier.includes('@')) {
        return identifier.split('@')[0];
    }
    return identifier;
}

function clientInitials(identifier) {
    const label = clientLabel(identifier);
    return label
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .trim()
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'CL';
}

function getClientId(conversation) {
    const id = conversation?.clientId ?? conversation?.senderId;
    return id ? id.toString() : null;
}

function getConversation(clientId) {
    return inboxData.conversations.find(
        (entry) => getClientId(entry) === clientId.toString()
    );
}

function updateUnreadBadge() {
    const unreadCount = document.getElementById('unread-messages-count');
    if (unreadCount) {
        unreadCount.textContent = String(inboxData.unreadTotal || 0);
    }
}

async function loadInbox(token) {
    const response = await fetch(`${API_BASE}/messages/inbox`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Could not load inbox.');
    }

    inboxData = data;
    renderInboxList();

    if (inboxData.conversations.length) {
        const keepActive =
            activeClientId &&
            inboxData.conversations.some((c) => getClientId(c) === activeClientId);
        const clientId = keepActive
            ? activeClientId
            : getClientId(inboxData.conversations[0]);
        showConversation(clientId, false);
    } else {
        showConversation(null, false);
    }
}

function renderInboxList() {
    const inboxList = document.getElementById('inbox-list');

    updateUnreadBadge();

    if (!inboxList) return;

    if (!inboxData.conversations.length) {
        inboxList.innerHTML = '<p class="inbox-empty" id="inbox-empty">No client messages yet.</p>';
        return;
    }

    inboxList.innerHTML = inboxData.conversations
        .filter((conversation) => getClientId(conversation) && conversation.lastMessage?.content)
        .map((conversation) => {
            const clientId = getClientId(conversation);
            const preview = conversation.lastMessage.content.slice(0, 60);
            const isActive = activeClientId === clientId;
            const badge =
                conversation.unreadCount > 0
                    ? `<div class="unread-badge">${conversation.unreadCount}</div>`
                    : '';

            return `
                <div class="inbox-item ${isActive ? 'active' : ''}" data-client-id="${clientId}">
                    <div class="c-avatar blue sm">${escapeHtml(clientInitials(conversation.senderIdentifier))}</div>
                    <div class="inbox-details">
                        <div class="flex-bw">
                            <strong>${escapeHtml(clientLabel(conversation.senderIdentifier))}</strong>
                            <span class="time">${formatTime(conversation.lastMessage.createdAt)}</span>
                        </div>
                        <p>${escapeHtml(preview)}${conversation.lastMessage.content.length > 60 ? '...' : ''}</p>
                    </div>
                    ${badge}
                </div>
            `;
        })
        .join('');

    document.querySelectorAll('.inbox-item').forEach((item) => {
        item.addEventListener('click', () => {
            showConversation(item.getAttribute('data-client-id'), true);
        });
    });
}

function renderChatMessages(conversation) {
    const chatHistory = document.getElementById('chat-history');
    if (!chatHistory) return;

    chatHistory.innerHTML = conversation.messages
        .map((msg) => {
            const text = msg.content || msg.message || '';
            const isOutgoing = msg.senderRole === 'therapist';
            const timestamp = msg.createdAt || msg.sent_at;
            return `
                <div class="bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
                    <p>${escapeHtml(text)}</p>
                    <span class="time">${formatTime(timestamp)}</span>
                </div>
            `;
        })
        .join('');

    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showConversation(clientId, markRead) {
    const chatHistory = document.getElementById('chat-history');
    const chatClientName = document.getElementById('chat-client-name');
    const chatClientMeta = document.getElementById('chat-client-meta');
    const chatAvatar = document.getElementById('chat-avatar');
    const replyInput = document.getElementById('therapist-reply-input');

    if (!clientId) {
        activeClientId = null;
        if (chatClientName) chatClientName.textContent = 'Select a conversation';
        if (chatClientMeta) chatClientMeta.textContent = 'Client messages appear here';
        if (chatAvatar) chatAvatar.textContent = '--';
        if (chatHistory) {
            chatHistory.innerHTML =
                '<p class="inbox-empty" id="chat-empty">Select a client from the left to read their messages.</p>';
        }
        if (replyInput) replyInput.disabled = true;
        return;
    }

    const conversation = getConversation(clientId);
    if (!conversation) return;

    activeClientId = clientId;

    document.querySelectorAll('.inbox-item').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-client-id') === clientId);
    });

    if (chatClientName) {
        chatClientName.textContent = clientLabel(conversation.senderIdentifier);
    }
    if (chatClientMeta) {
        chatClientMeta.textContent = conversation.senderIdentifier;
    }
    if (chatAvatar) {
        chatAvatar.textContent = clientInitials(conversation.senderIdentifier);
    }
    if (replyInput) {
        replyInput.disabled = false;
        replyInput.value = '';
    }

    renderChatMessages(conversation);

    if (markRead) {
        markConversationRead(clientId);
    }
}

async function markConversationRead(clientId) {
    if (markingRead) return;

    const conversation = getConversation(clientId);
    if (!conversation || conversation.unreadCount === 0) return;

    const token = authStorage.get('token');
    if (!token) return;

    markingRead = true;

    try {
        const response = await fetch(`${API_BASE}/messages/read`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ senderId: clientId })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Could not mark messages as read.');
        }

        conversation.unreadCount = 0;
        conversation.messages.forEach((msg) => {
            if (msg.senderRole !== 'therapist') {
                msg.read = true;
            }
        });
        inboxData.unreadTotal = inboxData.conversations.reduce(
            (total, entry) => total + entry.unreadCount,
            0
        );
        renderInboxList();
    } catch (error) {
        console.error('Could not mark messages as read:', error);
    } finally {
        markingRead = false;
    }
}

async function sendTherapistReply() {
    const token = authStorage.get('token');
    const userRole = authStorage.get('userRole');
    const replyInput = document.getElementById('therapist-reply-input');
    const sendBtn = document.getElementById('therapist-reply-send');

    if (!token || !replyInput) return;

    if (userRole !== 'therapist') {
        alert('You are signed in as a user. Please sign in again with the Therapist role to reply here.');
        window.location.href = '../landing-page/login.html';
        return;
    }

    if (!activeClientId) {
        alert('Select a client conversation on the left before sending.');
        return;
    }

    const content = replyInput.value.trim();
    if (!content) {
        replyInput.focus();
        return;
    }

    if (sendBtn) sendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                clientId: String(activeClientId),
                content
            })
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(
                'Server returned an invalid response. Restart npm start, then try again.'
            );
        }

        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                authStorage.clear();
                alert(data.message || 'Session expired. Please sign in again.');
                window.location.href = '../landing-page/login.html';
                return;
            }
            alert(data.message || 'Could not send reply.');
            return;
        }

        const conversation = getConversation(activeClientId);
        if (conversation) {
            conversation.messages.push(data.data);
            conversation.lastMessage = data.data;
            renderChatMessages(conversation);
            renderInboxList();
        } else {
            await loadInbox(token);
        }

        replyInput.value = '';
    } catch (error) {
        console.error(error);
        alert('Could not connect to the server.');
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const token = authStorage.get('token');
    const userRole = authStorage.get('userRole');

    if (!token || userRole !== 'therapist') {
        alert('Please sign in with the Therapist role to open this portal.');
        window.location.href = '../landing-page/login.html';
        return;
    }

    const identifier = authStorage.get('userIdentifier') || 'Therapist';
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

    const replyInput = document.getElementById('therapist-reply-input');
    const replySend = document.getElementById('therapist-reply-send');

    if (replyInput) {
        replyInput.disabled = true;
        replyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendTherapistReply();
            }
        });
    }

    if (replySend) {
        replySend.addEventListener('click', sendTherapistReply);
    }

    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-panel');

    navItems.forEach((item) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            navItems.forEach((nav) => nav.classList.remove('active'));
            item.classList.add('active');

            const targetViewId = `view-${item.getAttribute('data-target')}`;

            views.forEach((view) => {
                view.classList.remove('active');
                if (view.id === targetViewId) {
                    view.classList.add('active');
                }
            });

            if (item.getAttribute('data-target') === 'messages') {
                loadInbox(token).catch((error) => {
                    console.error(error);
                    alert('Could not load messages. Is the server running?');
                });
            }
        });
    });

    const clientTabs = document.querySelectorAll('.tabs button');
    clientTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            clientTabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    const catBtns = document.querySelectorAll('.cat-btn');
    catBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            catBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    loadInbox(token).catch((error) => console.error('Inbox preload failed:', error));
});
