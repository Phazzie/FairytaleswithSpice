#!/usr/bin/env tsx
/**
 * IMPROVED STORY GENERATION TESTS
 * 
 * Tests StoryService with proper TypeScript support
 * Focuses on actual failure points and edge cases
 * 
 * Run: npx tsx tests/story-service-improved.test.ts
 */

import { StoryService } from '../api/_lib/services/storyService';
import { StoryGenerationSeam, ChapterContinuationSeam } from '../api/_lib/types/contracts';

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

async function withMockGrok(fn: () => Promise<void>): Promise<void> {
  const originalApiKey = process.env['XAI_API_KEY'];
  delete process.env['XAI_API_KEY'];

  try {
    await fn();
  } finally {
    if (originalApiKey === undefined) {
      delete process.env['XAI_API_KEY'];
    } else {
      process.env['XAI_API_KEY'] = originalApiKey;
    }
  }
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
    expect(story.tropeMetadata, 'tropeMetadata should be defined').toBeDefined();
    
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
    await withMockGrok(async () => {
      const service = new StoryService();
      const wordCounts: Array<700 | 900 | 1200> = [700, 900, 1200];
      const tolerance = 0.3;

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
        const minWords = wordCount * (1 - tolerance);
        const maxWords = wordCount * (1 + tolerance);

        console.log(`   ✓ Target ${wordCount}, actual ${actualWords} (${variance.toFixed(1)}% variance)`);

        if (actualWords < minWords || actualWords > maxWords) {
          throw new Error(`Mock story word count ${actualWords} should be within 30% of ${wordCount}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });
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

    // Test invalid requested chapter count
    const invalidInput3: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['romance'],
      userInput: 'Test',
      spicyLevel: 3,
      wordCount: 700,
      requestedChapterCount: 4 as any
    };

    const result3 = await service.generateStory(invalidInput3);
    expect(result3.success).toBe(false);
    console.log(`   ✓ Correctly rejected invalid requested chapter count`);
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
    expect(chapter.cliffhangerAnalysis, 'cliffhangerAnalysis should be defined').toBeDefined();
  }),

  // Test 8: Multi-chapter generation batch
  testMultiChapterGenerationBatch: test('Multi-Chapter Story Generation Batch', async () => {
    await withMockGrok(async () => {
      const service = new StoryService();
      const input: StoryGenerationSeam['input'] = {
        creature: 'vampire',
        themes: ['forbidden_love', 'dark_secrets'],
        userInput: 'A court romance with escalating political danger',
        spicyLevel: 3,
        wordCount: 900,
        requestedChapterCount: 3
      };

      const result = await service.generateStory(input);

      if (!result.success) {
        throw new Error(`Multi-chapter generation failed: ${result.error?.message}`);
      }

      const story = result.data!;
      expect(story.chapters?.length).toBe(3);
      expect(result.metadata?.chaptersRequested).toBe(3);
      expect(result.metadata?.chaptersGenerated).toBe(3);
      expect(story.totalWordCount).toBeGreaterThan(0);
      expect(story.actualWordCount).toBe(story.totalWordCount);
      expect(story.appendedToStory).toContain('Chapter 3');
      expect(story.failedChapters).toBeUndefined();

      const minWords = input.wordCount * 0.7;
      const maxWords = input.wordCount * 1.3;
      if (story.totalWordCount < minWords || story.totalWordCount > maxWords) {
        throw new Error(`Multi-chapter mock total ${story.totalWordCount} should be within 30% of ${input.wordCount}`);
      }

      console.log(`   ✓ Generated chapters: ${story.chapters!.map(chapter => chapter.chapterNumber).join(', ')}`);
      console.log(`   ✓ Total word count: ${story.totalWordCount}`);
    });
  }),

  // Test 9: Multi-chapter continuation batch
  testMultiChapterContinuationBatch: test('Multi-Chapter Continuation Batch', async () => {
    await withMockGrok(async () => {
      const service = new StoryService();
      const input: ChapterContinuationSeam['input'] = {
        storyId: 'story_test_batch',
        currentChapterCount: 1,
        existingContent: '<h3>Chapter 1: The First Oath</h3><p>Arabella chose danger when she accepted the crimson ring.</p>',
        maintainTone: true,
        userInput: 'Escalate the court intrigue',
        requestedChapterCount: 2
      };

      const result = await service.continueChapter(input);

      if (!result.success) {
        throw new Error(`Multi-chapter continuation failed: ${result.error?.message}`);
      }

      const continuation = result.data!;
      expect(continuation.chapters?.length).toBe(2);
      expect(result.metadata?.chaptersRequested).toBe(2);
      expect(result.metadata?.chaptersGenerated).toBe(2);
      expect(continuation.chapters?.[0]?.chapterNumber).toBe(2);
      expect(continuation.chapters?.[1]?.chapterNumber).toBe(3);
      expect(continuation.appendedToStory).toContain('Chapter 3');
      expect(continuation.totalWordCount).toBeGreaterThan(0);
      expect(continuation.cliffhangerAnalysis).toBeDefined();
      for (const chapter of continuation.chapters!) {
        if (chapter.wordCount < 400 || chapter.wordCount > 600) {
          throw new Error(`Mock continuation chapter ${chapter.chapterNumber} word count ${chapter.wordCount} should stay within the 400-600 prompt target`);
        }
      }

      console.log(`   ✓ Continued chapters: ${continuation.chapters!.map(chapter => chapter.chapterNumber).join(', ')}`);
      console.log(`   ✓ Appended story word count: ${continuation.totalWordCount}`);
    });
  }),

  // Test 10: Streaming mock mode rejects oversized word counts before emitting chunks
  testStreamingRejectsOversizedMockWordCount: test('Streaming Mock Mode Rejects Oversized Word Count', async () => {
    await withMockGrok(async () => {
      const service = new StoryService();
      let chunkCount = 0;
      const input: StoryGenerationSeam['input'] = {
        creature: 'vampire',
        themes: ['forbidden_love'],
        userInput: 'A streaming request that should be rejected before mock generation.',
        spicyLevel: 3,
        wordCount: 5000 as any
      };

      try {
        await service.generateStoryStreaming(input, () => {
          chunkCount++;
        });
        throw new Error('oversized streaming mock request should have been rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Invalid word count');
        expect(chunkCount).toBe(0);
      }
    });
  }),
  
  // Test 11: Performance test
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

// ==================== STORY TEXT MEASUREMENT TESTS ====================

// Generator HTML puts each paragraph in its own `<p>` element and is under no
// obligation to leave whitespace between them. Everything below reads the story
// the way the reader sees it, which stripping tags in place does not: it welds
// the last word of one paragraph to the first word of the next.
const HTML_CHAPTER = [
  '<h3>Chapter 1: The Door</h3>',
  '<p>She opened the door.</p>',
  '<p>Blood pooled on the floor.</p>',
  '<p>Who was there?</p>'
].join('');

const storyTextTests = {
  testWordCountAcrossParagraphBoundaries: test('Word Count Reads Paragraph Boundaries', () => {
    const service = new StoryService();
    const countWords = (content: string) => (service as any).countWords(content);

    // "one" and "two" are two words to a reader, and were one before the fix.
    const twoWords = countWords('<p>one</p><p>two</p>');
    if (twoWords !== 2) {
      throw new Error(`Expected 2 words across a paragraph boundary, got ${twoWords}`);
    }

    // 4 heading words + 4 + 5 + 3 in the paragraphs.
    const chapterWords = countWords(HTML_CHAPTER);
    if (chapterWords !== 16) {
      throw new Error(`Expected 16 words in the sample chapter, got ${chapterWords}`);
    }

    // Every boundary used to cost one word, so the count grew with the markup.
    const manyParagraphs = Array.from({ length: 40 }, (_, index) => `<p>word${index}</p>`).join('');
    const manyParagraphWords = countWords(manyParagraphs);
    if (manyParagraphWords !== 40) {
      throw new Error(`Expected 40 words in 40 paragraphs, got ${manyParagraphWords}`);
    }

    console.log(`   ✓ <p>one</p><p>two</p> counts as ${twoWords} words`);
    console.log(`   ✓ Sample chapter counts as ${chapterWords} words`);
    console.log(`   ✓ 40 single-word paragraphs count as ${manyParagraphWords} words`);
  }),

  testStripHtmlKeepsWordsApart: test('Stripped Story Text Keeps Words Apart', () => {
    const service = new StoryService();
    const stripped: string = (service as any).stripHtml(HTML_CHAPTER);

    for (const welded of ['DoorShe', 'door.Blood', 'floor.Who']) {
      if (stripped.includes(welded)) {
        throw new Error(`Stripped text welded two paragraphs together: found "${welded}"`);
      }
    }

    if (!stripped.includes('Blood pooled on the floor.')) {
      throw new Error('Stripped text should preserve the prose of each paragraph');
    }

    console.log(`   ✓ Stripped text: ${JSON.stringify(stripped)}`);
  }),

  testLastChapterSummaryReadsTheEnding: test('Last Chapter Summary Reads The Ending', () => {
    const service = new StoryService();
    // Six paragraphs, so "the last three" is a strictly smaller set than "all".
    const story = [
      '<p>Paragraph one opens the chapter.</p>',
      '<p>Paragraph two builds the tension.</p>',
      '<p>Paragraph three turns the screw.</p>',
      '<p>Paragraph four raises the stakes.</p>',
      '<p>Paragraph five names the price.</p>',
      '<p>Paragraph six leaves the door open.</p>'
    ].join('');

    const summary: string = (service as any).extractLastChapterSummary(story);

    if (!summary.includes('Paragraph six')) {
      throw new Error(`Summary of the last chapter should reach its final paragraph: ${summary}`);
    }
    if (summary.includes('Paragraph one')) {
      throw new Error(`Summary of the last three paragraphs should not start at the beginning: ${summary}`);
    }

    console.log(`   ✓ Summary: ${JSON.stringify(summary)}`);
  }),

  testNextChapterHintIsTheClosingSentence: test('Next Chapter Hint Is The Closing Sentence', () => {
    const service = new StoryService();
    const hint: string = (service as any).generateNextChapterHint(HTML_CHAPTER);

    // With no whitespace after the full stops, the sentence split had nothing to
    // split on and the "hint" was the whole chapter, cut 200 characters in from
    // its opening.
    if (hint !== 'Who was there?') {
      throw new Error(`Expected the closing sentence as the hint, got: ${JSON.stringify(hint)}`);
    }

    console.log(`   ✓ Hint: ${JSON.stringify(hint)}`);
  })
};

// ==================== RUN TESTS ====================

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 STORY SERVICE COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(80));

  const startTime = Date.now();

  // Run main test suite
  for (const testFn of Object.values(testSuite)) {
    await testFn();
  }

  // Run token calculation tests
  console.log('\n' + '-'.repeat(80));
  console.log('🔢 TOKEN CALCULATION TESTS');
  console.log('-'.repeat(80));

  for (const testFn of Object.values(tokenCalculationTests)) {
    await testFn();
  }

  // Run story text measurement tests
  console.log('\n' + '-'.repeat(80));
  console.log('📏 STORY TEXT MEASUREMENT TESTS');
  console.log('-'.repeat(80));

  for (const testFn of Object.values(storyTextTests)) {
    await testFn();
  }

  const totalDuration = Date.now() - startTime;
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
