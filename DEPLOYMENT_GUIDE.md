# 🚀 Digital Ocean Deployment Guide

## ✅ Code Ready for Deployment

All migration changes have been committed and pushed to GitHub.

**Commit**: `feat: Digital Ocean migration - zero technical debt`  
**Branch**: `codespace-didactic-guide-5grrgjqqpx4v3vq75`  
**Status**: ✅ Build verified, server tested, health endpoint working

---

## 📋 Deployment Steps

### Option 1: Deploy via Digital Ocean MCP Server (Recommended)

The Digital Ocean MCP (Model Context Protocol) server allows you to manage deployments through the Copilot interface.

**Setup:**

1. **Get your Digital Ocean API token:**
   - Go to https://cloud.digitalocean.com/account/api/tokens
   - Click "Generate New Token"
   - Name: `FairytaleswithSpice-MCP`
   - Scopes: Read & Write
   - Copy the token (you'll only see it once!)

2. **Configure the MCP server:**
   ```bash
   # Set your token in the config file
   export DIGITALOCEAN_API_TOKEN="your_token_here"
   
   # Test the MCP connection
   npx @digitalocean/mcp -- -services apps,droplets --digitalocean-api-token "$DIGITALOCEAN_API_TOKEN"
   ```

3. **Use Copilot to deploy:**
   - The MCP server is now available in your Copilot context
   - Ask Copilot to: "Deploy FairytaleswithSpice to Digital Ocean using the App Platform"
   - Copilot will use the MCP server to create and configure the app

**MCP Services Available:**
- `apps` - Digital Ocean App Platform (what we need)
- `droplets` - Virtual machines (not needed for this deployment)
- `doks` - Digital Ocean Kubernetes (not needed for this deployment)

---

### Option 2: Deploy via Digital Ocean Dashboard (Manual)

If you prefer manual deployment:

1. **Go to Digital Ocean:**
   - Visit https://cloud.digitalocean.com/apps
   - Click "Create App"

2. **Connect GitHub:**
   - Choose "GitHub" as source
   - Select repository: `Phazzie/FairytaleswithSpice`
   - Select branch: `main` (merge your branch first) or `codespace-didactic-guide-5grrgjqqpx4v3vq75`
   - Digital Ocean will auto-detect `.do/app.yaml`

3. **Configure Environment Variables:**
   Click "Edit" next to environment variables and add:
   
   | Variable Name | Value | Type |
   |--------------|-------|------|
   | `XAI_API_KEY` | Your Grok API key | Secret |
   | `ELEVENLABS_API_KEY` | Your ElevenLabs key | Secret |
   | `NODE_ENV` | `production` | Variable |
   | `PORT` | `8080` | Variable |

   **Note:** API keys are optional - app works with mock services for testing

4. **Review Settings:**
   - Plan: Basic (starting at $5/month)
   - Region: NYC (or choose closest to your users)
   - Instance: basic-xxs (1 vCPU, 512 MB RAM)

5. **Deploy:**
   - Click "Create Resources"
   - Wait ~5-7 minutes for initial build
   - Your app will be live at: `https://fairytales-with-spice-xxxxx.ondigitalocean.app`

---

## 🔍 Post-Deployment Verification

### 1. Test Health Endpoint
```bash
curl https://your-app-url.ondigitalocean.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-08T...",
  "uptime": 123.45,
  "environment": "production",
  "services": {
    "grok": "configured",
    "elevenlabs": "configured"
  },
  "version": "2.1.0"
}
```

### 2. Test Story Generation
```bash
curl -X POST https://your-app-url.ondigitalocean.app/api/story/generate \
  -H "Content-Type: application/json" \
  -d '{
    "creature": "vampire",
    "themes": ["romance"],
    "spicyLevel": 3,
    "wordCount": 700,
    "userInput": "A vampire meets a human at midnight"
  }'
```

### 3. Access the Frontend
Open browser: `https://your-app-url.ondigitalocean.app`

---

## 🔧 Troubleshooting

### Build Fails
- Check Digital Ocean build logs
- Verify Node.js version (should use 20+)
- Check for TypeScript errors

### Server Won't Start
- Verify `PORT` environment variable is set to `8080`
- Check server logs in Digital Ocean dashboard
- Ensure all dependencies installed correctly

### API Endpoints Return 404
- Verify server.ts routes are deployed
- Check CORS settings if accessing from different domain
- Review server startup logs

### Services Show "mock" Instead of "configured"
- Add API keys in Digital Ocean environment variables
- Restart the app after adding keys
- Verify keys are correct

---

## 📊 Digital Ocean App Platform Details

**What Gets Deployed:**
```
/workspaces/FairytaleswithSpice/
├── .do/app.yaml           ← Digital Ocean reads this
├── story-generator/
│   ├── package.json       ← Dependencies installed
│   ├── src/server.ts      ← API routes + Angular SSR
│   └── dist/              ← Built files (created during build)
└── api/lib/services/      ← Service layer (unchanged)
```

**Build Process:**
1. Digital Ocean clones your GitHub repo
2. Runs: `cd story-generator && npm ci`
3. Runs: `npm run build:prod` (Angular production build)
4. Starts: `npm run start:prod` (node dist/story-generator/server/server.mjs)
5. Listens on port 8080
6. Health checks every 10 seconds

**Cost Estimate:**
- Basic plan: $5/month (512 MB RAM, 1 vCPU)
- Bandwidth: First 100 GB free
- Build minutes: Unlimited on App Platform
- SSL/HTTPS: Included free

---

## 🎯 Next Steps After Deployment

1. **Custom Domain (Optional):**
   - Add your domain in Digital Ocean dashboard
   - Update DNS records to point to Digital Ocean
   - SSL certificate auto-generated

2. **Monitoring:**
   - Digital Ocean provides built-in metrics
   - Monitor response times, error rates
   - Set up alerts for downtime

3. **Scaling:**
   - Start with basic-xxs (sufficient for testing)
   - Upgrade to professional-xs if traffic increases
   - Add horizontal scaling (multiple instances) if needed

4. **CI/CD:**
   - Auto-deploy on push to `main` branch
   - Configure in Digital Ocean app settings
   - Add staging environment if needed

---

## 📝 Summary

**Ready for Deployment:** ✅  
**Build Status:** ✅ Verified  
**Runtime Status:** ✅ Tested  
**Health Check:** ✅ Working  
**Seam Compliance:** ✅ Preserved  
**Technical Debt:** ✅ Zero  

**Deployment Time:** 5-7 minutes  
**Monthly Cost:** Starting at $5  
**Merge Required:** Yes (merge branch to main first, or deploy from branch)

---

Choose your deployment method above and let's get this live! 🚀
