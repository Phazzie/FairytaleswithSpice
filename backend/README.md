# Fairytales with Spice - Backend

Seam-Driven Development backend implementation for the Fairytales with Spice story generator.

## 🚀 Features

- **Story Generation**: AI-powered story creation using Grok API
- **Chapter Continuation**: Extend existing stories with new chapters
- **Audio Conversion**: Text-to-speech using ElevenLabs API
- **Export System**: Multiple format support (PDF, HTML, TXT, EPUB, DOCX)
- **Type Safety**: Full TypeScript implementation with contract validation
- **Error Handling**: Comprehensive error responses matching frontend contracts

## 🏗️ Architecture

This backend follows **Seam-Driven Development** principles:
- Contracts define all data boundaries
- Backend conforms exactly to frontend contracts
- Zero integration friction when swapping services
- Mock fallbacks for development without API keys

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- API Keys (optional for development):
  - Grok API Key
  - ElevenLabs API Key

## 🛠️ Installation

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Build and run:**
   ```bash
   # Development mode (with hot reload)
   npm run dev

   # Production build
   npm run build
   npm start
   ```

## 🔧 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3001` |
| `NODE_ENV` | Environment | No | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | No | `http://localhost:4200` |
| `GROK_API_KEY` | Grok AI API key | No | Mock mode |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | No | Mock mode |
| `STORAGE_BASE_URL` | File storage base URL | No | `https://storage.example.com` |

## 📡 API Endpoints

### Story Generation
```http
POST /api/generate-story
Content-Type: application/json

{
  "creature": "vampire",
  "themes": ["romance", "dark"],
  "userInput": "Victorian setting with forbidden love",
  "spicyLevel": 4,
  "wordCount": 900
}
```

### Chapter Continuation
```http
POST /api/continue-story
Content-Type: application/json

{
  "storyId": "story_123",
  "currentChapterCount": 1,
  "existingContent": "<h3>Previous content...</h3>",
  "userInput": "Make it more intense",
  "maintainTone": true
}
```

### Audio Conversion
```http
POST /api/convert-audio
Content-Type: application/json

{
  "storyId": "story_123",
  "content": "<h3>Story content...</h3>",
  "voice": "female",
  "speed": 1.0,
  "format": "mp3"
}
```

### Save/Export
```http
POST /api/save-story
Content-Type: application/json

{
  "storyId": "story_123",
  "content": "<h3>Story content...</h3>",
  "title": "My Spicy Story",
  "format": "pdf",
  "includeMetadata": true
}
```

## 🧪 Testing

The backend includes mock implementations for all services when API keys are not provided, making it easy to test without external dependencies.

### Health Check
```bash
curl http://localhost:3001/health
```

### Test Story Generation (Mock)
```bash
curl -X POST http://localhost:3001/api/generate-story \
  -H "Content-Type: application/json" \
  -d '{
    "creature": "vampire",
    "themes": ["romance"],
    "userInput": "Test story",
    "spicyLevel": 3,
    "wordCount": 700
  }'
```

## 🔒 Security

- Helmet.js for security headers
- CORS configuration
- Input validation using contract schemas
- Rate limiting (configurable)
- Environment variable protection

## 📁 Project Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── storyRoutes.ts     # Story generation & continuation
│   │   ├── audioRoutes.ts     # Audio conversion
│   │   └── exportRoutes.ts    # Save/export functionality
│   ├── services/
│   │   ├── storyService.ts    # Grok AI integration
│   │   ├── audioService.ts    # ElevenLabs integration
│   │   └── exportService.ts   # Export format handling
│   ├── types/
│   │   └── contracts.ts       # Seam contracts (copied from frontend)
│   ├── middleware/            # Custom middleware
│   └── server.ts              # Express server setup
├── .env.example               # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 Seam-Driven Development

This backend implements **contracts-first** development:

1. **Contracts Define Everything**: All data structures and error types are defined in `contracts.ts`
2. **Backend Conforms**: Implementation matches contracts exactly
3. **Zero Integration Issues**: Frontend can swap mock ↔ real backend seamlessly
4. **Type Safety**: Full TypeScript coverage prevents runtime errors
5. **Mock Fallbacks**: Development works without external API keys

## 🚦 Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "GENERATION_FAILED",
    "message": "Failed to generate story",
    "details": "Optional error details"
  },
  "metadata": {
    "requestId": "req_1234567890_abc123",
    "processingTime": 2500
  }
}
```

## 📈 Performance

- Request ID tracking for debugging
- Processing time metrics
- Efficient HTML cleaning for TTS
- Mock implementations for fast development
- Configurable timeouts for external APIs

## 🔧 Development

### Adding New Features

1. Define contracts in `contracts.ts` (frontend and backend)
2. Implement service methods
3. Add route handlers
4. Update error handling
5. Test with mocks first

### API Key Setup

For full functionality, obtain API keys from:
- **Grok**: https://console.x.ai/
- **ElevenLabs**: https://elevenlabs.io/

Without keys, the backend runs in mock mode with realistic delays and responses.

## 📝 License

ISC License - see package.json for details.

---

**Built with Seam-Driven Development** 🚀