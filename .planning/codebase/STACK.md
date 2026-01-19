# Technology Stack

## Overview
This is a generative UI dashboard application ("Neil's Command Central") that uses AI-powered chat to dynamically render infrastructure monitoring components. It follows a modern TypeScript fullstack architecture with React frontend and Express backend.

## Primary Language
- **TypeScript** (100% of custom code)
- Target: ES2020+ with ESNext module syntax

## Frontend Stack

### Core Framework
- **React 18.3.1** - UI library
- **Vite 5.4.11** - Build tool and dev server

### UI/Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS
- **IBM Plex Sans/Mono** - Typography (Carbon Design System inspired)
- **lucide-react 0.468.0** - Icon library

### AI/Copilot Integration
- **@copilotkit/react-core 1.51.1** - AI copilot framework
- **@copilotkit/react-ui 1.51.1** - Chat UI components
- **@copilotkit/runtime 1.51.1** - Runtime for actions
- **@copilotkit/runtime-client-gql** - GraphQL client for runtime

### State Management
- React useState/useRef hooks (no external state library)
- Component-level state with props drilling
- CopilotKit's built-in state sync via useCopilotReadable

## Backend Stack

### Core Framework
- **Express 4.21.2** - Node.js HTTP server
- **dotenv 16.4.7** - Environment configuration

### AI/LLM Integration
- **OpenAI API** (via @copilotkit/runtime OpenAIAdapter)
- **LangFlow** - Custom AI agent for Datadog metric interpretation

### MCP (Model Context Protocol)
- **@modelcontextprotocol/sdk 1.0.3** - MCP client/server SDK
- Custom MCP server for Datadog metrics
- MCP Registry pattern for multi-server orchestration

### AWS Integration
- **@aws-sdk/client-cost-explorer 3.717.0** - AWS Cost Explorer
- **@aws-sdk/client-ecr 3.717.0** - AWS ECR container registry

## External Services

### Monitoring & Observability
- **Datadog** - Primary metrics source
  - System metrics (CPU, memory, disk, network)
  - Docker container metrics
  - Custom n8n workflow metrics

### Cloud Infrastructure (AWS)
- **EC2** - Application hosting
- **ECR** - Container registry
- **Cost Explorer** - Billing data
- **Route53** - DNS (custom domain)

### AI/ML Services
- **OpenAI GPT** - LLM for chat interactions
- **LangFlow** - AI agent for metric interpretations

## Key Dependencies

### Production
```json
{
  "@aws-sdk/client-cost-explorer": "^3.717.0",
  "@aws-sdk/client-ecr": "^3.717.0",
  "@copilotkit/react-core": "^1.51.1",
  "@copilotkit/react-ui": "^1.51.1",
  "@copilotkit/runtime": "^1.51.1",
  "@modelcontextprotocol/sdk": "^1.0.3",
  "express": "^4.21.2",
  "openai": "^4.77.0"
}
```

### Development
```json
{
  "@types/react": "^18.3.18",
  "@vitejs/plugin-react-swc": "^3.5.0",
  "tailwindcss": "^3.4.17",
  "typescript": "~5.6.2",
  "vite": "^5.4.11"
}
```

## Build & Runtime

### Build Tool
- **Vite** - Development and production builds
- **SWC** - Fast TypeScript/JSX compilation via @vitejs/plugin-react-swc

### Runtime
- **Node.js** - Server runtime
- **Docker** - Container deployment
- Port 4000 (Express serves both API and static assets)

## Version Control & CI/CD
- **Git** - Version control
- **GitHub Actions** - CI/CD pipeline
- Automated deployment to EC2 on push to main

## Configuration Files
| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS customization |
| `.env.local` | Environment secrets (not committed) |
| `.env.example` | Environment template |
