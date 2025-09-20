// Simple test script to verify multi-voice audio processing functionality
import { AudioService } from './audioService';

async function testMultiVoiceProcessing() {
  console.log('🎭 Testing Multi-Voice Audio Processing...\n');
  
  const audioService = new AudioService();
  
  // Test story content with speaker tags
  const testStoryContent = `
    [Narrator]: The moonlight cast eerie shadows across the castle courtyard.
    [Vampire Lord, seductive]: "You shouldn't have come here alone, my dear."
    [Sarah, fearful but defiant]: "I'm not afraid of you!"
    [Narrator]: Her voice trembled despite her brave words, and she could feel his dark eyes piercing through her soul.
    [Werewolf Alpha, growling]: "The scent of fear is intoxicating."
    [Fairy Queen, melodic]: "Perhaps there's another way to settle this dispute."
  `;
  
  const testInput = {
    storyId: 'test-story-123',
    content: testStoryContent,
    voice: 'female' as const,
    speed: 1.0 as const,
    format: 'mp3' as const
  };
  
  try {
    console.log('📝 Test Content:');
    console.log(testStoryContent.trim());
    console.log('\n🔍 Processing audio conversion...');
    
    const result = await audioService.convertToAudio(testInput);
    
    if (result.success && result.data) {
      console.log('✅ Multi-voice processing successful!');
      console.log('📊 Results:');
      console.log(`   - Audio ID: ${result.data.audioId}`);
      console.log(`   - Duration: ${result.data.duration} seconds`);
      console.log(`   - File Size: ${result.data.fileSize} bytes`);
      console.log(`   - Format: ${result.data.format}`);
      console.log(`   - Processing Time: ${result.metadata?.processingTime}ms`);
    } else {
      console.log('❌ Multi-voice processing failed:');
      console.log(`   Error: ${result.error?.message}`);
      console.log(`   Code: ${result.error?.code}`);
    }
    
  } catch (error) {
    console.error('💥 Test failed with exception:', error);
  }
}

// Test content without speaker tags
async function testSingleVoiceProcessing() {
  console.log('\n🎙️ Testing Single-Voice Processing (fallback)...\n');
  
  const audioService = new AudioService();
  
  const testStoryContent = `
    The moonlight cast eerie shadows across the castle courtyard.
    A figure emerged from the darkness, their footsteps echoing ominously.
    This is regular narrative text without any speaker tags.
  `;
  
  const testInput = {
    storyId: 'test-story-456',
    content: testStoryContent,
    voice: 'neutral' as const,
    speed: 1.0 as const,
    format: 'mp3' as const
  };
  
  try {
    console.log('📝 Test Content (no speaker tags):');
    console.log(testStoryContent.trim());
    console.log('\n🔍 Processing audio conversion...');
    
    const result = await audioService.convertToAudio(testInput);
    
    if (result.success && result.data) {
      console.log('✅ Single-voice processing successful!');
      console.log('📊 Results:');
      console.log(`   - Audio ID: ${result.data.audioId}`);
      console.log(`   - Duration: ${result.data.duration} seconds`);
      console.log(`   - File Size: ${result.data.fileSize} bytes`);
      console.log(`   - Format: ${result.data.format}`);
      console.log(`   - Processing Time: ${result.metadata?.processingTime}ms`);
    } else {
      console.log('❌ Single-voice processing failed:');
      console.log(`   Error: ${result.error?.message}`);
      console.log(`   Code: ${result.error?.code}`);
    }
    
  } catch (error) {
    console.error('💥 Test failed with exception:', error);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Multi-Voice Audio Processing Tests\n');
  console.log('==================================================');
  
  await testMultiVoiceProcessing();
  await testSingleVoiceProcessing();
  
  console.log('\n==================================================');
  console.log('✨ Test suite completed!');
}

runTests().catch(console.error);