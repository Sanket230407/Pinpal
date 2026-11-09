// Checks and cleans request input on the server, because a client can send anything.
// Each validator replaces req.body with only the expected, cleaned fields.
import { AVATAR_COLORS } from '../../public/js/constants.js';

const MAX_NAME_LENGTH = 50;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes.

const USERNAME_PATTERN = /^[a-z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A number or object sent in place of text becomes an empty string and fails validation.
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// `field` tells the form which input to show the message under.
function rejectInput(res, field, message) {
  return res.status(400).json({ error: message, field });
}

export function validateSignup(req, res, next) {
  const body = req.body ?? {};
  const name = cleanText(body.name);
  const username = cleanText(body.username).toLowerCase();
  const email = cleanText(body.email).toLowerCase();
  // Passwords are not trimmed, because spaces can be a deliberate part of one.
  const password = typeof body.password === 'string' ? body.password : '';
  const avatarColor = cleanText(body.avatarColor);

  if (name.length === 0) {
    return rejectInput(res, 'name', 'Enter your name');
  }
  if (name.length > MAX_NAME_LENGTH) {
    return rejectInput(res, 'name', `Name can be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
    return rejectInput(
      res,
      'username',
      `Username must be ${MIN_USERNAME_LENGTH}–${MAX_USERNAME_LENGTH} characters`
    );
  }
  if (!USERNAME_PATTERN.test(username)) {
    return rejectInput(res, 'username', 'Username can only use letters, numbers and underscores');
  }
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return rejectInput(res, 'email', 'Enter a valid email address');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return rejectInput(res, 'password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return rejectInput(res, 'password', 'Password is too long');
  }
  const isAllowedColor = AVATAR_COLORS.some((color) => color.value === avatarColor);
  if (!isAllowedColor) {
    return rejectInput(res, 'avatarColor', 'Choose one of the avatar colors');
  }

  req.body = { name, username, email, password, avatarColor };
  next();
}

export function validateLogin(req, res, next) {
  const body = req.body ?? {};
  const identifier = cleanText(body.identifier).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (identifier.length === 0) {
    return rejectInput(res, 'identifier', 'Enter your email or username');
  }
  if (password.length === 0) {
    return rejectInput(res, 'password', 'Enter your password');
  }

  req.body = { identifier, password };
  next();
}
