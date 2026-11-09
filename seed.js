// Fills the database with demo users, connections and messages.
// Usage: npm run seed -- 25.18 75.83     (the two numbers are the latitude and longitude of the center)
//
// Running it again replaces the demo data with fresh data and keeps accounts people created themselves.
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import { AVATAR_COLORS } from './public/js/constants.js';
import { getAllMessages, getBlocks, getConnections, getUsers, loadDb, replaceDatabase } from './src/db.js';
import { buildLocation, offsetPoint } from './src/utils/geo.js';

dotenv.config({ quiet: true });

const KOTA = { lat: 25.18, lng: 75.83 };
const DEMO_PASSWORD = 'demo1234';
const DEMO_EMAIL_DOMAIN = '@demo.pinpal.test';
const MINUTE_IN_MS = 60 * 1000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

// km: distance from the center. minutesAgo: when they last shared their location and were active.
const DEMO_USERS = [
  { name: 'Asha Rao', username: 'asha', km: 0.3, minutesAgo: 5, bio: 'Final-year CS student. Happy to talk about side projects over chai.', interests: ['Coding', 'Music', 'Reading'] },
  { name: 'Rohan Mehta', username: 'rohan', km: 0.8, minutesAgo: 20, bio: 'Weekend cricketer and full-time snack enthusiast.', interests: ['Sports', 'Food', 'Movies'] },
  { name: 'Priya Sharma', username: 'priya', km: 1.2, minutesAgo: 45, bio: 'I photograph old buildings before they disappear.', interests: ['Photography', 'Travel', 'Art'] },
  { name: 'Kunal Verma', username: 'kunal', km: 1.9, minutesAgo: 60, bio: 'Looking for people to play co-op games with.', interests: ['Gaming', 'Coding', 'Movies'] },
  { name: 'Neha Joshi', username: 'neha', km: 2.6, minutesAgo: 90, bio: 'Morning runner. Always training for the next 10k.', interests: ['Fitness', 'Sports', 'Music'] },
  { name: 'Arjun Singh', username: 'arjun', km: 3.4, minutesAgo: 120, bio: 'Guitarist looking for a band that practices on Sundays.', interests: ['Music', 'Dance', 'Travel'] },
  { name: 'Sneha Gupta', username: 'sneha', km: 4.1, minutesAgo: 150, bio: 'Reading through every Booker Prize winner.', interests: ['Reading', 'Art', 'Food'] },
  { name: 'Vikram Patel', username: 'vikram', km: 4.8, minutesAgo: 180, bio: 'Exploring Rajasthan one street-food stall at a time.', interests: ['Food', 'Travel', 'Photography'] },
  { name: 'Ananya Iyer', username: 'ananya', km: 6.2, minutesAgo: 210, bio: 'Classical dancer who also writes a little Python.', interests: ['Dance', 'Music', 'Coding'] },
  { name: 'Dev Malhotra', username: 'dev', km: 7.5, minutesAgo: 240, bio: 'Gym in the morning, ranked matches at night.', interests: ['Fitness', 'Gaming'] },
  { name: 'Ishita Bose', username: 'ishita', km: 9.3, minutesAgo: 270, bio: 'Sketchbook always in my bag.', interests: ['Art', 'Movies', 'Reading'] },
  { name: 'Manav Kapoor', username: 'manav', km: 11.4, minutesAgo: 300, bio: 'Film club organizer. Ask me for recommendations.', interests: ['Movies', 'Photography', 'Music'] },
  { name: 'Pooja Nair', username: 'pooja', km: 14.6, minutesAgo: 330, bio: 'Planning my next trek.', interests: ['Travel', 'Fitness', 'Food'] },
  // These two never appear in Nearby, so you can show that Ghost Mode and the 24-hour rule work.
  { name: 'Kabir Khan', username: 'kabir', km: 0.6, minutesAgo: 30, ghostMode: true, bio: 'In Ghost Mode, so I stay out of Nearby.', interests: ['Coding', 'Gaming'] },
  { name: 'Tara Sethi', username: 'tara', km: 1.5, minutesAgo: 30 * 60, bio: 'Last shared my location more than a day ago.', interests: ['Music', 'Art'] },
];

// [sender, recipient, status]
const DEMO_CONNECTIONS = [
  ['asha', 'kunal', 'accepted'],
  ['asha', 'arjun', 'accepted'],
  ['priya', 'asha', 'accepted'],
  ['rohan', 'asha', 'pending'],
  ['neha', 'asha', 'pending'],
  ['asha', 'ananya', 'pending'],
  ['kunal', 'dev', 'accepted'],
];

