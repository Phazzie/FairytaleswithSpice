# Fairytales with Spice - Production Dockerfile for Digital Ocean
# Multi-stage build for optimized production deployment

# =====================================================
# Stage 1: Build Dependencies and Frontend
# =====================================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for building
RUN apk add --no-cache git python3 make g++

# Copy package files for dependency installation
COPY package.json package-lock.json ./
COPY story-generator/package.json ./story-generator/

# Install dependencies with clean cache
RUN npm ci --only=production --no-audit --no-fund && \
    cd story-generator && \
    npm ci --only=production --no-audit --no-fund

# Copy source code
COPY . .

# Build the frontend application
RUN cd story-generator && npm run build

# =====================================================
# Stage 2: Production Runtime
# =====================================================
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fairytales -u 1001

# Set working directory
WORKDIR /app

# Install only required system dependencies
RUN apk add --no-cache curl && \
    apk del --purge git python3 make g++

# Copy built application from builder stage
COPY --from=builder /app/story-generator/dist/story-generator ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/node_modules ./node_modules

# Copy startup and health check scripts
COPY docker/start.sh /usr/local/bin/start.sh
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/start.sh /usr/local/bin/healthcheck.sh

# Change ownership to non-root user
RUN chown -R fairytales:nodejs /app

# Switch to non-root user
USER fairytales

# Expose port (configurable via environment variable)
EXPOSE ${PORT:-8080}

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["/usr/local/bin/start.sh"]