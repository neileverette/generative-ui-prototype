# EC2 Docker Deployment Guide

## Prerequisites Checklist

- [ ] EC2 instance running (Ubuntu/Amazon Linux recommended)
- [ ] SSH access to EC2 instance
- [ ] Security group allows ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- [ ] Git installed on EC2
- [ ] Your GitHub repo is up to date with latest code

## Environment Variables Needed

You'll need these values from your local `.env.local`:
- `OPENAI_API_KEY`
- `DATADOG_API_KEY`
- `DATADOG_APP_KEY`
- `DATADOG_SITE` (default: us5.datadoghq.com)
- Optional: `LANGFLOW_URL`, `LANGFLOW_API_KEY`, `LANGFLOW_FLOW_ID`

---

## Step 1: Connect to EC2 Instance

```bash
# Replace with your EC2 details
ssh -i /path/to/your-key.pem ubuntu@your-ec2-ip
```

---

## Step 2: Install Docker & Docker Compose

### For Ubuntu/Debian:
```bash
# Update package index
sudo apt update

# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group (avoid sudo)
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Verify installation
docker --version
docker compose version
```

### For Amazon Linux 2023:
```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

---

## Step 3: Clone Repository

```bash
# Create app directory
cd ~
mkdir -p apps
cd apps

# Clone your repo (replace with your actual repo URL)
git clone https://github.com/neileverette/generative-ui-prototype.git
cd generative-ui-prototype
```

---

## Step 4: Create Production Environment File

```bash
# Create .env.local file
nano .env.local
```

Paste your environment variables:
```bash
# OpenAI API Key (for CopilotKit)
OPENAI_API_KEY=sk-proj-...

# Datadog API credentials
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=us5.datadoghq.com

# Optional: LangFlow configuration
LANGFLOW_URL=https://langflow.neil-everette.com
LANGFLOW_API_KEY=your-langflow-key
LANGFLOW_FLOW_ID=your-flow-id
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

Secure the file:
```bash
chmod 600 .env.local
```

---

## Step 5: Build Docker Image

```bash
# Build the image (takes 2-5 minutes)
docker build -t datadog-dashboard:latest .

# Verify image was created
docker images | grep datadog-dashboard
```

---

## Step 6: Run Docker Container

### Option A: Simple Run (Testing)
```bash
# Run container on port 4000
docker run -d \
  --name datadog-dashboard \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file .env.local \
  datadog-dashboard:latest

# Check if container is running
docker ps

# View logs
docker logs datadog-dashboard

# Follow logs in real-time
docker logs -f datadog-dashboard
```

### Option B: Docker Compose (Recommended for Production)

Create `docker-compose.prod.yml`:
```bash
nano docker-compose.prod.yml
```

Paste this content:
```yaml
version: '3.8'

services:
  dashboard:
    build: .
    container_name: datadog-dashboard
    restart: unless-stopped
    ports:
      - "4000:4000"
    env_file:
      - .env.local
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:4000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Run with Docker Compose:
```bash
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down

# Restart
docker compose -f docker-compose.prod.yml restart
```

---

## Step 7: Test the Deployment

```bash
# Test from EC2 instance
curl http://localhost:4000

# Check if you get HTML response
curl -I http://localhost:4000

# From your local machine (replace with EC2 IP)
curl http://YOUR_EC2_IP:4000
```

Open browser and navigate to: `http://YOUR_EC2_IP:4000`

---

## Step 8: Install Nginx Reverse Proxy (Optional but Recommended)

This allows you to:
- Use port 80/443 instead of 4000
- Add SSL certificate
- Better security and performance

### Install Nginx:
```bash
# Ubuntu/Debian
sudo apt install -y nginx

# Amazon Linux
sudo yum install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/datadog-dashboard
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Increase timeouts for AI requests
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/datadog-dashboard /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

Now access via: `http://YOUR_EC2_IP` (port 80)

---

## Step 9: Add SSL Certificate (HTTPS)

### Install Certbot:
```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# Amazon Linux
sudo yum install -y certbot python3-certbot-nginx
```

### Get Certificate:
```bash
# Make sure you have a domain pointing to your EC2 IP first!
sudo certbot --nginx -d your-domain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (recommended)
```

