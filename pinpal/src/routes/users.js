const express = require('express');
const db = require('../db');
const { requireAuth, meShape, publicShape, relation, cleanInterests } = require('../auth');
const { distanceKm, snap, validCoords } = require('../geo');

const router = express.Router();
router.use(requireAuth);

// ----- My account -----
router.get('/me', (req, res) => res.json(meShape(req.user)));

router.put('/me', (req, res) => {
  const u = req.user;
  const { name, bio, interests, visible, precise } = req.body;

  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2 || n.length > 50) return res.status(400).json({ error: 'Name must be 2-50 characters' });
    u.name = n;
  }
  if (bio !== undefined) u.bio = String(bio).trim().slice(0, 160);
  if (interests !== undefined) u.interests = cleanInterests(interests);
  if (visible !== undefined) u.visible = !!visible;
  if (precise !== undefined) u.precise = !!precise;

  db.save();
  res.json(meShape(u));
});

router.put('/me/location', (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!validCoords(lat, lng)) return res.status(400).json({ error: 'Invalid coordinates' });
  req.user.lat = lat;
  req.user.lng = lng;
  req.user.locationUpdatedAt = new Date().toISOString();
  db.save();
  res.json(meShape(req.user));
});

// ----- Discover people nearby -----
// GET /api/nearby?radius=5&interest=music&q=ann
router.get('/nearby', (req, res) => {
  const me = req.user;
  if (me.lat == null || me.lng == null) {
    return res.status(400).json({ error: 'Set your location first', code: 'NO_LOCATION' });
  }

  const radius = Math.min(Math.max(parseFloat(req.query.radius) || 5, 0.5), 200);
  const interest = String(req.query.interest || '').trim().toLowerCase();
  const q = String(req.query.q || '').trim().toLowerCase();

  const results = [];
  for (const u of db.users) {
    if (u.id === me.id) continue;
    if (u.lat == null || u.visible === false) continue;
    if (u.demoOwner && u.demoOwner !== me.id) continue; // demo people only show for their owner

    // Approximate users are shown on a coarse grid so their exact spot stays private
    const approx = !u.precise;
    const lat = approx ? snap(u.lat) : u.lat;
    const lng = approx ? snap(u.lng) : u.lng;

    const dist = distanceKm(me.lat, me.lng, lat, lng);
    if (dist > radius) continue;
    if (interest && !(u.interests || []).some((i) => i.includes(interest))) continue;
    if (q && !(u.name.toLowerCase().includes(q) || u.username.includes(q))) continue;

    const rel = relation(me.id, u.id);
    results.push({
      ...publicShape(u),
      lat, lng, approx,
      distanceKm: Math.round(dist * 100) / 100,
      relation: rel.status,
      connectionId: rel.connectionId,
    });
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  res.json({ radius, count: results.length, people: results.slice(0, 100) });
});

router.get('/users/:id', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u || (u.demoOwner && u.demoOwner !== req.user.id)) return res.status(404).json({ error: 'User not found' });
  const rel = relation(req.user.id, u.id);
  res.json({ ...publicShape(u), relation: rel.status, connectionId: rel.connectionId });
});

module.exports = router;
