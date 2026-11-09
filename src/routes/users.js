// Viewing profiles, editing your own profile, and Ghost Mode.
import { Router } from 'express';
import { getUserById, saveUser } from '../db.js';
import { validateGhostMode, validateProfile } from '../middleware/validate.js';
import { connectionStatus, findBlock } from '../utils/relationships.js';
import { publicUser, selfUser } from '../utils/serializers.js';

const router = Router();

router.put('/me', validateProfile, async (req, res) => {
  // Only the fields checked by validateProfile are copied over.
  const user = { ...req.user, ...req.body };
  await saveUser(user);
  res.json({ user: selfUser(user) });
});

router.put('/me/ghost', validateGhostMode, async (req, res) => {
  const user = { ...req.user, ghostMode: req.body.ghostMode };
  await saveUser(user);
  res.json({ user: selfUser(user) });
});

router.get('/:id', (req, res) => {
  const user = getUserById(req.params.id);

  // Someone who blocked you looks the same as an account that doesn't exist,
  // so a block can't be confirmed by looking at the response.
  if (!user || findBlock(user.id, req.user.id)) {
    return res.status(404).json({ error: 'This profile is not available' });
  }

  res.json({
    user: publicUser(user),
    isSelf: user.id === req.user.id,
    connection: connectionStatus(req.user.id, user.id),
    blockedByMe: Boolean(findBlock(req.user.id, user.id)),
  });
});

export default router;
