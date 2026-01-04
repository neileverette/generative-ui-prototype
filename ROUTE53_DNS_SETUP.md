# Route 53 DNS Setup for dashboard.neil-everette.com

## Step 1: Create A Record in Route 53

1. **Go to Route 53 Console:**
   - Navigate to: https://console.aws.amazon.com/route53/v2/hostedzones
   - Click on your hosted zone: `neil-everette.com`

2. **Create Record:**
   - Click **"Create record"** button
   - Record configuration:
     - **Record name:** `dashboard`
     - **Record type:** `A - Routes traffic to an IPv4 address`
     - **Value:** `52.21.155.13` (your EC2 IP)
     - **TTL:** `300` (5 minutes)
     - **Routing policy:** `Simple routing`
   - Click **"Create records"**

3. **Verify DNS Record:**
   After 1-2 minutes, test DNS propagation:
   ```bash
   # From your local machine
   nslookup dashboard.neil-everette.com
   # Should return: 52.21.155.13

   dig dashboard.neil-everette.com
   # Should show A record pointing to 52.21.155.13
   ```

---

## Step 2: Deploy Dashboard to EC2

### SSH to EC2 Instance:
```bash
ssh -i /path/to/your-key.pem ubuntu@52.21.155.13
```

### Clone Repository:
```bash
cd ~
mkdir -p apps
cd apps
git clone https://github.com/neileverette/generative-ui-prototype.git
cd generative-ui-prototype
```

### Create Environment File:
```bash
nano .env.local
```

Paste your credentials:
```bash
# OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Datadog API credentials
DATADOG_API_KEY=your-key-here
DATADOG_APP_KEY=your-app-key-here
DATADOG_SITE=us5.datadoghq.com

# Optional: LangFlow
LANGFLOW_URL=https://langflow.neil-everette.com
LANGFLOW_API_KEY=your-langflow-key
LANGFLOW_FLOW_ID=your-flow-id
```

Save: `Ctrl+X`, `Y`, `Enter`

Secure the file:
```bash
chmod 600 .env.local
```

### Deploy with Docker:
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
- Build Docker image
- Start container on port 4000
- Show logs and access URL

---

## Step 3: Set Up Nginx Reverse Proxy

### Install Nginx:
```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Create Nginx Configuration:
```bash
sudo nano /etc/nginx/sites-available/dashboard
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name dashboard.neil-everette.com;

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

Save: `Ctrl+X`, `Y`, `Enter`

### Enable Site:
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Test Access:
Open browser: `http://dashboard.neil-everette.com`

---

## Step 4: Add SSL Certificate (HTTPS)

### Install Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Get SSL Certificate:
```bash
sudo certbot --nginx -d dashboard.neil-everette.com
```

Follow prompts:
- Enter email address
- Agree to terms of service
- Choose to redirect HTTP to HTTPS (option 2)

Certbot will:
- Automatically obtain certificate
- Update Nginx configuration
- Enable HTTPS

### Test HTTPS:
Open browser: `https://dashboard.neil-everette.com`

### Auto-Renewal Test:
```bash
# Test renewal process
sudo certbot renew --dry-run
```

Certbot automatically creates a cron job for renewal.

---

## Step 5: Update EC2 Security Group

Ensure your security group allows traffic:

1. **Go to EC2 Console:**
   - Navigate to your instance: `i-040ac6026761030ac`
   - Click on **Security** tab
   - Click on the security group link

2. **Add Inbound Rules:**
   - **HTTP:** Port 80, Source: 0.0.0.0/0
   - **HTTPS:** Port 443, Source: 0.0.0.0/0
   - **Custom TCP:** Port 4000, Source: 0.0.0.0/0 (optional, for direct access)

---

## Quick Reference URLs

After setup, you'll have:
- **Dashboard:** https://dashboard.neil-everette.com
- **LangFlow:** https://langflow.neil-everette.com
- **n8n:** https://n8n.neil-everette.com

---

## Troubleshooting

### DNS not resolving:
```bash
# Check if record exists
nslookup dashboard.neil-everette.com

# If not resolving after 5 minutes, check Route 53 console
```

### Can't access dashboard:
```bash
# Check if Docker container is running
docker ps | grep datadog-dashboard

# Check logs
docker logs datadog-dashboard

# Check if Nginx is running
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate failed:
```bash
# Make sure port 80 is accessible
sudo ufw status

# Make sure DNS is resolving first
nslookup dashboard.neil-everette.com

# Try again
sudo certbot --nginx -d dashboard.neil-everette.com
```

### Container won't start:
```bash
# Check environment variables
cat .env.local

# Check Docker logs
docker logs datadog-dashboard

# Rebuild
docker stop datadog-dashboard
docker rm datadog-dashboard
./deploy.sh
```

---

## Update Deployment

To update your dashboard after making code changes:

```bash
# SSH to EC2
ssh -i /path/to/your-key.pem ubuntu@52.21.155.13

# Navigate to project
cd ~/apps/generative-ui-prototype

# Pull latest changes
git pull origin main

# Redeploy
./deploy.sh
```

---

## Complete Setup Checklist

- [ ] Create A record in Route 53 for `dashboard.neil-everette.com` → `52.21.155.13`
- [ ] Verify DNS resolves with `nslookup dashboard.neil-everette.com`
- [ ] SSH to EC2 instance
- [ ] Clone repository to `~/apps/generative-ui-prototype`
- [ ] Create `.env.local` with API keys
- [ ] Run `./deploy.sh` to build and start container
- [ ] Install Nginx
- [ ] Create Nginx config for `dashboard.neil-everette.com`
- [ ] Test HTTP access: `http://dashboard.neil-everette.com`
- [ ] Install Certbot and get SSL certificate
- [ ] Test HTTPS access: `https://dashboard.neil-everette.com`
- [ ] Verify security group allows ports 80 and 443
- [ ] Test dashboard functionality (System, Containers, Automations)
