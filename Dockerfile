# Single stage Docker build for Digital Ocean deployment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files for root and story-generator
COPY package.json package-lock.json ./
COPY story-generator/package.json story-generator/package-lock.json ./story-generator/

# Install all dependencies (including dev for build)
RUN npm ci
RUN cd story-generator && npm ci

# Copy the rest of the source code
COPY . .

# Build the application using the consolidated script
RUN npm run build:full

# Reinstall only production dependencies for a lean final image
RUN npm ci --only=production
RUN cd story-generator && npm ci --only=production && npm cache clean --force

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set correct permissions for the app directory
RUN chown -R nodejs:nodejs /app

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=8080

# Expose the application port
EXPOSE 8080

# Switch to the non-root user
USER nodejs

# Health check to ensure the server starts correctly
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Start the application server
CMD ["node", "story-generator/dist/story-generator/server/server.mjs"]