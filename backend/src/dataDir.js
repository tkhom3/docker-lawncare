const path = require('path');

// Single source of truth for the data directory so every module agrees on it.
// Default is <app root>/data (/app/data in the container), matching collector.py.
module.exports = process.env.DATA_DIR || path.join(__dirname, '../data');
