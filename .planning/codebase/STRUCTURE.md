# Directory Structure

## Root Level
```
generative-ui-prototype/
├── .github/                 # GitHub Actions workflows
├── .planning/               # Project planning docs (this folder)
├── dist/                    # Production build output
├── node_modules/            # Dependencies
├── public/                  # Static assets
├── server/                  # Backend source code
├── src/                     # Frontend source code
├── .env.example             # Environment template
├── .env.local               # Local secrets (not committed)
├── .gitignore               # Git ignore rules
├── DEPLOYMENT.md            # Deployment documentation
├── Dockerfile               # Container build definition
├── index.html               # HTML entry point
├── MCP_DEMO.md              # MCP integration guide
├── package.json             # Project manifest
├── README.md                # Project documentation
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite build configuration
```

## Frontend Source (`src/`)
```
src/
├── components/              # React components
│   ├── a2ui/                # A2UI component library
│   │   ├── AlertList.tsx    # Alert/incident display
│   │   ├── CardGroup.tsx    # Grouped metrics cards
│   │   ├── DataTable.tsx    # Tabular data display
│   │   ├── ECRSummaryCard.tsx # AWS ECR summary
│   │   ├── MetricCard.tsx   # Single metric display
│   │   ├── ProgressBar.tsx  # Progress/utilization bar
│   │   ├── StatusIndicator.tsx # Simple status display
│   │   └── index.ts         # Component exports
│   ├── BlurBackground.tsx   # Animated background
│   ├── DashboardCanvas.tsx  # Main dashboard container
│   ├── ErrorBoundary.tsx    # Error handling wrapper
│   ├── VoiceButton.tsx      # Voice input trigger
│   └── VoiceOverlay.tsx     # Voice transcription UI
├── config/                  # Configuration files
│   └── metrics.config.ts    # Datadog metrics config
├── data/                    # Static data files
│   └── deployments.json     # Deployment history
├── hooks/                   # Custom React hooks
│   └── useVoiceDictation.ts # Voice input hook
├── services/                # API clients
│   └── mcp-client.ts        # MCP API client
├── types/                   # TypeScript definitions
│   ├── a2ui.ts              # A2UI component types
│   ├── costs.ts             # AWS cost types
│   ├── datadog.ts           # Datadog metric types
│   └── index.ts             # Type exports
├── App.tsx                  # Main application component
├── index.css                # Global styles (Tailwind)
├── main.tsx                 # React entry point
└── vite-env.d.ts            # Vite type declarations
```

## Backend Source (`server/`)
```
server/
├── index.ts                 # Express server entry point
├── index.js                 # Compiled JavaScript
├── index.d.ts               # Type declarations
├── mcp-client.ts            # MCP client (frontend)
├── mcp-client.js            # Compiled JavaScript
├── mcp-registry.ts          # MCP server orchestration
├── mcp-registry.js          # Compiled JavaScript
├── mcp-registry.d.ts        # Type declarations
├── mcp-server.ts            # Datadog MCP server
├── mcp-server.js            # Compiled JavaScript
├── mcp-servers.config.json  # MCP server configuration
├── metrics-config.ts        # Datadog metrics definitions
└── metrics-config.js        # Compiled JavaScript
```

## CI/CD (`.github/`)
```
.github/
└── workflows/
    └── deploy.yml           # EC2 deployment workflow
```

## Key Files by Function

### Entry Points
| File | Purpose |
|------|---------|
| `index.html` | Browser entry point |
| `src/main.tsx` | React bootstrap |
| `src/App.tsx` | Application root |
| `server/index.ts` | Server entry point |

### Configuration
| File | Purpose |
|------|---------|
| `vite.config.ts` | Build configuration |
| `tsconfig.json` | TypeScript settings |
| `tailwind.config.js` | CSS framework config |
| `.env.local` | Environment secrets |
| `server/mcp-servers.config.json` | MCP server definitions |

### Core Business Logic
| File | Purpose |
|------|---------|
| `src/App.tsx` | CopilotKit actions, state management |
| `src/components/DashboardCanvas.tsx` | Component rendering logic |
| `src/types/a2ui.ts` | A2UI specification |
| `server/mcp-registry.ts` | MCP orchestration |
| `server/mcp-server.ts` | Datadog MCP tools |

### API Layer
| File | Purpose |
|------|---------|
| `server/index.ts` | All REST endpoints |
| `server/metrics-config.ts` | Metric query definitions |
| `src/services/mcp-client.ts` | Frontend API client |

## Module Organization Patterns

### Component Colocation
A2UI components are colocated in `src/components/a2ui/`:
- Each component has its own file
- Types imported from shared `types/a2ui.ts`
- Index file exports all components

### Server Module Pattern
Server uses flat structure with related files:
- Main module (e.g., `mcp-registry.ts`)
- Compiled output (`mcp-registry.js`)
- Type declarations (`mcp-registry.d.ts`)

### Type Centralization
All TypeScript types in `src/types/`:
- Grouped by domain (a2ui, costs, datadog)
- Re-exported via index.ts
- Shared between components and services
