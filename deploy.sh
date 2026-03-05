#!/bin/bash
set -e

SERVER="olakay@72.60.215.142"
SSH_KEY="$HOME/.ssh/id_ed25519_server"
REMOTE_DIR="/home/olakay/xbanka-backend"

echo "🚀 Deploying xbanka-backend to $SERVER..."

# Create remote directory just in case it doesn't exist
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "mkdir -p $REMOTE_DIR"

Server="$SERVER"

# Sync files to the server
echo "📂 Syncing files to server..."
rsync -avz --exclude='node_modules' --exclude='dist' --exclude='.git' -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" ./ $SERVER:$REMOTE_DIR/

# Override DATABASE_URL for the server environment (path must be valid inside the container)
echo "🔧 Configuring server .env..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "
  sed -i 's|DATABASE_URL=.*|DATABASE_URL=\"file:/app/data/prod.db\"|g' $REMOTE_DIR/.env
  mkdir -p /home/olakay/xbanka-data
"

# SSH in and run Docker Compose
echo "🐳 Building and starting Docker containers..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "cd $REMOTE_DIR && docker compose build && docker compose up -d && docker image prune -f"

echo "⏳ Waiting for services to start..."
sleep 5

# Run Prisma db push to apply schema changes
echo "📦 Applying database schema..."
# Try auth-service first, if it's down try gateway
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "
  if docker ps | grep -q xbanka-auth; then
    docker exec xbanka-auth npx prisma db push --schema=libs/database/prisma/schema.prisma --accept-data-loss || true
  elif docker ps | grep -q xbanka-gateway; then
    docker exec xbanka-gateway npx prisma db push --schema=libs/database/prisma/schema.prisma --accept-data-loss || true
  fi
"

echo "✅ Deployment complete! Checking container status:"
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "cd $REMOTE_DIR && docker compose ps"
