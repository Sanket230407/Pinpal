// Tiny JSON-file "database". Good enough for a college project:
// no installation needed, and you can open data/db.json to see what is stored.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');

let data = { users: [], connections: [], messages: [] };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      data = Object.assign(data, parsed);
    }
  } catch (e) {
    console.error('Could not read data/db.json, starting empty:', e.message);
  }
}

function flush() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('Could not save database:', e.message);
  }
}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 150);
}

const id = () => crypto.randomUUID();

load();

module.exports = {
  get users() { return data.users; },
  get connections() { return data.connections; },
  get messages() { return data.messages; },
  save,
  flush,
  id,
};
