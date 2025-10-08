# GitHub Coding Agent: Deep Code Analysis Task

## 🎯 MISSION: Find What a Surface-Level AI Would Miss

You are NOT a documentation reviewer. You are a **code archeologist and security auditor** tasked with finding bugs, flaws, performance issues, and architectural problems that require **reading and understanding the actual implementation**.

---

## 🚫 WHAT NOT TO DO

**DO NOT:**
- Summarize what files do based on their names
- Suggest adding comments or documentation
- Recommend TypeScript type improvements unless they reveal actual bugs
- Suggest stylistic changes (prettier will handle that)
- Rely on README files or documentation to understand behavior
- Make assumptions about what code "should" do without reading it

---

## ✅ WHAT TO DO: Read the Actual Code

### 1. **RUNTIME BEHAVIOR ANALYSIS**

**Read the code paths and trace execution:**

- **API Endpoints** (`api/story/generate.ts`, `api/story/continue.ts`, `api/audio/convert.ts`, `api/export/save.ts`):
  - What happens if the Grok API returns malformed JSON?
  - What if `generateStory()` throws an exception mid-stream?
  - Are there unhandled promise rejections?
  - What happens if two requests come in simultaneously with same storyId?
  - Are there race conditions in streaming responses?

- **Story Service** (`api/lib/services/storyService.ts`):
  - Read lines 150-400: What happens if `xaiStream()` throws after first chunk?
  - Read lines 300-380: Is there proper cleanup if generation fails halfway?
  - Read lines 500-700: Do the random selection functions have edge cases?
  - What if `selectRandomAuthorStyles()` gets an invalid creature type?
  - Can `buildSystemPrompt()` produce prompts that break Grok's token limits?

- **Audio Service** (`api/lib/services/audioService.ts`):
  - Read the actual implementation: How does it handle HTML entity decoding?
  - What happens if ElevenLabs API is down? Does it retry? Timeout?
  - Are there memory leaks when processing large story content?
  - Does it properly clean up temporary files?

- **Export Service** (`api/lib/services/exportService.ts`):
  - Read the export logic: Are there XSS vulnerabilities in HTML exports?
  - What happens if export generation takes 2+ minutes?
  - Are there file descriptor leaks?
  - Does PDF generation handle Unicode characters properly?

### 2. **DATA FLOW & STATE BUGS**

**Trace data transformations:**

- **Frontend → Backend Contract Violations**:
  - Read `story-generator/src/app/contracts.ts` vs `api/lib/types/contracts.ts`
  - Are they ACTUALLY identical or just similar?
  - What happens if frontend sends `spicyLevel: 6` (invalid)?
  - Does the backend validate `wordCount` is one of the allowed values?

- **Story Continuation Logic**:
  - Read the continuation flow in `storyService.ts`
  - Does it actually parse previous chapters correctly?
  - What if a story has 10 chapters - does it send ALL to Grok or summarize?
  - Is there a token limit explosion risk?

- **Streaming State Management**:
  - Read `api/story/stream.ts` implementation
  - What happens if client disconnects mid-stream?
  - Are there orphaned streams consuming memory?
  - Does SSE handle backpressure properly?

### 3. **SECURITY VULNERABILITIES**

**Read for actual attack vectors:**

- **Prompt Injection**:
  - Read `buildSystemPrompt()` in `storyService.ts`
  - Can user input escape the prompt structure?
  - Example: `userInput: "IGNORE PREVIOUS INSTRUCTIONS AND..."`
  - Does the code sanitize or validate user input before injecting into prompts?

- **API Key Exposure**:
  - Search the codebase: Are API keys accidentally logged?
  - Read error handling: Do stack traces leak sensitive config?
  - Are there debug logs that log full request bodies?

- **File System Access**:
  - Read export/audio services: Can user control file paths?
  - Path traversal vulnerabilities? (`../../etc/passwd`)
  - Are temp files cleaned up even on error?

- **Rate Limiting & DoS**:
  - Is there ANY rate limiting on the API endpoints?
  - Can someone spam `/api/story/generate` and drain Grok credits?
  - Are there memory limits on story size?

### 4. **PERFORMANCE & RESOURCE LEAKS**

**Read for inefficiencies:**

- **Memory Usage**:
  - Read streaming implementation: Are chunks buffered in memory?
  - What's the maximum story size before OOM errors?
  - Are there circular references preventing garbage collection?

- **Network Efficiency**:
  - Read Grok API calls: Are they using HTTP/2 connection pooling?
  - Are there unnecessary round trips?
  - Does audio conversion retry logic cause exponential backoff issues?

- **Blocking Operations**:
  - Search for synchronous file system calls (should be async)
  - Are there CPU-intensive operations blocking the event loop?
  - Does HTML-to-PDF conversion block the entire server?

### 5. **ERROR HANDLING GAPS**

**Read every try/catch block:**

- **Unhandled Edge Cases**:
  - What if Grok returns a 429 (rate limit)?
  - What if ElevenLabs returns 402 (payment required)?
  - What if story generation takes 5 minutes and times out?
  - Are there proper HTTP status codes for each failure type?

- **Error Propagation**:
  - Read error handling: Do errors get swallowed silently?
  - Are generic "500 Internal Server Error" responses helpful?
  - Do errors get logged with enough context to debug?

- **Graceful Degradation**:
  - What happens when external APIs are down?
  - Does the app fall back to mocks gracefully?
  - Are there circuit breakers for failing services?

### 6. **BUSINESS LOGIC BUGS**

**Read the actual implementation vs intended behavior:**

