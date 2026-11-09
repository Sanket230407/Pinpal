// Runs on the landing, signup and login pages.
import { api } from './api.js';
import { AVATAR_COLORS } from './constants.js';
import { getInitials } from './ui.js';

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

function clearErrors(form) {
  for (const message of form.querySelectorAll('.field-error, .form-error')) {
    message.textContent = '';
    message.hidden = true;
  }
  for (const input of form.querySelectorAll('[aria-invalid]')) {
    input.removeAttribute('aria-invalid');
  }
}

// Shows the message under its field, or at the top of the form if it isn't about one field.
function showError(form, err) {
  const fieldError = err.field ? form.querySelector(`#${err.field}-error`) : null;
  const message = fieldError || form.querySelector('#form-error');
  message.textContent = err.message;
  message.hidden = false;

  const input = err.field ? form.querySelector(`#${err.field}`) : null;
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
}

// Handles everything the two forms have in common: sending, the busy button, and errors.
function setUpForm(form, path) {
  const submitButton = form.querySelector('button[type="submit"]');
  const buttonLabel = submitButton.textContent;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    submitButton.disabled = true;
    submitButton.textContent = 'Please wait…';

    try {
      const body = Object.fromEntries(new FormData(form));
      await api(path, { method: 'POST', body, redirectOn401: false });
      goToApp();
    } catch (err) {
      showError(form, err);
      submitButton.disabled = false;
      submitButton.textContent = buttonLabel;
    }
  });
}

function setUpAvatarPicker() {
  const options = document.querySelector('#color-options');
  const preview = document.querySelector('#avatar-preview');
  const nameInput = document.querySelector('#name');

  AVATAR_COLORS.forEach((color, index) => {
    const label = document.createElement('label');
    label.className = 'color-option';
    label.style.setProperty('--swatch', color.value);

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'avatarColor';
    radio.value = color.value;
    radio.checked = index === 0;
    radio.setAttribute('aria-label', color.name);
    radio.addEventListener('change', () => {
      preview.style.background = color.value;
    });

    label.append(radio);
    options.append(label);
  });

  preview.style.background = AVATAR_COLORS[0].value;
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
