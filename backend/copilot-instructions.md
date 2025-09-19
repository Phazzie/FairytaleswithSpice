# Backend Copilot Instructions - Fairytales with Spice

## 🎯 Backend-Specific Seam-Driven Development

This document provides backend-specific guidelines for the **Fairytales with Spice** story generation platform, extending the core Seam-Driven Development methodology.

### BACKEND CORE PRINCIPLES:

1. **CONTRACTS ARE LAW**: Backend implementation must match frontend contracts exactly. Every response structure, error code, and data type must conform to `contracts.ts`.

2. **MOCK-FIRST SERVICES**: Always implement mock versions before real API integrations. Mocks should be realistic and include proper delays.

3. **FAIL GRACEFULLY**: External API failures should never break the user experience. Always have fallback responses.

4. **TYPE SAFETY EVERYWHERE**: Use TypeScript strictly. No `any` types in service implementations.

## 🏗️ Service Implementation Patterns

### Story Generation Service (`storyService.ts`)

**Contract Adherence**:
```typescript
// ✅ CORRECT: Exact contract match
const generateStory = async (input: StoryGenerationSeam['input']): Promise<StoryGenerationSeam['output']> => {
  // Implementation matches contract exactly
};

// ❌ WRONG: Additional or missing fields
const generateStory = async (input: any): Promise<any> => {
  // Breaks contract, causes integration failures
};
```

**Mock Implementation Pattern**:
```typescript
const generateStoryMock = async (input: StoryGenerationSeam['input']): Promise<StoryGenerationSeam['output']> => {
  // Simulate realistic processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  
  return {
    storyId: `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: `The ${input.creature} of ${generateRandomLocation()}`,
    content: generateMockStoryContent(input.creature, input.themes, input.spicyLevel),
    creature: input.creature,
    themes: input.themes,
    spicyLevel: input.spicyLevel,
    actualWordCount: calculateActualWordCount(input.wordCount),
    estimatedReadTime: Math.ceil(input.wordCount / 200),
    hasCliffhanger: Math.random() > 0.3, // 70% chance of cliffhanger
    generatedAt: new Date()
  };
};
```

### Audio Conversion Service (`audioService.ts`)

**HTML Content Cleaning**:
```typescript
const cleanHtmlForTTS = (htmlContent: string): string => {
  return htmlContent
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};
```

**Mock Audio Processing**:
```typescript
const convertToAudioMock = async (input: AudioConversionSeam['input']): Promise<AudioConversionSeam['output']> => {
  const cleanText = cleanHtmlForTTS(input.content);
  const estimatedDuration = Math.ceil(cleanText.length / 20); // ~20 chars per second
  
  // Simulate processing time based on content length
  const processingTime = Math.min(cleanText.length / 100, 30000); // Max 30 seconds
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  return {
    audioId: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    storyId: input.storyId,
    downloadUrl: `${process.env.STORAGE_BASE_URL}/mock-audio/${input.storyId}.${input.format}`,
    duration: estimatedDuration,
    fileSize: estimatedDuration * 32000, // Approximate file size
    voice: input.voice,
    speed: input.speed,
    format: input.format,
    processedAt: new Date()
  };
};
```

## 📡 API Route Implementation

### Standardized Response Pattern
```typescript
app.post('/api/generate-story', async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    // Validate input against contract
    const input = validateStoryGenerationInput(req.body);
    
    // Call service (mock or real based on API keys)
    const result = await storyService.generateStory(input);
    
    // Return standardized success response
    res.json({
      success: true,
      data: result,
      metadata: {
        requestId,
        processingTime: Date.now() - startTime
      }
    } as ApiResponse<StoryGenerationSeam['output']>);
    
  } catch (error) {
    // Return standardized error response
    res.status(500).json({
      success: false,
      error: {
        code: error.code || 'GENERATION_FAILED',
        message: error.message || 'Failed to generate story',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      metadata: {
        requestId,
        processingTime: Date.now() - startTime
      }
    } as ApiResponse<never>);
  }
});
```

## 🔄 Mock/Real Service Switching

### Environment-Based Service Selection
```typescript
// Service factory pattern for seamless switching
const createStoryService = () => {
  const hasGrokKey = !!process.env.XAI_API_KEY;
  
  if (hasGrokKey && process.env.NODE_ENV === 'production') {
    return new GrokStoryService();
  } else {
    return new MockStoryService();
  }
};

const createAudioService = () => {
  const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
  
  if (hasElevenLabsKey && process.env.NODE_ENV === 'production') {
    return new ElevenLabsAudioService();
  } else {
    return new MockAudioService();
  }
};
```

### Service Interface Consistency
```typescript
// All services (mock and real) implement the same interface
interface IStoryService {
  generateStory(input: StoryGenerationSeam['input']): Promise<StoryGenerationSeam['output']>;
  continueStory(input: ChapterContinuationSeam['input']): Promise<ChapterContinuationSeam['output']>;
}

