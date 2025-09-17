#!/bin/sh

# Kill any process using port 3000
echo "Checking for processes using port 3000..."
PORT_PID=$(lsof -t -i:3000)
if [ -n "$PORT_PID" ]; then
  echo "Killing process $PORT_PID using port 3000"
  kill -9 $PORT_PID
  sleep 1
fi

# Kill any existing serve processes
echo "Stopping any existing serve processes..."
pkill -f "npx serve" || true

# Clean cache and build artifacts safely
echo "Cleaning cache and build artifacts..."
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf .vite
rm -rf dist

# Only remove specific build artifacts (not source files)
echo "Removing old build artifacts..."
rm -f assets/index-*.js 2>/dev/null || true
rm -f assets/index-*.css 2>/dev/null || true  
rm -f assets/vite-*.svg 2>/dev/null || true
echo "Cache and build artifacts cleaned safely!"

# Ensure we have the development index.html for Vite
echo "Ensuring development index.html exists..."
if [ ! -f "index.html" ]; then
  cp index-dev.html index.html
  echo "Copied index-dev.html to index.html"
fi

# Build project
echo "Building project..."
npm run build

# Copy dist files to root
echo "Copying dist files to root..."
cp -r dist/* .

# Start server
echo "Starting server on port 3000..."
npx serve -s -l 3000
