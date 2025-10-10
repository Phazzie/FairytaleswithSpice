#!/usr/bin/env node
/**
 * COMPREHENSIVE STORY GENERATION TESTS
 * 
 * Tests the StoryService directly (not through HTTP endpoints)
 * This isolates service logic from HTTP/networking issues
 * 
 * Run: node tests/story-service.test.mjs
 */

import { StoryService } from '../api/lib/services/storyService.js';
import { logger } from '../api/lib/utils/logger.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
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

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  total: 0
};

// Helper: Assert function
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

// Helper: Warn function
function warn(message) {
  testResults.warnings++;
  logWarning(message);
}

// ==================== TEST SUITE ====================

async function testBasicStoryGeneration() {
  logTest('Basic Story Generation - Vampire Romance');
  
  const service = new StoryService();
  const input = {
    creature: 'vampire',
    themes: ['forbidden_love', 'desire'],
    userInput: 'A vampire lord meets a mortal librarian',
    spicyLevel: 3,
    wordCount: 700
  };
  
  logInfo(`Input: ${JSON.stringify(input, null, 2)}`);
  
  const startTime = Date.now();
  const result = await service.generateStory(input);
  const duration = Date.now() - startTime;
  
  logInfo(`Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  
  // Test: Result structure
  assert(result !== null && result !== undefined, 'Result is not null/undefined', 'Result is null or undefined');
  assert(typeof result === 'object', 'Result is an object', 'Result is not an object');
  assert('success' in result, 'Result has success property', 'Result missing success property');
  
  if (!result.success) {
    logFailure(`Story generation failed: ${result.error?.message}`);
    if (result.error?.details) {
      logInfo(`Error details: ${result.error.details}`);
    }
    return false;
  }
  
  // Test: Success response structure
  assert('data' in result, 'Result has data property', 'Result missing data property');
  assert('metadata' in result, 'Result has metadata property', 'Result missing metadata property');
  
  const story = result.data;
  
  // Test: Required fields
  assert(typeof story.storyId === 'string' && story.storyId.length > 0, 
    `Story has valid storyId: ${story.storyId}`, 
    'Story missing or invalid storyId');
  
  assert(typeof story.title === 'string' && story.title.length > 0, 
    `Story has valid title: "${story.title}"`, 
    'Story missing or invalid title');
  
  assert(typeof story.content === 'string' && story.content.length > 0, 
    `Story has content (${story.content.length} chars)`, 
    'Story missing or invalid content');
  
  assert(typeof story.actualWordCount === 'number' && story.actualWordCount > 0, 
    `Story has word count: ${story.actualWordCount}`, 
    'Story missing or invalid word count');
  
  assert(typeof story.estimatedReadTime === 'number' && story.estimatedReadTime > 0, 
    `Story has read time: ${story.estimatedReadTime} min`, 
    'Story missing or invalid read time');
  
  assert(typeof story.hasCliffhanger === 'boolean', 
    `Story has cliffhanger flag: ${story.hasCliffhanger}`, 
    'Story missing or invalid cliffhanger flag');
  
  // Test: Word count accuracy (within 20% tolerance)
  const targetWordCount = input.wordCount;
  const actualWordCount = story.actualWordCount;
  const tolerance = targetWordCount * 0.2; // 20% tolerance
  const withinTolerance = Math.abs(actualWordCount - targetWordCount) <= tolerance;
  
  if (withinTolerance) {
    logSuccess(`Word count within tolerance: ${actualWordCount} (target: ${targetWordCount}, ±${tolerance.toFixed(0)})`);
  } else {
    warn(`Word count outside tolerance: ${actualWordCount} (target: ${targetWordCount}, ±${tolerance.toFixed(0)})`);
  }
  
  // Test: Content quality checks
  const hasHTML = /<[^>]+>/.test(story.content);
  assert(hasHTML, 'Content contains HTML formatting', 'Content missing HTML formatting');
  
  // Test: Metadata
  assert(result.metadata.requestId, 
    `Metadata has requestId: ${result.metadata.requestId}`, 
    'Metadata missing requestId');
  
  assert(typeof result.metadata.processingTime === 'number', 
    `Metadata has processingTime: ${result.metadata.processingTime}ms`, 
    'Metadata missing processingTime');
  
  // Display content preview
  const cleanContent = story.content.replace(/<[^>]*>/g, '').trim();
  const preview = cleanContent.substring(0, 300);
  logInfo(`Content preview:\n${preview}...`);
  
  return result.success;
}

async function testAllCreatureTypes() {
  logTest('All Creature Types');
  
  const creatures = ['vampire', 'werewolf', 'fairy'];
  const service = new StoryService();
  
  for (const creature of creatures) {
    logInfo(`\nTesting creature: ${creature}`);
    
    const input = {
      creature,
      themes: ['desire', 'passion'],
      userInput: `A ${creature} story`,
      spicyLevel: 2,
      wordCount: 700
    };
    
    const result = await service.generateStory(input);
    
    assert(result.success, 
      `${creature} story generated successfully`, 
      `${creature} story generation failed: ${result.error?.message}`);
    
    if (result.success) {
      assert(result.data.creature === creature, 
        `Creature type preserved: ${creature}`, 
        `Creature type mismatch: expected ${creature}, got ${result.data.creature}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testAllSpicyLevels() {
  logTest('All Spicy Levels (1-5)');
  
  const service = new StoryService();
  const levels = [1, 2, 3, 4, 5];
  
  for (const level of levels) {
    logInfo(`\nTesting spicy level: ${level}`);
    
    const input = {
      creature: 'vampire',
      themes: ['passion', 'desire'],
      userInput: `Spicy level ${level} test`,
      spicyLevel: level,
      wordCount: 700
    };
    
    const result = await service.generateStory(input);
    
    assert(result.success, 
      `Spicy level ${level} story generated`, 
      `Spicy level ${level} failed: ${result.error?.message}`);
    
    if (result.success) {
      assert(result.data.spicyLevel === level, 
        `Spicy level preserved: ${level}`, 
        `Spicy level mismatch: expected ${level}, got ${result.data.spicyLevel}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testWordCountVariations() {
  logTest('Word Count Variations (700, 900, 1200)');
  
  const service = new StoryService();
  const wordCounts = [700, 900, 1200];
  
  for (const wordCount of wordCounts) {
    logInfo(`\nTesting word count: ${wordCount}`);
    
    const input = {
      creature: 'werewolf',
      themes: ['obsession'],
      userInput: `Word count ${wordCount} test`,
      spicyLevel: 3,
      wordCount
    };
    
    const startTime = Date.now();
    const result = await service.generateStory(input);
    const duration = Date.now() - startTime;
    
    assert(result.success, 
      `${wordCount} word story generated in ${duration}ms`, 
      `${wordCount} word story failed: ${result.error?.message}`);
    
    if (result.success) {
      const actual = result.data.actualWordCount;
      const tolerance = wordCount * 0.2;
      const withinTolerance = Math.abs(actual - wordCount) <= tolerance;
      
      if (withinTolerance) {
        logSuccess(`Word count accurate: ${actual} (target: ${wordCount}, ±${tolerance.toFixed(0)})`);
      } else {
        warn(`Word count off: ${actual} (target: ${wordCount}, ±${tolerance.toFixed(0)})`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function testChapterContinuation() {
  logTest('Chapter Continuation');
  
  const service = new StoryService();
  
  // First generate a story
  logInfo('Generating initial story...');
  const initialInput = {
    creature: 'fairy',
    themes: ['forbidden_love', 'betrayal'],
    userInput: 'A fairy princess falls for a dark sorcerer',
    spicyLevel: 3,
    wordCount: 700
  };
  
  const initialStory = await service.generateStory(initialInput);
  
  assert(initialStory.success, 
    'Initial story generated', 
    `Initial story failed: ${initialStory.error?.message}`);
  
  if (!initialStory.success) {
    return false;
  }
  
  // Now continue the chapter
  logInfo('\nContinuing with Chapter 2...');
  const continueInput = {
    storyId: initialStory.data.storyId,
    currentChapterCount: 1,
    existingContent: initialStory.data.content,
    maintainTone: true
  };
  
  const chapter2 = await service.continueChapter(continueInput);
  
  assert(chapter2.success, 
    'Chapter 2 generated', 
    `Chapter 2 failed: ${chapter2.error?.message}`);
  
  if (chapter2.success) {
    assert(chapter2.data.chapterNumber === 2, 
      `Chapter number is 2`, 
      `Chapter number mismatch: ${chapter2.data.chapterNumber}`);
    
    assert(chapter2.data.content.length > 0, 
      `Chapter 2 has content (${chapter2.data.content.length} chars)`, 
      'Chapter 2 has no content');
    
    logInfo(`Chapter 2 word count: ${chapter2.data.wordCount}`);
  }
  
  return chapter2.success;
}

async function testInputValidation() {
  logTest('Input Validation');
  
  const service = new StoryService();
  
  // Test invalid creature
  logInfo('\nTesting invalid creature type...');
  let result = await service.generateStory({
    creature: 'dragon', // Invalid!
    themes: ['passion'],
    userInput: 'Test',
    spicyLevel: 3,
    wordCount: 700
  });
  
  assert(!result.success && result.error?.code === 'INVALID_INPUT', 
    'Invalid creature rejected', 
    'Invalid creature was not rejected');
  
  // Test invalid spicy level
  logInfo('\nTesting invalid spicy level...');
  result = await service.generateStory({
    creature: 'vampire',
    themes: ['passion'],
    userInput: 'Test',
    spicyLevel: 10, // Invalid!
    wordCount: 700
  });
  
  assert(!result.success && result.error?.code === 'INVALID_INPUT', 
    'Invalid spicy level rejected', 
    'Invalid spicy level was not rejected');
  
  // Test empty themes
  logInfo('\nTesting empty themes...');
  result = await service.generateStory({
    creature: 'vampire',
    themes: [], // Invalid!
    userInput: 'Test',
    spicyLevel: 3,
    wordCount: 700
  });
  
  assert(!result.success && result.error?.code === 'INVALID_INPUT', 
    'Empty themes rejected', 
    'Empty themes were not rejected');
}

async function testSpeakerTags() {
  logTest('Multi-Voice Speaker Tags');
  
  const service = new StoryService();
  const input = {
    creature: 'vampire',
    themes: ['passion', 'desire'],
    userInput: 'A vampire and a mortal have a passionate encounter with lots of dialogue',
    spicyLevel: 4,
    wordCount: 900
  };
  
  const result = await service.generateStory(input);
  
  assert(result.success, 
    'Story generated', 
    `Story failed: ${result.error?.message}`);
  
  if (result.success) {
    const content = result.data.content;
    const hasSpeakerTags = /\[([^\]]+)\]:/.test(content);
    
    if (hasSpeakerTags) {
      const speakerMatches = content.match(/\[([^\]]+)\]:/g);
      const uniqueSpeakers = [...new Set(speakerMatches)];
      
      logSuccess(`Speaker tags found: ${uniqueSpeakers.length} unique speakers`);
      logInfo(`Speakers: ${uniqueSpeakers.slice(0, 5).join(', ')}${uniqueSpeakers.length > 5 ? '...' : ''}`);
    } else {
      warn('No speaker tags found in content (expected for dialogue-heavy stories)');
    }
    
    // Check for rawContent (should have speaker tags preserved)
    if (result.data.rawContent) {
      logSuccess('rawContent field present (for audio processing)');
    } else {
      warn('rawContent field missing (needed for multi-voice audio)');
    }
  }
}

async function testLoggingIntegration() {
  logTest('Logging System Integration');
  
  // Clear existing logs
  logger.clearLogs();
  
  const service = new StoryService();
  const input = {
    creature: 'werewolf',
    themes: ['power_dynamics'],
    userInput: 'Testing logging',
    spicyLevel: 2,
    wordCount: 700
  };
  
  await service.generateStory(input);
  
  // Check recent logs
  const recentLogs = logger.getRecentLogs(100);
  
  assert(recentLogs.length > 0, 
    `Logging active: ${recentLogs.length} log entries captured`, 
    'No logs captured');
  
  // Check for required log types
  const hasInfo = recentLogs.some(log => log.level === 'info');
  const hasPerformance = recentLogs.some(log => log.message.includes('Performance'));
  const hasRequestId = recentLogs.some(log => log.context?.requestId);
  
  assert(hasInfo, 'Info logs present', 'No info logs found');
  assert(hasPerformance, 'Performance logs present', 'No performance logs found');
  assert(hasRequestId, 'Request IDs present', 'No request IDs found');
  
  // Display some logs
  const importantLogs = recentLogs.filter(log => 
    log.level === 'info' || log.level === 'error' || log.message.includes('Performance')
  );
  
  if (importantLogs.length > 0) {
    logInfo('\nRecent log entries:');
    importantLogs.slice(-5).forEach(log => {
      console.log(`  [${log.level.toUpperCase()}] ${log.message}`);
    });
  }
}

// ==================== RUN ALL TESTS ====================

async function runAllTests() {
  logSection('🧪 STORY SERVICE COMPREHENSIVE TEST SUITE');
  
  log('Testing StoryService directly (isolated from HTTP/networking)', 'cyan');
  log('This tests the core business logic and AI integration\n', 'cyan');
  
  const tests = [
    { name: 'Basic Story Generation', fn: testBasicStoryGeneration },
    { name: 'All Creature Types', fn: testAllCreatureTypes },
    { name: 'All Spicy Levels', fn: testAllSpicyLevels },
    { name: 'Word Count Variations', fn: testWordCountVariations },
    { name: 'Chapter Continuation', fn: testChapterContinuation },
    { name: 'Input Validation', fn: testInputValidation },
    { name: 'Speaker Tags (Multi-Voice)', fn: testSpeakerTags },
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
    
    // Small delay between test suites
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