interface IAudioService {
  convertToAudio(input: AudioConversionSeam['input']): Promise<AudioConversionSeam['output']>;
  getConversionProgress(audioId: string): Promise<AudioProgress>;
}
```

## 🔍 Error Handling Patterns

### Domain-Specific Error Codes
```typescript
// Spicy content validation
const validateSpicyLevel = (level: SpicyLevel, creature: CreatureType): void => {
  if (level > 5 || level < 1) {
    throw new ValidationError('INVALID_SPICY_LEVEL', 'Spicy level must be between 1 and 5');
  }
  
  // Domain-specific validation
  if (creature === 'fairy' && level > 4) {
    throw new ValidationError('FAIRY_SPICY_LIMIT', 'Fairy stories cannot exceed spicy level 4');
  }
};

// AI service error mapping
const mapGrokError = (grokError: any): ContractError => {
  switch (grokError.code) {
    case 'RATE_LIMIT_EXCEEDED':
      return {
        code: 'GENERATION_FAILED',
        message: 'Story generation temporarily unavailable. Please try again in a few minutes.',
        retryable: true,
        retryAfter: 300 // 5 minutes
      };
    case 'CONTENT_POLICY_VIOLATION':
      return {
        code: 'CONTENT_VIOLATION',
        message: 'Story content violates content policy. Please adjust spicy level or themes.',
        retryable: false
      };
    default:
      return {
        code: 'GENERATION_FAILED',
        message: 'Failed to generate story. Please try again.',
        retryable: true
      };
  }
};
```

## 📊 Performance & Monitoring

### Request Tracking
```typescript
// Request ID for debugging integration issues
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Processing time monitoring
const trackProcessingTime = (operation: string) => {
  const startTime = Date.now();
  return () => {
    const duration = Date.now() - startTime;
    console.log(`[${operation}] Processing time: ${duration}ms`);
    return duration;
  };
};
```

### Rate Limiting & Quotas
```typescript
// ElevenLabs quota management
const checkAudioQuota = async (): Promise<void> => {
  const usage = await elevenLabsClient.getUsage();
  if (usage.remaining < 1000) { // Less than 1000 characters remaining
    throw new QuotaError('AUDIO_QUOTA_EXCEEDED', 'TTS quota exceeded', usage.resetTime);
  }
};

// Grok rate limiting
const rateLimiter = new Map<string, number>();
const checkRateLimit = (ip: string): void => {
  const now = Date.now();
  const requests = rateLimiter.get(ip) || 0;
  
  if (requests > 10) { // Max 10 requests per minute
    throw new RateLimitError('RATE_LIMIT_EXCEEDED', 'Too many requests');
  }
  
  rateLimiter.set(ip, requests + 1);
  setTimeout(() => rateLimiter.delete(ip), 60000); // Reset after 1 minute
};
```

## 🧪 Testing Backend Services

### Contract Validation Tests
```typescript
describe('Story Generation Service', () => {
  it('should return response matching exact contract', async () => {
    const input: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance', 'dark'],
      userInput: 'Victorian setting',
      spicyLevel: 3,
      wordCount: 900
    };
    
    const result = await storyService.generateStory(input);
    
    // Validate exact contract match
    expect(result).toMatchObject({
      storyId: expect.any(String),
      title: expect.any(String),
      content: expect.any(String),
      creature: 'vampire',
      themes: ['romance', 'dark'],
      spicyLevel: 3,
      actualWordCount: expect.any(Number),
      estimatedReadTime: expect.any(Number),
      hasCliffhanger: expect.any(Boolean),
      generatedAt: expect.any(Date)
    });
  });
});
```

### Mock Service Testing
```typescript
describe('Mock Services', () => {
  it('should provide realistic processing delays', async () => {
    const startTime = Date.now();
    await mockStoryService.generateStory(sampleInput);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeGreaterThan(2000); // At least 2 seconds
    expect(duration).toBeLessThan(6000); // Less than 6 seconds
  });
});
```

## 🚀 Deployment Considerations

### Environment Variables
```bash
# Required for production
XAI_API_KEY=your_grok_api_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Optional configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://fairytaleswithspice.vercel.app
STORAGE_BASE_URL=https://storage.fairytaleswithspice.com

# Development only
DEBUG=fairytales:*
```

### Health Check Endpoint
```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      grok: !!process.env.XAI_API_KEY ? 'configured' : 'mock',
      elevenlabs: !!process.env.ELEVENLABS_API_KEY ? 'configured' : 'mock'
    },
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.json(health);
});
```

## 📝 Development Workflow

### Adding New Features
1. **Update contracts.ts** in both frontend and backend
2. **Implement mock service** with realistic behavior
3. **Add route handler** following standardized pattern
4. **Implement real service** integration
5. **Add service factory** for mock/real switching
6. **Test contract adherence** with validation

### Debugging Integration Issues
1. Check request/response logs with request IDs
2. Validate contract structures match exactly
3. Test mock services independently
4. Verify environment variable configuration
5. Check external API response mapping

---

**Remember**: Backend exists to fulfill frontend contracts exactly. When integration fails, fix the contract and regenerate - never debug the generated code! 🚀