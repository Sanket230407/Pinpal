// Blocking and unblocking people.
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { deleteBlock, deleteConnection, getBlocks, getUserById, saveBlock } from '../db.js';
import { findBlock, findConnectionBetween } from '../utils/relationships.js';
import { publicUser } from '../utils/serializers.js';

const router = Router();

// Lists only the people you blocked. You never get to see who blocked you.
router.get('/', (req, res) => {
  const blocked = getBlocks()
    .filter((block) => block.blockerId === req.user.id)
    .map((block) => ({ createdAt: block.createdAt, user: publicUser(getUserById(block.blockedId)) }));

  res.json({ blocked });
});

router.post('/:userId', async (req, res) => {
  const targetId = req.params.userId;

  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You can't block yourself" });
  }
  if (!getUserById(targetId)) {
    return res.status(404).json({ error: 'This profile is not available' });
  }
  if (findBlock(req.user.id, targetId)) {
    return res.status(409).json({ error: 'You already blocked this person' });
  }

  const connection = findConnectionBetween(req.user.id, targetId);
  if (connection) {
    await deleteConnection(connection.id);
  }

  await saveBlock({
    id: nanoid(),
    blockerId: req.user.id,
    blockedId: targetId,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ ok: true });
});

router.delete('/:userId', async (req, res) => {
  const block = findBlock(req.user.id, req.params.userId);
  if (!block) {
    return res.status(404).json({ error: "You haven't blocked this person" });
  }
  await deleteBlock(block.id);
  res.json({ ok: true });
});

export default router;
