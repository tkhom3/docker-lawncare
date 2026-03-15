const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const weatherRouter = require('./routes/weather');
const worklogRouter = require('./routes/worklog');
const soiltestRouter = require('./routes/soiltest');
const settingsRouter = require('./routes/settings');
const statusRouter = require('./routes/status');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rate limit all API routes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200 });
app.use('/api/', apiLimiter);

// Optional: separate rate limiter for frontend (non-API) routes
const frontendLimiter = rateLimit({ windowMs: 60 * 1000, limit: 200 });

// Serve static React build
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/weather', weatherRouter);
app.use('/api/worklog', worklogRouter);
app.use('/api/soiltest', soiltestRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/status', statusRouter);

// Catch-all: serve React's index.html for client-side routing
app.get('/*path', frontendLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Lawncare server running on port ${PORT}`);
});
