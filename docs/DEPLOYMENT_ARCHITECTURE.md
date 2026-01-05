# Deployment Tracking Architecture

## Current Architecture (Manual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOCAL DEVELOPMENT                           │
├─────────────────────────────────────────────────────────────────────┤
│  Developer makes changes → git commit → git push → merge to main    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MANUAL DEPLOYMENT                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. SCP files to EC2                                                │
│  2. SSH to EC2                                                      │
│  3. Run ./deploy.sh                                                 │
│  4. Manually create git tag                                         │
│  5. Manually update deployments.json                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EC2 INSTANCE                                │
├─────────────────────────────────────────────────────────────────────┤
│  Docker builds image → Stops old container → Starts new container   │
│  Container: generative-ui (port 4000)                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Data Flow

1. `deployments.json` is a static file in the repo
2. Manually updated after each deployment
3. No link between git tags and deployment records
4. No automated tracking of what's actually running

---

## Proposed Architecture (Automated)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LOCAL DEVELOPMENT                           │
├─────────────────────────────────────────────────────────────────────┤
│  Developer makes changes → git commit → git push → merge to main    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GITHUB ACTIONS CI/CD                           │
├─────────────────────────────────────────────────────────────────────┤
│  Triggered on push to main:                                         │
│  1. Build Docker image                                              │
│  2. Run tests (optional)                                            │
│  3. Create git tag (auto-increment version)                         │
│  4. SSH to EC2 and deploy                                           │
│  5. Update deployment registry                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│        EC2 INSTANCE           │   │    DEPLOYMENT REGISTRY        │
├───────────────────────────────┤   ├───────────────────────────────┤
│  Pull latest code             │   │  Options:                     │
│  Rebuild Docker image         │   │  - GitHub Releases API        │
│  Restart container            │   │  - S3 JSON file               │
│                               │   │  - DynamoDB table             │
│  Container: generative-ui     │   │  - Git tags (current)         │
│  Port: 4000                   │   │                               │
└───────────────────────────────┘   └───────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DASHBOARD UI                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Fetches deployment history from registry                           │
│  Displays: Tag | Name | Date | Summary | Commits                    │
│  Shows currently running version                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Proposed Data Flow

1. Push to main triggers GitHub Actions
2. CI/CD creates versioned git tag automatically
3. Deployment metadata stored in registry (GitHub Releases, S3, or DB)
4. Dashboard fetches live deployment data via API
5. Current running version verified against container metadata

---

## Key Improvements

| Aspect | Current | Proposed |
|--------|---------|----------|
| Deployment trigger | Manual SSH + SCP | Automatic on push to main |
| Version tagging | Manual `git tag` | Auto-increment in CI/CD |
| Deployment history | Static JSON file | Dynamic registry/API |
| Rollback | Manual container swap | One-click via CI/CD |
| Audit trail | Conversation logs | Git tags + GitHub Releases |

---

## Files Involved

### Current
- `src/data/deployments.json` - Static deployment records
- `deploy.sh` - Manual deployment script
- Git tags (`v1.0.0`, `v1.1.0`) - Version markers

### Proposed Additions
- `.github/workflows/deploy.yml` - CI/CD pipeline
- API endpoint or external registry for deployment data
- Environment variable for current version in container

---

## Deployment History

| Tag | Name | Date | Summary |
|-----|------|------|---------|
| `v1.0.0` | Initial Deployment | 2026-01-02T01:30:33Z | Generative UI Dashboard with CopilotKit and Datadog |
| `v1.1.0` | Voice Input Feature | 2026-01-05T18:39:00Z | Voice input with live transcription and MCP integration |
| `v1.1.1` | Layout Responsiveness Fix | 2026-01-06T04:30:00Z | Fix home screen tiles and deployments grid layout |

---

## EC2 Container Layout

| Container | Port | Status | Purpose |
|-----------|------|--------|---------|
| `generative-ui` | 4000 | Live | Current production build |
| `datadog-dashboard-backup` | 8080 | Standby | Rollback backup |

---

## Quick Reference Commands

### Deploy Manually
```bash
# SSH to EC2
ssh -i ~/.ssh/macbook-air-keypair.pem ec2-user@52.21.155.13

# Navigate and deploy
cd ~/apps/generative-ui-prototype
git pull origin main
./deploy.sh
```

### Create Version Tag
```bash
git tag -a v1.x.x -m "Description of release"
git push origin v1.x.x
```

### Rollback to Previous Version
```bash
# On EC2
docker stop generative-ui
docker rm generative-ui
docker run -d --name generative-ui --restart unless-stopped -p 4000:4000 --env-file .env.local <previous-image-id>
```

### View Deployment Tags
```bash
git tag -l --format='%(tag) | %(creatordate:short) | %(subject)'
```
