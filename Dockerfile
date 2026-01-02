# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm install --omit=dev && npm install tsx dotenv

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server

# Copy env example (actual env will be mounted or passed)
COPY .env.example ./.env.example

# Expose ports
EXPOSE 4000

# Start the server
CMD ["npx", "tsx", "server/index.ts"]
