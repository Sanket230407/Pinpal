// The Connections page: My Connections, Received and Sent.
import { api } from './api.js';
import { initNav, refreshBadge } from './nav.js';
import { createAvatar, createLinkButton, el, showState } from './ui.js';

const tabContent = document.querySelector('#tab-content');
const actionError = document.querySelector('#action-error');
const tabButtons = document.querySelectorAll('[data-tab]');

const EMPTY_MESSAGES = {
  connections: 'No connections yet. Find someone on the Nearby page.',
  received: 'No requests waiting for you.',
  sent: "You don't have any requests waiting for an answer.",
};

let lists = { connections: [], received: [], sent: [] };
let currentTab = 'connections';

function createActionButton(text, styleClass, action) {
  const button = el('button', `button ${styleClass} button-small`, text);
  button.type = 'button';
  button.addEventListener('click', async () => {
    actionError.hidden = true;
    button.disabled = true;
    try {
      await action();
      await loadLists();
      refreshBadge();
    } catch (err) {
      button.disabled = false;
      actionError.textContent = err.message;
      actionError.hidden = false;
    }
  });
  return button;
}

const acceptRequest = (id) => api(`/connections/${id}/accept`, { method: 'PUT' });
const deleteConnection = (id) => api(`/connections/${id}`, { method: 'DELETE' });

function createButtons(item) {
  if (currentTab === 'received') {
    return [
      createActionButton('Accept', 'button-primary', () => acceptRequest(item.id)),
      createActionButton('Decline', 'button-secondary', () => deleteConnection(item.id)),
    ];
  }
  if (currentTab === 'sent') {
    return [createActionButton('Cancel', 'button-secondary', () => deleteConnection(item.id))];
  }

  const removeAfterConfirming = async () => {
    if (window.confirm(`Remove ${item.user.name} from your connections?`)) {
      await deleteConnection(item.id);
    }
  };
  return [
    createLinkButton('Message', `/chat.html?with=${encodeURIComponent(item.user.id)}`, 'button-primary button-small'),
    createActionButton('Remove', 'button-secondary', removeAfterConfirming),
  ];
}

function createRow(item) {
  const row = el('div', 'list-row');

  const nameLink = el('a', 'person-name', item.user.name);
  nameLink.href = `/user.html?id=${encodeURIComponent(item.user.id)}`;

  const text = el('div', 'list-row-text');
  text.append(nameLink, el('p', 'person-username', `@${item.user.username}`));

  const buttons = el('div', 'list-row-actions');
  buttons.append(...createButtons(item));

  row.append(createAvatar(item.user), text, buttons);
  return row;
}

function renderTab() {
  for (const button of tabButtons) {
    const name = button.dataset.tab;
    button.setAttribute('aria-pressed', String(name === currentTab));
    const label = { connections: 'Connections', received: 'Received', sent: 'Sent' }[name];
    button.textContent = `${label} (${lists[name].length})`;
  }

  const items = lists[currentTab];
  if (items.length === 0) {
    const action = currentTab === 'connections' ? createLinkButton('Go to Nearby', '/nearby.html') : null;
    showState(tabContent, 'empty', EMPTY_MESSAGES[currentTab], action);
  } else {
    tabContent.replaceChildren(...items.map(createRow));
  }
}

async function loadLists() {
  const [accepted, requests] = await Promise.all([api('/connections'), api('/connections/requests')]);
  lists = { connections: accepted.connections, received: requests.received, sent: requests.sent };
  renderTab();
}

async function start() {
  initNav('connections');

  // Lets other pages link straight to a tab, as the Respond button does.
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  if (requestedTab === 'received' || requestedTab === 'sent') {
    currentTab = requestedTab;
  }

  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      currentTab = button.dataset.tab;
      actionError.hidden = true;
      renderTab();
    });
  }

  showState(tabContent, 'loading', 'Loading your connections…');
  try {
    await loadLists();
  } catch (err) {
    showState(tabContent, 'error', err.message);
  }
}

start();