// [sender, recipient, text, how many minutes ago]
const DEMO_MESSAGES = [
  ['kunal', 'asha', 'Hey! Saw you like coding too. What are you working on?', 180],
  ['asha', 'kunal', 'A location app for my web-dev course. You?', 175],
  ['kunal', 'asha', "A small multiplayer game. Let's compare notes sometime.", 170],
  ['arjun', 'asha', 'Are you coming to the open mic on Saturday?', 60],
  ['asha', 'arjun', "Yes! I'll be there by 7.", 55],
  ['priya', 'asha', 'I took some photos near the Chambal riverfront. Want to see them?', 30],
];

function readCenter() {
  const [latArg, lngArg] = process.argv.slice(2);
  if (latArg === undefined) {
    return KOTA;
  }

  const lat = Number(latArg);
  const lng = Number(lngArg);
  const isValid = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!isValid) {
    console.error('Usage: npm run seed -- <latitude> <longitude>   for example: npm run seed -- 25.18 75.83');
    process.exit(1);
  }
  return { lat, lng };
}

// A running server keeps its own copy of the data in memory and would overwrite the seed on its next save.
async function stopIfServerIsRunning() {
  const port = process.env.PORT || 3000;
  let isRunning = false;
  try {
    const response = await fetch(`http://localhost:${port}/api/auth/session`);
    const body = await response.json();
    isRunning = 'loggedIn' in body;
  } catch {
    // Nothing answered, so the server isn't running and it's safe to continue.
  }

  if (isRunning) {
    console.error(`PinPal is running on port ${port}. Stop the server, then run the seed again.`);
    process.exit(1);
  }
}

function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * MINUTE_IN_MS).toISOString();
}

function buildUser(demo, index, center, passwordHash) {
  // Multiplying by the golden angle spreads people evenly in every direction around the center.
  const bearing = index * 2.39996;
  const point = offsetPoint(center.lat, center.lng, demo.km, bearing);
  const updatedAt = minutesAgoIso(demo.minutesAgo);

  return {
    id: nanoid(),
    name: demo.name,
    username: demo.username,
    email: `${demo.username}${DEMO_EMAIL_DOMAIN}`,
    passwordHash,
    bio: demo.bio,
    interests: demo.interests,
    avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length].value,
    location: { ...buildLocation(null, point.lat, point.lng), updatedAt },
    ghostMode: demo.ghostMode ?? false,
    lastActive: updatedAt,
    createdAt: new Date(Date.now() - 7 * 24 * HOUR_IN_MS).toISOString(),
  };
}

// Finds what to keep: real accounts, and only the records that are purely between real accounts.
function readRealData() {
  const users = getUsers().filter((user) => !user.email.endsWith(DEMO_EMAIL_DOMAIN));
  const realIds = new Set(users.map((user) => user.id));
  const isBetweenRealUsers = (idA, idB) => realIds.has(idA) && realIds.has(idB);

  return {
    users,
    connections: getConnections().filter((item) => isBetweenRealUsers(item.fromId, item.toId)),
    messages: getAllMessages().filter((item) => isBetweenRealUsers(item.fromId, item.toId)),
    blocks: getBlocks().filter((item) => isBetweenRealUsers(item.blockerId, item.blockedId)),
  };
}

function stopIfUsernameIsTaken(realUsers) {
  const demoUsernames = DEMO_USERS.map((demo) => demo.username);
  const clash = realUsers.find((user) => demoUsernames.includes(user.username));
  if (clash) {
    console.error(`The account "${clash.username}" uses a demo username. Nothing was changed.`);
    process.exit(1);
  }
}

async function seed() {
  await stopIfServerIsRunning();
  const center = readCenter();

  loadDb();
  const real = readRealData();
  stopIfUsernameIsTaken(real.users);

  // Hashing once is enough here, since every demo user shares the same password.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = DEMO_USERS.map((demo, index) => buildUser(demo, index, center, passwordHash));

  const idOf = (username) => users.find((user) => user.username === username).id;

  const connections = DEMO_CONNECTIONS.map(([from, to, status]) => ({
    id: nanoid(),
    fromId: idOf(from),
    toId: idOf(to),
    status,
    createdAt: minutesAgoIso(24 * 60),
  }));

  const messages = DEMO_MESSAGES.map(([from, to, text, minutesAgo]) => ({
    id: nanoid(),
    fromId: idOf(from),
    toId: idOf(to),
    text,
    createdAt: minutesAgoIso(minutesAgo),
  }));

  await replaceDatabase({
    users: [...real.users, ...users],
    connections: [...real.connections, ...connections],
    messages: [...real.messages, ...messages],
    blocks: real.blocks,
  });

  console.log(`Created ${users.length} demo users around ${center.lat}, ${center.lng}.`);
  console.log(`Kept ${real.users.length} real account(s).`);
  console.log(`Log in as "asha" (or any other demo username) with the password ${DEMO_PASSWORD}.`);
  console.log('Demo locations count as fresh for about 18 hours. Run the seed again before a demo.');
}

await seed();
