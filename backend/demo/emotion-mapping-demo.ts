#!/usr/bin/env ts-node

import { AudioService } from '../src/services/audioService';

/**
 * Demo script to showcase the enhanced emotion mapping system
 */
async function demonstrateEmotionMapping() {
  console.log('🎭 Fairytales with Spice - Enhanced Audio Pipeline Demo\n');
  
  const audioService = new AudioService();
  
  // 1. Show emotion information
  console.log('📊 EMOTION SYSTEM OVERVIEW:');
  const emotionInfo = audioService.getEmotionInfo();
  console.log(`Total emotions supported: ${emotionInfo.totalEmotions}`);
  console.log('Emotion categories:');
  Object.entries(emotionInfo.categories).forEach(([category, emotions]) => {
    console.log(`  ${category}: ${emotions.slice(0, 3).join(', ')}${emotions.length > 3 ? '...' : ''}`);
  });
  
  // 2. Test emotion recognition
  console.log('\n🧪 EMOTION TESTING:');
  const testEmotions = ['seductive', 'feral', 'ethereal', 'bloodthirsty', 'playful'];
  testEmotions.forEach(emotion => {
    const result = audioService.testEmotionCombination(emotion);
    console.log(`${emotion}: ${result.isSupported ? '✅ Supported' : '❌ Not supported'}`);
    if (result.parameters) {
      console.log(`  Parameters: stability=${result.parameters.stability}, style=${result.parameters.style}`);
    }
  });
  
  // 3. Test fuzzy matching
  console.log('\n🔍 FUZZY MATCHING:');
  const unknownEmotions = ['flirty', 'angrr', 'happyness'];
  unknownEmotions.forEach(emotion => {
    const result = audioService.testEmotionCombination(emotion);
    console.log(`"${emotion}" → Suggestions: ${result.suggestions?.join(', ') || 'none'}`);
  });
  
  // 4. Demo multi-voice with emotions
  console.log('\n🎵 MULTI-VOICE GENERATION DEMO:');
  const storyContent = `
    [Narrator]: In the moonlit clearing, three figures met.
    [Vampire Lord, seductive]: "Welcome to my domain, little fairy."
    [Fairy Princess, defiant]: "I'm not afraid of you, bloodsucker!"
    [Werewolf Alpha, protective]: "Leave her alone, or face my pack."
    [Vampire Lord, amused]: "How delightfully entertaining."
    [Fairy Princess, worried]: "We need to get out of here..."
    [Narrator, dramatic]: The tension in the air was electric.
  `;
  
  try {
    const result = await audioService.convertToAudio({
      storyId: 'demo_story',
      content: storyContent
    });
    
    if (result.success) {
      console.log('✅ Multi-voice audio generation successful!');
      console.log(`Audio details: ${result.data!.duration}s duration, ${result.data!.fileSize} bytes`);
      console.log(`Audio URL: ${result.data!.audioUrl}`);
    } else {
      console.log('❌ Audio generation failed:', result.error?.message);
    }
  } catch (error) {
    console.log('❌ Demo error:', error);
  }
  
  // 5. Show character consistency tracking
  console.log('\n👥 CHARACTER CONSISTENCY:');
  const infoAfter = audioService.getEmotionInfo();
  if (infoAfter.recentlyUsed.length > 0) {
    console.log('Recent character emotions:');
    infoAfter.recentlyUsed.slice(0, 5).forEach(entry => {
      console.log(`  ${entry.character}: ${entry.emotion}`);
    });
  } else {
    console.log('No character emotion history yet.');
  }
  
  console.log('\n🎉 Demo complete! The enhanced audio pipeline with emotion mapping is ready for production.');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateEmotionMapping().catch(console.error);
}

export { demonstrateEmotionMapping };