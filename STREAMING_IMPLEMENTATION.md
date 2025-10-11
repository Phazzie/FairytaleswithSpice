# Streaming Implementation Plan

## Overview
Add Server-Sent Events (SSE) streaming to story generation for real-time progress feedback.

## Current State
- Backend has `generateStoryStreaming()` method (not yet wired up)
- `api/story/stream.ts` endpoint exists but not complete
- Generation takes ~21 seconds - users see nothing until completion

## Implementation Steps

### Phase 1: Backend Streaming (30 min)
1. ✅ Complete SSE endpoint in `api/story/stream.ts`
2. ✅ Wire up `storyService.generateStoryStreaming()`
3. ✅ Add progress events: 0%, 25%, 50%, 75%, 100%
4. ✅ Return partial story chunks as they generate

### Phase 2: Frontend Integration (30 min)
1. Add EventSource to StoryService in Angular
2. Create streaming UI component
3. Show progress bar with percentage
4. Display partial content as it arrives
5. Handle completion/errors

## API Design

### SSE Endpoint: GET `/api/story/stream`
**Query Parameters:**
- `creature`: vampire|werewolf|fairy
- `themes`: romance,dark (comma-separated)
- `spicyLevel`: 1-5
- `wordCount`: 700|900|1200
- `userInput`: (optional) custom ideas

**Event Stream Format:**
```
event: progress
data: {"percentage": 25, "message": "Crafting plot structure..."}

event: chunk
data: {"content": "<p>The vampire lord stood..."}

event: complete
data: {"storyId": "story_123", "title": "Moonlit Desires", ...}

event: error
data: {"code": "GENERATION_FAILED", "message": "..."}
```

## Progress Messages
- 0%: "Initializing story generation..."
- 25%: "Crafting plot structure..."
- 50%: "Developing characters and dialogue..."
- 75%: "Adding spicy details..."
- 100%: "Finalizing your tale..."

## Benefits
- ✅ Users see immediate feedback (no 21-second wait)
- ✅ Better UX - feels faster even if same duration
- ✅ Can cancel mid-generation
- ✅ Shows what AI is working on
- ✅ Reduces perceived latency by 50%+

## Testing
- Test with all creature types
- Test error handling (API timeout, invalid input)
- Test connection drops mid-stream
- Test multiple concurrent streams

## Rollout
1. Deploy backend SSE endpoint
2. Keep non-streaming endpoint as fallback
3. Add feature flag for streaming
4. Monitor streaming performance
5. Gradually enable for all users

**Status**: Ready to implement
**Estimated Time**: 60 minutes total
**Priority**: High (significant UX improvement)
