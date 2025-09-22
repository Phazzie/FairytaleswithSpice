# GitHub Coding Agent Task: Fix & Update Test Suite + ElevenLabs v3 Integration

## 🎯 **MISSION OVERVIEW**
Fix failing tests, update ElevenLabs integration to v3, and enhance the audio experience in the Fairytales with Spice application.

## 📊 **CURRENT STATUS**
- ✅ **Enhanced Story System**: 10 unconventional beat structures + author blending working perfectly
- ✅ **Audio Player**: Basic HTML5 audio player with download functionality exists
- ❌ **Tests**: 27/56 tests failing due to enhanced system changes
- ❌ **ElevenLabs**: Using old v1 model, needs upgrade to v3
- ❌ **Audio UX**: Missing advanced player controls and multi-voice visualization

## 🚨 **PRIMARY ISSUES TO FIX**

### 1. **Test Suite Failures** (Critical Priority)
**Problem**: Tests expect old "master storyteller" prompts but enhanced system generates new format:

```typescript
// FAILING: Tests expect this OLD format
expect.objectContaining({
  messages: ArrayContaining [
    ObjectContaining {"content": StringContaining "master storyteller"}
  ]
})

// ACTUAL: Enhanced system generates THIS new format  
"DYNAMIC STYLE SELECTION FOR THIS STORY:\nAnne Rice: \"Do you know what it means..."
```

**Required Actions**:
- [ ] Update `storyService.test.ts` prompt expectations to match enhanced system
- [ ] Fix mock generation fallback when `XAI_AI_KEY` is missing
- [ ] Update route tests to handle new response structures
- [ ] Add tests for new enhanced features (beat structures, author blending)
- [ ] Fix `rawContent` property handling in contracts
- [ ] Resolve audioService.test.ts compilation errors

### 2. **ElevenLabs Model Upgrade** (High Priority)
**Current**: Using `eleven_monolingual_v1` (old)
**Target**: Upgrade to `eleven_turbo_v2_5` or `eleven_multilingual_v2` (latest v3 models)

**Required Actions**:
- [ ] Research latest ElevenLabs v3 model names and capabilities
- [ ] Update `model_id` in `audioService.ts` (line 184)
- [ ] Test voice quality improvements
- [ ] Update voice settings for v3 optimization
- [ ] Add model fallback system (v3 → v2 → v1)

### 3. **Enhanced Audio Player** (Medium Priority)
**Current**: Basic HTML5 `<audio controls>` element
**Goal**: Professional audio experience with multi-voice visualization

**Required Actions**:
- [ ] Add playback speed controls (0.5x, 1x, 1.25x, 1.5x, 2x)
- [ ] Implement visual progress indicator with chapter markers
- [ ] Add speaker identification during playback (show current voice)
- [ ] Create volume controls and audio visualization
- [ ] Add keyboard shortcuts (spacebar = play/pause, arrow keys = seek)
- [ ] Implement auto-play next chapter functionality

## 🔧 **DETAILED IMPLEMENTATION TASKS**

### **Task A: Fix Test Suite**

#### A1. Update storyService.test.ts expectations
```typescript
// REPLACE old expectations like:
expect.objectContaining({
  messages: ArrayContaining [
    ObjectContaining {"content": StringContaining "master storyteller"}
  ]
})

// WITH new enhanced format expectations:
expect.objectContaining({
  messages: ArrayContaining [
    ObjectContaining {"content": StringContaining "DYNAMIC STYLE SELECTION"}
  ]
})
```

#### A2. Fix mock generation fallback
The enhanced system should call `generateMockStory()` when API key is missing. Currently it's trying to call Grok API even without key.

#### A3. Add enhanced system tests
```typescript
describe('Enhanced Story Features', () => {
  it('should include author style blending in prompts', async () => {
    // Test that prompts contain author combinations
  });
  
  it('should use unconventional beat structures', async () => {
    // Test that prompts contain one of 10 beat structures
  });
  
  it('should plant Chekhov elements', async () => {
    // Test that prompts contain [Chekhov1] and [Chekhov2]
  });
});
```

### **Task B: ElevenLabs v3 Integration**

#### B1. Research latest models
Check ElevenLabs documentation for:
- Latest model names (likely `eleven_turbo_v2_5` or `eleven_multilingual_v2`)
- New voice settings parameters
- Improved quality/speed optimizations

#### B2. Update audioService.ts
```typescript
// CURRENT (line 184):
model_id: 'eleven_monolingual_v1',

// UPDATE TO:
model_id: process.env.ELEVENLABS_MODEL_V3 || 'eleven_turbo_v2_5', // Latest v3 model
```

#### B3. Add model fallback system
```typescript
const ELEVENLABS_MODELS = [
  'eleven_turbo_v2_5',      // v3 - fastest
  'eleven_multilingual_v2', // v3 - best quality  
  'eleven_monolingual_v1'   // v1 - fallback
];
```

### **Task C: Enhanced Audio Player**

