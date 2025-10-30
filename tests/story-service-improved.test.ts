#!/usr/bin/env tsx
/**
 * IMPROVED STORY GENERATION TESTS
 *
 * Updated to validate multi-chapter generation batches.
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
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(message || `Expected ${actual} to be ${expected}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
      }
    },
    toEqualArrayLength: (expected: number) => {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(message || `Expected array length ${expected}, got ${Array.isArray(actual) ? actual.length : 'non-array'}`);
      }
    }
  };
}

// Helper to summarise results at end
async function summarize() {
  console.log('\n📊 TEST SUMMARY');
  console.log('-'.repeat(80));
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(` - ${r.name}: ${r.error}`);
    });
  }
}

// ==================== TESTS ====================

const testSuite = {
  testServiceInstantiation: test('Service Instantiation', async () => {
    const service = new StoryService();
    expect(service).toBeDefined();
  }),

  testBasicGeneration: test('Basic Story Generation - Single Chapter', async () => {
    const service = new StoryService();
    const input: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance'],
      userInput: 'A vampire lord meets a mortal librarian',
      spicyLevel: 3,
      wordCount: 700,
      requestedChapterCount: 1
    };

    const result = await service.generateStory(input);
    if (!result.success || !result.data) {
      throw new Error(`Story generation failed: ${result.error?.message}`);
    }

    const story = result.data;
    expect(story.storyId, 'storyId should be defined').toBeDefined();
    expect(story.chapters, 'chapters should be defined').toBeDefined();
    expect(story.chapters, 'should return exactly one chapter').toEqualArrayLength(1);

    const chapter = story.chapters[0];
    expect(chapter.chapterNumber, 'chapter number should be 1').toBe(1);
    expect(chapter.wordCount, 'chapter word count should be > 0').toBeGreaterThan(0);
    expect(story.totalWordCount, 'total word count should be > 0').toBeGreaterThan(0);

    console.log(`   ✓ Story ID: ${story.storyId}`);
    console.log(`   ✓ Title: "${story.title}"`);
    console.log(`   ✓ Total Words: ${story.totalWordCount}`);
  }),

  testMultiChapterBatches: test('Multi-Chapter Batch Generation (1,2,3)', async () => {
    const service = new StoryService();
    const chapterCounts: Array<1 | 2 | 3> = [1, 2, 3];

    for (const count of chapterCounts) {
      console.log(`   Requesting ${count} chapter(s)...`);
      const input: StoryGenerationSeam['input'] = {
        creature: 'werewolf',
        themes: ['adventure'],
        userInput: 'Pack politics threaten a budding romance',
        spicyLevel: 2,
        wordCount: 900,
        requestedChapterCount: count
      };

      const result = await service.generateStory(input);
      if (!result.success || !result.data) {
        throw new Error(`Failed to generate ${count} chapter(s): ${result.error?.message}`);
      }

      const story = result.data;
      expect(story.chapters, 'chapters array should exist').toBeDefined();
      expect(story.chapters!, `should contain ${count} chapters`).toEqualArrayLength(count);

      const numbers = story.chapters!.map(ch => ch.chapterNumber);
      const expectedNumbers = Array.from({ length: count }, (_, idx) => idx + 1);
      expect(JSON.stringify(numbers)).toBe(JSON.stringify(expectedNumbers));

      const summedWordCount = story.chapters!.reduce((total, ch) => total + ch.wordCount, 0);
      console.log(`   ✓ Generated ${count} chapters (${summedWordCount} words total)`);

      if (story.failedChapters?.length) {
        console.log(`   ⚠️ Partial failures detected: ${story.failedChapters.map(fc => `Chapter ${fc.chapterNumber}`).join(', ')}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }),

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
        wordCount: 700,
        requestedChapterCount: 1
      };

      const result = await service.generateStory(input);
      if (!result.success || !result.data) {
        throw new Error(`Failed to generate ${creature} story: ${result.error?.message}`);
      }

      console.log(`   ✓ ${creature}: "${result.data.title}" (${result.data.totalWordCount} words total)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }),

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
        wordCount: 700,
        requestedChapterCount: 1
      };

      const result = await service.generateStory(input);
      if (!result.success) {
        throw new Error(`Failed to generate level ${level} story: ${result.error?.message}`);
      }

      console.log(`   ✓ Level ${level}: Generated successfully (${result.data!.totalWordCount} words)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }),

  testWordCounts: test('Different Word Count Targets', async () => {
    const service = new StoryService();
    const wordCounts: Array<700 | 900 | 1200> = [700, 900, 1200];

    for (const wordCount of wordCounts) {
      console.log(`   Testing ${wordCount} words...`);
      const input: StoryGenerationSeam['input'] = {
        creature: 'fairy',
        themes: ['adventure'],
        userInput: 'Test story',
        spicyLevel: 2,
        wordCount,
        requestedChapterCount: 1
      };

      const result = await service.generateStory(input);
      if (!result.success || !result.data) {
        throw new Error(`Failed to generate ${wordCount}-word story: ${result.error?.message}`);
      }

      const actualWords = result.data.totalWordCount;
      const variance = Math.abs(actualWords - wordCount) / wordCount * 100;
      console.log(`   ✓ Target ${wordCount}, actual ${actualWords} (${variance.toFixed(1)}% variance)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }),

  testInvalidInputs: test('Invalid Input Handling', async () => {
    const service = new StoryService();

    const invalidInput1 = {
      themes: ['romance'],
      userInput: 'Test',
      spicyLevel: 3,
      wordCount: 700,
      requestedChapterCount: 1
    } as any;

    const result1 = await service.generateStory(invalidInput1);
    expect(result1.success).toBe(false);
    console.log(`   ✓ Correctly rejected missing creature`);

    const invalidInput2: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance'],
      userInput: 'Test',
      spicyLevel: 10 as any,
      wordCount: 700,
      requestedChapterCount: 1
    };

    const result2 = await service.generateStory(invalidInput2);
    expect(result2.success).toBe(false);
    console.log(`   ✓ Correctly rejected invalid spicy level`);
  }),

  testChapterContinuation: test('Chapter Continuation Batches', async () => {
    const service = new StoryService();

    const storyInput: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance'],
      userInput: 'Initial story',
      spicyLevel: 3,
      wordCount: 700,
      requestedChapterCount: 2
    };

    const storyResult = await service.generateStory(storyInput);
    if (!storyResult.success || !storyResult.data) {
      throw new Error('Failed to generate initial story');
    }

    const story = storyResult.data;
    console.log(`   ✓ Generated initial story with ${story.chapters.length} chapter(s)`);

    const continueInput: ChapterContinuationSeam['input'] = {
      storyId: story.storyId,
      currentChapterCount: story.chapters.length,
      existingContent: story.appendedToStory,
      maintainTone: true,
      userInput: 'Continue the romance',
      requestedChapterCount: 2
    };

    const continueResult = await service.continueChapter(continueInput);
    if (!continueResult.success || !continueResult.data) {
      throw new Error(`Continuation failed: ${continueResult.error?.message}`);
    }

    const continuation = continueResult.data;
    expect(continuation.chapters, 'continuation chapters should exist').toBeDefined();
    expect(continuation.chapters!, 'should return requested chapters').toEqualArrayLength(2);

    const expectedNumbers = [story.chapters.length + 1, story.chapters.length + 2];
    const actualNumbers = continuation.chapters!.map(ch => ch.chapterNumber);
    expect(JSON.stringify(actualNumbers)).toBe(JSON.stringify(expectedNumbers));

    console.log(`   ✓ Continued story with chapters ${actualNumbers.join(', ')}`);
  })
};

(async () => {
  for (const testName of Object.keys(testSuite)) {
    await (testSuite as any)[testName]();
  }
  await summarize();
})();