### Auto-renewal:
```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Certbot automatically creates a cron job for renewal
```

Now access via: `https://your-domain.com`

---

## Step 10: Update and Redeploy

When you make code changes:

```bash
# SSH to EC2
ssh -i /path/to/your-key.pem ubuntu@your-ec2-ip

cd ~/apps/generative-ui-prototype

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# Or with simple docker run:
docker stop datadog-dashboard
docker rm datadog-dashboard
docker build -t datadog-dashboard:latest .
docker run -d \
  --name datadog-dashboard \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file .env.local \
  datadog-dashboard:latest
```

---

## Useful Docker Commands

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs datadog-dashboard
docker logs -f datadog-dashboard  # Follow logs

# Restart container
docker restart datadog-dashboard

# Stop container
docker stop datadog-dashboard

# Remove container
docker rm datadog-dashboard

# Remove image
docker rmi datadog-dashboard:latest

# Execute command in container
docker exec -it datadog-dashboard sh

# View container resource usage
docker stats datadog-dashboard

# Inspect container
docker inspect datadog-dashboard
```

---

## Troubleshooting

### Container won't start:
```bash
# Check logs
docker logs datadog-dashboard

# Common issues:
# - Missing environment variables
# - Port 4000 already in use
# - Invalid .env.local file
```

### Can't access from browser:
```bash
# Check security group in AWS Console:
# - Inbound rule for port 80 (HTTP): 0.0.0.0/0
# - Inbound rule for port 443 (HTTPS): 0.0.0.0/0
# - Inbound rule for port 4000: 0.0.0.0/0 (if not using Nginx)

# Check if port is listening
sudo netstat -tlnp | grep 4000
sudo netstat -tlnp | grep 80
```

### Environment variables not loading:
```bash
# Check if .env.local exists
ls -la .env.local

# Check file permissions
chmod 600 .env.local

# Verify variables in container
docker exec datadog-dashboard env | grep DATADOG
```

### Out of disk space:
```bash
# Clean up old images and containers
docker system prune -a

# Check disk usage
df -h
docker system df
```

---

## Security Best Practices

1. **Firewall Configuration:**
```bash
# Install UFW (Ubuntu)
sudo apt install -y ufw

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

2. **Keep .env.local secure:**
```bash
# Never commit to git
echo ".env.local" >> .gitignore

# Restrict permissions
chmod 600 .env.local
```

3. **Regular updates:**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker pull node:20-alpine
```

---

## Monitoring

### View Dashboard Logs:
```bash
docker logs -f --tail 100 datadog-dashboard
```

### Monitor Container Health:
```bash
docker stats datadog-dashboard
```

### Set up Log Rotation:
Already configured in docker-compose.prod.yml with:
- Max log size: 10MB
- Max log files: 3

---

## Backup Strategy

### Backup Configuration:
```bash
# Backup .env.local
cp .env.local .env.local.backup

# Backup entire app directory
tar -czf ~/datadog-dashboard-backup-$(date +%Y%m%d).tar.gz ~/apps/generative-ui-prototype
```

### AWS Snapshots:
- Create AMI snapshot in AWS Console
- Schedule automated snapshots via AWS Backup

---

## Quick Reference

**Start:** `docker compose -f docker-compose.prod.yml up -d`
**Stop:** `docker compose -f docker-compose.prod.yml down`
**Logs:** `docker compose -f docker-compose.prod.yml logs -f`
**Restart:** `docker compose -f docker-compose.prod.yml restart`
**Update:** `git pull && docker compose -f docker-compose.prod.yml up -d --build`

---

## Next Steps After Deployment

1. ✅ Verify dashboard loads in browser
2. ✅ Test "System Infrastructure" button
3. ✅ Test "Docker Containers" button
4. ✅ Test "Automations" button
5. ✅ Verify Datadog metrics display correctly
6. ✅ Test chat functionality with CopilotKit
7. ✅ Set up SSL certificate with Let's Encrypt
8. ✅ Configure custom domain (if desired)
9. ✅ Set up monitoring alerts in Datadog
10. ✅ Document EC2 IP/domain for team access
