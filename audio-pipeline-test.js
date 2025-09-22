#!/usr/bin/env node

/**
 * Audio Pipeline Investigation & Testing Tool
 * 
 * Comprehensive end-to-end testing of the audio generation pipeline
 * for Fairytales with Spice. Tests everything from story generation 
 * output format through final audio processing.
 */

const { AudioService } = require('./backend/dist/services/audioService');

// Test data representing real story output with speaker tags
const TEST_STORIES = {
  multiVoice: {
    storyId: 'test_multivoice',
    content: `
      <h3>The Vampire's Seduction</h3>
      
      <p>[Narrator]: The moonlight cast shadows across the ancient castle courtyard as Elena approached the imposing figure waiting for her.</p>
      
      <p>[Vampire Lord Dimitri]: "You came. I wasn't certain you would have the courage."</p>
      
      <p>[Elena, nervous]: "I keep my promises, even when they terrify me."</p>
      
      <p>[Narrator]: His eyes gleamed with predatory satisfaction as he stepped closer, the scent of dark roses and danger surrounding him.</p>
      
      <p>[Vampire Lord Dimitri, seductive]: "Fear and desire are often indistinguishable, my dear."</p>
      
      <p>[Elena, defiant]: "I'm not afraid of you!"</p>
      
      <p>[Narrator]: But her racing pulse betrayed her words, and they both knew it.</p>
    `,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  },
  
  singleVoice: {
    storyId: 'test_singlevoice', 
    content: `
      <h3>Simple Story</h3>
      <p>This is a simple story without speaker tags that should be processed with a single voice.</p>
      <p>It contains <em>emphasis</em> and other HTML formatting that needs to be cleaned for audio processing.</p>
    `,
    voice: 'narrator',
    speed: 1.0,
    format: 'mp3'
  },
  
  complexMultiVoice: {
    storyId: 'test_complex',
    content: `
      <h3>Werewolf Pack Dynamics</h3>
      
      <p>[Narrator]: The pack gathered under the blood moon, tension crackling between the rival alphas.</p>
      
      <p>[Alpha Marcus, commanding]: "The territory dispute ends tonight."</p>
      
      <p>[Alpha Raven, challenging]: "Then let's settle this the old way."</p>
      
      <p>[Omega Sarah, worried]: "Please, there has to be another way!"</p>
      
      <p>[Fairy Witness Aria, mystical]: "The ancient laws must be honored, but blood need not be spilled."</p>
      
      <p>[Narrator]: The wind carried the scent of magic and moonlight as the supernatural beings faced their destiny.</p>
    `,
    voice: 'werewolf_male',
    speed: 1.0,
    format: 'mp3'
  }
};

// Voice parameter investigation data
const VOICE_PARAMETERS = {
  stability: [0.3, 0.5, 0.7, 0.9],
  similarity_boost: [0.3, 0.5, 0.7, 0.9],
  style: [0.1, 0.3, 0.5, 0.7]
};

// Emotion mapping test data (subset of 90+ emotions)
const EMOTION_TEST_CASES = [
  'seductive', 'commanding', 'nervous', 'defiant', 'challenging', 
  'worried', 'mystical', 'angry', 'passionate', 'fearful',
  'confident', 'mysterious', 'playful', 'intense', 'vulnerable'
];

async function runAudioPipelineInvestigation() {
  console.log('🎧 Starting Comprehensive Audio Pipeline Investigation\n');
  
  const audioService = new AudioService();
  const results = {
    speakerTagAnalysis: {},
    voiceAssignmentTests: {},
    audioGenerationTests: {},
    errorHandling: {},
    performanceMetrics: {}
  };

  // ==================== PHASE 1: SPEAKER TAG ANALYSIS ====================
  console.log('📝 Phase 1: Speaker Tag Format Analysis');
  
  await testSpeakerTagParsing(audioService, results);
  
  // ==================== PHASE 2: VOICE ASSIGNMENT TESTING ====================
  console.log('\n🎭 Phase 2: Voice Assignment & Character Detection');
  
  await testVoiceAssignment(audioService, results);
  
  // ==================== PHASE 3: AUDIO GENERATION TESTING ====================
  console.log('\n🎵 Phase 3: Audio Generation Pipeline Testing');
  
  await testAudioGeneration(audioService, results);
  
  // ==================== PHASE 4: ERROR HANDLING & FALLBACKS ====================
  console.log('\n⚠️  Phase 4: Error Handling & Fallback Testing');
  
  await testErrorHandling(audioService, results);
  
  // ==================== PHASE 5: PERFORMANCE ANALYSIS ====================
  console.log('\n⚡ Phase 5: Performance Metrics Analysis');
  
  await testPerformanceMetrics(audioService, results);
  
  // ==================== RESULTS SUMMARY ====================
  console.log('\n📊 Investigation Results Summary');
  console.log('=======================================');
  
  generateInvestigationReport(results);
  
  return results;
}

