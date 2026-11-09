// Entry point: creates the Express app, connects the middleware and routes, and starts listening.
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import { loadDb } from './src/db.js';
import { requireAuth } from './src/middleware/auth.js';
import authRoutes from './src/routes/auth.js';
import blockRoutes from './src/routes/blocks.js';
import connectionRoutes from './src/routes/connections.js';
import locationRoutes from './src/routes/location.js';
import messageRoutes from './src/routes/messages.js';
import nearbyRoutes from './src/routes/nearby.js';
import userRoutes from './src/routes/users.js';
import { setUpSocket } from './src/socket.js';

dotenv.config({ quiet: true });

const PORT = process.env.PORT || 3000;
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  // A fresh clone has no .env file, and the app should still start.
  // Sessions live in memory and end on restart anyway, so a temporary secret loses nothing.
  console.warn('SESSION_SECRET is not set, so a temporary one was generated. Add it to .env.');
  return crypto.randomBytes(32).toString('hex');
}

const app = express();
app.disable('x-powered-by');

// Kept in a variable because the socket server needs the same sessions as Express.
const sessionMiddleware = session({
  name: 'pinpal.sid',
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Page scripts can't read the cookie, so XSS can't steal it.
    sameSite: 'lax', // Other sites can't send logged-in POST requests.
    maxAge: SEVEN_DAYS_IN_MS,
  },
});

app.use(express.json({ limit: '10kb' }));
app.use(sessionMiddleware);

app.use(express.static(path.join(import.meta.dirname, 'public')));

// Signup and login are public, so this router is mounted before requireAuth.
app.use('/api/auth', authRoutes);

// Every API route added below this line needs a logged-in user.
app.use('/api', requireAuth);
app.use('/api/users', userRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/nearby', nearbyRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/blocks', blockRoutes);

// Unknown API paths return JSON, because the frontend expects JSON from /api.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express sends any thrown error here. Four arguments mark this as an error handler.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request body is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

loadDb();

// Socket.IO attaches to a plain HTTP server, so Express runs inside one rather than listening itself.
const httpServer = createServer(app);
setUpSocket(httpServer, sessionMiddleware);

httpServer.listen(PORT, () => {
  console.log(`PinPal is running at http://localhost:${PORT}`);
});
