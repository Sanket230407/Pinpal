// Demo helper: when you present the project you are probably the only registered user.
// This spawns fake people around YOUR location (only you can see them) so every feature can be shown.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, AVATAR_COLORS } = require('../auth');
const { offsetPoint } = require('../geo');

const router = express.Router();
router.use(requireAuth);

const PEOPLE = [
  ['Aarav Mehta', 'Coffee + code. Always up for a hackathon.', ['coding', 'coffee', 'startups']],
  ['Diya Sharma', 'Weekend trekker and amateur photographer.', ['trekking', 'photography', 'travel']],
  ['Kabir Singh', 'Guitar player looking for jam buddies.', ['music', 'guitar', 'cricket']],
  ['Ananya Iyer', 'Bookworm. Ask me for a recommendation.', ['books', 'movies', 'coffee']],
  ['Rohan Patil', 'Football every evening, come join!', ['football', 'fitness', 'gaming']],
  ['Meera Nair', 'Foodie exploring every street stall in town.', ['food', 'travel', 'photography']],
  ['Ishaan Verma', 'Gamer by night, student by day.', ['gaming', 'anime', 'coding']],
  ['Saanvi Gupta', 'Yoga, sketching and chai.', ['yoga', 'art', 'chai']],
  ['Vihaan Joshi', 'Cyclist. Sunday morning rides.', ['cycling', 'fitness', 'music']],
  ['Tara Deshmukh', 'Learning Spanish, teaching dance.', ['dance', 'languages', 'movies']],
];

router.post('/spawn', async (req, res) => {
  const me = req.user;
  if (me.lat == null) return res.status(400).json({ error: 'Set your location first' });

  let demos = db.users.filter((u) => u.demoOwner === me.id);

  if (demos.length === 0) {
    const hash = await bcrypt.hash(Math.random().toString(36), 8);
    demos = PEOPLE.map(([name, bio, interests], i) => {
      const username = name.toLowerCase().replace(/[^a-z]/g, '') + '_demo';
      const u = {
        id: db.id(), name, username: `${username}${me.id.slice(0, 4)}`, email: `${username}.${me.id}@demo.pinpal`,
        passwordHash: hash, bio, interests,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        visible: true, precise: i % 3 === 0, // a few are "approximate" to show that feature
        demoOwner: me.id, createdAt: new Date().toISOString(),
      };
      db.users.push(u);
      return u;
    });
  }

  // (Re)place them around the caller: 0.3 - 7 km away in random directions
  for (const u of demos) {
    const p = offsetPoint(me.lat, me.lng, 0.3 + Math.random() * 6.7, Math.random() * Math.PI * 2);
    u.lat = p.lat;
    u.lng = p.lng;
    u.locationUpdatedAt = new Date().toISOString();
  }
  db.save();
  res.json({ ok: true, count: demos.length });
});

router.delete('/', (req, res) => {
  const meId = req.user.id;
  const ids = new Set(db.users.filter((u) => u.demoOwner === meId).map((u) => u.id));
  if (ids.size === 0) return res.json({ ok: true, removed: 0 });

  const keep = (arr, pred) => { for (let i = arr.length - 1; i >= 0; i--) if (!pred(arr[i])) arr.splice(i, 1); };
  keep(db.users, (u) => !ids.has(u.id));
  keep(db.connections, (c) => !ids.has(c.from) && !ids.has(c.to));
  keep(db.messages, (m) => !ids.has(m.from) && !ids.has(m.to));
  db.save();
  res.json({ ok: true, removed: ids.size });
});

module.exports = router;
