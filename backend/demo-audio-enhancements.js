#!/usr/bin/env node

/**
 * Enhanced Audio Pipeline Demonstration Script
 * 
 * This script showcases the new audio generation capabilities:
 * - Emotion-aware voice processing
 * - Multi-character voice analysis
 * - Voice consistency recommendations
 * - Character personality-based voice modulation
 */

const { AudioEnhancementService } = require('./dist/services/audioEnhancementService');

console.log('🎭 Enhanced Audio Pipeline Demonstration\n');

// Initialize the audio enhancement service
const audioService = new AudioEnhancementService();

// Sample story content with speaker tags and emotions
const sampleStory = `
[Narrator]: In the moonlit garden of the abandoned mansion, three supernatural beings found themselves drawn together by fate.

[Elvira, seductive]: "Well, well... what have we here?" She emerged from the shadows, her crimson lips curving into a predatory smile. "Two handsome strangers trespassing on my territory."

[Marcus, aggressive]: "Territory?" He growled, his muscles tensing as his amber eyes flashed with wolfish intensity. "This place belongs to no one, bloodsucker."

[Luna, playful]: "Oh my stars!" She giggled like wind chimes, floating down from the ancient oak tree. "Such hostility between friends! Surely we can all share this magical place?"

[Elvira, mysterious]: "Share... yes, I could be persuaded to share many things." Her voice dropped to a whisper that made both men shiver. "But everything has a price."

[Marcus, determined]: "I don't deal with vampires. Nothing but trouble comes from your kind." Despite his words, he couldn't look away from her hypnotic gaze.

[Luna, mischievous]: "Trouble can be so much fun though!" She spun in the air, leaving a trail of glittering fairy dust. "Besides, I sense something deeper here... desire perhaps?"

[Narrator]: The three circled each other like dancers in an ancient ritual, each hiding secrets that could either bind them together or tear them apart forever.
`;

console.log('📖 Analyzing Sample Story Content:');
console.log('=====================================\n');

// Demonstrate voice consistency analysis
console.log('🔍 Voice Consistency Analysis:');
const analysis = audioService.analyzeVoiceConsistency(sampleStory);

console.log(`📊 Characters Detected: ${analysis.speakers.length}`);
analysis.speakers.forEach(speaker => {
  const count = analysis.speakerCount[speaker];
  console.log(`   • ${speaker}: ${count} dialogue${count > 1 ? 's' : ''}`);
});

console.log(`\n🎭 Emotions Used: ${Object.keys(analysis.emotionDistribution).length}`);
Object.entries(analysis.emotionDistribution).forEach(([emotion, count]) => {
  console.log(`   • ${emotion}: ${count} instance${count > 1 ? 's' : ''}`);
});

console.log('\n💡 Recommendations:');
analysis.recommendations.forEach(rec => {
  console.log(`   • ${rec}`);
});

console.log('\n=====================================\n');

// Demonstrate emotion mapping
console.log('🎨 Emotion-to-Voice Parameter Mapping:');
const emotions = ['seductive', 'aggressive', 'playful', 'mysterious', 'determined', 'mischievous'];
const characters = ['vampire_female', 'werewolf_male', 'fairy_female'];

emotions.forEach(emotion => {
  console.log(`\n😊 Emotion: "${emotion}"`);
  characters.forEach(character => {
    const params = audioService.calculateVoiceParameters(emotion, character, 1.0);
    console.log(`   ${character}:`);
    console.log(`     stability: ${params.stability.toFixed(2)} | similarity: ${params.similarityBoost.toFixed(2)} | style: ${params.style.toFixed(2)} | boost: ${params.speakerBoost}`);
  });
});

console.log('\n=====================================\n');

// Demonstrate speaker tag parsing
console.log('🏷️  Speaker Tag Parsing Examples:');
const testTags = [
  '[Elvira, seductive]',
  '[Marcus, aggressive]',
  '[Luna, playful]',
  '[Narrator]',
  '[Count Dracula, sinister]',
  '[Sarah, nervous]'
];

testTags.forEach(tag => {
  const parsed = audioService.extractEmotionFromSpeakerTag(tag);
  console.log(`   ${tag} → Speaker: "${parsed.speaker}", Emotion: "${parsed.emotion}"`);
});

console.log('\n=====================================\n');

// Demonstrate available emotions
console.log('🎭 Available Emotions (90+ supported):');
const allEmotions = audioService.getAvailableEmotions();
console.log(`Total: ${allEmotions.length} emotions\n`);

// Group emotions by category
const emotionCategories = {
  'Positive': ['happy', 'joyful', 'excited', 'content', 'pleased', 'cheerful'],
  'Passionate': ['seductive', 'romantic', 'passionate', 'sensual', 'lustful', 'aroused'],
  'Intense': ['angry', 'furious', 'aggressive', 'dominant', 'powerful', 'commanding'],
  'Mysterious': ['mysterious', 'enigmatic', 'secretive', 'sinister', 'ominous'],
  'Vulnerable': ['sad', 'nervous', 'vulnerable', 'fragile', 'worried', 'fearful'],
  'Playful': ['playful', 'mischievous', 'teasing', 'flirtatious', 'cheeky', 'witty']
};

Object.entries(emotionCategories).forEach(([category, emotions]) => {
  console.log(`${category}:`);
  emotions.filter(emotion => allEmotions.includes(emotion)).forEach(emotion => {
    console.log(`   • ${emotion}`);
  });
  console.log('');
});

console.log('=====================================\n');

console.log('✨ Enhanced Audio Pipeline Features:');
console.log('   🎯 90+ emotion-aware voice mappings');
console.log('   🎭 Character personality-based modulation');
console.log('   🔍 Automatic voice consistency analysis');
console.log('   🎵 Advanced audio player with character controls');
console.log('   📊 Real-time feedback and recommendations');
console.log('   🚀 Optimized for TV-quality narration');

console.log('\n🎊 Demo Complete! The audio pipeline is ready to create world-class');
console.log('   spicy fairy tale narrations with emotional depth and character consistency.');