// Connection requests: sending, accepting, declining, cancelling and removing.
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { deleteConnection, getConnectionById, getConnections, getUserById, saveConnection } from '../db.js';
import { findBlock, findConnectionBetween } from '../utils/relationships.js';
import { publicUser } from '../utils/serializers.js';

const router = Router();

// Adds the other person's public details, which is what the page needs to display.
function withOtherUser(connection, myId) {
  const otherId = connection.fromId === myId ? connection.toId : connection.fromId;
  return {
    id: connection.id,
    status: connection.status,
    createdAt: connection.createdAt,
    user: publicUser(getUserById(otherId)),
  };
}

router.get('/', (req, res) => {
  const connections = getConnections()
    .filter(
      (item) =>
        item.status === 'accepted' && (item.fromId === req.user.id || item.toId === req.user.id)
    )
    .map((item) => withOtherUser(item, req.user.id));

  res.json({ connections });
});

router.get('/requests', (req, res) => {
  const pending = getConnections().filter((item) => item.status === 'pending');

  const received = pending
    .filter((item) => item.toId === req.user.id)
    .map((item) => withOtherUser(item, req.user.id));
  const sent = pending
    .filter((item) => item.fromId === req.user.id)
    .map((item) => withOtherUser(item, req.user.id));

  res.json({ received, sent });
});

router.post('/:userId', async (req, res) => {
  const targetId = req.params.userId;

  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You can't connect with yourself" });
  }
  // Someone who blocked you looks like a missing account, the same as on their profile page.
  if (!getUserById(targetId) || findBlock(targetId, req.user.id)) {
    return res.status(404).json({ error: 'This profile is not available' });
  }
  if (findBlock(req.user.id, targetId)) {
    return res.status(403).json({ error: 'Unblock this person before connecting' });
  }

  const existing = findConnectionBetween(req.user.id, targetId);
  if (existing?.status === 'accepted') {
    return res.status(409).json({ error: 'You are already connected' });
  }
  if (existing?.fromId === req.user.id) {
    return res.status(409).json({ error: 'You already sent a request' });
  }
  if (existing) {
    return res.status(409).json({ error: 'This person already sent you a request. Check your Received tab.' });
  }

  const connection = {
    id: nanoid(),
    fromId: req.user.id,
    toId: targetId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await saveConnection(connection);
  res.status(201).json({ connection: withOtherUser(connection, req.user.id) });
});

router.put('/:id/accept', async (req, res) => {
  const connection = getConnectionById(req.params.id);

  if (!connection) {
    return res.status(404).json({ error: 'That request no longer exists' });
  }
  // Only the person who received a request can accept it. The sender can't approve their own.
  if (connection.toId !== req.user.id) {
    return res.status(403).json({ error: 'Only the person who received this request can accept it' });
  }
  if (connection.status === 'accepted') {
    return res.status(409).json({ error: 'You are already connected' });
  }

  connection.status = 'accepted';
  await saveConnection(connection);
  res.json({ connection: withOtherUser(connection, req.user.id) });
});

// One route covers declining, cancelling and removing, because each one deletes the record.
router.delete('/:id', async (req, res) => {
  const connection = getConnectionById(req.params.id);

  if (!connection) {
    return res.status(404).json({ error: 'That connection no longer exists' });
  }
  if (connection.fromId !== req.user.id && connection.toId !== req.user.id) {
    return res.status(403).json({ error: 'This connection belongs to other people' });
  }

  await deleteConnection(connection.id);
  res.json({ ok: true });
});

export default router;