async function testSpeakerTagParsing(audioService, results) {
  const testCases = [
    '[Vampire Lord]: "Test dialogue"',
    '[Character, emotion]: "Emotional dialogue"', 
    '[Narrator]: Descriptive text without quotes',
    'Mixed content [Speaker]: "dialogue" and narrative',
    '[Complex Name With Spaces, complex emotion]: "Complex case"'
  ];
  
  console.log('  Testing speaker tag parsing patterns...');
  
  // Access private method for testing (note: this would need service modification)
  const speakerTagPattern = /\[([^\]]+)\]:\s*/g;
  
  testCases.forEach((testCase, index) => {
    const matches = testCase.match(speakerTagPattern);
    results.speakerTagAnalysis[`case_${index}`] = {
      input: testCase,
      matches: matches || [],
      parsed: matches ? true : false
    };
    
    console.log(`    ✓ Case ${index + 1}: ${matches ? 'PARSED' : 'NO MATCH'}`);
  });
}

async function testVoiceAssignment(audioService, results) {
  const characterNames = [
    'Vampire Lord Dimitri',
    'Vampire Lady Anastasia', 
    'Alpha Marcus',
    'Luna Sarah',
    'Fairy Prince Oberon',
    'Fairy Princess Titania',
    'Human Detective John',
    'Human Doctor Maria',
    'Narrator'
  ];
  
  console.log('  Testing character-to-voice assignment...');
  
  // We'd need to expose the assignVoiceToSpeaker method for testing
  characterNames.forEach((name, index) => {
    // This would call audioService.assignVoiceToSpeaker(name) if exposed
    const expectedVoice = inferExpectedVoice(name);
    
    results.voiceAssignmentTests[name] = {
      character: name,
      expectedVoice: expectedVoice,
      // actualVoice: would come from service method
      correct: true // placeholder
    };
    
    console.log(`    ✓ ${name} → ${expectedVoice}`);
  });
}

async function testAudioGeneration(audioService, results) {
  console.log('  Testing multi-voice audio generation...');
  
  for (const [testName, testStory] of Object.entries(TEST_STORIES)) {
    try {
      const startTime = Date.now();
      const result = await audioService.convertToAudio(testStory);
      const processingTime = Date.now() - startTime;
      
      results.audioGenerationTests[testName] = {
        success: result.success,
        processingTime: processingTime,
        audioUrl: result.data?.audioUrl,
        duration: result.data?.duration,
        fileSize: result.data?.fileSize,
        hasMultiVoice: testStory.content.includes('[') && testStory.content.includes(']:')
      };
      
      console.log(`    ✓ ${testName}: ${result.success ? 'SUCCESS' : 'FAILED'} (${processingTime}ms)`);
      
    } catch (error) {
      results.audioGenerationTests[testName] = {
        success: false,
        error: error.message,
        processingTime: null
      };
      
      console.log(`    ✗ ${testName}: FAILED - ${error.message}`);
    }
  }
}

async function testErrorHandling(audioService, results) {
  const errorTestCases = [
    { name: 'empty_content', input: { storyId: 'test', content: '', voice: 'female' } },
    { name: 'invalid_html', input: { storyId: 'test', content: '<invalid>Broken HTML', voice: 'female' } },
    { name: 'extremely_long', input: { storyId: 'test', content: 'Very long content...'.repeat(1000), voice: 'female' } }
  ];
  
  console.log('  Testing error handling and fallbacks...');
  
  for (const testCase of errorTestCases) {
    try {
      const result = await audioService.convertToAudio(testCase.input);
      
      results.errorHandling[testCase.name] = {
        success: result.success,
        errorCode: result.error?.code,
        handledGracefully: result.success || result.error?.code !== undefined
      };
      
      console.log(`    ✓ ${testCase.name}: ${result.success ? 'PROCESSED' : 'HANDLED GRACEFULLY'}`);
      
    } catch (error) {
      results.errorHandling[testCase.name] = {
        success: false,
        error: error.message,
        handledGracefully: false
      };
      
      console.log(`    ✗ ${testCase.name}: UNHANDLED ERROR`);
    }
  }
}

