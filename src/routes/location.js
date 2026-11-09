// Saves the logged-in user's location.
import { Router } from 'express';
import { saveUser } from '../db.js';
import { limitLocationUpdates } from '../middleware/rateLimit.js';
import { validateLocation } from '../middleware/validate.js';
import { buildLocation } from '../utils/geo.js';
import { selfUser } from '../utils/serializers.js';

const router = Router();

// Validation runs first, so a rejected request doesn't use up the one update a minute.
router.put('/', validateLocation, limitLocationUpdates, async (req, res) => {
  const { lat, lng } = req.body;
  const user = { ...req.user, location: buildLocation(req.user.location, lat, lng) };
  await saveUser(user);
  res.json({ user: selfUser(user) });
});

export default router;
