// Simple in-memory rate limits. They reset when the server restarts, which is fine for one server.

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
const ONE_MINUTE_IN_MS = 60 * 1000;
const MAX_FAILED_LOGINS = 5;

// IP address -> { count, windowEndsAt }
const failedLogins = new Map();
// User id -> the time their next location update is allowed
const nextLocationUpdate = new Map();

function minutesUntil(time) {
  return Math.ceil((time - Date.now()) / ONE_MINUTE_IN_MS);
}

function secondsUntil(time) {
  return Math.ceil((time - Date.now()) / 1000);
}

// Stops someone guessing passwords. Only failed attempts count.
export function limitFailedLogins(req, res, next) {
  const record = failedLogins.get(req.ip);
  const isLocked = record && record.windowEndsAt > Date.now() && record.count >= MAX_FAILED_LOGINS;
  if (isLocked) {
    const minutes = minutesUntil(record.windowEndsAt);
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${minutes} min.` });
  }
  next();
}

// A successful login deliberately doesn't reset the count. Otherwise an attacker with their own
// account could log in after every 4 guesses and never reach the limit.
export function recordFailedLogin(ip) {
  const record = failedLogins.get(ip);
  if (record && record.windowEndsAt > Date.now()) {
    record.count += 1;
  } else {
    failedLogins.set(ip, { count: 1, windowEndsAt: Date.now() + TEN_MINUTES_IN_MS });
  }
}

// Without a limit, someone could send many fake positions and compare the distances they get back
// to work out where another user really is. One update a minute makes that very slow.
export function limitLocationUpdates(req, res, next) {
  const allowedAt = nextLocationUpdate.get(req.user.id);
  if (allowedAt && allowedAt > Date.now()) {
    const seconds = secondsUntil(allowedAt);
    return res.status(429).json({ error: `You just shared your location. Try again in ${seconds} seconds.` });
  }
  nextLocationUpdate.set(req.user.id, Date.now() + ONE_MINUTE_IN_MS);
  next();
}

// Removes expired records so these maps don't keep growing while the server runs.
function removeExpiredRecords() {
  const now = Date.now();
  for (const [ip, record] of failedLogins) {
    if (record.windowEndsAt <= now) {
      failedLogins.delete(ip);
    }
  }
  for (const [userId, allowedAt] of nextLocationUpdate) {
    if (allowedAt <= now) {
      nextLocationUpdate.delete(userId);
    }
  }
}

// unref() means this timer alone won't keep a stopped program running.
setInterval(removeExpiredRecords, TEN_MINUTES_IN_MS).unref();