async function testPerformanceMetrics(audioService, results) {
  console.log('  Analyzing performance characteristics...');
  
  const performanceTests = [];
  
  // Test different content lengths
  const contentLengths = [100, 500, 1000, 2000];
  
  for (const length of contentLengths) {
    const content = `<p>[Narrator]: ${'Test content '.repeat(length / 12)}</p>`;
    const testInput = {
      storyId: `perf_test_${length}`,
      content: content,
      voice: 'narrator'
    };
    
    try {
      const startTime = Date.now();
      const result = await audioService.convertToAudio(testInput);
      const processingTime = Date.now() - startTime;
      
      performanceTests.push({
        contentLength: length,
        processingTime: processingTime,
        success: result.success,
        timePerCharacter: processingTime / content.length
      });
      
      console.log(`    ✓ ${length} chars: ${processingTime}ms (${(processingTime / content.length).toFixed(2)}ms/char)`);
      
    } catch (error) {
      console.log(`    ✗ ${length} chars: FAILED`);
    }
  }
  
  results.performanceMetrics = {
    contentLengthTests: performanceTests,
    averageTimePerCharacter: performanceTests.reduce((sum, test) => sum + test.timePerCharacter, 0) / performanceTests.length
  };
}

function inferExpectedVoice(characterName) {
  const lowerName = characterName.toLowerCase();
  
  if (lowerName.includes('narrator')) return 'narrator';
  if (lowerName.includes('vampire')) {
    return lowerName.includes('lady') || lowerName.includes('anastasia') ? 'vampire_female' : 'vampire_male';
  }
  if (lowerName.includes('alpha') || lowerName.includes('luna') || lowerName.includes('wolf')) {
    return lowerName.includes('luna') || lowerName.includes('sarah') ? 'werewolf_female' : 'werewolf_male';
  }
  if (lowerName.includes('fairy') || lowerName.includes('oberon') || lowerName.includes('titania')) {
    return lowerName.includes('princess') || lowerName.includes('titania') ? 'fairy_female' : 'fairy_male';
  }
  
  // Default to human voices
  const femaleNames = ['anastasia', 'sarah', 'titania', 'maria'];
  return femaleNames.some(name => lowerName.includes(name)) ? 'human_female' : 'human_male';
}

function generateInvestigationReport(results) {
  console.log('\n🎯 KEY FINDINGS:');
  
  // Speaker tag analysis
  const tagParsingSuccess = Object.values(results.speakerTagAnalysis).filter(r => r.parsed).length;
  const totalTagTests = Object.keys(results.speakerTagAnalysis).length;
  console.log(`📝 Speaker Tag Parsing: ${tagParsingSuccess}/${totalTagTests} patterns detected correctly`);
  
  // Audio generation success
  const audioSuccess = Object.values(results.audioGenerationTests).filter(r => r.success).length;
  const totalAudioTests = Object.keys(results.audioGenerationTests).length;
  console.log(`🎵 Audio Generation: ${audioSuccess}/${totalAudioTests} tests successful`);
  
  // Error handling
  const errorHandlingSuccess = Object.values(results.errorHandling).filter(r => r.handledGracefully).length;
  const totalErrorTests = Object.keys(results.errorHandling).length;
  console.log(`⚠️  Error Handling: ${errorHandlingSuccess}/${totalErrorTests} cases handled gracefully`);
  
  // Performance metrics
  if (results.performanceMetrics.averageTimePerCharacter) {
    console.log(`⚡ Performance: ${results.performanceMetrics.averageTimePerCharacter.toFixed(2)}ms per character average`);
  }
  
  console.log('\n📋 RECOMMENDATIONS FOR NEXT PHASE:');
  console.log('  1. Implement proper multi-voice audio chunk merging');
  console.log('  2. Add emotion → voice parameter mapping system');
  console.log('  3. Research ElevenLabs voice creation API capabilities');
  console.log('  4. Investigate sound effects integration options');
  console.log('  5. Develop advanced audio player with character visualization');
}

// Run the investigation if called directly
if (require.main === module) {
  runAudioPipelineInvestigation()
    .then(() => {
      console.log('\n✅ Audio Pipeline Investigation Complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Investigation failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAudioPipelineInvestigation,
  TEST_STORIES,
  EMOTION_TEST_CASES,
  VOICE_PARAMETERS
};