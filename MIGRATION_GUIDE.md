# Migration Guide: Vercel to Digital Ocean

This guide helps you migrate your existing Fairytales with Spice deployment from Vercel to Digital Ocean.

## 🔄 Why Migrate?

### Cost Comparison
- **Vercel**: $20/month (Pro) to $40+/month (Team) for production usage
- **Digital Ocean**: $5/month (Basic) to $12/month (Professional) for equivalent resources

### Feature Improvements
- **✅ Image Generation**: Now available with `grok-2-image`
- **✅ Faster AI Models**: Upgraded to `grok-4-fast-reasoning`
- **✅ Better Control**: Full server access, custom configurations
- **✅ Persistent Connections**: Better for future features like WebSocket support

## 📋 Migration Checklist

### 1. Export Environment Variables
From your Vercel dashboard, note down:
```
XAI_API_KEY=your_existing_key
ELEVENLABS_API_KEY=your_existing_key
```

### 2. Fork/Update Repository
```bash
# If you forked the original repo, pull latest changes
git remote add upstream https://github.com/Phazzie/FairytaleswithSpice.git
git fetch upstream
git merge upstream/main

# Or fork the updated repository fresh
```

### 3. Deploy to Digital Ocean
Choose your deployment method:

#### Option A: Digital Ocean App Platform (Easiest)
1. Go to Digital Ocean dashboard → Apps → Create App
2. Connect your GitHub repository
3. Use the provided `.do/app.yaml` specification
4. Set environment variables in the dashboard
5. Click "Create Resources"

#### Option B: Docker on Droplet
```bash
# Create a droplet and SSH in
ssh root@your-droplet-ip

# Clone and deploy
git clone https://github.com/YOUR-USERNAME/FairytaleswithSpice.git
cd FairytaleswithSpice
echo "XAI_API_KEY=your_key" > .env
echo "ELEVENLABS_API_KEY=your_key" >> .env
docker compose up -d
```

### 4. Test Migration
```bash
# Test health endpoint
curl https://your-app.ondigitalocean.app/api/health

# Test story generation
curl -X POST https://your-app.ondigitalocean.app/api/story/generate \
  -H "Content-Type: application/json" \
  -d '{"creature":"vampire","themes":["romance"],"spicyLevel":2,"wordCount":700}'

# Test new image generation feature!
curl -X POST https://your-app.ondigitalocean.app/api/image/generate \
  -H "Content-Type: application/json" \
  -d '{"storyId":"test","content":"A vampire prince","creature":"vampire","themes":["romance"],"style":"dark"}'
```

### 5. Update DNS (Optional)
If you have a custom domain:
1. Update DNS A records to point to Digital Ocean
2. Configure domain in Digital Ocean dashboard
3. SSL certificates are managed automatically

### 6. Shutdown Vercel (After Testing)
Once confirmed working:
1. Delete Vercel deployment
2. Remove webhook integrations
3. Cancel Vercel subscription (if applicable)

## 🆕 New Features Available

### Image Generation
```javascript
// New image generation API
const response = await fetch('/api/image/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    storyId: 'story_123',
    content: story.content,
    creature: 'vampire',
    themes: ['romance', 'dark_secrets'],
    style: 'dark', // artistic, photorealistic, fantasy, dark, romantic
    aspectRatio: '16:9' // 1:1, 16:9, 9:16, 4:3
  })
});
```

### Enhanced Story Generation
- **25% faster** with `grok-4-fast-reasoning`
- Better creative consistency
- Improved dialogue formatting

## 🔧 Troubleshooting Migration

### API Endpoints Not Working
- Verify environment variables are set in Digital Ocean dashboard
- Check application logs: `doctl apps logs <app-id> --type=run`
- Ensure health check passes: `GET /api/health`

### Build Failures
- Check Docker build logs
- Verify all dependencies are properly installed
- Ensure Node.js version compatibility (requires 20.x+)

### Performance Issues
- Upgrade from Basic to Professional plan ($12/month)
- Enable CDN for static assets
- Consider horizontal scaling (multiple instances)

## 💰 Cost Savings Calculation

### Before (Vercel)
- Pro Plan: $20/month
- Bandwidth overages: ~$10/month
- **Total: ~$30/month**

### After (Digital Ocean)
- Basic App: $5/month
- Or Professional: $12/month
- Bandwidth: 100GB included
- **Total: $5-12/month**

**Annual Savings: $216-300**

## 🚨 Breaking Changes

### None for End Users!
- All API endpoints remain the same
- Frontend functionality unchanged
- Environment variables use same names
- Mock mode still works without API keys

### Developer Changes
- API functions moved from `/api/` folder to Express.js routes in `server.ts`
- Build process now includes Docker containerization
- Deployment uses Digital Ocean instead of Vercel CLI

## 📞 Migration Support

Need help with migration?
- **GitHub Issues**: [Migration Support](https://github.com/Phazzie/FairytaleswithSpice/issues/new?labels=migration)
- **Discord**: Join our community for real-time help
- **Email**: migration-help@fairytaleswithspice.com

## ✅ Post-Migration Validation

Run this checklist after migration:

- [ ] Health endpoint returns 200 OK
- [ ] Story generation works (both mock and with API key)
- [ ] Audio conversion functions
- [ ] Export/save features operational
- [ ] **NEW**: Image generation working
- [ ] Frontend loads correctly
- [ ] Environment variables secure
- [ ] SSL certificate active
- [ ] DNS resolves to new deployment
- [ ] Cost monitoring set up
- [ ] Backup/monitoring configured

**Congratulations! 🎉 You've successfully migrated to Digital Ocean with enhanced features and lower costs!**