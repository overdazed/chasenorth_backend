#!/bin/bash

# Production dependencies only (no dev dependencies like nodemon)
npm ci --only=production

# Set production environment
export NODE_ENV=production

# Start the server
node server.js