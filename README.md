# 🧚‍♀️ Fairytales with Spice ✨

> *Generate spicy, adult-oriented fairy tales with AI-powered storytelling, multi-voice audio narration, and professional export options*

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://fairytaleswithspice.vercel.app)
[![Angular](https://img.shields.io/badge/Angular-20.3-red?style=for-the-badge&logo=angular)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)

## 🌟 Features

### 📚 **Enhanced Story Generation v2.0** 🆕
- **Multi-Creature Stories**: Choose from vampires, werewolves, and fairies
- **5 Distinct Themes**: Romance, Adventure, Mystery, Comedy, and Dark narratives
- **🎭 10 Unconventional Beat Structures**: Temptation Cascade, Power Exchange, Seduction Trap, Ritual Binding, Vulnerability Spiral, Hunt and Claim, Bargain's Price, Memory Fracture, Transformation Hunger, Mirror Souls
- **👥 Dynamic Author Style Blending**: 2+1 selection system combines voices from 15 renowned authors (Anne Rice, Patricia Briggs, Holly Black, etc.)
- **🎯 Invisible Randomization**: Each story gets unexpected combinations completely hidden from users
- **📚 Chekhov Element Tracking**: Automatically plants story elements for future chapter payoffs
- **🌶️ Spice-Aware Adaptation**: Beat structures intelligently adapt to content intensity (1-5 levels)
- **Real-time Progress**: Watch your story unfold with live generation updates
- **Chapter Continuation**: Extend stories with seamless chapter additions
- **Customizable Length**: 700, 900, or 1200 word options

### 🎭 **Advanced Multi-Voice Audio**
- **Character-Specific Voices**: Unique voices for each creature type and gender
- **Speaker Tag Recognition**: Automatically detects `[Character]:` dialogue patterns
- **90+ Emotion System**: Maps emotional states to voice parameters
- **Seamless Audio Merging**: Combines multiple speakers into flowing narration
- **Professional Quality**: ElevenLabs integration for premium text-to-speech

### 📤 **Professional Export Options**
- **Multiple Formats**: PDF, EPUB, DOCX, HTML, and TXT
- **Metadata Inclusion**: Author, title, themes, and generation details
- **Chapter Organization**: Properly formatted multi-chapter exports
- **Download Management**: Secure links with expiration handling

### 🛠️ **Developer-Friendly Architecture**
- **Seam-Driven Development**: Explicit contracts prevent integration failures
- **Mock Services**: Full functionality without external API dependencies
- **Comprehensive Testing**: 95%+ test coverage with integration suites
- **Debug Panel**: Built-in tools for API testing and error monitoring
- **Enterprise CI/CD**: 5-workflow pipeline with security scanning

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or higher
- npm or yarn package manager
- (Optional) ElevenLabs API key for audio features
- (Optional) Grok/XAI API key for AI story generation

### 1. Clone the Repository
```bash
git clone https://github.com/Phazzie/FairytaleswithSpice.git
cd FairytaleswithSpice
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd story-generator && npm install && cd ..
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
# Optional: AI Story Generation (uses mocks if not provided)
XAI_API_KEY=your_grok_api_key_here

# Optional: Audio Generation (uses mocks if not provided)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Development settings
NODE_ENV=development
```

### 4. Run in Development Mode
```bash
# Start frontend (Angular dev server)
cd story-generator && npm run dev

# API functions are automatically deployed to Vercel
# No local backend server needed - uses Vercel serverless functions
```

### 5. Access the Application
- **Frontend**: http://localhost:4200
- **API**: Deployed automatically to Vercel (https://fairytaleswithspice.vercel.app/api/)
- **Production**: https://fairytaleswithspice.vercel.app

## 🏗️ Architecture Overview

### **Seam-Driven Development**
This project follows a unique methodology where every data boundary is explicitly defined:

```typescript
// Example: Story Generation Seam
interface StoryGenerationSeam {
  input: {
    creature: CreatureType;
    themes: ThemeType[];
    userInput: string;
    spicyLevel: SpicyLevel;
    wordCount: WordCount;
  };
  output: {
    storyId: string;
    title: string;
    content: string;
    // ... complete contract definition
  };
}
```

### **Project Structure**
```
FairytaleswithSpice/
├── 📁 story-generator/     # Angular 20.3 Frontend
│   ├── src/app/
│   │   ├── contracts.ts    # Frontend seam contracts
│   │   ├── app.ts         # Main application component
│   │   ├── story.service.ts # API communication
│   │   └── debug-panel/   # Development tools
│   └── ...
├── 📁 api/                # Vercel Serverless Functions
│   ├── health.ts          # Health check endpoint
│   ├── story/
│   │   ├── generate.ts    # Story generation endpoint
│   │   └── continue.ts    # Chapter continuation
│   ├── audio/
│   │   └── convert.ts     # Audio conversion endpoint
│   └── lib/
│       ├── services/      # Core business logic
│       └── types/         # Shared type definitions
├── 📁 .github/workflows/  # Enterprise CI/CD Pipeline
└── 📁 tests/             # Integration test suites
```

## 🎯 Usage Guide

### **Creating Your First Story**

1. **Select a Creature**: Choose vampire, werewolf, or fairy
2. **Pick Themes**: Select up to 5 themes from the available options
3. **Set Spicy Level**: Choose intensity from 1 (mild) to 5 (hot) 🌶️
4. **Add Custom Input** (optional): Provide specific story elements
5. **Choose Word Count**: Select 700, 900, or 1200 words
6. **Generate**: Click "Generate Story" and watch the real-time progress

### **Multi-Voice Audio Features**

The system automatically detects speaker patterns in generated stories:

```
[Vampire Lord]: "Come closer, my dear..."
[Fairy Princess]: "I'll never succumb to your darkness!"
[Narrator]: The tension in the moonlit chamber was palpable.
```

Each speaker gets a unique voice:
- **Vampire Lord**: Deep, seductive male voice
- **Fairy Princess**: Light, magical female voice  
- **Narrator**: Neutral storytelling voice

### **Export Options**

After generating a story, you can export in multiple formats:
- **PDF**: Professional layout with metadata
- **EPUB**: E-book format for readers
- **DOCX**: Microsoft Word document
- **HTML**: Web-ready format
- **TXT**: Plain text for universal compatibility

## 🔧 Development

### **Available Scripts**

**Frontend (story-generator/)**
```bash
npm run dev          # Development server with hot reload
npm run build        # Production build
npm run test         # Run unit tests
npm run lint         # Code quality checks
```

**API Development (now integrated with frontend)**
```bash
# Build and run locally (all-in-one Express server)
cd story-generator
npm run build
PORT=3000 node dist/story-generator/server/server.mjs

# Or use Docker for local development
docker compose up --build

# Test API endpoints
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/story/generate \
  -H "Content-Type: application/json" \
  -d '{"creature":"vampire","themes":["romance"],"spicyLevel":2,"wordCount":700}'
```

**Integration Tests (tests/)**
```bash
npm run test:integration  # Full end-to-end tests
```

### **Mock vs Real Services**

The application works fully without external APIs:

**Mock Mode** (default):
- Realistic story generation with predefined templates
- Audio conversion returns mock URLs with proper metadata
- Export functions generate downloadable mock files

**Production Mode** (with API keys):
- Real AI story generation via Grok/XAI
- Professional audio via ElevenLabs text-to-speech
- All features maintain identical interfaces

### **Debug Panel**

Access with `Ctrl+Shift+D` or click the debug button:
- **API Health Checks**: Test endpoint connectivity
- **Error Log Viewer**: Real-time error monitoring
- **Service Status**: Current API key configuration
- **Test Suite Runner**: Execute integration tests

## 🔐 Security & Privacy

- **No Data Persistence**: Stories are generated fresh each time
- **Environment Variable Security**: API keys never exposed to frontend
- **CORS Protection**: Proper origin validation
- **Input Sanitization**: All user inputs are validated and cleaned
- **Rate Limiting**: API calls are throttled to prevent abuse

## 🚀 Deployment

### **Digital Ocean Deployment** (Recommended)

Deploy to Digital Ocean App Platform for scalable, cost-effective hosting:

1. **Fork this repository**
2. **Connect to Digital Ocean**:
   - Login to Digital Ocean dashboard
   - Go to Apps → Create App
   - Connect your GitHub repository
3. **Deploy with one-click**:
   - Use the provided `.do/app.yaml` configuration
   - Or manually configure Docker deployment
4. **Set Environment Variables**:
   ```
   XAI_API_KEY=your_grok_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ```
5. **Deploy**: Digital Ocean builds and deploys automatically

**Cost**: Starting at $5/month (Basic plan) - much cheaper than Vercel for production!

📋 **[Complete Digital Ocean Deployment Guide](./DIGITAL_OCEAN_DEPLOYMENT.md)**

### **Alternative: Vercel Deployment** (Legacy)

⚠️ **Note**: This app has been migrated to work better with Digital Ocean, but Vercel still works:

1. **Fork this repository**
2. **Connect to Vercel**: Import your fork in Vercel dashboard
3. **Set Environment Variables**:
   ```
   XAI_API_KEY=your_grok_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ```
4. **Deploy**: Vercel automatically builds and deploys

### **Docker Deployment**

```bash
# Local Docker development
docker compose up --build

# Production Docker deployment
docker build -t fairytales-with-spice .
docker run -p 8080:8080 \
  -e XAI_API_KEY=your_key \
  -e ELEVENLABS_API_KEY=your_key \
  fairytales-with-spice
```

## 📊 Testing

### **Test Coverage**
- **Frontend**: 85%+ component and service coverage
- **API**: 98%+ endpoint coverage with 154 test cases
- **Integration**: Complete workflow validation
- **CI/CD**: Automated testing on every commit

### **Running Tests**
```bash
# Run all tests
npm test

# Frontend tests only
cd story-generator && npm test

# API tests only  
cd api && npm test

# Integration tests
cd tests && npm run test:integration
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow the seam-driven approach**: Define contracts first
4. **Add comprehensive tests**: Maintain 95%+ coverage
5. **Update documentation**: Comment your code thoroughly
6. **Submit a pull request**: Include detailed description

### **Development Guidelines**
- Follow TypeScript strict mode
- Use seam contracts for all API boundaries
- Add JSDoc comments to all public methods
- Include error handling for all external calls
- Write tests for both success and failure scenarios

## 📝 API Documentation

### **Health Check**
```http
GET /api/health
```
Returns system status and service availability.

### **Story Generation**
```http
POST /api/story/generate
Content-Type: application/json

{
  "creature": "vampire",
  "themes": ["romance", "mystery"],
  "userInput": "Victorian London setting",
  "spicyLevel": 3,
  "wordCount": 900
}
```

### **Audio Conversion**
```http
POST /api/audio/convert
Content-Type: application/json

{
  "storyId": "story_123",
  "content": "Story content with [Speaker]: dialogue",
  "voice": "female",
  "speed": 1.0,
  "format": "mp3"
}
```

### **Image Generation** (New!)
```http
POST /api/image/generate
Content-Type: application/json

{
  "storyId": "story_123",
  "content": "A vampire prince in Victorian London",
  "creature": "vampire",
  "themes": ["romance", "dark_secrets"],
  "style": "dark",
  "aspectRatio": "16:9"
}
```

[View complete API documentation](./DIGITAL_OCEAN_DEPLOYMENT.md#api-endpoints)

## 🎨 Customization

### **Adding New Creatures**
1. Update `CreatureType` in contracts.ts
2. Add creature to themes array in app.ts
3. Add voice mappings in audioService.ts
4. Update story generation prompts

### **Custom Voices**
Set environment variables for character-specific voices:
```env
ELEVENLABS_VOICE_VAMPIRE_MALE=your_voice_id
ELEVENLABS_VOICE_FAIRY_FEMALE=your_voice_id
```

### **New Export Formats**
Extend the export service with additional format handlers following the existing seam contract pattern.

## 📈 Performance

- **Story Generation**: 2-8 seconds (depending on complexity)
- **Audio Conversion**: 10-30 seconds (varies by length)
- **Export Generation**: 1-3 seconds per format
- **Bundle Size**: <2MB compressed frontend
- **Lighthouse Score**: 95+ performance rating

## 🐛 Troubleshooting

### **Common Issues**

**Story Generation Fails**
- Check if running in mock mode (expected behavior)
- Verify XAI_API_KEY if using real AI
- Check API health endpoint

**Audio Not Working**
- Confirm ELEVENLABS_API_KEY is set
- Check browser audio permissions
- Verify audio format compatibility

**Build Errors**
- Run `npm ci` to clean install dependencies
- Check Node.js version (requires 20.x+)
- Clear npm cache: `npm cache clean --force`

### **Debug Mode**
Enable verbose logging:
```env
NODE_ENV=development
DEBUG=fairytales:*
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **ElevenLabs** for premium text-to-speech technology
- **Grok/XAI** for advanced AI story generation and image generation
- **Digital Ocean** for scalable, cost-effective cloud deployment  
- **Angular Team** for the robust frontend framework
- **Docker** for containerized deployment simplicity

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Phazzie/FairytaleswithSpice/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Phazzie/FairytaleswithSpice/discussions)
- **Email**: [Contact the development team](mailto:support@fairytaleswithspice.com)

---

## 🗄️ Database Options Investigation

Considering adding database persistence to save stories, enable user accounts, and unlock advanced features?

📊 **[View Complete Database Investigation](./DATABASE_INDEX.md)**

Quick summaries:
- **[Decision Flowchart](./DATABASE_DECISION_FLOWCHART.md)** - Visual guide to choosing your database strategy
- **[Quick Reference](./DATABASE_QUICK_REFERENCE.md)** - 10-minute decision guide
- **[ROI Analysis](./DATABASE_ROI_ANALYSIS.md)** - Cost-benefit breakdown
- **[Full Investigation](./DATABASE_INVESTIGATION.md)** - Complete technical analysis

**TL;DR**: PostgreSQL + Auth0 = $20/month, 10-14 hours implementation, enables story library, user accounts, multi-chapter state, analytics, and more.

---

<div align="center">

**[🚀 Digital Ocean Deployment Guide](./DIGITAL_OCEAN_DEPLOYMENT.md)** | **[🗄️ Database Options](./DATABASE_INDEX.md)** | **[📖 Documentation](./docs/)** | **[🐳 Docker Setup](#docker-deployment)**

*Made with ❤️ and a touch of spice*

</div>