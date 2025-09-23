#!/bin/sh

# Fairytales with Spice - Production Startup Script
# Optimized for Digital Ocean App Platform

set -e

echo "🧚‍♀️ Starting Fairytales with Spice..."
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-8080}"

# Validate required directories
if [ ! -d "/app/dist" ]; then
    echo "❌ Error: Build output not found. Please ensure the application was built properly."
    exit 1
fi

if [ ! -d "/app/api" ]; then
    echo "❌ Error: API directory not found."
    exit 1
fi

# Set default port if not provided
export PORT=${PORT:-8080}

# Log configuration for container environments
export NODE_OPTIONS="--max-old-space-size=512"

# Configure frontend URL for CORS
if [ -z "$FRONTEND_URL" ]; then
    if [ "$NODE_ENV" = "production" ]; then
        export FRONTEND_URL="https://your-app.ondigitalocean.app"
        echo "⚠️  FRONTEND_URL not set, using default: $FRONTEND_URL"
    else
        export FRONTEND_URL="http://localhost:${PORT}"
    fi
fi

echo "Frontend URL: $FRONTEND_URL"

# API Key status logging (without exposing keys)
if [ -n "$XAI_API_KEY" ]; then
    echo "✅ Grok AI: Configured"
else
    echo "🔄 Grok AI: Using mock mode"
fi

if [ -n "$ELEVENLABS_API_KEY" ]; then
    echo "✅ ElevenLabs: Configured"  
else
    echo "🔄 ElevenLabs: Using mock mode"
fi

# Start the application with proper error handling
echo "🚀 Starting server on port ${PORT}..."

# Start the Express.js server
exec node server.js