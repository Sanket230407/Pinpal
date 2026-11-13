const express = require('express');
const db = require('../db');
const { requireAuth, relation } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const CANNED_REPLIES = [
  'Hey! Nice to meet you 👋',
  'Oh cool, you are nearby too!',
  'Haha yes, we should meet up sometime.',
  'Sounds like a plan!',
  'That is awesome, tell me more.',
  'I am free this weekend, what about you?',
  'Love that. Which area are you in?',
];

// Conversation summary: last message + unread count per friend
router.get('/summary', (req, res) => {
  const meId = req.user.id;
  const map = new Map();
  for (const m of db.messages) {
    if (m.from !== meId && m.to !== meId) continue;
    const otherId = m.from === meId ? m.to : m.from;
    const entry = map.get(otherId) || { userId: otherId, last: null, unread: 0 };
    entry.last = { text: m.text, from: m.from, createdAt: m.createdAt };
    if (m.to === meId && !m.read) entry.unread++;
    map.set(otherId, entry);
  }
  res.json([...map.values()]);
});

// Messages with one friend. Opening the chat marks incoming messages as read.
router.get('/:userId', (req, res) => {
  const meId = req.user.id;
  const otherId = req.params.userId;
  if (relation(meId, otherId).status !== 'friends') {
    return res.status(403).json({ error: 'You can only chat with connections' });
  }
  const convo = db.messages.filter(
    (m) => (m.from === meId && m.to === otherId) || (m.from === otherId && m.to === meId)
  );
  let changed = false;
  for (const m of convo) {
    if (m.to === meId && !m.read) { m.read = true; changed = true; }
  }
  if (changed) db.save();
  res.json(convo.slice(-200).map(({ id, from, text, createdAt }) => ({ id, from, text, createdAt })));
});

router.post('/:userId', (req, res) => {
  const meId = req.user.id;
  const otherId = req.params.userId;
  const text = String(req.body.text || '').trim().slice(0, 500);

  if (!text) return res.status(400).json({ error: 'Message is empty' });
  if (relation(meId, otherId).status !== 'friends') {
    return res.status(403).json({ error: 'You can only chat with connections' });
  }

  const msg = { id: db.id(), from: meId, to: otherId, text, createdAt: new Date().toISOString(), read: false };
  db.messages.push(msg);

  // Demo people answer back so chat is easy to demonstrate.
  // The reply is saved straight away (a timer would not survive on Vercel's serverless functions).
  const other = db.users.find((u) => u.id === otherId);
  if (other && other.demoOwner === meId) {
    db.messages.push({
      id: db.id(),
      from: otherId,
      to: meId,
      text: CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)],
      createdAt: new Date(Date.now() + 1000).toISOString(),
      read: false,
    });
  }

  db.save();
  res.status(201).json({ id: msg.id, from: msg.from, text: msg.text, createdAt: msg.createdAt });
});

module.exports = router;
