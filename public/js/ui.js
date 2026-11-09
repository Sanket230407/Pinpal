// Small display helpers shared by several pages.
// Text always goes in through textContent, so a name like "<script>" shows as text and never runs.
import { AVATAR_COLORS } from './constants.js';

export function el(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

// "Asha Rao" becomes "AR", and "Asha" becomes "A".
export function getInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function createAvatar(user, sizeClass = '') {
  const avatar = el('div', `avatar ${sizeClass}`.trim(), getInitials(user.name));
  avatar.style.background = user.avatarColor;
  // The person's name is always written beside their avatar, so this would only repeat it.
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

// Shared interests are marked in words as well as color, so color isn't the only signal.
export function createInterestChips(interests, sharedInterests = []) {
  const list = el('ul', 'chip-list');
  for (const interest of interests) {
    const isShared = sharedInterests.includes(interest);
    const chip = el('li', isShared ? 'chip chip-shared' : 'chip', interest);
    if (isShared) {
      chip.append(el('span', 'visually-hidden', ' (you share this)'));
    }
    list.append(chip);
  }
  return list;
}

export function timeAgo(isoTime) {
  const minutes = Math.floor((Date.now() - new Date(isoTime).getTime()) / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

// Fills a container with a loading, empty or error message. `action` is an optional link or button.
export function showState(container, type, message, action = null) {
  const state = el('div', `state state-${type}`);
  state.setAttribute('role', type === 'error' ? 'alert' : 'status');
  if (type === 'loading') {
    state.append(el('span', 'spinner'));
  }
  state.append(el('p', '', message));
  if (action) {
    state.append(action);
  }
  container.replaceChildren(state);
}

export function createLinkButton(text, href, styleClass = 'button-secondary') {
  const link = el('a', `button ${styleClass}`, text);
  link.href = href;
  return link;
}

// ---------- Form helpers ----------

export function clearFormErrors(form) {
  for (const message of form.querySelectorAll('.field-error, .form-error')) {
    message.textContent = '';
    message.hidden = true;
  }
  for (const input of form.querySelectorAll('[aria-invalid]')) {
    input.removeAttribute('aria-invalid');
  }
}

// Shows the message under its field, or at the top of the form if it isn't about one field.
export function showFormError(form, err) {
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

// Adds one radio button for each avatar color. Used by the signup and profile forms.
export function createColorOptions(container, preview, selectedValue) {
  for (const color of AVATAR_COLORS) {
    const label = el('label', 'color-option');
    label.style.setProperty('--swatch', color.value);

    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'avatarColor';
    radio.value = color.value;
    radio.checked = color.value === selectedValue;
    radio.setAttribute('aria-label', color.name);
    radio.addEventListener('change', () => {
      preview.style.background = color.value;
    });

    label.append(radio);
    container.append(label);
  }
  preview.style.background = selectedValue;
}
