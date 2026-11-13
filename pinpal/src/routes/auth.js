const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, meShape, AVATAR_COLORS } = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim().toLowerCase();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || name.length > 50) return res.status(400).json({ error: 'Name must be 2-50 characters' });
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username: 3-20 letters, numbers or underscores' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  if (db.users.some((u) => u.email === email)) return res.status(409).json({ error: 'That email is already registered' });
  if (db.users.some((u) => u.username === username)) return res.status(409).json({ error: 'That username is taken' });

  const user = {
    id: db.id(),
    name,
    username,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    bio: '',
    interests: [],
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    lat: null,
    lng: null,
    visible: true,
    precise: false,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  db.save();

  res.status(201).json({ token: sign(user.id), user: meShape(user) });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.users.find((u) => u.email === email && !u.demoOwner);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  res.json({ token: sign(user.id), user: meShape(user) });
});

module.exports = router;
