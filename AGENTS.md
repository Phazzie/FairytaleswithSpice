# World-Class AI Agents Guide: Fairytales with Spice

## 🎯 Project Overview

**Fairytales with Spice** is an AI-powered story generation platform that creates spicy fairy tales using a **Seam-Driven Development** methodology. This guide provides comprehensive, world-class instructions for AI agents working on this codebase.

### Core Domain Concepts
- **Spicy Fairy Tales**: Adult-oriented reimaginings of classic fairy tales.
- **Creature-Based Stories**: Vampire, werewolf, and fairy protagonists.
- **Content Rating System**: 1-5 spicy levels for content intensity.
- **Multi-Modal Output**: Text stories, audio narration, and multiple export formats.

## 🏗️ Architecture: Seam-Driven Development

### What is Seam-Driven Development?
Every data boundary (seam) is explicitly defined with TypeScript contracts **before** implementation. This prevents integration failures and enables seamless mock-to-real service transitions. It is the cornerstone of this project's architecture.

### Project Structure
```
📁 FairytaleswithSpice/
├── 📁 story-generator/          # Angular frontend
│   └── src/app/contracts.ts     # Frontend seam contracts
├── 📁 backend/                  # Express.js backend
│   └── src/types/contracts.ts   # Backend seam contracts (identical)
└── 📁 .github/
    └── copilot-instructions.md  # Development methodology for Copilot
```

## 📋 Established Seam Contracts

### Type Definitions (Domain Language)
This is the single source of truth for all data types in the application.
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
**Purpose**: Transforms user input from the frontend form into a fully-formed, AI-generated story.
```typescript
interface StoryGenerationSeam {
  input: {
    creature: CreatureType;
    themes: ThemeType[];
    userInput: string; // Optional custom ideas from the user
    spicyLevel: SpicyLevel;
    wordCount: WordCount;
  };
  
  output: {
    storyId: string;
    title: string;
    content: string; // HTML formatted for [innerHTML] binding
    actualWordCount: number;
    estimatedReadTime: number; // in minutes
    hasCliffhanger: boolean; // controls "Continue Chapter" button visibility
    generatedAt: Date;
  };
}
```

### SEAM 2: Story → Chapter Continuation
**Purpose**: Extends an existing story with a new chapter, maintaining the established tone and style.
```typescript
interface ChapterContinuationSeam {
  input: {
    storyId: string;
    currentChapterCount: number;
    existingContent: string; // Full story HTML
    userInput?: string; // Optional continuation hints from the user
    maintainTone: boolean; // Flag to keep the same spicy level and themes
  };
  
  output: {
    chapterId: string;
    chapterNumber: number;
    title: string;
    content: string; // New chapter HTML
    cliffhangerEnding: boolean;
    appendedToStory: string; // The full, updated story including the new chapter
  };
}
```

### SEAM 3: Story Text → Audio Converter
**Purpose**: Converts the HTML content of a story into an audio narration.
```typescript
interface AudioConversionSeam {
  input: {
    storyId: string;
    content: string; // HTML content (which will be cleaned for TTS)
    voice: VoiceType;
    speed: AudioSpeed;
    format: AudioFormat;
  };
  
  output: {
    audioId: string;
    storyId: string;
    downloadUrl: string; // Direct download URL for the audio file
    duration: number; // in seconds
    fileSize: number; // in bytes
  };
}
```

### SEAM 4: Story Data → Save/Export System
**Purpose**: Exports a story into various downloadable formats.
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

## 🚦 Standardized API Responses

All API interactions adhere to a standardized response structure to ensure consistency and predictability.

### The `ApiResponse` Wrapper
Every API response is wrapped in an `ApiResponse<T>` object, where `T` is the specific seam's output type.

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    processingTime: number; // in milliseconds
    rateLimitRemaining?: number;
  };
}
```

### Example: Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "storyId": "story_1678886400000_abcdef123",
    "title": "The Vampire's Kiss",
    "content": "<h3>Chapter 1</h3><p>Once upon a time...</p>",
    "actualWordCount": 750,
    "estimatedReadTime": 4,
    "hasCliffhanger": true,
    "generatedAt": "2023-03-15T12:00:00.000Z"
  },
  "metadata": {
    "requestId": "req_1678886400000_xyz",
    "processingTime": 1500
  }
}
```

