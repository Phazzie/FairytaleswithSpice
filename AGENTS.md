# AI Agents Guide: Fairytales with Spice

## 🎯 Project Overview

**Fairytales with Spice** is an AI-powered story generation platform that creates spicy fairy tales using **Seam-Driven Development** methodology. This guide provides comprehensive instructions for AI agents working on this codebase.

### Core Domain Concepts
- **Spicy Fairy Tales**: Adult-oriented reimaginings of classic fairy tales
- **Creature-Based Stories**: Vampire, werewolf, and fairy protagonists
- **Content Rating System**: 1-5 spicy levels for content intensity
- **Multi-Modal Output**: Text stories, audio narration, multiple export formats

## 🏗️ Architecture: Seam-Driven Development

### What is Seam-Driven Development?
Every data boundary (seam) is explicitly defined with TypeScript contracts **before** implementation. This prevents integration failures and enables seamless mock-to-real service transitions.

### Project Structure
```
📁 FairytaleswithSpice/
├── 📁 story-generator/          # Angular frontend
│   └── src/app/contracts.ts     # Frontend seam contracts
├── 📁 backend/                  # Express.js backend
│   └── src/types/contracts.ts   # Backend seam contracts (identical)
└── 📁 .github/
    └── copilot-instructions.md  # Development methodology
```

## 📋 Established Seam Contracts

### Type Definitions (Domain Language)
```typescript
export type CreatureType = 'vampire' | 'werewolf' | 'fairy';
export type ThemeType = 'romance' | 'adventure' | 'mystery' | 'comedy' | 'dark';
export type SpicyLevel = 1 | 2 | 3 | 4 | 5;
export type WordCount = 700 | 900 | 1200;
export type VoiceType = 'female' | 'male' | 'neutral';
export type AudioSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;
export type AudioFormat = 'mp3' | 'wav' | 'aac';
export type ExportFormat = 'pdf' | 'txt' | 'html' | 'epub' | 'docx';
```

### SEAM 1: User Input → Story Generator
**Purpose**: Transform form inputs into AI-generated story content
```typescript
interface StoryGenerationSeam {
  input: {
    creature: CreatureType;
    themes: ThemeType[];
    userInput: string; // Optional custom ideas
    spicyLevel: SpicyLevel;
    wordCount: WordCount;
  };
  
  output: {
    storyId: string;
    title: string;
    content: string; // HTML formatted for [innerHTML] binding
    actualWordCount: number;
    estimatedReadTime: number; // in minutes
    hasCliffhanger: boolean; // controls "Continue Chapter" button
    generatedAt: Date;
  };
}
```

### SEAM 2: Story → Chapter Continuation
**Purpose**: Extend existing stories with new chapters maintaining tone/style
```typescript
interface ChapterContinuationSeam {
  input: {
    storyId: string;
    currentChapterCount: number;
    existingContent: string; // Full story HTML
    userInput?: string; // Optional continuation hints
    maintainTone: boolean; // Keep same spicy level and themes
  };
  
  output: {
    chapterId: string;
    chapterNumber: number;
    title: string;
    content: string; // New chapter HTML
    cliffhangerEnding: boolean;
    appendedToStory: string; // Full updated story
  };
}
```

### SEAM 3: Story Text → Audio Converter
**Purpose**: Convert HTML story content to audio narration
```typescript
interface AudioConversionSeam {
  input: {
    storyId: string;
    content: string; // HTML content (cleaned for TTS)
    voice: VoiceType;
    speed: AudioSpeed;
    format: AudioFormat;
  };
  
  output: {
    audioId: string;
    storyId: string;
    downloadUrl: string; // Direct download URL
    duration: number; // in seconds
    fileSize: number; // in bytes
  };
}
```

### SEAM 4: Story Data → Save/Export System
**Purpose**: Export stories in various formats for download
```typescript
interface SaveExportSeam {
  input: {
    storyId: string;
    content: string; // Full story HTML
    title: string;
    format: ExportFormat;
    includeMetadata?: boolean;
    includeChapters?: boolean;
  };
  
  output: {
    exportId: string;
    downloadUrl: string;
    filename: string;
    format: ExportFormat;
    fileSize: number;
    expiresAt: Date;
  };
}
```

## 🚦 Standardized Error Handling

All seams use consistent error patterns:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    processingTime: number;
    rateLimitRemaining?: number;
  };
}
```

Common error codes:
- `GENERATION_FAILED`: AI story generation failed
- `STORY_NOT_FOUND`: Referenced story doesn't exist
- `AUDIO_QUOTA_EXCEEDED`: TTS API limits reached
- `FORMAT_NOT_SUPPORTED`: Export format unavailable

## 🔧 Development Workflow for Agents

### 1. **Understanding Existing Seams**
- Always examine `contracts.ts` files first
- Understand data flow: Form → API → AI Services → Response
- Note the mock/real service switching mechanism

### 2. **Adding New Features**
```bash
# Step 1: Define the contract
# Edit contracts.ts with new seam interface

