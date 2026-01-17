# Generative UI Prototype

An agent-driven dashboard demonstrating dynamic UI composition using multi-agent orchestration, Model Context Protocol (MCP), and AI-powered insights.

**Live Demo:** https://dashboard.neil-everette.com

## What We're Building

### The Problem with Traditional Dashboards

Traditional monitoring dashboards are **static**—they show the same pre-configured widgets regardless of context. Users have to know which dashboard to look at and interpret the data themselves.

### Our Approach: Agent-Driven Generative UI

This prototype flips the model: instead of a fixed dashboard, an **AI agent dynamically composes the UI** based on what you ask. The interface is generated, not configured.

**Key differentiators:**

| Traditional Dashboard | Generative UI |
|-----------------------|---------------|
| Static, pre-configured widgets | Dynamically composed based on context |
| User navigates to find data | Agent brings relevant data to user |
| Fixed layout | Priority-based, adaptive layout |
| Manual interpretation | Agent provides AI-powered insights |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                     │
│  ┌─────────────────────────────────┬─────────────────────────────────────┐  │
│  │       Dashboard Canvas          │          Chat Sidebar               │  │
│  │  ┌─────────┐ ┌─────────┐       │                                     │  │
│  │  │ Metric  │ │ Metric  │       │    "Show me system metrics"         │  │
│  │  │  Card   │ │  Card   │       │                                     │  │
│  │  │ + AI    │ │ + AI    │       │    Agent: "Here's your system..."   │  │
│  │  │ Insight │ │ Insight │       │                                     │  │
│  │  └─────────┘ └─────────┘       │    [Voice Input Button]             │  │
│  │  ┌─────────────────────┐       │                                     │  │
│  │  │    Data Table       │       │                                     │  │
│  │  └─────────────────────┘       │                                     │  │
│  └─────────────────────────────────┴─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────┐
│      CopilotKit Runtime       │   │           Express Server               │
│  • 40+ Agent Actions          │   │  • /api/copilotkit (agent runtime)    │
│  • OpenAI GPT-4 Adapter       │   │  • /api/mcp/* (MCP orchestration)     │
│  • A2UI Component Rendering   │   │  • /api/metrics/* (Datadog queries)   │
└───────────────────────────────┘   │  • /api/costs/* (AWS Cost Explorer)   │
                                    └───────────────────────────────────────┘
                                                    │
                    ┌───────────────┬───────────────┼───────────────┐
                    ▼               ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Datadog   │ │  LangFlow   │ │     AWS     │ │     n8n     │
            │     API     │ │   Agent     │ │    Cost     │ │  Workflows  │
            │  (Metrics)  │ │(AI Insights)│ │  Explorer   │ │  (via DD)   │
            └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## Key Features

### 1. Dynamic Dashboard Composition
- **A2UI Specification**: Agents emit declarative JSON that the frontend renders
- **Priority-based Layout**: Critical issues surface first
- **Component Types**: Metric cards, data tables, card groups, alerts, progress bars

### 2. AI-Powered Insights
- **LangFlow Integration**: GPT-4 agent interprets raw metrics
- **Per-Metric Interpretations**: Natural language explanations for each metric
- **Actionable Recommendations**: Suggestions based on system state

### 3. Multi-Source Data Integration
- **Datadog**: System metrics (CPU, memory, disk, network, containers)
- **AWS Cost Explorer**: Current month costs and forecasts by service
- **n8n Workflows**: Automation execution metrics and success rates

### 4. Voice Input
- **Web Speech API**: Speak queries instead of typing
- **Live Transcription**: See your words as you speak
- **Seamless Integration**: Voice input flows directly to chat

### 5. Shortcut Tiles
Quick access to common views:
- System & Infrastructure
- Containers
- Automations (n8n)
- Costs
- Deployments
- Commands

### 6. Modern Visual Design
- **Animated Background**: Orbital blur animations with varied directions
- **Purple Accent Theme**: Status highlights and success states in accent purple
- **IBM Plex Typography**: Professional, readable fonts
- **Staggered Animations**: Smooth 50ms interval component entry

## Data Flow

```
1. USER INPUT
   ├─ Chat: "Show me CPU metrics"
   ├─ Voice: Microphone → Speech-to-Text → Chat
   └─ Click: Shortcut tile (e.g., "System & Infrastructure")

2. AGENT PROCESSING
   ├─ CopilotKit interprets user intent
   ├─ Selects appropriate action (from 40+ available)
   └─ Calls backend endpoints

3. DATA FETCHING (Parallel)
   ├─ /api/metrics/overview/fast → Datadog (CPU, Memory, Disk, etc.)
   ├─ /api/metrics/interpretations → LangFlow (AI insights)
   └─ /api/costs/overview → AWS (billing data)

4. RESPONSE AGGREGATION
   ├─ Raw metrics with status (healthy/warning/critical)
   ├─ AI interpretations per metric
   └─ Formatted for display

5. UI RENDERING
   ├─ A2UI components generated
   ├─ Priority-sorted layout
   ├─ Skeleton loaders while AI insights load
   └─ Staggered animations (50ms intervals)
```

## LangFlow Integration

### Architecture

LangFlow provides AI-powered metric interpretation through a dedicated agent flow:

```
┌─────────────────────────────────────────────────────────────────┐
│                        LangFlow Flow                             │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │  Chat    │───▶│  Agent   │───▶│  OpenAI  │───▶│  Chat    │  │
│   │  Input   │    │  (GPT-4) │    │   API    │    │  Output  │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                         │                                        │
│                         ▼                                        │
│                  Agent Instructions:                             │
│                  "You are a system metrics interpreter..."       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Prompt Configuration

The LangFlow agent uses the following system prompt:

```
You are a system metrics interpreter. You receive JSON data about server
metrics and provide brief, natural language interpretations.

For each metric, provide:
1. A one-sentence interpretation of what the value means
2. Whether it indicates healthy, warning, or critical status

Keep responses concise - one short paragraph per metric. Focus on actionable insights.

Example input: {"cpu_usage": 45, "memory_usage": 78, "disk_usage": 23}
Example output: CPU usage at 45% is healthy with plenty of headroom. Memory at 78%
is elevated but acceptable - consider monitoring if it trends higher. Disk usage
at 23% is excellent with ample storage available.
```

### API Integration

The backend calls LangFlow via REST API:

```typescript
// server/index.ts
const response = await fetch(
  `${LANGFLOW_URL}/api/v1/run/${LANGFLOW_FLOW_ID}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LANGFLOW_API_KEY,
    },
    body: JSON.stringify({
      input_value: query,
      output_type: 'chat',
      input_type: 'chat',
    }),
  }
);
```

### Environment Configuration

```env
LANGFLOW_URL=https://langflow.neil-everette.com
LANGFLOW_FLOW_ID=f1f52570-34af-4303-90b0-1315d0afee03
LANGFLOW_API_KEY=sk-...
```

## Project Structure

```
generative-ui-prototype/
├── src/                              # Frontend (React + TypeScript)
│   ├── App.tsx                       # Main app with CopilotKit + 40+ actions
│   ├── components/
│   │   ├── DashboardCanvas.tsx       # A2UI component renderer
│   │   ├── a2ui/                     # A2UI implementations
│   │   │   ├── MetricCard.tsx        # Metric display with AI insights
│   │   │   ├── CardGroup.tsx         # Grouped metrics
│   │   │   ├── DataTable.tsx         # Tabular data
│   │   │   ├── AlertList.tsx         # Alert displays
│   │   │   ├── StatusIndicator.tsx   # Status badges
│   │   │   └── ProgressBar.tsx       # Utilization bars
│   │   ├── carbon/                   # Carbon Design System components
│   │   │   └── CarbonMetricCard.tsx  # Carbon-styled metric card
│   │   ├── VoiceButton.tsx           # Voice input trigger
│   │   ├── VoiceOverlay.tsx          # Transcription display
│   │   └── BlurBackground.tsx        # Visual background (orbit animations)
│   ├── services/
│   │   └── mcp-client.ts             # MCP client for API calls
│   ├── hooks/
│   │   └── useVoiceDictation.ts      # Web Speech API hook
│   ├── types/
│   │   ├── a2ui.ts                   # A2UI component definitions
│   │   ├── datadog.ts                # Datadog types
│   │   └── costs.ts                  # AWS cost types
│   └── data/
│       └── deployments.json          # Deployment history
│
├── server/                           # Backend (Express + TypeScript)
│   ├── index.ts                      # All API endpoints
│   ├── mcp-registry.ts               # MCP orchestration layer
│   ├── mcp-server.ts                 # MCP server implementation
│   ├── metrics-config.ts             # Centralized metric definitions
│   └── mcp-servers.config.json       # MCP server configs
│
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions CI/CD
│
├── Configuration
│   ├── package.json                  # Dependencies
│   ├── vite.config.ts                # Vite build config
│   ├── tailwind.config.js            # Tailwind theme
│   ├── tsconfig.json                 # TypeScript config
│   ├── Dockerfile                    # Container build
│   └── nginx.conf                    # Static file serving
│
└── Documentation
    ├── README.md                     # This file
    ├── DEPLOYMENT.md                 # Deployment guide
    ├── LANGFLOW_CONNECTION_GUIDE.md  # LangFlow setup
    ├── MCP_DEMO.md                   # MCP demonstration guide
    ├── ROUTE53_DNS_SETUP.md          # DNS configuration
    └── docs/
        ├── DEPLOYMENT_ARCHITECTURE.md    # Infrastructure overview
        ├── LANGFLOW_DATADOG_AGENT_PLAN.md
        ├── LANGFLOW_DATADOG_AGENT_README.md
        ├── LANGFLOW_SETUP_GUIDE.md
        └── ci-cd-pipeline.md             # CI/CD documentation
```

## A2UI Component Specification

The Agent-to-UI (A2UI) spec defines how agents emit UI components:

### Component Types

| Component | Description | Props |
|-----------|-------------|-------|
| `metric_card` | Single KPI with AI insight | title, value, unit, status, interpretation, actionableInsights |
| `card_group` | Clustered related metrics | title, subtitle, metrics[], insight |
| `data_table` | Tabular data | columns[], rows[] |
| `alert_list` | Active alerts | alerts[] with severity, message, timestamp |
| `status_indicator` | Simple status | label, status, message |
| `progress_bar` | Utilization bar | label, value, max, status |

### Priority System

Components sorted for display relevance:
- `critical` (weight: 0) - Immediate attention required
- `high` (weight: 1) - Warning state
- `medium` (weight: 2) - Normal metrics
- `low` (weight: 3) - Supporting info

### Example A2UI Output

```json
{
  "id": "system-metric-cpu_total",
  "component": "metric_card",
  "source": "datadog",
  "priority": "high",
  "props": {
    "title": "CPU Usage",
    "value": 67.5,
    "unit": "%",
    "status": "warning",
    "interpretation": "CPU usage is elevated, indicating moderate system load",
    "actionableInsights": ["Consider investigating background processes"]
  }
}
```

## Setup

### Prerequisites

- Node.js 18+
- Datadog account with API access
- OpenAI API key
- LangFlow instance (optional, for AI insights)
- AWS account (optional, for cost data)

### Installation

```bash
# Clone the repository
git clone https://github.com/neileverette/generative-ui-prototype.git
cd generative-ui-prototype

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

```env
# Required
OPENAI_API_KEY=sk-proj-...
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=us5.datadoghq.com

# LangFlow (for AI insights)
LANGFLOW_URL=https://langflow.your-domain.com
LANGFLOW_FLOW_ID=your-flow-id
LANGFLOW_API_KEY=sk-...

# AWS (for cost data)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Server
PORT=4000
```

### Running Locally

```bash
# Start both client and server
npm run dev

# Or run separately:
npm run dev:client  # Vite on :3000
npm run dev:server  # Express on :4000
```

Open http://localhost:3000

## Usage Examples

### Chat Prompts

- "Show me a system overview"
- "What's my CPU usage?"
- "Are there any critical issues?"
- "How many containers are running?"
- "Show me AWS costs this month"
- "What's the status of my n8n workflows?"

### Voice Input

Click the microphone button and speak your query. The system will transcribe and process it automatically.

### Shortcut Tiles

Click any tile on the home screen for quick access:
- **System & Infrastructure**: CPU, memory, disk, network, uptime
- **Containers**: Running container count and metrics
- **Automations**: n8n workflow success rates
- **Costs**: AWS monthly spend and forecasts
- **Deployments**: Recent deployment history with GitHub Actions trigger tracking
- **Commands**: Common query shortcuts

## Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** - Build tool
- **Tailwind CSS** - Styling (IBM Plex fonts, observability-inspired theme)
- **Carbon Design System** - IBM's design system for enterprise UI components
- **CopilotKit** - AI agent runtime
- **Recharts** - Data visualization
- **Lucide React** + **Carbon Icons** - Icons

### Backend
- **Express.js** - API server
- **TypeScript** - Type safety
- **MCP SDK** - Model Context Protocol

### AI/ML
- **OpenAI GPT-4** - Agent reasoning
- **LangFlow** - AI insight generation

### Data Sources
- **Datadog API** - Infrastructure metrics
- **AWS Cost Explorer** - Cloud costs
- **n8n** - Workflow metrics (via Datadog custom tags)

### Infrastructure
- **Docker** - Containerization
- **Amazon ECR** - Container registry
- **Amazon EC2** - Compute
- **nginx** - Reverse proxy
- **GitHub Actions** - CI/CD

## CI/CD Pipeline

### GitHub Actions Workflow

The project uses automated deployment via GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy to EC2

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # 1. Checkout code
      - uses: actions/checkout@v4

      # 2. Configure AWS credentials
      - uses: aws-actions/configure-aws-credentials@v4

      # 3. Login to Amazon ECR
      - uses: aws-actions/amazon-ecr-login@v2

      # 4. Build and push Docker image
      - run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      # 5. SSH to EC2 and deploy
      - run: |
          ssh ec2-user@$HOST << 'ENDSSH'
            # Pull latest image
            docker pull $ECR_IMAGE:latest

            # Stop and remove old container
            docker stop generative-ui || true
            docker rm generative-ui || true

            # Run new container with env file
            docker run -d \
              --name generative-ui \
              --restart unless-stopped \
              -p 4000:4000 \
              --env-file /home/ec2-user/apps/generative-ui-prototype/.env.local \
              $ECR_IMAGE:latest
          ENDSSH
```

### Pipeline Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Push to   │───▶│   Build     │───▶│   Push to   │───▶│  Deploy to  │
│    main     │    │   Docker    │    │    ECR      │    │    EC2      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │   Live at   │
                                                         │ dashboard.  │
                                                         │neil-everette│
                                                         │    .com     │
                                                         └─────────────┘
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_REGION` | AWS region (e.g., us-east-1) |
| `ECR_REPOSITORY` | ECR repository name |
| `EC2_SSH_KEY` | SSH private key for EC2 |
| `EC2_HOST` | EC2 public IP or hostname |
| `EC2_USER` | EC2 username (e.g., ec2-user) |

### Server Environment

The EC2 instance reads environment variables from:
```
/home/ec2-user/apps/generative-ui-prototype/.env.local
```

**Important**: When updating env vars, you must recreate the container (not just restart) because Docker `--env-file` is read at container creation time.

## Roadmap

- [x] CopilotKit client agent with A2UI rendering
- [x] Direct Datadog API integration
- [x] LangFlow AI agent for metric interpretation
- [x] AWS Cost Explorer integration
- [x] n8n workflow metrics
- [x] Voice input support
- [x] GitHub Actions CI/CD pipeline
- [x] Docker containerization
- [x] Deployment tracking with trigger history
- [x] Carbon Design System integration
- [x] Animated visual design (orbit backgrounds, purple accents)
- [ ] Additional backend agents (PagerDuty, Slack, etc.)
- [ ] Historical trend analysis
- [ ] Custom alerting rules
- [ ] Multi-tenant support

## License

MIT
