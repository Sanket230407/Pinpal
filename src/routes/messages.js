// Chat history and sending messages. Only people with an accepted connection can use these.
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getMessagesBetween, getUserById, saveMessage } from '../db.js';
import { validateMessage } from '../middleware/validate.js';
import { sendToUsers } from '../socket.js';
import { areConnected } from '../utils/relationships.js';
import { publicUser } from '../utils/serializers.js';

const router = Router();

// Blocking deletes the connection, so this one check also covers blocked users.
function requireConnection(req, res, next) {
  if (!areConnected(req.user.id, req.params.userId)) {
    return res.status(403).json({ error: 'You can only chat with your connections' });
  }
  next();
}

router.get('/:userId', requireConnection, (req, res) => {
  res.json({
    user: publicUser(getUserById(req.params.userId)),
    messages: getMessagesBetween(req.user.id, req.params.userId),
  });
});

// Every message comes through this route, so a message can't skip these checks. The socket only delivers.
router.post('/:userId', requireConnection, validateMessage, async (req, res) => {
  const message = {
    id: nanoid(),
    fromId: req.user.id,
    toId: req.params.userId,
    text: req.body.text,
    createdAt: new Date().toISOString(),
  };
  await saveMessage(message);

  // Goes to the sender as well, so their other open tabs stay up to date.
  sendToUsers([message.fromId, message.toId], 'message:new', message);
  res.status(201).json({ message });
});

export default router;
