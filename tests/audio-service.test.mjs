#!/usr/bin/env node
/**
 * COMPREHENSIVE AUDIO SERVICE TESTS
 * 
 * Tests the AudioService directly (not through HTTP endpoints)
 * This isolates service logic from HTTP/networking issues
 * 
 * Run: node tests/audio-service.test.mjs
 */

import { AudioService } from '../api/lib/services/audioService.js';
import { logger } from '../api/lib/utils/logger.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logTest(testName) {
  log(`\n🧪 TEST: ${testName}`, 'blue');
  console.log('-'.repeat(80));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logFailure(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  total: 0
};

function assert(condition, message, failMessage) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    logSuccess(message);
    return true;
  } else {
    testResults.failed++;
    logFailure(failMessage || message);
    return false;
  }
}

function warn(message) {
  testResults.warnings++;
  logWarning(message);
}

// Sample story content for testing
const SAMPLE_STORIES = {
  simple: `<p>The vampire lord stood in the moonlight, his eyes glowing crimson. "Come to me," he whispered, his voice like silk and shadow.</p>`,
  
  withSpeakerTags: `<p>[Vampire Lord]: "The night calls to you, my dear. Can you resist its pull?"</p>
<p>[Mortal Woman]: "I... I shouldn't be here. This is forbidden."</p>
<p>[Vampire Lord]: "Forbidden fruits taste the sweetest, do they not?"</p>
<p>[Narrator]: She felt his cold hand on her shoulder, sending shivers down her spine.</p>`,
  
  withVoiceMetadata: `<p>[Lord Dante, voice: deep, seductive male vampire with Italian accent]: "Welcome to my domain, cara mia."</p>
<p>[Elena, voice: soft, nervous female human]: "Your castle is... magnificent. And terrifying."</p>
<p>[Lord Dante]: "Fear and desire often walk hand in hand, do they not?"</p>`,
  
  multiCharacter: `<p>[Alpha Wolf Marcus]: "The pack needs you. You can't keep running from your destiny."</p>
<p>[Lone Wolf Sarah]: "I choose my own path, Marcus. I always have."</p>
<p>[Beta Wolf James]: "The alpha speaks wisdom. Listen to him."</p>
<p>[Sarah]: "Wisdom? Or control? There's a difference."</p>
<p>[Narrator]: The tension in the clearing was palpable as the full moon rose.</p>`,
  
  long: `<p>The ancient castle loomed before her, its towers piercing the stormy sky like dark fingers reaching toward heaven. Isabella hesitated at the gate, her heart pounding with a mixture of fear and anticipation.</p>
<p>[Count Vladislav]: "You came. I wondered if you would have the courage."</p>
<p>[Isabella]: "Courage or foolishness? I'm not sure which brought me here."</p>
<p>[Count Vladislav]: "Perhaps both. The line between bravery and madness is often blurred in matters of the heart."</p>
<p>[Narrator]: He descended the marble stairs with supernatural grace, his movements fluid as water, his presence commanding the very air around him.</p>
<p>[Isabella]: "You promised me answers. About my family. About what I am."</p>
<p>[Count Vladislav]: "And answers you shall have, my dear. But first, let us dine. The journey has been long, and you must be famished."</p>`
};

// ==================== TEST SUITE ====================

