FROM node:18.19-slim

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init system
RUN apt-get update && apt-get install -y tini && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start the application
CMD ["npm", "start"] 