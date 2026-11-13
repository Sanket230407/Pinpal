// Auth helpers: JWT signing + middleware + shared "shape" functions
const jwt = require('jsonwebtoken');
const db = require('./db');

// Change this (set JWT_SECRET env var) before deploying anywhere public
const SECRET = process.env.JWT_SECRET || 'pinpal-dev-secret-change-me';

const AVATAR_COLORS = ['#6c5ce7', '#ff6b6b', '#00b894', '#0984e3', '#e17055', '#fd79a8', '#00cec9', '#fdcb6e', '#a29bfe', '#55efc4'];

function sign(userId) {
  return jwt.sign({ uid: userId }, SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.users.find((u) => u.id === payload.uid);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

// What the owner of an account may see about themselves
function meShape(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    bio: u.bio || '',
    interests: u.interests || [],
    avatarColor: u.avatarColor,
    lat: u.lat ?? null,
    lng: u.lng ?? null,
    visible: u.visible !== false,
    precise: u.precise === true,
    locationUpdatedAt: u.locationUpdatedAt || null,
    hasDemo: db.users.some((x) => x.demoOwner === u.id),
  };
}

// What other people may see (no email, no raw coordinates)
function publicShape(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    bio: u.bio || '',
    interests: u.interests || [],
    avatarColor: u.avatarColor,
    isDemo: !!u.demoOwner,
  };
}

// Relationship between two users: none | friends | pending_out | pending_in
function relation(meId, otherId) {
  const c = db.connections.find(
    (x) => (x.from === meId && x.to === otherId) || (x.from === otherId && x.to === meId)
  );
  if (!c) return { status: 'none', connectionId: null };
  if (c.status === 'accepted') return { status: 'friends', connectionId: c.id };
  return { status: c.from === meId ? 'pending_out' : 'pending_in', connectionId: c.id };
}

function cleanInterests(input) {
  const list = Array.isArray(input)
    ? input
    : typeof input === 'string' ? input.split(',') : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const v = String(raw).trim().toLowerCase().slice(0, 20);
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
    if (out.length >= 8) break;
  }
  return out;
}

module.exports = { sign, requireAuth, meShape, publicShape, relation, cleanInterests, AVATAR_COLORS };
