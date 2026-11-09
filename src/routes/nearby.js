// The main feature: finds people near the logged-in user without revealing where they really are.
import { Router } from 'express';
import { getUsers } from '../db.js';
import { validateNearbyQuery } from '../middleware/validate.js';
import { distanceKm, distanceLabel } from '../utils/geo.js';
import { connectionStatus, isBlockedEitherWay } from '../utils/relationships.js';
import { publicUser } from '../utils/serializers.js';

const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

const router = Router();

function hasFreshLocation(user) {
  if (!user.location) {
    return false;
  }
  return Date.now() - new Date(user.location.updatedAt).getTime() < TWENTY_FOUR_HOURS_IN_MS;
}

router.get('/', validateNearbyQuery, (req, res) => {
  const me = req.user;
  const { radius, interest } = req.nearbyFilters;

  if (!hasFreshLocation(me)) {
    return res.status(409).json({ error: 'Share your location to see who is nearby' });
  }

  const candidates = getUsers().filter((user) => {
    if (user.id === me.id || user.ghostMode || !hasFreshLocation(user)) {
      return false;
    }
    if (interest && !user.interests.includes(interest)) {
      return false;
    }
    return !isBlockedEitherWay(me.id, user.id);
  });

  const withDistance = candidates.map((user) => ({
    user,
    km: distanceKm(me.location.lat, me.location.lng, user.location.lat, user.location.lng),
  }));

  const closestFirst = withDistance
    .filter((item) => item.km <= radius)
    .sort((a, b) => a.km - b.km);

  // Only these fields leave the server. `km` and the real coordinates stay here.
  const results = closestFirst.map(({ user, km }) => ({
    user: publicUser(user),
    distance: distanceLabel(km),
    pin: { lat: user.location.fuzzLat, lng: user.location.fuzzLng },
    sharedInterests: user.interests.filter((item) => me.interests.includes(item)),
    connection: connectionStatus(me.id, user.id),
  }));

  res.json({ results });
});

export default router;
