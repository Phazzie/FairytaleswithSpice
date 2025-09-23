#!/bin/sh

# Fairytales with Spice - Health Check Script
# Digital Ocean compatible health check

set -e

# Default health check URL
HEALTH_URL="http://localhost:${PORT:-8080}/api/health"

# Perform health check with timeout
if curl -f -s --max-time 5 "$HEALTH_URL" > /dev/null; then
    echo "✅ Health check passed"
    exit 0
else
    echo "❌ Health check failed"
    exit 1
fi