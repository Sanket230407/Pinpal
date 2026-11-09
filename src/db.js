// The only file that touches db.json. Replacing this file is all it takes to move to a real database.
//
// How it works: the data is loaded into memory at startup, reads come from memory,
// and every change is saved to disk through a queue, one write at a time.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EMPTY_DB = { users: [], connections: [], messages: [], blocks: [] };
const MAX_RENAME_ATTEMPTS = 5;

let data = null;
let dbFile = null;
let writeQueue = Promise.resolve();

export function loadDb() {
  // DB_FILE lets test runs use a throwaway database instead of the real one.
  dbFile = process.env.DB_FILE || path.join(import.meta.dirname, '..', 'data', 'db.json');
  mkdirSync(path.dirname(dbFile), { recursive: true });

  if (existsSync(dbFile)) {
    // If the file is damaged, JSON.parse throws and the server stops.
    // That is better than starting empty and overwriting data that could be repaired.
    data = { ...EMPTY_DB, ...JSON.parse(readFileSync(dbFile, 'utf8')) };
  } else {
    data = structuredClone(EMPTY_DB);
    queueWrite().catch((err) => console.error('Could not create the database file:', err));
  }
}

// Writing to a temp file and then renaming means a crash mid-write can't leave a half-written db.json.
async function writeToDisk() {
  const tempFile = `${dbFile}.tmp`;
  await writeFile(tempFile, JSON.stringify(data, null, 2));
  await renameWithRetry(tempFile, dbFile);
}

// On Windows, OneDrive or antivirus software can briefly lock a file, so rename may need another try.
async function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const isTemporaryLock = ['EPERM', 'EBUSY', 'EACCES'].includes(err.code);
      if (!isTemporaryLock || attempt === MAX_RENAME_ATTEMPTS) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
}

// Each write waits for the one before it, so two requests can never write at the same time.
function queueWrite() {
  const thisWrite = writeQueue.then(writeToDisk);
  // A failed write is reported to its caller, but must not stop the writes queued after it.
  writeQueue = thisWrite.catch(() => {});
  return thisWrite;
}

// Getters return copies, so a route can't change stored data without calling a save helper.

export function getUsers() {
  return structuredClone(data.users);
}

export function getUserById(id) {
  return copyIfFound(data.users.find((user) => user.id === id));
}

export function getUserByUsername(username) {
  return copyIfFound(data.users.find((user) => user.username === username));
}

export function getUserByEmail(email) {
  return copyIfFound(data.users.find((user) => user.email === email));
}

export function saveUser(user) {
  return addOrReplace(data.users, user);
}

export function getConnections() {
  return structuredClone(data.connections);
}

export function getConnectionById(id) {
  return copyIfFound(data.connections.find((connection) => connection.id === id));
}

export function saveConnection(connection) {
  return addOrReplace(data.connections, connection);
}

export function deleteConnection(id) {
  return removeById('connections', id);
}

// Messages are always stored in the order they were sent, so no sorting is needed.
export function getMessagesBetween(userA, userB) {
  const messages = data.messages.filter(
    (message) =>
      (message.fromId === userA && message.toId === userB) ||
      (message.fromId === userB && message.toId === userA)
  );
  return structuredClone(messages);
}

export function getAllMessages() {
  return structuredClone(data.messages);
}

export function saveMessage(message) {
  return addOrReplace(data.messages, message);
}

export function getBlocks() {
  return structuredClone(data.blocks);
}

export function saveBlock(block) {
  return addOrReplace(data.blocks, block);
}

export function deleteBlock(id) {
  return removeById('blocks', id);
}

// Replaces everything. Only the seed script uses this.
export function replaceDatabase(newData) {
  data = structuredClone(newData);
  return queueWrite();
}

// Memory is updated before the first await, so later requests see the change straight away.
function addOrReplace(collection, item) {
  const index = collection.findIndex((existing) => existing.id === item.id);
  if (index === -1) {
    collection.push(structuredClone(item));
  } else {
    collection[index] = structuredClone(item);
  }
  return queueWrite();
}

function removeById(collectionName, id) {
  data[collectionName] = data[collectionName].filter((item) => item.id !== id);
  return queueWrite();
}

function copyIfFound(item) {
  return item ? structuredClone(item) : null;
}
