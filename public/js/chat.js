// The Chat page: your connections on the left and one conversation on the right.
import { io } from '/socket.io/socket.io.esm.min.js';
import { api } from './api.js';
import { initNav } from './nav.js';
import { createAvatar, createLinkButton, el, showState } from './ui.js';

const layout = document.querySelector('#chat-layout');
const chatList = document.querySelector('#chat-list');
const chatHeader = document.querySelector('#chat-header');
const chatPartner = document.querySelector('#chat-partner');
const messagesBox = document.querySelector('#chat-messages');
const chatForm = document.querySelector('#chat-form');
const messageInput = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const sendError = document.querySelector('#send-error');
const connectionNotice = document.querySelector('#connection-notice');

const partnerId = new URLSearchParams(window.location.search).get('with');

let myId = null;
// A sender gets each message twice, from the API and the socket. This stops it showing twice.
const shownMessageIds = new Set();

function formatTime(isoTime) {
  const time = new Date(isoTime);
  const isToday = time.toDateString() === new Date().toDateString();
  const options = isToday
    ? { hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
  return time.toLocaleString([], options);
}

function isNearBottom() {
  const distanceFromBottom = messagesBox.scrollHeight - messagesBox.scrollTop - messagesBox.clientHeight;
  return distanceFromBottom < 120;
}

function scrollToBottom() {
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// textContent keeps messages as plain text, so HTML someone sends can't run.
function addMessage(message) {
  if (shownMessageIds.has(message.id)) {
    return;
  }
  // The first message replaces the "say hello" text.
  if (shownMessageIds.size === 0) {
    messagesBox.replaceChildren();
  }
  shownMessageIds.add(message.id);

  // Doesn't pull someone back down if they've scrolled up to read older messages.
  const shouldScroll = message.fromId === myId || isNearBottom();

  const isMine = message.fromId === myId;
  const bubble = el('div', isMine ? 'message message-mine' : 'message');
  bubble.append(el('p', 'message-text', message.text), el('p', 'message-time', formatTime(message.createdAt)));
  messagesBox.append(bubble);

  if (shouldScroll) {
    scrollToBottom();
  }
}

function createListItem(connection) {
  const { user } = connection;
  const link = el('a', 'chat-list-item');
  link.href = `/chat.html?with=${encodeURIComponent(user.id)}`;
  link.dataset.userId = user.id;
  if (user.id === partnerId) {
    link.setAttribute('aria-current', 'page');
  }

  const text = el('div', 'list-row-text');
  text.append(el('p', 'person-name', user.name), el('p', 'person-username', `@${user.username}`));

  const unread = el('span', 'unread-dot');
  unread.hidden = true;
  unread.append(el('span', 'visually-hidden', 'New message'));

  link.append(createAvatar(user), text, unread);
  return link;
}

async function loadChatList() {
  showState(chatList, 'loading', 'Loading…');
  try {
    const { connections } = await api('/connections');
    if (connections.length === 0) {
      showState(chatList, 'empty', 'Connect with someone to start chatting.', createLinkButton('Go to Nearby', '/nearby.html'));
    } else {
      chatList.replaceChildren(...connections.map(createListItem));
    }
  } catch (err) {
    showState(chatList, 'error', err.message);
  }
}

async function loadConversation() {
  shownMessageIds.clear();
  showState(messagesBox, 'loading', 'Loading messages…');

  try {
    const { user, messages } = await api(`/messages/${encodeURIComponent(partnerId)}`);

    const profileLink = el('a', 'person-name', user.name);
    profileLink.href = `/user.html?id=${encodeURIComponent(user.id)}`;
    chatPartner.replaceChildren(createAvatar(user), profileLink);
    chatHeader.hidden = false;
    chatForm.hidden = false;

    if (messages.length === 0) {
      showState(messagesBox, 'empty', `No messages yet. Say hello to ${user.name}.`);
    } else {
      messagesBox.replaceChildren();
      messages.forEach(addMessage);
      scrollToBottom();
    }
  } catch (err) {
    chatForm.hidden = true;
    showState(messagesBox, 'error', err.message, createLinkButton('Back to chats', '/chat.html'));
  }
}

function isInOpenConversation(message) {
  return partnerId && (message.fromId === partnerId || message.toId === partnerId);
}

function showUnreadDot(userId) {
  const dot = chatList.querySelector(`[data-user-id="${CSS.escape(userId)}"] .unread-dot`);
  if (dot) {
    dot.hidden = false;
  }
}

function connectSocket() {
  const socket = io();
  let hasConnectedBefore = false;

  socket.on('message:new', (message) => {
    if (isInOpenConversation(message)) {
      addMessage(message);
    } else if (message.fromId !== myId) {
      showUnreadDot(message.fromId);
    }
  });

  socket.on('connect', () => {
    connectionNotice.hidden = true;
    // Messages sent while disconnected weren't delivered, so history is loaded again.
    if (hasConnectedBefore && partnerId) {
      loadConversation();
    }
    hasConnectedBefore = true;
  });

  socket.on('disconnect', () => {
    connectionNotice.hidden = false;
  });
  socket.on('connect_error', () => {
    connectionNotice.hidden = false;
  });
}

async function sendMessage(event) {
  event.preventDefault();
  sendError.hidden = true;

  const text = messageInput.value.trim();
  if (text.length === 0) {
    return;
  }

  sendButton.disabled = true;
  try {
    const { message } = await api(`/messages/${encodeURIComponent(partnerId)}`, {
      method: 'POST',
      body: { text },
    });
    addMessage(message);
    messageInput.value = '';
  } catch (err) {
    // The text stays in the box, so it isn't lost and can be sent again.
    sendError.textContent = err.message;
    sendError.hidden = false;
  } finally {
    sendButton.disabled = false;
    messageInput.focus();
  }
}

async function start() {
  initNav('chat');
  layout.classList.toggle('has-conversation', Boolean(partnerId));

  if (!partnerId) {
    showState(messagesBox, 'empty', 'Choose a connection to read your messages.');
  }

  try {
    const { user } = await api('/auth/me');
    myId = user.id;
  } catch (err) {
    showState(messagesBox, 'error', err.message);
    return;
  }

  chatForm.addEventListener('submit', sendMessage);
  await loadChatList();
  if (partnerId) {
    await loadConversation();
  }
  connectSocket();
}

start();
