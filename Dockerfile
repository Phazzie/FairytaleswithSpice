# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package.json files from workspaces to leverage Docker cache
COPY package.json package-lock.json ./
COPY api/package.json ./api/
COPY story-generator/package.json ./story-generator/
COPY packages/contracts/package.json ./packages/contracts/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Run the unified build script to compile both API and the Angular app
# This uses the TypeScript project references to build in the correct order.
RUN npm run build

# Prune development dependencies for a smaller node_modules to copy
RUN npm prune --production


# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy production node_modules and necessary package files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/story-generator/package.json ./story-generator/
COPY --from=builder /app/api/package.json ./api/
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/

# Copy compiled application code from the builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/story-generator/dist ./story-generator/dist

# Set permissions for the entire app directory
RUN chown -R nodejs:nodejs /app

# Switch to the non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# The entrypoint is the Angular server, which now imports our API.
CMD ["node", "story-generator/dist/story-generator/server/main.js"]