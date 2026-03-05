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
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "
  # Source .env to get variables for Prisma
  cd $REMOTE_DIR
  DATABASE_URL=\$(grep DATABASE_URL .env | cut -d '\"' -f 2)
  if docker ps | grep -q xbanka-auth; then
    docker exec -e DATABASE_URL=\"\$DATABASE_URL\" xbanka-auth npx prisma db push --schema=libs/database/prisma/schema.prisma --config=libs/database/prisma.config.ts --accept-data-loss
  elif docker ps | grep -q xbanka-gateway; then
    docker exec -e DATABASE_URL=\"\$DATABASE_URL\" xbanka-gateway npx prisma db push --schema=libs/database/prisma/schema.prisma --config=libs/database/prisma.config.ts --accept-data-loss
  fi
"

echo "✅ Deployment complete! Checking container status:"
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "cd $REMOTE_DIR && docker compose ps"
