# Digital Ocean Deployment Guide

This document provides instructions for deploying Fairytales with Spice to Digital Ocean App Platform.

## 🚀 Quick Deploy

### Option 1: Digital Ocean App Platform (Recommended)

1. **Fork the repository** to your GitHub account
2. **Connect to Digital Ocean**:
   - Login to your Digital Ocean dashboard
   - Go to Apps → Create App
   - Connect your GitHub repository
   - Select the branch (main)

3. **Configure the app**:
   - Use the provided `.do/app.yaml` spec file
   - Or manually configure:
     - **Resource**: Basic (512MB RAM, 1 vCPU) - upgradeable
     - **Dockerfile**: `Dockerfile` in root directory
     - **Port**: 8080
     - **Health Check**: `/api/health`

4. **Set Environment Variables** (in DO dashboard):
   ```
   XAI_API_KEY=your_grok_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_key_here
   ```

5. **Deploy**: Click "Create Resources"

### Option 2: Digital Ocean Droplets

1. **Create a Droplet**:
   - Ubuntu 22.04 LTS
   - Basic plan (1GB+ RAM recommended)
   - Add SSH key

2. **Setup Docker**:
   ```bash
   # SSH into your droplet
   ssh root@your-droplet-ip
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Install Docker Compose
   sudo apt-get install docker-compose-plugin
   ```

3. **Deploy the application**:
   ```bash
   # Clone the repository
   git clone https://github.com/Phazzie/FairytaleswithSpice.git
   cd FairytaleswithSpice
   
   # Set environment variables
   echo "XAI_API_KEY=your_key_here" > .env
   echo "ELEVENLABS_API_KEY=your_key_here" >> .env
   
   # Build and run
   docker compose up -d
   ```

4. **Configure reverse proxy** (optional but recommended):
   - Install nginx
   - Configure SSL with Let's Encrypt
   - Proxy requests to container port 3000

## 🌍 Environment Variables

### Required for Production
```
XAI_API_KEY=your_xai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### Optional Configuration
```
# Frontend URL (auto-set in DO App Platform)
FRONTEND_URL=https://your-app-name.ondigitalocean.app

# Runtime environment
NODE_ENV=production

# Server port (auto-configured)
PORT=8080
```

## 📊 Resource Requirements

### Minimum Requirements
- **RAM**: 512MB (Basic plan)
- **CPU**: 1 vCPU (shared)
- **Storage**: 1GB
- **Bandwidth**: Included in DO plans

### Recommended for Production
- **RAM**: 1GB+ (Professional plan)
- **CPU**: 1 vCPU (dedicated)
- **Storage**: 5GB+
- **CDN**: Enable DO Spaces for asset delivery

## 🔧 Configuration

### App Platform Configuration
```yaml
# Resource scaling
instance_count: 1  # Scale up as needed
instance_size_slug: basic-xxs  # or professional-xs for better performance

# Health monitoring
health_check:
  http_path: /api/health
  initial_delay_seconds: 10
  period_seconds: 30
  timeout_seconds: 5
```

### Database (Future Enhancement)
```yaml
# Add if persistent storage needed
databases:
- name: fairytales-db
  engine: PG
  num_nodes: 1
  size: db-s-dev-database
```

## 📈 Monitoring

### Built-in Health Checks
- **Endpoint**: `GET /api/health`
- **Expected Response**: 200 with service status
- **Monitoring**: Automated in DO App Platform

### Logs
```bash
# View application logs in DO dashboard
# Or via CLI:
doctl apps logs <app-id> --type=run
```

## 🚧 Migration from Vercel

### What Changed
- ✅ **Serverless → Express.js**: All API functions converted to Express routes
- ✅ **Environment Variables**: Same names, different configuration method
- ✅ **CORS**: Configured for new domain
- ✅ **Build Process**: Optimized for containerized deployment

### Migration Steps
1. **Export environment variables** from Vercel dashboard
2. **Update frontend URL** references (if hardcoded)
3. **Configure new domain** in Digital Ocean
4. **Test all API endpoints** after deployment
5. **Update DNS records** to point to new domain

## 💰 Cost Estimation

### Digital Ocean App Platform
- **Basic Plan**: $5/month (512MB RAM, 1 vCPU)
- **Professional Plan**: $12/month (1GB RAM, 1 vCPU dedicated)
- **Bandwidth**: 100GB included, $0.01/GB after
- **Build minutes**: 400 included, $0.015/minute after

### Digital Ocean Droplets
- **Basic Droplet**: $4/month (512MB RAM)
- **Standard Droplet**: $6/month (1GB RAM)
- **Additional**: Load balancer $12/month, Managed database $15/month

## 🛠️ Development

### Local Development with Docker
```bash
# Build and run locally
docker compose up --build

# Access application
http://localhost:3000
```

### Local Development without Docker
```bash
# Install dependencies
npm run install:all

# Build frontend
npm run build

# Start server
cd story-generator
npm start
```

## 🔐 Security

### Digital Ocean Security Features
- **Automatic SSL/TLS**: Managed certificates
- **DDoS Protection**: Built-in
- **Private Networking**: Internal communication
- **Secrets Management**: Environment variables encrypted at rest

### Additional Security (Recommended)
- **Firewall Rules**: Configure DO Cloud Firewall
- **Rate Limiting**: Implement request throttling
- **Content Security Policy**: Add security headers
- **Input Validation**: Already implemented in API

## 📞 Support

### Digital Ocean Resources
- **Documentation**: [App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- **Community**: [DigitalOcean Community](https://www.digitalocean.com/community/)
- **Support**: Available with paid plans

### Application Support
- **Issues**: [GitHub Issues](https://github.com/Phazzie/FairytaleswithSpice/issues)
- **Documentation**: See repository README

---

**Ready to deploy!** 🚀 Follow the Quick Deploy steps above to get your app running on Digital Ocean.