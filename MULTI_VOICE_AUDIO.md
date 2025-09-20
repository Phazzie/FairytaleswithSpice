# Multi-Voice Audio Generation Documentation

## Overview

The Fairytales with Spice platform now supports **multi-voice audio generation**, creating immersive audiobooks where different characters speak with distinct, character-appropriate voices.

## Features

### 🎭 Character-Specific Voices

The system automatically assigns voices based on creature types and character analysis:

- **Vampires**: Deep, seductive voices (male/female variants)
- **Werewolves**: Gruff, powerful voices (male/female variants)  
- **Fairies**: Ethereal, mystical voices (gender-neutral variants)
- **Humans**: Relatable, emotional voices (multiple personality variants)
- **Narrator**: Neutral storytelling or intimate voices

### 😊 Emotional Inflection

The system recognizes emotional context and adjusts voice settings accordingly:

- `seductive`, `fearful`, `defiant`, `angry`, `tender`
- `mysterious`, `playful`, `intense`, `vulnerable`, `commanding`
- `intimate`, `neutral`

## Usage

### Story Format Requirements

Stories must use the `[Speaker]:` dialogue format for multi-voice generation:

```
[Narrator]: The moonlight cast eerie shadows across the castle courtyard.
[Vampire Lord, seductive]: "You shouldn't have come here alone, my dear."
[Sarah, fearful but defiant]: "I'm not afraid of you!"
[Narrator, intimate]: Her voice trembled despite her brave words.
```

### API Integration

#### Input Parameters

```typescript
{
  storyId: string;
  content: string; // HTML content with [Speaker]: format
  multiVoice?: boolean; // Enable multi-voice (default: true)
  creatureType?: CreatureType; // For intelligent voice assignment
  characterVoiceOverrides?: Record<string, CharacterVoiceType>; // Manual assignments
  voice?: VoiceType; // Fallback voice
  speed?: AudioSpeed;
  format?: AudioFormat;
}
```

#### Response

```typescript
{
  audioId: string;
  audioUrl: string; // Final compiled audiobook
  isMultiVoice: boolean;
  multiVoiceResult?: {
    segments: SpeakerSegment[]; // Individual character segments
    characterVoices: Record<string, CharacterVoiceType>; // Voice assignments
    totalDuration: number;
  };
  // ... standard audio response fields
}
```

## ElevenLabs Integration

### Required Environment Variables

```bash
# Core API access
ELEVENLABS_API_KEY=your_api_key_here

# Character-specific voice IDs (optional, falls back to defaults)
ELEVENLABS_VAMPIRE_MALE=voice_id_here
ELEVENLABS_VAMPIRE_FEMALE=voice_id_here
ELEVENLABS_WEREWOLF_MALE=voice_id_here
ELEVENLABS_WEREWOLF_FEMALE=voice_id_here
ELEVENLABS_FAIRY_ETHEREAL=voice_id_here
ELEVENLABS_FAIRY_MYSTICAL=voice_id_here
ELEVENLABS_HUMAN_MALE=voice_id_here
ELEVENLABS_HUMAN_FEMALE=voice_id_here
ELEVENLABS_NARRATOR_NEUTRAL=voice_id_here
ELEVENLABS_NARRATOR_INTIMATE=voice_id_here
```

### Voice Settings Optimization

The system automatically adjusts ElevenLabs voice settings based on emotional context:

- **Seductive**: Lower stability (0.3), higher style (0.8)
- **Fearful**: Very low stability (0.2), low style (0.3)
- **Angry**: High stability (0.7), high style (0.9)
- **Tender**: High stability (0.8), low style (0.2)
- **Commanding**: Very high stability (0.9), high style (0.7)

## Error Handling

### Graceful Degradation

1. **Multi-voice parsing fails** → Falls back to single-voice generation
2. **Character voice generation fails** → Uses neutral narrator voice
3. **API quota exceeded** → Returns mock audio with error details
4. **Network issues** → Comprehensive retry logic with exponential backoff

### Error Types

- `DIALOGUE_PARSING_FAILED`: Content doesn't contain recognizable dialogue
- `VOICE_GENERATION_FAILED`: Specific character voice generation failed
- `AUDIO_QUOTA_EXCEEDED`: ElevenLabs API limits reached
- `CONVERSION_FAILED`: General processing error

## Performance Characteristics

### Processing Pipeline

1. **Dialogue Parsing**: ~50ms for typical 700-word story
2. **Voice Assignment**: ~10ms character analysis
3. **Audio Generation**: ~3-5 seconds per character segment
4. **Audio Stitching**: ~1-2 seconds for compilation
5. **Total Time**: ~30-60 seconds for multi-character story

### Scalability Considerations

- **Concurrent Requests**: Service handles multiple simultaneous conversions
- **Memory Usage**: ~50MB peak during audio processing
- **Storage**: Individual segments cached for potential reuse
- **API Limits**: Respects ElevenLabs rate limiting (configurable)

## Development

### Testing Without API Keys

The system includes comprehensive mock implementations:

```typescript
// Automatically generates sine wave audio when no API key present
if (!this.elevenLabsApiKey) {
  return this.generateMockAudioData(text);
}
```

### Debugging

Enable debug logging to trace the multi-voice pipeline:

```typescript
console.log('Parsed segments:', segments);
console.log('Voice assignments:', characterVoices);
console.log('Generation progress:', progress);
```

## Future Enhancements

### Planned Features

- **Voice Cloning**: Custom character voices from user samples
- **Real-time Preview**: Live voice preview during character assignment
- **Advanced Emotions**: Expanded emotional context detection
- **Voice Mixing**: Blend multiple voice characteristics
- **Background Audio**: Ambient sounds and music integration

### Integration Opportunities

- **SSML Support**: Advanced speech synthesis markup
- **Voice Marketplace**: Community-contributed character voices
- **AI Voice Training**: Fine-tuned models for specific character types
- **Multi-language**: Support for non-English stories

## Support

For technical issues or feature requests related to multi-voice audio generation:

1. Check error logs for specific failure modes
2. Verify ElevenLabs API key and quotas
3. Ensure story content uses proper `[Speaker]:` format
4. Test with mock generation first (no API key)

The multi-voice system is designed to be robust and user-friendly while providing professional-quality audiobook generation capabilities.