// Another person's public profile, with Connect, Message and Block.
import { api } from './api.js';
import { createConnectionControl } from './connectionControl.js';
import { initNav } from './nav.js';
import { createAvatar, createInterestChips, createLinkButton, el, showState, timeAgo } from './ui.js';

const container = document.querySelector('#profile');
const actionError = document.querySelector('#action-error');
const userId = new URLSearchParams(window.location.search).get('id');

function showActionError(message) {
  actionError.textContent = message;
  actionError.hidden = false;
}

function createBlockButton(user, blockedByMe) {
  const button = el(
    'button',
    'button button-quiet button-danger',
    blockedByMe ? 'Unblock' : 'Block'
  );
  button.type = 'button';

  button.addEventListener('click', async () => {
    actionError.hidden = true;
    if (!blockedByMe) {
      const confirmed = window.confirm(
        `Block ${user.name}? You won't see each other in Nearby, and any connection between you will end.`
      );
      if (!confirmed) {
        return;
      }
    }

    button.disabled = true;
    try {
      await api(`/blocks/${user.id}`, { method: blockedByMe ? 'DELETE' : 'POST' });
      await loadProfile();
    } catch (err) {
      button.disabled = false;
      showActionError(err.message);
    }
  });
  return button;
}

function createActions({ user, isSelf, connection, blockedByMe }) {
  const actions = el('div', 'profile-actions');

  if (isSelf) {
    actions.append(createLinkButton('Edit your profile', '/profile.html'));
    return actions;
  }

  if (!blockedByMe) {
    actions.append(
      createConnectionControl(user.id, connection, {
        onChange: () => {},
        onError: showActionError,
      })
    );
  }
  if (connection.status === 'connected') {
    actions.append(
      createLinkButton('Message', `/chat.html?with=${encodeURIComponent(user.id)}`, 'button-primary button-small')
    );
  }
  actions.append(createBlockButton(user, blockedByMe));
  return actions;
}

function renderProfile(data) {
  const { user, blockedByMe } = data;
  document.title = `${user.name} on PinPal`;

  const card = el('section', 'card section-card public-profile');
  const heading = el('h1', 'profile-name', user.name);
  card.append(createAvatar(user, 'avatar-large'), heading, el('p', 'person-username', `@${user.username}`));

  if (user.lastActive) {
    card.append(el('p', 'person-username', `Active ${timeAgo(user.lastActive)}`));
  }
  if (blockedByMe) {
    card.append(el('p', 'notice', "You blocked this person. They can't see your profile."));
  }

  card.append(el('p', 'profile-bio', user.bio || "This person hasn't written a bio yet."));

  if (user.interests.length > 0) {
    card.append(createInterestChips(user.interests));
  }

  card.append(createActions(data));
  container.replaceChildren(card);
}

async function loadProfile() {
  try {
    renderProfile(await api(`/users/${encodeURIComponent(userId)}`));
  } catch (err) {
    showState(container, 'error', err.message, createLinkButton('Back to Nearby', '/nearby.html'));
  }
}

function start() {
  initNav('');
  if (!userId) {
    showState(container, 'error', 'This link is missing a profile.', createLinkButton('Back to Nearby', '/nearby.html'));
    return;
  }
  showState(container, 'loading', 'Loading profile…');
  loadProfile();
}

start();
