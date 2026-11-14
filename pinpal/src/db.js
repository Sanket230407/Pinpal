
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');

// Vercel's Upstash integration sets one of these pairs of environment variables
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const usesRedis = Boolean(REDIS_URL && REDIS_TOKEN);
const REDIS_KEY = 'pinpal:db';

const empty = () => ({ users: [], connections: [], messages: [] });

let data = empty();
let dirty = false;       // true when something changed and must be saved
let fileLoaded = false;  // file mode only reads the file once

// Send one command to Upstash Redis over its REST API, e.g. ['GET', 'pinpal:db']
async function redis(command) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error('Redis error: ' + (body.error || res.status));
  return body.result;
}

async function load() {
  if (usesRedis) {
    // Always fetch fresh data: another serverless copy may have changed it
    const raw = await redis(['GET', REDIS_KEY]);
    data = Object.assign(empty(), raw ? JSON.parse(raw) : {});
    dirty = false;
    return;
  }
  if (fileLoaded) return;
  fileLoaded = true;
  try {
    if (fs.existsSync(FILE)) data = Object.assign(empty(), JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (e) {
    console.error('Could not read data/db.json, starting empty:', e.message);
  }
}

function writeFile() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('Could not save database:', e.message);
  }
}

// Routes call save() after changing something; persist() then writes it once per request
function save() {
  dirty = true;
}

async function persist() {
  if (!dirty) return;
  dirty = false;
  if (usesRedis) await redis(['SET', REDIS_KEY, JSON.stringify(data)]);
  else writeFile();
}

const id = () => crypto.randomUUID();

module.exports = {
  get users() { return data.users; },
  get connections() { return data.connections; },
  get messages() { return data.messages; },
  usesRedis,
  load,
  save,
  persist,
  id,
};
