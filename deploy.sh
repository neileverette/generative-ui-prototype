#!/bin/bash

# Datadog Dashboard - Quick Deploy Script for EC2
# Usage: ./deploy.sh

set -e

echo "🚀 Starting Datadog Dashboard Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ Error: .env.local file not found!${NC}"
    echo "Please create .env.local with your environment variables."
    echo "See .env.example for reference."
    exit 1
fi

# Check required environment variables
echo "📋 Checking environment variables..."
required_vars=("OPENAI_API_KEY" "DATADOG_API_KEY" "DATADOG_APP_KEY")
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env.local; then
        echo -e "${RED}❌ Missing required variable: ${var}${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Environment variables OK${NC}"

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t datadog-dashboard:latest .
echo -e "${GREEN}✅ Image built successfully${NC}"

# Stop and remove existing container if running
if docker ps -a --format '{{.Names}}' | grep -q '^datadog-dashboard$'; then
    echo "🛑 Stopping existing container..."
    docker stop datadog-dashboard
    docker rm datadog-dashboard
fi

# Run new container
echo "🏃 Starting new container..."
docker run -d \
  --name datadog-dashboard \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file .env.local \
  datadog-dashboard:latest

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q '^datadog-dashboard$'; then
    echo -e "${GREEN}✅ Container is running!${NC}"

    # Get container logs
    echo ""
    echo "📝 Recent logs:"
    docker logs --tail 20 datadog-dashboard

    echo ""
    echo -e "${GREEN}🎉 Deployment successful!${NC}"
    echo ""
    echo "Access your dashboard at:"
    echo "  - http://localhost:4000 (from this server)"
    echo "  - http://$(curl -s http://checkip.amazonaws.com):4000 (from browser)"
    echo ""
    echo "Useful commands:"
    echo "  View logs:    docker logs -f datadog-dashboard"
    echo "  Restart:      docker restart datadog-dashboard"
    echo "  Stop:         docker stop datadog-dashboard"
    echo "  Remove:       docker rm datadog-dashboard"
else
    echo -e "${RED}❌ Container failed to start!${NC}"
    echo "Check logs with: docker logs datadog-dashboard"
    exit 1
fi
