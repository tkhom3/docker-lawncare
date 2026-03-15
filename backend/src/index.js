const express = require('express');
const cors = require('cors');
const path = require('path');
const { scheduleBackups } = require('./backup');

const weatherRouter = require('./routes/weather');
const worklogRouter = require('./routes/worklog');
const soiltestRouter = require('./routes/soiltest');
const settingsRouter = require('./routes/settings');
const statusRouter = require('./routes/status');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory rate limiter
const createRateLimiter = (windowMs = 60 * 1000, limit = 200) => {
  const requests = new Map();
  
  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime <= now) {
        requests.delete(ip);
      }
    }
  }, 60000);
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, { count: 0, resetTime: now + windowMs });
    }
    
    const data = requests.get(ip);
    
    // Reset window if expired
    if (now >= data.resetTime) {
      data.count = 0;
      data.resetTime = now + windowMs;
    }
    
    data.count++;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - data.count));
    res.setHeader('X-RateLimit-Reset', data.resetTime);
    
    if (data.count > limit) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
    
    next();
  };
};

app.use(cors());
app.use(express.json());

// Rate limit all API routes
const apiLimiter = createRateLimiter(60 * 1000, 200);
app.use('/api/', apiLimiter);

// Rate limiter for frontend routes
const frontendLimiter = createRateLimiter(60 * 1000, 200);

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

scheduleBackups();

app.listen(PORT, () => {
  console.log(`Lawncare server running on port ${PORT}`);
});
