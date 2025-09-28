# Docker build for Digital Ocean deployment
# Single stage that includes build process
FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY story-generator/package*.json ./story-generator/

# Install dependencies at root level
RUN npm ci --only=production

# Install dependencies for story-generator (including dev deps for build)
WORKDIR /app/story-generator
RUN npm ci

# Copy source code
WORKDIR /app
COPY . .

# Build the application
WORKDIR /app/story-generator
RUN npm run build

# Clean up dev dependencies after build
RUN npm ci --only=production && npm cache clean --force

# Create app user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set permissions
RUN chown -R nodejs:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Switch to app user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/story-generator/server/server.mjs"]