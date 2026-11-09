// Signup, login, logout, and "who am I?".
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getUserByEmail, getUserById, getUserByUsername, saveUser } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateLogin, validateSignup } from '../middleware/validate.js';
import { selfUser } from '../utils/serializers.js';

const BCRYPT_ROUNDS = 10;

const router = Router();

function findDuplicate(username, email) {
  if (getUserByUsername(username)) {
    return { field: 'username', error: 'That username is taken' };
  }
  if (getUserByEmail(email)) {
    return { field: 'email', error: 'An account with that email already exists' };
  }
  return null;
}

// A new session id at login stops an attacker from planting a known session id beforehand.
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }
      req.session.userId = userId;
      resolve();
    });
  });
}

router.post('/signup', validateSignup, async (req, res) => {
  const { name, username, email, password, avatarColor } = req.body;

  // Checked first so a duplicate gets a quick answer, without the slow password hash.
  const duplicate = findDuplicate(username, email);
  if (duplicate) {
    return res.status(409).json(duplicate);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Checked again because another signup may have taken the name while this request was hashing.
  // There is no await between this check and saveUser, so nothing can slip in between them.
  const lateDuplicate = findDuplicate(username, email);
  if (lateDuplicate) {
    return res.status(409).json(lateDuplicate);
  }

  const now = new Date().toISOString();
  const user = {
    id: nanoid(),
    name,
    username,
    email,
    passwordHash,
    bio: '',
    interests: [],
    avatarColor,
    location: null,
    ghostMode: false,
    lastActive: now,
    createdAt: now,
  };
  await saveUser(user);

  await startSession(req, user.id);
  res.status(201).json({ user: selfUser(user) });
});

router.post('/login', validateLogin, async (req, res) => {
  const { identifier, password } = req.body;

  // Usernames can't contain @, so this can't confuse a username with an email.
  const user = identifier.includes('@')
    ? getUserByEmail(identifier)
    : getUserByUsername(identifier);

  const isPasswordCorrect = user ? await bcrypt.compare(password, user.passwordHash) : false;

  // The same message for both cases, so this form doesn't reveal which accounts exist.
  if (!isPasswordCorrect) {
    return res.status(401).json({ error: 'Incorrect email, username or password' });
  }

  user.lastActive = new Date().toISOString();
  await saveUser(user);

  await startSession(req, user.id);
  res.json({ user: selfUser(user) });
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('pinpal.sid');
    res.json({ ok: true });
  });
});

// Public pages use this to ask "am I logged in?". Being logged out is a normal answer here,
// so it returns 200. A 401 would show up as a red error in the browser console on every visit.
router.get('/session', (req, res) => {
  res.json({ loggedIn: Boolean(req.session.userId && getUserById(req.session.userId)) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: selfUser(req.user) });
});

export default router;
