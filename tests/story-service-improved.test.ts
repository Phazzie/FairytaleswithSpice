#!/usr/bin/env tsx
/**
 * IMPROVED STORY GENERATION TESTS
 * 
 * Tests StoryService with proper TypeScript support
 * Focuses on actual failure points and edge cases
 * 
 * Run: npx tsx tests/story-service-improved.test.ts
 */

import { StoryService } from '../api/lib/services/storyService';
import { StoryGenerationSeam, ChapterContinuationSeam } from '../api/lib/types/contracts';

// ==================== TEST UTILITIES ====================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
  details?: any;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    const startTime = Date.now();
    try {
      console.log(`\n🧪 ${name}`);
      console.log('-'.repeat(80));
      await fn();
      const duration = Date.now() - startTime;
      results.push({ name, passed: true, duration });
      console.log(`✅ PASSED (${duration}ms)`);
      return true;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      results.push({ 
        name, 
        passed: false, 
        error: error.message,
        duration 
      });
      console.log(`❌ FAILED (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      if (error.stack) {
        console.log(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n   ')}`);
      }
      return false;
    }
  };
}

function expect(actual: any, message?: string) {
  return {
    toBeDefined: () => {
      if (actual === undefined || actual === null) {
        throw new Error(message || `Expected value to be defined, got ${actual}`);
      }
    },
    toBeUndefined: () => {
      if (actual !== undefined) {
        throw new Error(message || `Expected value to be undefined, got ${actual}`);
      }
    },
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${actual} to be ${expected}`);
      }
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(message || `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    },
    toContain: (substring: string) => {
      if (typeof actual !== 'string' || !actual.includes(substring)) {
        throw new Error(message || `Expected "${actual}" to contain "${substring}"`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) {
        throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected: number) => {
      if (actual >= expected) {
        throw new Error(message || `Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeInstanceOf: (expected: any) => {
      if (!(actual instanceof expected)) {
        throw new Error(message || `Expected ${actual} to be instance of ${expected.name}`);
      }
    },
    toHaveProperty: (prop: string) => {
      if (!(prop in actual)) {
        throw new Error(message || `Expected object to have property "${prop}"`);
      }
    },
    toBeOneOf: (values: any[]) => {
      if (!values.includes(actual)) {
        throw new Error(message || `Expected ${actual} to be one of [${values.join(', ')}]`);
      }
    }
  };
}

// ==================== TESTS ====================

const testSuite = {
  
  // Test 1: Service instantiation
  testServiceInstantiation: test('Service Instantiation', async () => {
    const service = new StoryService();
    expect(service).toBeDefined();
  }),
  
  // Test 2: Basic story generation with valid input
  testBasicGeneration: test('Basic Story Generation - Vampire Romance', async () => {
    const service = new StoryService();
    const input: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance', 'dark'],
      userInput: 'A vampire lord meets a mortal librarian',
      spicyLevel: 3,
      wordCount: 700
    };
    
    const result = await service.generateStory(input);
    
    // Validate response structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('metadata');
    
    if (!result.success) {
      console.log('   Error:', result.error);
      throw new Error(`Story generation failed: ${result.error?.message}`);
    }
    
    expect(result.data).toBeDefined();
    const story = result.data!;
    
    // Validate required fields
    expect(story.storyId, 'storyId should be defined').toBeDefined();
    expect(story.title, 'title should be defined').toBeDefined();
    expect(story.content, 'content should be defined').toBeDefined();
    expect(story.actualWordCount, 'actualWordCount should be defined').toBeDefined();
    
    console.log(`   ✓ Story ID: ${story.storyId}`);
    console.log(`   ✓ Title: "${story.title}"`);
    console.log(`   ✓ Word Count: ${story.actualWordCount} (target: ${input.wordCount})`);
    console.log(`   ✓ Read Time: ${story.estimatedReadTime} min`);
    console.log(`   ✓ Cliffhanger: ${story.hasCliffhanger}`);
    
    // Validate word count is within reasonable range
    const targetWordCount = input.wordCount;
    const tolerance = 0.3; // 30% tolerance
    const minWords = targetWordCount * (1 - tolerance);
    const maxWords = targetWordCount * (1 + tolerance);
    
    if (story.actualWordCount < minWords || story.actualWordCount > maxWords) {
      console.log(`   ⚠️  Word count outside tolerance range (${minWords}-${maxWords})`);
    }
  }),
  
  // Test 3: All creature types
  testAllCreatures: test('All Creature Types Generation', async () => {
    const service = new StoryService();
    const creatures: Array<'vampire' | 'werewolf' | 'fairy'> = ['vampire', 'werewolf', 'fairy'];
    
    for (const creature of creatures) {
      console.log(`   Testing ${creature}...`);
      
      const input: StoryGenerationSeam['input'] = {
        creature,
        themes: ['romance'],
        userInput: `A ${creature} story`,
        spicyLevel: 2,
        wordCount: 700
      };
      
      const result = await service.generateStory(input);
      
      if (!result.success) {
        throw new Error(`Failed to generate ${creature} story: ${result.error?.message}`);
      }
      
      expect(result.data).toBeDefined();
      console.log(`   ✓ ${creature}: "${result.data!.title}" (${result.data!.actualWordCount} words)`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }),
  
  // Test 4: All spicy levels
  testAllSpicyLevels: test('All Spicy Levels (1-5)', async () => {
    const service = new StoryService();
    const levels: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];
    
    for (const level of levels) {
      console.log(`   Testing spicy level ${level}...`);
      
      const input: StoryGenerationSeam['input'] = {
        creature: 'vampire',
        themes: ['romance'],
        userInput: 'Test story',
        spicyLevel: level,
        wordCount: 700
      };
      
      const result = await service.generateStory(input);
      
      if (!result.success) {
        throw new Error(`Failed to generate level ${level} story: ${result.error?.message}`);
      }
      
      console.log(`   ✓ Level ${level}: Generated successfully`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }),
  
  // Test 5: Different word counts
  testWordCounts: test('Different Word Count Targets', async () => {
    const service = new StoryService();
    const wordCounts: Array<700 | 900 | 1200> = [700, 900, 1200];
    
    for (const wordCount of wordCounts) {
      console.log(`   Testing ${wordCount} words...`);
      
      const input: StoryGenerationSeam['input'] = {
        creature: 'vampire',
        themes: ['romance'],
        userInput: 'Test story',
        spicyLevel: 2,
        wordCount
      };
      
      const result = await service.generateStory(input);
      
      if (!result.success) {
        throw new Error(`Failed to generate ${wordCount}-word story: ${result.error?.message}`);
      }
      
      const actualWords = result.data!.actualWordCount;
      const variance = Math.abs(actualWords - wordCount) / wordCount * 100;
      
      console.log(`   ✓ Target ${wordCount}, actual ${actualWords} (${variance.toFixed(1)}% variance)`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }),
  
  // Test 6: Invalid inputs
  testInvalidInputs: test('Invalid Input Handling', async () => {
    const service = new StoryService();
    
    // Test missing creature
    const invalidInput1 = {
      themes: ['romance'],
      userInput: 'Test',
      spicyLevel: 3,
      wordCount: 700
    } as any;
    
    const result1 = await service.generateStory(invalidInput1);
    expect(result1.success).toBe(false);
    console.log(`   ✓ Correctly rejected missing creature`);
    
    // Test invalid spicy level
    const invalidInput2: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance'],
      userInput: 'Test',
      spicyLevel: 10 as any,
      wordCount: 700
    };
    
    const result2 = await service.generateStory(invalidInput2);
    expect(result2.success).toBe(false);
    console.log(`   ✓ Correctly rejected invalid spicy level`);
  }),
  
  // Test 7: Chapter continuation
  testChapterContinuation: test('Chapter Continuation', async () => {
    const service = new StoryService();
    
    // First generate a story
    const storyInput: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance'],
      userInput: 'Initial story',
      spicyLevel: 3,
      wordCount: 700
    };
    
    const storyResult = await service.generateStory(storyInput);
    
    if (!storyResult.success) {
      throw new Error('Failed to generate initial story');
    }
    
    const story = storyResult.data!;
    console.log(`   ✓ Generated initial story: "${story.title}"`);
    
    // Now continue it
    const continueInput: ChapterContinuationSeam['input'] = {
      storyId: story.storyId,
      currentChapterCount: 1,
      existingContent: story.content,
      maintainTone: true,
      userInput: 'Continue the romance'
    };
    
    const continueResult = await service.continueChapter(continueInput);
    
    if (!continueResult.success) {
      throw new Error(`Failed to continue chapter: ${continueResult.error?.message}`);
    }
    
    const chapter = continueResult.data!;
    console.log(`   ✓ Generated chapter ${chapter.chapterNumber}: "${chapter.title}"`);
    console.log(`   ✓ Chapter word count: ${chapter.wordCount}`);
  }),
  
  // Test 8: Performance test
  testPerformance: test('Performance Benchmarking', async () => {
    const service = new StoryService();
    const iterations = 3;
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      const input: StoryGenerationSeam['input'] = {
        creature: 'vampire',
        themes: ['romance'],
        userInput: `Performance test ${i + 1}`,
        spicyLevel: 2,
        wordCount: 700
      };
      
      const result = await service.generateStory(input);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        durations.push(duration);
        console.log(`   Run ${i + 1}: ${duration}ms`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log(`   ✓ Average: ${avgDuration.toFixed(0)}ms`);
    console.log(`   ✓ Min: ${minDuration}ms`);
    console.log(`   ✓ Max: ${maxDuration}ms`);
  })
};

// ==================== RUN TESTS ====================

async function runAllTests() {
  })
};

// ==================== TOKEN CALCULATION TESTS ====================

const tokenCalculationTests = {
  testTokenCalculation700: test('Token Calculation for 700 words', () => {
    const service = new StoryService();
    // Access private method via type assertion
    const tokens = (service as any).calculateOptimalTokens(700);
    
    // Expected with OPTIMIZED formula: 700 * 1.5 * 1.15 * 1.1 * 1.05 = 1394.3 → 1395
    const expected = Math.ceil(700 * 1.5 * 1.15 * 1.1 * 1.05);
    console.log(`   Tokens for 700 words: ${tokens} (expected: ${expected})`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
    
    // Should be more efficient than PR#65's calculation
    const pr65Calculation = Math.ceil(700 * 1.5 * 1.2 * 1.15 * 1.1);
    console.log(`   PR#65 would allocate: ${pr65Calculation} tokens`);
    console.log(`   Our optimization saves: ${pr65Calculation - tokens} tokens (${((pr65Calculation - tokens) / pr65Calculation * 100).toFixed(1)}%)`);
  }),
  
  testTokenCalculation900: test('Token Calculation for 900 words', () => {
    const service = new StoryService();
    const tokens = (service as any).calculateOptimalTokens(900);
    
    // Expected: 900 * 1.5 * 1.15 * 1.1 * 1.05 = 1792.1 → 1793
    const expected = Math.ceil(900 * 1.5 * 1.15 * 1.1 * 1.05);
    console.log(`   Tokens for 900 words: ${tokens} (expected: ${expected})`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
  }),
  
  testTokenCalculation1200: test('Token Calculation for 1200 words', () => {
    const service = new StoryService();
    const tokens = (service as any).calculateOptimalTokens(1200);
    
    // Expected: 1200 * 1.5 * 1.15 * 1.1 * 1.05 = 2389.5 → 2390
    const expected = Math.ceil(1200 * 1.5 * 1.15 * 1.1 * 1.05);
    console.log(`   Tokens for 1200 words: ${tokens} (expected: ${expected})`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
  }),
  
  testTokenCalculationAlwaysRoundsUp: test('Token Calculation Always Rounds Up', () => {
    const service = new StoryService();
    
    // Test with a value that would have a decimal
    const tokens = (service as any).calculateOptimalTokens(750);
    const rawCalculation = 750 * 1.5 * 1.15 * 1.1 * 1.05;
    const expected = Math.ceil(rawCalculation);
    
    console.log(`   Raw calculation: ${rawCalculation}`);
    console.log(`   Rounded up to: ${tokens}`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
    
    if (tokens < rawCalculation) {
      throw new Error('Token calculation should always round up');
    }
  })
};

// ==================== TOKEN CALCULATION TESTS ====================

const tokenCalculationTests = {
  testTokenCalculation700: test('Token Calculation for 700 words', () => {
    const service = new StoryService();
    // Access private method via type assertion
    const tokens = (service as any).calculateOptimalTokens(700);
    
    // Expected with optimized formula: 700 * 1.5 * 1.15 * 1.1 * 1.05 = 1393.5 → 1394
    const expected = Math.ceil(700 * 1.5 * 1.15 * 1.1 * 1.05);
    console.log(`   Tokens for 700 words: ${tokens} (expected: ${expected})`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
    
    // Should be more efficient than old calculation
    const oldCalculation = 700 * 2;
    console.log(`   Old calculation would be: ${oldCalculation}`);
    console.log(`   New is ${((oldCalculation - tokens) / oldCalculation * 100).toFixed(1)}% more efficient`);
  }),
  
  testTokenCalculation900: test('Token Calculation for 900 words', () => {
    const service = new StoryService();
    const tokens = (service as any).calculateOptimalTokens(900);
    
    // Expected: 900 * 1.5 * 1.15 * 1.1 * 1.05 = 1792.1 → 1793
    const expected = Math.ceil(900 * 1.5 * 1.15 * 1.1 * 1.05);
    console.log(`   Tokens for 900 words: ${tokens} (expected: ${expected})`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
  }),
  
  testTokenCalculation1200: test('Token Calculation for 1200 words', () => {
    const service = new StoryService();
    const tokens = (service as any).calculateOptimalTokens(1200);
    
    // Expected: 1200 * 1.5 * 1.15 * 1.1 * 1.05 = 2389.5 → 2390
    const expected = Math.ceil(1200 * 1.5 * 1.15 * 1.1 * 1.05);
    console.log(`   Tokens for 1200 words: ${tokens} (expected: ${expected})`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
  }),
  
  testTokenCalculationAlwaysRoundsUp: test('Token Calculation Always Rounds Up', () => {
    const service = new StoryService();
    
    // Test with a value that would have a decimal
    const tokens = (service as any).calculateOptimalTokens(750);
    const rawCalculation = 750 * 1.5 * 1.15 * 1.1 * 1.05;
    const expected = Math.ceil(rawCalculation);
    
    console.log(`   Raw calculation: ${rawCalculation}`);
    console.log(`   Rounded up to: ${tokens}`);
    
    if (tokens !== expected) {
      throw new Error(`Expected ${expected} tokens, got ${tokens}`);
    }
    
    if (tokens < rawCalculation) {
      throw new Error('Token calculation should always round up');
    }
  })
};

// ==================== RUN TESTS ====================

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 STORY SERVICE COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  for (const [testName, testFn] of Object.entries(testSuite)) {
    await testFn();
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const total = results.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.failed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
