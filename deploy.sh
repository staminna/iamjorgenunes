#!/bin/sh

echo "🚀 Starting production deployment..."

# Stop existing PM2 process
echo "Stopping existing PM2 process..."
pm2 stop iamjorgenunes-com 2>/dev/null || true
pm2 delete iamjorgenunes-com 2>/dev/null || true

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

# Create clean development index.html for Vite
echo "Creating clean development index.html..."
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>iamjorgenunes.com - Jorge Domingues Nunes</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF
echo "Created clean development index.html"

# Build project
echo "Building project for production..."
npm run build

# Copy dist files to root
echo "Copying dist files to root..."
cp -r dist/* .

# Create logs directory
mkdir -p logs

# Start with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Show status
pm2 status

echo "✅ Production deployment complete!"
echo "🌐 Application running at: http://localhost:3000"
echo "📊 Monitor with: pm2 monit"
echo "📋 View logs with: pm2 logs iamjorgenunes-com"