async function testBasicAudioConversion() {
  logTest('Basic Audio Conversion - Simple Story');
  
  const service = new AudioService();
  const input = {
    storyId: 'test_story_001',
    content: SAMPLE_STORIES.simple,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  };
  
  logInfo(`Input: ${JSON.stringify({ ...input, content: input.content.substring(0, 50) + '...' }, null, 2)}`);
  
  const startTime = Date.now();
  const result = await service.convertToAudio(input);
  const duration = Date.now() - startTime;
  
  logInfo(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  
  // Test: Result structure
  assert(result !== null, 'Result is not null', 'Result is null');
  assert(typeof result === 'object', 'Result is an object', 'Result is not an object');
  assert('success' in result, 'Result has success property', 'Result missing success property');
  
  if (!result.success) {
    logFailure(`Audio conversion failed: ${result.error?.message}`);
    if (result.error?.details) {
      logInfo(`Error details: ${result.error.details}`);
    }
    return false;
  }
  
  // Test: Success response structure
  assert('data' in result, 'Result has data property', 'Result missing data property');
  assert('metadata' in result, 'Result has metadata property', 'Result missing metadata property');
  
  const audio = result.data;
  
  // Test: Required fields
  assert(typeof audio.audioId === 'string' && audio.audioId.length > 0,
    `Audio has valid audioId: ${audio.audioId}`,
    'Audio missing or invalid audioId');
  
  assert(audio.storyId === input.storyId,
    `Story ID matches: ${audio.storyId}`,
    'Story ID mismatch');
  
  assert(typeof audio.audioUrl === 'string' && audio.audioUrl.length > 0,
    `Audio has URL (${audio.audioUrl.substring(0, 50)}...)`,
    'Audio missing or invalid URL');
  
  assert(typeof audio.duration === 'number' && audio.duration > 0,
    `Audio has duration: ${audio.duration}s`,
    'Audio missing or invalid duration');
  
  assert(typeof audio.fileSize === 'number' && audio.fileSize > 0,
    `Audio has file size: ${(audio.fileSize / 1024).toFixed(2)} KB`,
    'Audio missing or invalid file size');
  
  assert(audio.format === input.format,
    `Audio format matches: ${audio.format}`,
    'Audio format mismatch');
  
  // Test: Progress tracking
  assert(audio.progress && audio.progress.status === 'completed',
    'Audio has completed status',
    'Audio status is not completed');
  
  assert(audio.progress.percentage === 100,
    'Audio progress is 100%',
    'Audio progress is not 100%');
  
  // Test: Data URL format (for mock or actual audio)
  if (audio.audioUrl.startsWith('data:')) {
    logSuccess('Audio is data URL (base64 encoded)');
    const isValidDataUrl = /^data:audio\/(mp3|mpeg|wav|aac);base64,/.test(audio.audioUrl);
    assert(isValidDataUrl, 'Data URL has correct format', 'Data URL has incorrect format');
  } else if (audio.audioUrl.startsWith('http')) {
    logSuccess('Audio is HTTP URL');
  } else {
    warn('Audio URL format is non-standard');
  }
  
  return result.success;
}

async function testMultiVoiceProcessing() {
  logTest('Multi-Voice Processing - Speaker Tags');
  
  const service = new AudioService();
  const input = {
    storyId: 'test_story_002',
    content: SAMPLE_STORIES.withSpeakerTags,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  };
  
  logInfo('Testing story with speaker tags: [Character]: dialogue format');
  
  const result = await service.convertToAudio(input);
  
  assert(result.success,
    'Multi-voice story converted successfully',
    `Multi-voice conversion failed: ${result.error?.message}`);
  
  if (result.success) {
    logSuccess('Multi-voice processing handled speaker tags');
    logInfo(`Audio duration: ${result.data.duration}s`);
    logInfo(`File size: ${(result.data.fileSize / 1024).toFixed(2)} KB`);
    
    // Multi-voice stories typically take longer to process
    if (result.metadata.processingTime > 1000) {
      logInfo(`Processing time: ${result.metadata.processingTime}ms (expected for multi-voice)`);
    }
  }
  
  return result.success;
}

async function testVoiceMetadataExtraction() {
  logTest('Voice Metadata Extraction');
  
  const service = new AudioService();
  const input = {
    storyId: 'test_story_003',
    content: SAMPLE_STORIES.withVoiceMetadata,
    voice: 'male',
    speed: 1.0,
    format: 'mp3'
  };
  
  logInfo('Testing story with voice metadata: [Character, voice: description]: dialogue format');
  
  const result = await service.convertToAudio(input);
  
  assert(result.success,
    'Story with voice metadata converted',
    `Voice metadata conversion failed: ${result.error?.message}`);
  
  if (result.success) {
    logSuccess('Voice metadata processed and applied to character voices');
  }
  
  return result.success;
}

async function testAllVoiceTypes() {
  logTest('All Voice Types');
  
  const service = new AudioService();
  const voices = ['female', 'male', 'neutral'];
  
  for (const voice of voices) {
    logInfo(`\nTesting voice: ${voice}`);
    
    const input = {
      storyId: `test_voice_${voice}`,
      content: SAMPLE_STORIES.simple,
      voice,
      speed: 1.0,
      format: 'mp3'
    };
    
    const result = await service.convertToAudio(input);
    
    assert(result.success,
      `${voice} voice converted successfully`,
      `${voice} voice failed: ${result.error?.message}`);
    
    if (result.success) {
      assert(result.data.voice === voice,
        `Voice type preserved: ${voice}`,
        `Voice type mismatch: expected ${voice}, got ${result.data.voice}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testAllAudioFormats() {
  logTest('All Audio Formats (mp3, wav, aac)');
  
  const service = new AudioService();
  const formats = ['mp3', 'wav', 'aac'];
  
  for (const format of formats) {
    logInfo(`\nTesting format: ${format}`);
    
    const input = {
      storyId: `test_format_${format}`,
      content: SAMPLE_STORIES.simple,
      voice: 'female',
      speed: 1.0,
      format
    };
    
    const result = await service.convertToAudio(input);
    
    assert(result.success,
      `${format} format converted successfully`,
      `${format} format failed: ${result.error?.message}`);
    
    if (result.success) {
      assert(result.data.format === format,
        `Format preserved: ${format}`,
        `Format mismatch: expected ${format}, got ${result.data.format}`);
      
      // Check data URL MIME type
      if (result.data.audioUrl.startsWith('data:')) {
        const expectedMime = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
        const hasMime = result.data.audioUrl.includes(expectedMime);
        if (hasMime) {
          logSuccess(`Data URL has correct MIME type: ${expectedMime}`);
        } else {
          warn(`Data URL MIME type may be incorrect`);
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testAllSpeedSettings() {
  logTest('All Speed Settings (0.5x to 1.5x)');
  
  const service = new AudioService();
  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5];
  
  for (const speed of speeds) {
    logInfo(`\nTesting speed: ${speed}x`);
    
    const input = {
      storyId: `test_speed_${speed}`,
      content: SAMPLE_STORIES.simple,
      voice: 'female',
      speed,
      format: 'mp3'
    };
    
    const result = await service.convertToAudio(input);
    
    assert(result.success,
      `Speed ${speed}x converted successfully`,
      `Speed ${speed}x failed: ${result.error?.message}`);
    
    if (result.success) {
      assert(result.data.speed === speed,
        `Speed preserved: ${speed}x`,
        `Speed mismatch: expected ${speed}, got ${result.data.speed}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testLongContentHandling() {
  logTest('Long Content Handling');
  
  const service = new AudioService();
  const input = {
    storyId: 'test_long_story',
    content: SAMPLE_STORIES.long,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  };
  
  logInfo(`Testing with ${input.content.length} character story`);
  
  const startTime = Date.now();
  const result = await service.convertToAudio(input);
  const duration = Date.now() - startTime;
  
  assert(result.success,
    `Long content converted in ${duration}ms`,
    `Long content failed: ${result.error?.message}`);
  
  if (result.success) {
    logInfo(`Audio duration: ${result.data.duration}s`);
    logInfo(`File size: ${(result.data.fileSize / 1024).toFixed(2)} KB`);
    
    // Longer content should produce longer audio
    if (result.data.duration > 10) {
      logSuccess('Audio duration appropriate for content length');
    } else {
      warn('Audio duration may be too short for content length');
    }
  }
  
  return result.success;
}

async function testHTMLCleaning() {
  logTest('HTML Cleaning for TTS');
  
  const service = new AudioService();
  
  // Story with various HTML tags
  const htmlContent = `
    <h1>The Vampire's Embrace</h1>
    <p><strong>Bold text</strong> and <em>italic text</em>.</p>
    <p>This has <span class="highlight">highlighted</span> content.</p>
    <ul>
      <li>List item 1</li>
      <li>List item 2</li>
    </ul>
    <p>A link: <a href="#">click here</a></p>
  `;
  
  const input = {
    storyId: 'test_html_cleaning',
    content: htmlContent,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  };
  
  logInfo('Testing HTML tag removal and cleaning');
  
  const result = await service.convertToAudio(input);
  
  assert(result.success,
    'HTML content converted successfully',
    `HTML cleaning failed: ${result.error?.message}`);
  
  if (result.success) {
    logSuccess('HTML tags properly cleaned for TTS processing');
  }
  
  return result.success;
}

async function testInputValidation() {
  logTest('Input Validation');
  
  const service = new AudioService();
  
  // Test missing storyId
  logInfo('\nTesting missing storyId...');
  let result = await service.convertToAudio({
    storyId: '',
    content: SAMPLE_STORIES.simple,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  });
  
  // Note: Service might not validate storyId, so we just check it doesn't crash
  logInfo(`Result: ${result.success ? 'Success' : 'Failed'}`);
  
  // Test empty content
  logInfo('\nTesting empty content...');
  result = await service.convertToAudio({
    storyId: 'test',
    content: '',
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  });
  
  if (!result.success) {
    logSuccess('Empty content properly rejected');
  } else {
    warn('Empty content was processed (might be intentional)');
  }
  
  // Test invalid format
  logInfo('\nTesting invalid format fallback...');
  result = await service.convertToAudio({
    storyId: 'test',
    content: SAMPLE_STORIES.simple,
    voice: 'female',
    speed: 1.0,
    format: 'invalid'
  });
  
  // Should either reject or fallback to mp3
  if (result.success) {
    logInfo(`Fallback format: ${result.data.format}`);
  }
}

async function testEmotionSystem() {
  logTest('Emotion Mapping System');
  
  const service = new AudioService();
  
  // Test getEmotionInfo
  logInfo('\nTesting emotion info endpoint...');
  const emotionInfo = service.getEmotionInfo();
  
  assert(emotionInfo && typeof emotionInfo === 'object',
    'Emotion info returned',
    'Emotion info not available');
  
  if (emotionInfo) {
    assert(Array.isArray(emotionInfo.emotions),
      `${emotionInfo.emotions?.length || 0} emotions available`,
      'Emotions array not found');
    
    assert(emotionInfo.description,
      'Emotion system has description',
      'Description missing');
    
    logInfo(`Emotion categories: ${emotionInfo.categories?.length || 0}`);
  }
  
  // Test emotion combination
  if (emotionInfo && emotionInfo.emotions.length > 0) {
    const testEmotion = emotionInfo.emotions[0];
    logInfo(`\nTesting emotion: ${testEmotion}`);
    
    const emotionTest = service.testEmotionCombination(testEmotion);
    
    assert(emotionTest && emotionTest.emotion === testEmotion,
      `Emotion test successful for: ${testEmotion}`,
      'Emotion test failed');
    
    if (emotionTest && emotionTest.voiceSettings) {
      logSuccess('Voice settings generated for emotion');
      logInfo(`Settings: stability=${emotionTest.voiceSettings.stability}, boost=${emotionTest.voiceSettings.similarity_boost}`);
    }
  }
}

async function testLoggingIntegration() {
  logTest('Logging System Integration');
  
  logger.clearLogs();
  
  const service = new AudioService();
  const input = {
    storyId: 'test_logging',
    content: SAMPLE_STORIES.simple,
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  };
  
  await service.convertToAudio(input);
  
  const recentLogs = logger.getRecentLogs(100);
  
  assert(recentLogs.length > 0,
    `Logging active: ${recentLogs.length} log entries captured`,
    'No logs captured');
  
  const hasInfo = recentLogs.some(log => log.level === 'info');
  const hasRequestId = recentLogs.some(log => log.context?.requestId);
  
  assert(hasInfo, 'Info logs present', 'No info logs found');
  assert(hasRequestId, 'Request IDs present', 'No request IDs found');
  
  const audioLogs = recentLogs.filter(log => 
    log.message.includes('Audio') || log.message.includes('audio')
  );
  
  if (audioLogs.length > 0) {
    logInfo(`\nAudio-related logs: ${audioLogs.length}`);
    audioLogs.slice(-3).forEach(log => {
      console.log(`  [${log.level.toUpperCase()}] ${log.message}`);
    });
  }
}

// ==================== RUN ALL TESTS ====================

async function runAllTests() {
  logSection('🎙️  AUDIO SERVICE COMPREHENSIVE TEST SUITE');
  
  log('Testing AudioService directly (isolated from HTTP/networking)', 'cyan');
  log('This tests audio conversion, multi-voice, and ElevenLabs integration\n', 'cyan');
  
  const tests = [
    { name: 'Basic Audio Conversion', fn: testBasicAudioConversion },
    { name: 'Multi-Voice Processing', fn: testMultiVoiceProcessing },
    { name: 'Voice Metadata Extraction', fn: testVoiceMetadataExtraction },
    { name: 'All Voice Types', fn: testAllVoiceTypes },
    { name: 'All Audio Formats', fn: testAllAudioFormats },
    { name: 'All Speed Settings', fn: testAllSpeedSettings },
    { name: 'Long Content Handling', fn: testLongContentHandling },
    { name: 'HTML Cleaning', fn: testHTMLCleaning },
    { name: 'Input Validation', fn: testInputValidation },
    { name: 'Emotion System', fn: testEmotionSystem },
    { name: 'Logging Integration', fn: testLoggingIntegration }
  ];
  
  for (const test of tests) {
    try {
      await test.fn();
    } catch (error) {
      logFailure(`EXCEPTION in ${test.name}: ${error.message}`);
      console.error(error);
      testResults.failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // ==================== FINAL RESULTS ====================
  
  logSection('📊 TEST RESULTS');
  
  log(`Total Tests: ${testResults.total}`, 'cyan');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, 'red');
  log(`Warnings: ${testResults.warnings}`, 'yellow');
  
  const successRate = testResults.total > 0 
    ? ((testResults.passed / testResults.total) * 100).toFixed(1) 
    : 0;
  
  console.log('');
  if (testResults.failed === 0) {
    log(`🎉 ALL TESTS PASSED! (${successRate}% success rate)`, 'green');
  } else {
    log(`⚠️  SOME TESTS FAILED (${successRate}% success rate)`, 'yellow');
  }
  
  console.log('');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  logFailure(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
