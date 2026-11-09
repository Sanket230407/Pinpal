// The logged-in user's own profile: editing, Ghost Mode and the blocked list.
import { api } from './api.js';
import { INTERESTS } from './constants.js';
import { initNav } from './nav.js';
import { clearFormErrors, createAvatar, createColorOptions, el, getInitials, showFormError, showState } from './ui.js';

const MAX_BIO_LENGTH = 160;
const MAX_INTERESTS = 5;

const pageState = document.querySelector('#page-state');
const content = document.querySelector('#profile-content');
const form = document.querySelector('#profile-form');
const nameInput = document.querySelector('#name');
const bioInput = document.querySelector('#bio');
const bioCount = document.querySelector('#bio-count');
const interestOptions = document.querySelector('#interest-options');
const interestCount = document.querySelector('#interest-count');
const preview = document.querySelector('#avatar-preview');
const saveButton = document.querySelector('#save-button');
const formSuccess = document.querySelector('#form-success');
const ghostToggle = document.querySelector('#ghost-toggle');
const ghostError = document.querySelector('#ghost-error');
const blockedList = document.querySelector('#blocked-list');
const blockedError = document.querySelector('#blocked-error');

function showSummary(user) {
  preview.textContent = getInitials(user.name);
  preview.style.background = user.avatarColor;
  document.querySelector('#summary-name').textContent = user.name;
  document.querySelector('#summary-username').textContent = `@${user.username}`;
  document.querySelector('#summary-email').textContent = `${user.email} (only you can see this)`;
  document.querySelector('#public-link').href = `/user.html?id=${encodeURIComponent(user.id)}`;
}

function updateBioCount() {
  bioCount.textContent = `${bioInput.value.length} of ${MAX_BIO_LENGTH} characters`;
}

// Once 5 are chosen, the others are disabled. The server checks this limit too.
function updateInterestLimit() {
  const boxes = [...interestOptions.querySelectorAll('input')];
  const chosen = boxes.filter((box) => box.checked).length;
  interestCount.textContent = `${chosen} of ${MAX_INTERESTS} chosen`;
  for (const box of boxes) {
    box.disabled = !box.checked && chosen >= MAX_INTERESTS;
  }
}

function createInterestOptions(selected) {
  for (const interest of INTERESTS) {
    const label = el('label', 'interest-option');
    const box = el('input');
    box.type = 'checkbox';
    box.name = 'interests';
    box.value = interest;
    box.checked = selected.includes(interest);
    box.addEventListener('change', updateInterestLimit);
    label.append(box, el('span', '', interest));
    interestOptions.append(label);
  }
  updateInterestLimit();
}

async function saveProfile(event) {
  event.preventDefault();
  clearFormErrors(form);
  formSuccess.hidden = true;
  saveButton.disabled = true;

  const formData = new FormData(form);
  const body = {
    name: formData.get('name'),
    bio: formData.get('bio'),
    interests: formData.getAll('interests'),
    avatarColor: formData.get('avatarColor'),
  };

  try {
    const { user } = await api('/users/me', { method: 'PUT', body });
    showSummary(user);
    nameInput.value = user.name;
    bioInput.value = user.bio;
    updateBioCount();
    formSuccess.textContent = 'Changes saved.';
    formSuccess.hidden = false;
  } catch (err) {
    showFormError(form, err);
  } finally {
    saveButton.disabled = false;
  }
}

async function changeGhostMode() {
  ghostError.hidden = true;
  ghostToggle.disabled = true;
  try {
    await api('/users/me/ghost', { method: 'PUT', body: { ghostMode: ghostToggle.checked } });
  } catch (err) {
    // The switch goes back, so it never shows a setting that wasn't saved.
    ghostToggle.checked = !ghostToggle.checked;
    ghostError.textContent = err.message;
    ghostError.hidden = false;
  } finally {
    ghostToggle.disabled = false;
  }
}

function createBlockedRow(user) {
  const row = el('div', 'list-row');

  const name = el('div', 'list-row-text');
  name.append(el('p', 'person-name', user.name), el('p', 'person-username', `@${user.username}`));

  const unblock = el('button', 'button button-secondary button-small', 'Unblock');
  unblock.type = 'button';
  unblock.addEventListener('click', async () => {
    blockedError.hidden = true;
    unblock.disabled = true;
    try {
      await api(`/blocks/${user.id}`, { method: 'DELETE' });
      await loadBlocked();
    } catch (err) {
      unblock.disabled = false;
      blockedError.textContent = err.message;
      blockedError.hidden = false;
    }
  });

  row.append(createAvatar(user), name, unblock);
  return row;
}

async function loadBlocked() {
  try {
    const { blocked } = await api('/blocks');
    if (blocked.length === 0) {
      showState(blockedList, 'empty', "You haven't blocked anyone.");
    } else {
      blockedList.replaceChildren(...blocked.map((item) => createBlockedRow(item.user)));
    }
  } catch (err) {
    showState(blockedList, 'error', err.message);
  }
}

async function start() {
  initNav('profile');
  showState(pageState, 'loading', 'Loading your profile…');

  let user;
  try {
    ({ user } = await api('/auth/me'));
  } catch (err) {
    showState(pageState, 'error', err.message);
    return;
  }

  pageState.replaceChildren();
  content.hidden = false;

  showSummary(user);
  nameInput.value = user.name;
  bioInput.value = user.bio;
  updateBioCount();
  ghostToggle.checked = user.ghostMode;
  createInterestOptions(user.interests);
  createColorOptions(document.querySelector('#color-options'), preview, user.avatarColor);

  nameInput.addEventListener('input', () => {
    preview.textContent = getInitials(nameInput.value);
  });
  bioInput.addEventListener('input', updateBioCount);
  form.addEventListener('submit', saveProfile);
  ghostToggle.addEventListener('change', changeGhostMode);

  await loadBlocked();
}

start();
