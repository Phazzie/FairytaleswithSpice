# Multi-stage Docker build for Digital Ocean deployment
# Stage 1: Build the Angular application
FROM node:20-alpine AS build-stage

# Set working directory
WORKDIR /app

# Copy root package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy story-generator directory
COPY story-generator/ ./story-generator/
WORKDIR /app/story-generator

# Install Angular dependencies
RUN npm ci

# Build the Angular application
RUN npm run build

# Stage 2: Create production image
FROM node:20-alpine AS production-stage

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build-stage --chown=nodejs:nodejs /app/story-generator/dist/story-generator ./dist/story-generator
COPY --from=build-stage --chown=nodejs:nodejs /app/story-generator/package*.json ./
COPY --from=build-stage --chown=nodejs:nodejs /app/story-generator/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Switch to app user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "http.get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })" || exit 1

# Start the application
CMD ["node", "dist/story-generator/server/server.mjs"]