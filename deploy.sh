#!/bin/bash

# Quick Deployment Script for Fairytales with Spice
# Digital Ocean App Platform deployment helper

set -e

echo "🧚‍♀️ Fairytales with Spice - Digital Ocean Deployment Helper"
echo "============================================================="

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "⚠️  Digital Ocean CLI (doctl) not found. Please install it first:"
    echo "   https://docs.digitalocean.com/reference/doctl/how-to/install/"
    echo ""
    echo "Or deploy manually through the Digital Ocean dashboard:"
    echo "   https://cloud.digitalocean.com/apps/new"
    exit 1
fi

# Check if user is authenticated
if ! doctl account get &> /dev/null; then
    echo "🔐 Please authenticate with Digital Ocean first:"
    echo "   doctl auth init"
    exit 1
fi

echo "✅ Digital Ocean CLI authenticated"

# Get app name
read -p "🏷️  Enter app name (default: fairytales-spice): " APP_NAME
APP_NAME=${APP_NAME:-fairytales-spice}

# Get region
echo "🌍 Available regions:"
echo "   - nyc1 (New York)"
echo "   - sfo3 (San Francisco)"  
echo "   - ams3 (Amsterdam)"
echo "   - sgp1 (Singapore)"
read -p "📍 Enter region (default: nyc1): " REGION
REGION=${REGION:-nyc1}

# Get GitHub info
echo ""
echo "📱 GitHub Repository Setup:"
read -p "   GitHub username/org (default: Phazzie): " GITHUB_USER
GITHUB_USER=${GITHUB_USER:-Phazzie}

read -p "   Repository name (default: FairytaleswithSpice): " GITHUB_REPO  
GITHUB_REPO=${GITHUB_REPO:-FairytaleswithSpice}

read -p "   Branch (default: main): " GITHUB_BRANCH
GITHUB_BRANCH=${GITHUB_BRANCH:-main}

# Ask about API keys
echo ""
echo "🔑 API Keys (optional - app works in mock mode without them):"
read -p "   Add Grok/XAI API key? (y/n): " ADD_GROK
read -p "   Add ElevenLabs API key? (y/n): " ADD_ELEVEN

# Prepare environment variables
ENV_VARS="NODE_ENV=production,PORT=8080"

if [[ "$ADD_GROK" == "y" || "$ADD_GROK" == "Y" ]]; then
    read -p "   Enter Grok/XAI API key: " GROK_KEY
    if [[ -n "$GROK_KEY" ]]; then
        ENV_VARS="$ENV_VARS,XAI_API_KEY=$GROK_KEY"
    fi
fi

if [[ "$ADD_ELEVEN" == "y" || "$ADD_ELEVEN" == "Y" ]]; then
    read -p "   Enter ElevenLabs API key: " ELEVEN_KEY
    if [[ -n "$ELEVEN_KEY" ]]; then
        ENV_VARS="$ENV_VARS,ELEVENLABS_API_KEY=$ELEVEN_KEY"
    fi
fi

echo ""
echo "🚀 Deploying with the following configuration:"
echo "   App Name: $APP_NAME"
echo "   Region: $REGION"  
echo "   Repository: $GITHUB_USER/$GITHUB_REPO"
echo "   Branch: $GITHUB_BRANCH"
echo "   Environment: $ENV_VARS"
echo ""

read -p "Continue with deployment? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo "🔄 Creating Digital Ocean app..."

# Create the app using the app.yaml spec
if [ -f "app.yaml" ]; then
    echo "📄 Using app.yaml configuration..."
    # Update the app.yaml with user-specific values
    sed -i.bak "s/name: fairytales-with-spice/name: $APP_NAME/" app.yaml
    sed -i.bak "s/region: nyc1/region: $REGION/" app.yaml  
    sed -i.bak "s/repo: Phazzie\/FairytaleswithSpice/repo: $GITHUB_USER\/$GITHUB_REPO/" app.yaml
    sed -i.bak "s/branch: main/branch: $GITHUB_BRANCH/" app.yaml
    
    # Deploy using app spec
    APP_ID=$(doctl apps create --spec app.yaml --format ID --no-header)
    
    # Restore original app.yaml
    mv app.yaml.bak app.yaml
else
    echo "❌ app.yaml not found. Please run this script from the project root directory."
    exit 1
fi

if [[ -n "$APP_ID" ]]; then
    echo "✅ App created successfully!"
    echo "   App ID: $APP_ID"
    echo "   Name: $APP_NAME"
    echo ""
    
    echo "🔄 Waiting for deployment to complete..."
    doctl apps get $APP_ID --wait
    
    echo "🌐 Getting app URL..."
    APP_URL=$(doctl apps get $APP_ID --format LiveURL --no-header)
    
    if [[ -n "$APP_URL" ]]; then
        echo ""
        echo "🎉 Deployment successful!"
        echo "============================================"
        echo "🌐 Your app is live at: $APP_URL"
        echo "🔍 Health check: $APP_URL/api/health"
        echo "📊 Dashboard: https://cloud.digitalocean.com/apps/$APP_ID"
        echo ""
        echo "📋 Next steps:"
        echo "   - Test your app: curl $APP_URL/api/health"
        echo "   - Configure custom domain (optional)"
        echo "   - Set up monitoring alerts"
        echo "   - Scale resources if needed"
        echo ""
        echo "📚 Documentation:"
        echo "   - Deployment Guide: ./DEPLOY.md"
        echo "   - Environment Setup: ./env.example"
        echo "   - Troubleshooting: ./README.md#troubleshooting"
    else
        echo "⚠️  Deployment may still be in progress. Check the dashboard:"
        echo "   https://cloud.digitalocean.com/apps/$APP_ID"
    fi
else
    echo "❌ Failed to create app. Check the error messages above."
    exit 1
fi

echo ""
echo "🧚‍♀️ Happy storytelling! ✨"