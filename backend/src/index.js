const express = require('express');
const cors = require('cors');
const path = require('path');

const weatherRouter = require('./routes/weather');
const worklogRouter = require('./routes/worklog');
const settingsRouter = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static React build
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/weather', weatherRouter);
app.use('/api/worklog', worklogRouter);
app.use('/api/settings', settingsRouter);

// Catch-all: serve React's index.html for client-side routing
app.get('/*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Lawncare server running on port ${PORT}`);
});
