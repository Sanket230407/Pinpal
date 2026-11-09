// Runs on the landing, signup and login pages.
import { api } from './api.js';
import { AVATAR_COLORS } from './constants.js';
import { clearFormErrors, createColorOptions, getInitials, showFormError } from './ui.js';

const signupForm = document.querySelector('#signup-form');
const loginForm = document.querySelector('#login-form');

function goToApp() {
  window.location.href = '/nearby.html';
}

// Someone who is already logged in has no reason to see these pages.
async function redirectIfLoggedIn() {
  try {
    const { loggedIn } = await api('/auth/session');
    if (loggedIn) {
      goToApp();
    }
  } catch {
    // The server is unreachable. The page still works, and submitting a form will show the error.
  }
}

// Handles everything the two forms have in common: sending, the busy button, and errors.
function setUpForm(form, path) {
  const submitButton = form.querySelector('button[type="submit"]');
  const buttonLabel = submitButton.textContent;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    submitButton.disabled = true;
    submitButton.textContent = 'Please wait…';

    try {
      const body = Object.fromEntries(new FormData(form));
      await api(path, { method: 'POST', body, redirectOn401: false });
      goToApp();
    } catch (err) {
      showFormError(form, err);
      submitButton.disabled = false;
      submitButton.textContent = buttonLabel;
    }
  });
}

function setUpAvatarPicker() {
  const preview = document.querySelector('#avatar-preview');
  const nameInput = document.querySelector('#name');

  createColorOptions(document.querySelector('#color-options'), preview, AVATAR_COLORS[0].value);
  nameInput.addEventListener('input', () => {
    preview.textContent = getInitials(nameInput.value);
  });
}

redirectIfLoggedIn();

if (signupForm) {
  setUpAvatarPicker();
  setUpForm(signupForm, '/auth/signup');
}

if (loginForm) {
  setUpForm(loginForm, '/auth/login');
}
