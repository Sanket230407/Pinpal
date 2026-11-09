// Blocks requests from anyone who isn't logged in.
import { getUserById, saveUser } from '../db.js';

const ONE_MINUTE_IN_MS = 60 * 1000;

export function requireAuth(req, res, next) {
  const user = req.session.userId ? getUserById(req.session.userId) : null;

  // Checking the user still exists covers a session that outlived its account, such as after a re-seed.
  if (!user) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  req.user = user;
  updateLastActive(user);
  next();
}

// Powers "active 2h ago". Saving at most once a minute avoids a disk write on every request.
function updateLastActive(user) {
  const millisecondsSinceActive = Date.now() - new Date(user.lastActive).getTime();
  if (millisecondsSinceActive < ONE_MINUTE_IN_MS) {
    return;
  }
  user.lastActive = new Date().toISOString();
  // The request doesn't depend on this save, so a failure is logged instead of failing the request.
  saveUser(user).catch((err) => console.error('Could not update lastActive:', err));
}
