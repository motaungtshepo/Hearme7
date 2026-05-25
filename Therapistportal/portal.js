const API_BASE = 'http://localhost:5000/api';
let inboxData = { conversations: [], unreadTotal: 0 };
let activeSenderId = null;

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

async function loadInbox(token) {
    const response = await fetch(`${API_BASE}/messages/inbox`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Could not load inbox.');
    }

    inboxData = data;
    renderInbox();
}

function renderInbox() {
    const inboxList = document.getElementById('inbox-list');
    const inboxEmpty = document.getElementById('inbox-empty');
    const unreadCount = document.getElementById('unread-messages-count');

    if (unreadCount) {
        unreadCount.textContent = String(inboxData.unreadTotal || 0);
    }

    if (!inboxList) return;

    if (!inboxData.conversations.length) {
        inboxList.innerHTML = '<p class="inbox-empty" id="inbox-empty">No client messages yet.</p>';
        renderConversation(null);
        return;
    }

    inboxList.innerHTML = inboxData.conversations
        .map((conversation, index) => {
            const preview = conversation.lastMessage.content.slice(0, 60);
            const isActive =
                activeSenderId === conversation.senderId.toString() ||
                (!activeSenderId && index === 0);
            const badge =
                conversation.unreadCount > 0
                    ? `<div class="unread-badge">${conversation.unreadCount}</div>`
                    : '';

            return `
                <div class="inbox-item ${isActive ? 'active' : ''}" data-sender-id="${conversation.senderId}">
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
            const senderId = item.getAttribute('data-sender-id');
            selectConversation(senderId);
        });
    });

    const firstSenderId = inboxData.conversations[0].senderId.toString();
    selectConversation(activeSenderId || firstSenderId);
}

function renderConversation(senderId) {
    const chatHistory = document.getElementById('chat-history');
    const chatClientName = document.getElementById('chat-client-name');
    const chatClientMeta = document.getElementById('chat-client-meta');
    const chatAvatar = document.getElementById('chat-avatar');

    const conversation = inboxData.conversations.find(
        (entry) => entry.senderId.toString() === senderId
    );

    if (!conversation) {
        if (chatClientName) chatClientName.textContent = 'Select a conversation';
        if (chatClientMeta) chatClientMeta.textContent = 'Client messages appear here';
        if (chatAvatar) chatAvatar.textContent = '--';
        if (chatHistory) {
            chatHistory.innerHTML =
                '<p class="inbox-empty" id="chat-empty">Select a client from the left to read their messages.</p>';
        }
        return;
    }

    activeSenderId = senderId;

    document.querySelectorAll('.inbox-item').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-sender-id') === senderId);
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

    if (chatHistory) {
        chatHistory.innerHTML = conversation.messages
            .map(
                (msg) => `
                <div class="bubble incoming">
                    <p>${escapeHtml(msg.content)}</p>
                    <span class="time">${formatTime(msg.createdAt)}</span>
                </div>
            `
            )
            .join('');
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    markConversationRead(senderId);
}

async function markConversationRead(senderId) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        await fetch(`${API_BASE}/messages/read`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ senderId })
        });

        const conversation = inboxData.conversations.find(
            (entry) => entry.senderId.toString() === senderId
        );
        if (conversation) {
            conversation.unreadCount = 0;
            conversation.messages.forEach((msg) => {
                msg.read = true;
            });
            inboxData.unreadTotal = inboxData.conversations.reduce(
                (total, entry) => total + entry.unreadCount,
                0
            );
            renderInbox();
            selectConversation(senderId);
        }
    } catch (error) {
        console.error('Could not mark messages as read:', error);
    }
}

function selectConversation(senderId) {
    renderConversation(senderId);
}

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