#### C1. Create AudioPlayerComponent
```typescript
// New file: story-generator/src/app/audio-player/audio-player.component.ts
export class AudioPlayerComponent {
  @Input() audioUrl: string;
  @Input() duration: number;
  @Input() multiVoiceData?: any; // For speaker identification
  
  // Playback controls
  playbackSpeed = 1.0;
  currentTime = 0;
  isPlaying = false;
  volume = 1.0;
  
  // Methods
  togglePlayback() { }
  setPlaybackSpeed(speed: number) { }
  seek(time: number) { }
  onKeyboardShortcut(event: KeyboardEvent) { }
}
```

#### C2. Add speaker visualization
When multi-voice audio is playing, show current speaker:
```html
<div class="speaker-indicator" *ngIf="currentSpeaker">
  🎭 Now Speaking: {{ currentSpeaker }}
  <span class="voice-type">({{ currentVoiceType }})</span>
</div>
```

#### C3. Implement advanced controls
```html
<div class="audio-controls-advanced">
  <button (click)="togglePlayback()">⏯️</button>
  <input type="range" [(ngModel)]="currentTime" [max]="duration">
  <select [(ngModel)]="playbackSpeed">
    <option value="0.5">0.5x</option>
    <option value="1.0">1x</option>
    <option value="1.25">1.25x</option>
    <option value="1.5">1.5x</option>
    <option value="2.0">2x</option>
  </select>
</div>
```

## 🧪 **TESTING REQUIREMENTS**

### **Test Coverage Goals**:
- [ ] All existing tests passing (56/56)
- [ ] Enhanced system features covered (author blending, beat structures)
- [ ] ElevenLabs v3 integration tested
- [ ] Audio player component fully tested
- [ ] Error handling and fallbacks verified

### **Quality Gates**:
- [ ] No regression in story generation quality
- [ ] Audio conversion time improved with v3 models
- [ ] User experience enhanced with new audio player
- [ ] All seam contracts maintained and validated

## 📁 **KEY FILES TO MODIFY**

### **Tests & Contracts**:
- `backend/src/services/storyService.test.ts` - Update prompt expectations
- `backend/src/routes/storyRoutes.test.ts` - Fix response structure tests
- `backend/src/services/audioService.test.ts` - Fix compilation errors
- `backend/src/types/contracts.ts` - Ensure rawContent property
- `api/lib/types/contracts.ts` - Mirror backend contracts

### **ElevenLabs Integration**:
- `api/lib/services/audioService.ts` - Upgrade to v3 models
- `backend/src/services/audioService.ts` - Mirror API changes

### **Frontend Audio Player**:
- `story-generator/src/app/app.html` - Enhanced audio player UI
- `story-generator/src/app/app.css` - Audio player styling
- `story-generator/src/app/app.ts` - Audio player logic
- Create new: `story-generator/src/app/audio-player/` component

## 🎯 **SUCCESS CRITERIA**

### **Must Have**:
- ✅ All 56 tests passing
- ✅ ElevenLabs v3 models working
- ✅ Enhanced story system fully tested
- ✅ Basic audio player improvements

### **Should Have**:
- ✅ Advanced audio player with speed controls
- ✅ Speaker identification during playback
- ✅ Keyboard shortcuts for audio control
- ✅ Visual progress indicators

### **Nice to Have**:
- ✅ Audio visualization during playback
- ✅ Chapter markers in audio timeline
- ✅ Auto-play next chapter functionality
- ✅ Audio quality comparison (v1 vs v3)

## 🚀 **IMPLEMENTATION ORDER**

1. **Phase 1: Fix Tests** (Blocking - must complete first)
   - Update test expectations for enhanced prompts
   - Fix mock generation fallback
   - Resolve compilation errors

2. **Phase 2: ElevenLabs v3** (High impact)
   - Research and implement latest models
   - Test voice quality improvements
   - Add fallback system

3. **Phase 3: Audio Player** (User experience)
   - Create enhanced audio controls
   - Add speaker identification
   - Implement keyboard shortcuts

## 📝 **NOTES & CONTEXT**

- **Enhanced Story System**: The 10 unconventional beat structures are working perfectly and generating amazing story variety
- **Current Audio**: Basic functionality exists but needs professional polish
- **Test Architecture**: Uses Jest with mock services for development without API keys
- **Seam-Driven Development**: All changes must maintain explicit contracts between components
- **User Experience**: Goal is to create a premium storytelling platform with excellent audio narration

## 🤝 **COLLABORATION NOTES**

- **Test Changes**: Can be validated locally with `npm test`
- **ElevenLabs Testing**: May need API key for full validation
- **Audio Player**: Should work with both mock and real audio URLs
- **Breaking Changes**: Avoid breaking existing story generation functionality

---

**AGENT INSTRUCTIONS**: Please implement these tasks in the order specified, ensuring each phase is complete before moving to the next. Focus on maintaining the seam-driven architecture and comprehensive test coverage throughout the implementation.