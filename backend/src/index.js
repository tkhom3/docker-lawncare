const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { scheduleBackups } = require('./backup');

const weatherRouter = require('./routes/weather');
const worklogRouter = require('./routes/worklog');
const soiltestRouter = require('./routes/soiltest');
const settingsRouter = require('./routes/settings');
const statusRouter = require('./routes/status');
const plannedWorkRouter = require('./routes/plannedwork');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.removeHeader('X-Powered-By');
  next();
});

app.use(express.json());

// Rate limit all API routes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200 });
app.use('/api/', apiLimiter);

// Rate limiter for frontend routes
const frontendLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200 });

// Serve static React build
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/weather', weatherRouter);
app.use('/api/worklog', worklogRouter);
app.use('/api/soiltest', soiltestRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/status', statusRouter);
app.use('/api/planned-work', plannedWorkRouter);

// Catch-all: serve React's index.html for client-side routing
app.get('/*path', frontendLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

scheduleBackups();

app.listen(PORT, () => {
  console.log(`Lawncare server running on port ${PORT}`);
});
