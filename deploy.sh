#!/bin/bash
set -e

SERVER="olakay@72.60.215.142"
SSH_KEY="$HOME/.ssh/id_ed25519_server"
REMOTE_DIR="/home/olakay/xbanka-backend"

echo "🚀 Deploying xbanka-backend to $SERVER..."

# Create remote directory just in case it doesn't exist
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "mkdir -p $REMOTE_DIR"

# Sync files to the server
echo "📂 Syncing files to server..."
rsync -avz --exclude='node_modules' --exclude='dist' --exclude='.git' -e "ssh -o StrictHostKeyChecking=no -i $SSH_KEY" ./ $SERVER:$REMOTE_DIR/

# SSH in and run Docker Compose
echo "🐳 Building and starting Docker containers..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "cd $REMOTE_DIR && docker compose build && docker compose up -d && docker image prune -f"

echo "✅ Deployment complete! Checking container status:"
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $SERVER "cd $REMOTE_DIR && docker compose ps"