### Example: Error Response (`4xx` or `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "GENERATION_FAILED",
    "message": "The AI model failed to generate a story.",
    "details": "Upstream API returned a 503 error."
  },
  "metadata": {
    "requestId": "req_1678886400000_abc",
    "processingTime": 250
  }
}
```

### Common Error Codes
- `INVALID_INPUT`: The request payload failed validation.
- `GENERATION_FAILED`: The AI story generation service failed.
- `STORY_NOT_FOUND`: The requested story ID does not exist.
- `AUDIO_QUOTA_EXCEEDED`: The text-to-speech API quota has been reached.
- `FORMAT_NOT_SUPPORTED`: The requested export format is not available.
- `INTERNAL_ERROR`: A generic server-side error occurred.

## 🔧 Contributor's Guide & Development Workflow

### 1. Understanding Existing Seams
- **Always start with `contracts.ts`**: These files are the single source of truth.
- **Trace the data flow**: Understand how data moves from the user's form, through the API, to the AI services, and back to the user.
- **Note the mock/real service switching**: The backend is designed to work seamlessly with or without real API keys.

### 2. How to Add a New Feature (Seam)
1.  **Define the Contract**: Open `contracts.ts` and define a new `YourNewFeatureSeam` interface with clear `input` and `output` shapes.
2.  **Implement the UI with Mocks**: Build your Angular component and service. Use the new contract type and create a mock implementation of the service that returns realistic data.
3.  **Implement the Backend Service**: Create a new service in the `backend/src/services` directory that implements the new seam. Start with a mock implementation.
4.  **Connect to Real APIs**: Once the mock implementation is working, connect your backend service to the real APIs (e.g., Grok AI, ElevenLabs).

### 3. Mock-First Development
The backend includes mock implementations for all services. This is a core principle of our development process.
- **Story Generation**: Generates realistic fake stories with proper HTML structure.
- **Audio Conversion**: Provides mock audio URLs with realistic processing times.
- **Export System**: Creates mock download URLs for all supported formats.
This allows for full end-to-end testing without incurring API costs or requiring API keys for every developer.

## 🧪 Testing Strategy

### Contract Validation
Use type guards to validate that the data moving across seams conforms to the contracts.
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
1.  **Mock Mode**: Run the full test suite against the mock services to ensure the application logic is correct.
2.  **Real Mode**: Run a smaller set of tests against the real APIs to validate the integration. This is typically done in a staging environment.
3.  **Contract Adherence**: Write tests that explicitly check if API responses match the seam contracts.

## 🔍 Troubleshooting Guide

### Common Integration Issues

**❌ Problem**: The frontend receives a different data structure than expected.
**✅ Solution**:
1.  Verify that the `contracts.ts` files in the frontend and backend are identical.
2.  Check the network tab in your browser's developer tools to inspect the actual API response.
3.  Ensure your backend service is correctly implementing the seam's `output` contract.

**❌ Problem**: Audio conversion fails silently.
**✅ Solution**:
1.  Check the backend logs for errors from the text-to-speech service.
2.  Verify that the HTML content being sent is properly cleaned and sanitized for TTS processing.

**❌ Problem**: Story generation produces malformed HTML.
**✅ Solution**:
1.  Inspect the prompt being sent to the AI model.
2.  Validate the AI's response before parsing and sanitizing it.
3.  Improve the HTML sanitization logic to handle more edge cases.

**❌ Problem**: Environment variables are not being loaded.
**✅ Solution**:
1.  Ensure you have a `.env` file in the `backend` directory.
2.  Verify that the variable names in your `.env` file match the ones used in the code (e.g., `XAI_API_KEY`).
3.  Restart the backend server after making changes to the `.env` file.

## 🚀 Performance Considerations

### Story Generation
- Cache common prompt templates to reduce redundant computations.
- Implement request deduplication for identical story requests.
- Use streaming for generating very long stories to improve perceived performance.

### Audio Processing
- Process long stories in audio chunks.
- Compress audio files to reduce their size and speed up downloads.
- Implement progressive download for audio playback.

### Export System
- Generate exports asynchronously in the background.
- Cache popular export formats to serve them instantly.
- Implement a cleanup mechanism for expired download links.

---

## 📚 Quick Reference

### Essential Files
- `story-generator/src/app/contracts.ts`: Frontend seam definitions.
- `backend/src/types/contracts.ts`: Backend seam definitions.
- `backend/src/services/storyService.ts`: AI integration logic.
- `backend/src/services/audioService.ts`: TTS processing logic.
- `backend/src/services/exportService.ts`: File format handling logic.

### Key Commands
```bash
# To run the frontend development server
cd story-generator && npm start

# To run the backend development server
cd backend && npm run dev
```

### Environment Variables
Create a `.env` file in the `backend` directory with the following variables:
```
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:4200

# Optional: For real AI services
XAI_API_KEY=your_grok_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

**Remember**: This is a seam-driven codebase. When in doubt, check the contracts first! 🚀