# Step 2: Implement UI with mocks
# Create components using contract types

# Step 3: Generate backend service
# Implement service conforming to contract

# Step 4: Connect real APIs
# Replace mocks with Grok AI / ElevenLabs integration
```

### 3. **Mock-First Development**
The backend includes mock implementations for all services:
- **Story Generation**: Realistic fake stories with proper HTML structure
- **Audio Conversion**: Mock audio URLs with realistic processing times
- **Export System**: Mock download URLs for all formats

Development works fully without external API keys.

## 🧪 Testing Strategy

### Contract Validation
```typescript
// Example: Validate story generation output
const validateStoryOutput = (output: any): output is StoryGenerationSeam['output'] => {
  return typeof output.storyId === 'string' &&
         typeof output.title === 'string' &&
         typeof output.content === 'string' &&
         typeof output.actualWordCount === 'number' &&
         typeof output.hasCliffhanger === 'boolean';
};
```

### Integration Testing
1. **Mock Mode**: Test all features without external APIs
2. **Real Mode**: Test with actual API keys for production validation
3. **Contract Adherence**: Ensure responses match seam contracts exactly

## 🎨 UI/UX Considerations

### Content Rating Display
- Spicy Level 1-2: "Mild" (🌶️)
- Spicy Level 3: "Medium" (🌶️🌶️)
- Spicy Level 4-5: "Hot" (🌶️🌶️🌶️)

### Progress Indicators
- Story generation: Show AI thinking with creature-themed animations
- Audio conversion: Display waveform progress
- Export: Show format-specific progress messages

### Responsive Design
- Mobile-first approach for story reading
- Touch-friendly controls for audio playback
- Swipe gestures for chapter navigation

## 🔍 Troubleshooting Guide

### Common Integration Issues

**❌ Problem**: Frontend receives different data structure than expected
**✅ Solution**: Check contract definitions match exactly between frontend/backend

**❌ Problem**: Audio conversion fails silently
**✅ Solution**: Verify HTML content is properly cleaned for TTS processing

**❌ Problem**: Export downloads return 404
**✅ Solution**: Check storage URL configuration and file expiration times

**❌ Problem**: Story generation produces malformed HTML
**✅ Solution**: Validate AI response parsing and HTML sanitization

### API Key Issues

**Development Mode (No Keys)**:
- All features work with realistic mocks
- Processing delays simulate real API response times
- Generated content follows proper content rating guidelines

**Production Mode (With Keys)**:
- Grok API: Used for story and chapter generation
- ElevenLabs API: Used for text-to-speech conversion
- Rate limiting and quota management handled automatically

## 🚀 Performance Considerations

### Story Generation
- Cache common prompt templates
- Implement request deduplication
- Use streaming for long story generation

### Audio Processing
- Process audio in chunks for long stories
- Compress audio files for faster downloads
- Implement progressive download for playback

### Export System
- Generate exports asynchronously
- Cache popular export formats
- Implement cleanup for expired downloads

## 📝 Code Quality Standards

### TypeScript Strictness
- All seam interfaces must be strictly typed
- No `any` types in contract definitions
- Use type guards for runtime validation

### Error Handling
- Every API call must handle all defined error cases
- User-friendly error messages for all spicy levels
- Graceful degradation when external services fail

### Documentation
- All seam contracts include JSDoc comments
- API endpoints documented with OpenAPI/Swagger
- Component props documented with examples

## 🎯 Project-Specific Best Practices

### Content Generation
- Always respect the spicy level constraints
- Maintain character consistency within stories
- Ensure appropriate content warnings are displayed

### User Experience
- Provide content previews before full generation
- Allow users to adjust spicy levels mid-story
- Implement "safe mode" for shared devices

### Data Privacy
- Never log user story inputs or generated content
- Implement proper session management
- Clear temporary files after processing

---

## 📚 Quick Reference

### Essential Files
- `contracts.ts`: All seam definitions
- `storyService.ts`: AI integration logic
- `audioService.ts`: TTS processing
- `exportService.ts`: File format handling

### Key Commands
```bash
# Frontend development
cd story-generator && npm run dev

# Backend development  
cd backend && npm run dev

# Build for production
npm run build && npm start
```

### Environment Variables
```bash
GROK_API_KEY=your_grok_key
ELEVENLABS_API_KEY=your_elevenlabs_key
NODE_ENV=development|production
```

**Remember**: This is a seam-driven codebase. When in doubt, check the contracts first! 🚀