#!/usr/bin/env ts-node

// Simple test script to validate dialogue parsing functionality
import { DialogueParser } from './src/services/dialogueParser';
import { DialogueSegment } from './src/types/contracts';

const parser = new DialogueParser();

// Test with mock story from StoryService
const mockStory = `<h3>The Vampire's Forbidden Passion</h3>

<p>[Narrator]: In the shadowed alleys of Victorian London, Lady Arabella Worthington found herself drawn to the mysterious stranger who haunted her dreams. His eyes, crimson as fresh-spilled wine, held secrets that both terrified and exhilarated her.</p>

<p>[Mysterious Stranger, seductive]: "You shouldn't be here, my lady. These streets hold dangers for someone of your... delicate nature."</p>

<p>[Arabella, breathless]: "I'm not afraid. There's something about you that calls to me, something I can't resist."</p>

<p>[Narrator]: The vampire prince revealed himself slowly, each layer of deception peeling away like the petals of a night-blooming flower. His touch was electric, sending sparks through her veins that made her gasp with forbidden pleasure.</p>

<p>[Vampire, passionate]: "You don't know what you're asking for. Once you cross this threshold, there's no returning to your innocent world."</p>

<p>[Arabella, defiant]: "Then let me fall into darkness. I choose this, I choose you, whatever the cost."</p>`;

console.log('🧪 Testing Multi-Voice Dialogue Parser\n');

// Debug: show cleaned content
const cleanedContent = mockStory
  .replace(/<[^>]*>/g, '') // Remove HTML tags
  .replace(/\n\s*\n/g, '\n') // Remove extra newlines
  .replace(/\s+/g, ' ') // Normalize whitespace
  .trim();

console.log('🔍 Cleaned Content:');
console.log('==================');
console.log(cleanedContent);
console.log('\n');

// Parse the dialogue
const segments = parser.parseStoryDialogue(mockStory, 'vampire');

console.log('📝 Parsed Dialogue Segments:');
console.log('=============================\n');

segments.forEach((segment: DialogueSegment, index: number) => {
  console.log(`Segment ${index + 1}:`);
  console.log(`  Speaker: ${segment.speaker}`);
  console.log(`  Voice Type: ${segment.voiceType}`);
  console.log(`  Emotion: ${segment.emotion || 'neutral'}`);
  console.log(`  Text: "${segment.text.substring(0, 100)}${segment.text.length > 100 ? '...' : ''}"`);
  console.log('');
});

// Test character voice mapping
const voiceMapping = parser.getCharacterVoiceMapping(segments);
console.log('🎭 Character Voice Mapping:');
console.log('============================');
Object.entries(voiceMapping).forEach(([character, voice]) => {
  console.log(`  ${character}: ${voice}`);
});

// Test duration estimation
const estimatedDuration = parser.estimateAudioDuration(segments, 1.0);
console.log(`\n⏱️  Estimated Audio Duration: ${Math.floor(estimatedDuration / 60)}:${(estimatedDuration % 60).toString().padStart(2, '0')}`);

console.log('\n✅ Dialogue parsing test completed!');