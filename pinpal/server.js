// PinPal - entry point
const express = require('express');
const path = require('path');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50kb' }));

// Small request logger (handy while demoing)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toLocaleTimeString()}  ${req.method} ${req.originalUrl}`);
  }
  next();
});

// API routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api', require('./src/routes/users'));
app.use('/api/connections', require('./src/routes/connections'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/demo', require('./src/routes/demo'));

// Unknown API route -> JSON 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const server = app.listen(PORT, () => {
  console.log(`\n  PinPal is running  ->  http://localhost:${PORT}\n`);
});

function shutdown() {
  db.flush();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
