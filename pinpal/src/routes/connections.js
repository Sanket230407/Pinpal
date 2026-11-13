const express = require('express');
const db = require('../db');
const { requireAuth, publicShape } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const findUser = (id) => db.users.find((u) => u.id === id);

// All my connections, grouped
router.get('/', (req, res) => {
  const meId = req.user.id;
  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const c of db.connections) {
    if (c.from !== meId && c.to !== meId) continue;
    const otherId = c.from === meId ? c.to : c.from;
    const other = findUser(otherId);
    if (!other) continue;
    const item = { connectionId: c.id, createdAt: c.createdAt, user: publicShape(other) };
    if (c.status === 'accepted') friends.push(item);
    else if (c.to === meId) incoming.push(item);
    else outgoing.push(item);
  }
  res.json({ friends, incoming, outgoing });
});

// Send a connection request
router.post('/request', (req, res) => {
  const meId = req.user.id;
  const targetId = String(req.body.userId || '');
  const target = findUser(targetId);

  if (!target) return res.status(404).json({ error: 'User not found' });
  if (targetId === meId) return res.status(400).json({ error: "You can't connect with yourself" });
  if (target.demoOwner && target.demoOwner !== meId) return res.status(404).json({ error: 'User not found' });

  const existing = db.connections.find(
    (c) => (c.from === meId && c.to === targetId) || (c.from === targetId && c.to === meId)
  );

  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'You are already connected' });
    if (existing.from === meId) return res.status(409).json({ error: 'Request already sent' });
    // They already asked me - just accept it
    existing.status = 'accepted';
    db.save();
    return res.json({ connectionId: existing.id, status: 'accepted' });
  }

  const conn = {
    id: db.id(),
    from: meId,
    to: targetId,
    // demo people accept instantly so the feature is easy to show off
    status: target.demoOwner ? 'accepted' : 'pending',
    createdAt: new Date().toISOString(),
  };
  db.connections.push(conn);
  db.save();
  res.status(201).json({ connectionId: conn.id, status: conn.status });
});

router.post('/:id/accept', (req, res) => {
  const c = db.connections.find((x) => x.id === req.params.id);
  if (!c || c.to !== req.user.id) return res.status(404).json({ error: 'Request not found' });
  if (c.status === 'accepted') return res.json({ ok: true });
  c.status = 'accepted';
  db.save();
  res.json({ ok: true });
});

router.post('/:id/decline', (req, res) => {
  const idx = db.connections.findIndex((x) => x.id === req.params.id && x.to === req.user.id && x.status === 'pending');
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  db.connections.splice(idx, 1);
  db.save();
  res.json({ ok: true });
});

// Cancel my own request, or remove a friend (either side)
router.delete('/:id', (req, res) => {
  const meId = req.user.id;
  const idx = db.connections.findIndex((x) => x.id === req.params.id && (x.from === meId || x.to === meId));
  if (idx === -1) return res.status(404).json({ error: 'Connection not found' });
  const c = db.connections[idx];
  db.connections.splice(idx, 1);
  // Remove the chat history too when unfriending
  const a = c.from, b = c.to;
  for (let i = db.messages.length - 1; i >= 0; i--) {
    const m = db.messages[i];
    if ((m.from === a && m.to === b) || (m.from === b && m.to === a)) db.messages.splice(i, 1);
  }
  db.save();
  res.json({ ok: true });
});

module.exports = router;