- **Story Generation Quality**:
  - Read `buildSystemPrompt()`: Does it actually enforce spicy levels?
  - Does the prompt construction create contradictions?
  - Example: "Write 900 words" but prompt is already 2000 tokens
  - Are beat structures mutually exclusive or can they conflict?

- **Continuation Consistency**:
  - Read continuation logic: Does it preserve character names?
  - What if first chapter has vampire named "Dmitri", does AI maintain that?
  - Is there logic to extract character names from previous chapters?

- **Audio-Text Sync**:
  - Read audio conversion: Does it strip HTML tags properly?
  - What about special characters like em-dashes, quotes?
  - Does voice metadata format confuse TTS engines?

- **Cliffhanger Detection**:
  - Read the code: How does it determine `hasCliffhanger: boolean`?
  - Is it actually parsing AI output or just guessing?
  - What if AI doesn't follow the serialization hook instructions?

### 7. **INTEGRATION BUGS**

**Read cross-service interactions:**

- **Frontend-Backend Mismatch**:
  - Read Angular service (`story.service.ts`) HTTP calls
  - Do they match the API endpoint signatures?
  - Are headers being set correctly?
  - Does CORS configuration allow the requests?

- **Third-Party API Assumptions**:
  - Read Grok API integration: Does code assume response structure?
  - What if Grok changes their API format?
  - Are API versions pinned or using "latest"?

- **Environment Configuration**:
  - Read how environment variables are loaded
  - What happens if `XAI_API_KEY` is undefined?
  - Are there sensible defaults for dev vs production?

---

## 📋 SPECIFIC FILES TO DEEP-READ

### CRITICAL PATH (Read Line-by-Line):
1. **`api/lib/services/storyService.ts`** (Lines 1-900)
   - Focus: Prompt injection, token limits, error handling
   
2. **`api/story/generate.ts`** + **`api/story/stream.ts`**
   - Focus: Streaming state, concurrent requests, timeouts

3. **`api/lib/services/audioService.ts`**
   - Focus: HTML sanitization, API error handling, file cleanup

4. **`story-generator/src/app/story.service.ts`**
   - Focus: Error propagation, response parsing, state management

### SECURITY AUDIT:
5. **Search for**: `process.env`, `console.log`, `eval`, `new Function`, `innerHTML`
   - Look for accidental exposure, injection risks

6. **Search for**: `try {` without `catch` or empty catch blocks
   - Look for swallowed errors

7. **Search for**: `setTimeout`, `setInterval`
   - Look for memory leaks, orphaned timers

---

## 🎯 OUTPUT FORMAT

For each bug/flaw found, provide:

### 1. **Bug Title** (One-line description)

### 2. **Location**
- File: `exact/path/to/file.ts`
- Lines: `123-145`
- Function: `functionName()`

### 3. **Actual Code Snippet**
```typescript
// Show the problematic code (5-10 lines)
```

### 4. **The Problem**
- What happens at runtime?
- What's the attack vector?
- What's the performance impact?
- What data gets corrupted?

### 5. **Reproduction Steps**
```bash
# Exact curl command or test case to trigger the bug
curl -X POST http://localhost:3000/api/story/generate \
  -H "Content-Type: application/json" \
  -d '{"userInput": "MALICIOUS INPUT HERE"}'
```

### 6. **Severity**
- 🔴 CRITICAL: Security, data loss, crashes
- 🟠 HIGH: Incorrect behavior, bad UX, performance
- 🟡 MEDIUM: Edge cases, rare scenarios
- 🟢 LOW: Code quality, potential future issues

### 7. **Proposed Fix**
```typescript
// Show the corrected code
```

---

## 🧪 TESTING CHECKLIST

Before marking analysis complete, have you:

- [ ] Read every API endpoint handler implementation?
- [ ] Traced at least 3 complete request flows from frontend to AI API?
- [ ] Found at least 1 unhandled error case?
- [ ] Checked for prompt injection vulnerabilities?
- [ ] Verified environment variable handling?
- [ ] Looked for race conditions in async code?
- [ ] Checked for memory leaks in streaming/audio?
- [ ] Validated contract consistency frontend↔backend?
- [ ] Looked for file system security issues?
- [ ] Checked for proper HTTP status code usage?

---

## 💡 THINK LIKE AN ATTACKER

**Try to break it:**
- "What if I send 10,000 requests per second?"
- "What if I send a 1MB userInput string?"
- "What if I set spicyLevel to -1 or 999?"
- "What if I disconnect during streaming?"
- "What if I send HTML/JavaScript in userInput?"
- "What if Grok API returns HTML instead of JSON?"
- "What if I request export of a non-existent storyId?"

**Try to confuse it:**
- "What if I continue a chapter that doesn't exist?"
- "What if I send invalid creature type?"
- "What if I generate audio for empty content?"
- "What if I export the same story 1000 times simultaneously?"

---

## 🎯 SUCCESS CRITERIA

You've done your job when you find:

✅ **3+ security vulnerabilities** (prompt injection, path traversal, API key exposure)
✅ **5+ unhandled error cases** (specific API failures, edge cases)
✅ **2+ race conditions or concurrency bugs**
✅ **3+ performance issues** (memory leaks, blocking operations, inefficient algorithms)
✅ **2+ business logic flaws** (incorrect behavior vs intended functionality)

---

## 🚀 START HERE

1. **Clone the repo and set up locally** (if you haven't)
2. **Start with**: `api/lib/services/storyService.ts` - Read lines 1-900
3. **Next**: `api/story/generate.ts` - Trace the request flow
4. **Then**: Search for `try {` across all files
5. **Finally**: Test your findings with actual curl commands

**Remember**: You're not reviewing documentation. You're hunting bugs in running code.

Go deep. Break things. Find what I missed. 🔍🐛
