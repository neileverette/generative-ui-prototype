# Generative UI Prototype

An agent-driven dashboard prototype demonstrating dynamic UI composition based on real-time observability data from Datadog.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│  ┌─────────────────────────────┬─────────────────────────────┐  │
│  │      Dashboard Canvas       │        Chat Sidebar          │  │
│  │  ┌───────┐ ┌───────┐       │                               │  │
│  │  │Metric │ │Metric │       │    "Show me CPU metrics"      │  │
│  │  │ Card  │ │ Card  │       │                               │  │
│  │  └───────┘ └───────┘       │    Agent: "Here's your..."    │  │
│  │  ┌─────────────────┐       │                               │  │
│  │  │  Time Series    │       │                               │  │
│  │  │    Chart        │       │                               │  │
│  │  └─────────────────┘       │                               │  │
│  └─────────────────────────────┴─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CopilotKit Runtime                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Agent Actions                          │    │
│  │  • fetchMetrics(metrics[], timeRange)                   │    │
│  │  • getSystemOverview()                                   │    │
│  │  • renderDashboard(components[])                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Datadog API                                │
│  • system.cpu.user / system.cpu.system                          │
│  • system.mem.usable / system.mem.total                         │
│  • docker.containers.running                                     │
│  • system.load.1/5/15                                            │
│  • system.disk.in_use                                            │
│  • system.net.bytes_rcvd / bytes_sent                           │
└─────────────────────────────────────────────────────────────────┘
```

## A2UI Specification

The Agent-to-UI (A2UI) specification defines a declarative JSON schema for UI components that agents can emit. The frontend runtime interprets these definitions and renders appropriate components.

### Component Types

| Component | Description | Use Case |
|-----------|-------------|----------|
| `metric_card` | Single value with status indicator | Current CPU %, Memory usage |
| `time_series_chart` | Line/area chart over time | CPU trend, Network I/O |
| `data_table` | Tabular data display | Container list, Top processes |
| `alert_list` | Active alerts/incidents | System warnings |
| `status_indicator` | Simple status display | Service health |
| `progress_bar` | Utilization bar | Disk usage, Memory |

### Priority System

Components are sorted by priority for display:
- `critical` (weight: 0) - Requires immediate attention
- `high` (weight: 1) - Warning state or concerning trends
- `medium` (weight: 2) - Normal important metrics
- `low` (weight: 3) - Supporting information

## Setup

### Prerequisites

- Node.js 18+
- Datadog account with API access
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd generative-ui-prototype

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

Edit `.env.local` with your credentials:

```env
# OpenAI API Key (for CopilotKit)
OPENAI_API_KEY=sk-...

# Datadog API credentials
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
DATADOG_SITE=us5.datadoghq.com
```

**Finding your Datadog keys:**
1. Go to https://us5.datadoghq.com/organization-settings/api-keys
2. Create or copy your API Key
3. Go to Application Keys and create one for this app

### Running Locally

```bash
# Start both client and server
npm run dev

# Or run separately:
npm run dev:client  # Vite dev server on :3000
npm run dev:server  # Express server on :4000
```

Open http://localhost:3000

## Usage

### Example Prompts

- "Show me a system overview"
- "What's my CPU usage?"
- "Show me memory and load metrics for the last hour"
- "Are there any critical issues?"
- "Display network throughput"
- "How many containers are running?"

### How It Works

1. **User asks a question** in the chat sidebar
2. **Agent interprets** the request and calls appropriate tools
3. **Datadog tools** fetch real metrics from your infrastructure
4. **Agent generates A2UI JSON** defining which components to show
5. **Frontend renders** the components in priority order on the canvas

## Project Structure

```
generative-ui-prototype/
├── src/
│   ├── components/
│   │   ├── a2ui/           # A2UI component implementations
│   │   │   ├── MetricCard.tsx
│   │   │   ├── TimeSeriesChart.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── AlertList.tsx
│   │   │   ├── StatusIndicator.tsx
│   │   │   └── ProgressBar.tsx
│   │   └── DashboardCanvas.tsx
│   ├── types/
│   │   ├── a2ui.ts         # A2UI type definitions
│   │   └── datadog.ts      # Datadog API types
│   ├── App.tsx             # Main app with CopilotKit
│   ├── main.tsx
│   └── index.css
├── server/
│   └── index.ts            # Express + CopilotKit runtime
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

## Customization

### Adding New Metrics

Edit `server/index.ts` and add to the `metricQueries` object:

```typescript
myNewMetric: {
  query: 'avg:my.metric{host:your-host}',
  displayName: 'My Metric',
  unit: '%',
  warning: 70,
  critical: 90,
},
```

### Adding New Component Types

1. Define the type in `src/types/a2ui.ts`
2. Create the component in `src/components/a2ui/`
3. Register it in `src/components/DashboardCanvas.tsx`

## Deployment

### EC2 Deployment

```bash
# On your EC2 instance
git clone <your-repo>
cd generative-ui-prototype
npm install
cp .env.example .env.local
# Edit .env.local with your keys

# Build for production
npm run build

# Run with PM2 for production
npm install -g pm2
pm2 start npm --name "gen-ui" -- run start:server
```

### Using with nginx (optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/generative-ui-prototype/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Agent Framework**: CopilotKit
- **LLM**: OpenAI GPT-4
- **Data Source**: Datadog API
- **Backend**: Express.js

## License

MIT
