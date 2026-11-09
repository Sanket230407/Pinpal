// Temporary script for the placeholder Nearby page. Phase 3 replaces it.
import { api } from './api.js';

const statusText = document.querySelector('#status');
const pageError = document.querySelector('#page-error');
const logoutButton = document.querySelector('#logout-button');

function showPageError(message) {
  pageError.textContent = message;
  pageError.hidden = false;
}

async function showCurrentUser() {
  try {
    const { user } = await api('/auth/me');
    statusText.textContent = `Signed in as ${user.name} (@${user.username}).`;
  } catch (err) {
    statusText.textContent = '';
    showPageError(err.message);
  }
}

logoutButton.addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (err) {
    showPageError(err.message);
  }
});

showCurrentUser();
