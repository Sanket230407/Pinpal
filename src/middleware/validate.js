// Checks and cleans request input on the server, because a client can send anything.
// Each validator replaces req.body with only the expected, cleaned fields.
import { AVATAR_COLORS, INTERESTS } from '../../public/js/constants.js';

const MAX_BIO_LENGTH = 160;
const MAX_INTERESTS = 5;
const MAX_MESSAGE_LENGTH = 500;
const RADIUS_OPTIONS_KM = [1, 5, 10, 25];
const DEFAULT_RADIUS_KM = 5;
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

export function validateProfile(req, res, next) {
  const body = req.body ?? {};
  const name = cleanText(body.name);
  const bio = cleanText(body.bio);
  const avatarColor = cleanText(body.avatarColor);

  if (name.length === 0) {
    return rejectInput(res, 'name', 'Enter your name');
  }
  if (name.length > MAX_NAME_LENGTH) {
    return rejectInput(res, 'name', `Name can be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (bio.length > MAX_BIO_LENGTH) {
    return rejectInput(res, 'bio', `Bio can be at most ${MAX_BIO_LENGTH} characters`);
  }
  if (!Array.isArray(body.interests)) {
    return rejectInput(res, 'interests', 'Choose your interests from the list');
  }
  // A Set removes repeats, so sending "Music" five times can't fill all the slots.
  const interests = [...new Set(body.interests)];
  if (!interests.every((interest) => INTERESTS.includes(interest))) {
    return rejectInput(res, 'interests', 'Choose your interests from the list');
  }
  if (interests.length > MAX_INTERESTS) {
    return rejectInput(res, 'interests', `Choose up to ${MAX_INTERESTS} interests`);
  }
  if (!AVATAR_COLORS.some((color) => color.value === avatarColor)) {
    return rejectInput(res, 'avatarColor', 'Choose one of the avatar colors');
  }

  req.body = { name, bio, interests, avatarColor };
  next();
}

export function validateGhostMode(req, res, next) {
  const ghostMode = req.body?.ghostMode;
  if (typeof ghostMode !== 'boolean') {
    return res.status(400).json({ error: 'ghostMode must be true or false' });
  }
  req.body = { ghostMode };
  next();
}

export function validateLocation(req, res, next) {
  const lat = req.body?.lat;
  const lng = req.body?.lng;
  // Number.isFinite also rejects text such as "25.18", which is a number only by accident.
  const isValidLat = Number.isFinite(lat) && lat >= -90 && lat <= 90;
  const isValidLng = Number.isFinite(lng) && lng >= -180 && lng <= 180;
  if (!isValidLat || !isValidLng) {
    return res.status(400).json({ error: 'Latitude and longitude are not valid' });
  }
  req.body = { lat, lng };
  next();
}

// Express 5 doesn't allow replacing req.query, so the cleaned values go on req.nearbyFilters.
export function validateNearbyQuery(req, res, next) {
  const radius = req.query.radius === undefined ? DEFAULT_RADIUS_KM : Number(req.query.radius);
  if (!RADIUS_OPTIONS_KM.includes(radius)) {
    return res.status(400).json({ error: `Radius must be one of: ${RADIUS_OPTIONS_KM.join(', ')} km` });
  }

  const interest = req.query.interest;
  if (interest !== undefined && interest !== '' && !INTERESTS.includes(interest)) {
    return res.status(400).json({ error: 'That interest is not in the list' });
  }

  req.nearbyFilters = { radius, interest: interest || null };
  next();
}

export function validateMessage(req, res, next) {
  const text = cleanText(req.body?.text);
  if (text.length === 0) {
    return res.status(400).json({ error: 'Write a message first' });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters` });
  }
  req.body = { text };
  next();
}
