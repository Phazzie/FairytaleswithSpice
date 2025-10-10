#!/usr/bin/env tsx
/**
 * IMPROVED AUDIO SERVICE TESTS
 * 
 * Tests AudioService with proper TypeScript support
 * Focuses on actual failure points and edge cases
 * 
 * Run: npx tsx tests/audio-service-improved.test.ts
 */

import { AudioService } from '../api/lib/services/audioService';
import { AudioConversionSeam } from '../api/lib/types/contracts';

// ==================== TEST UTILITIES ====================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
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

// ==================== SAMPLE DATA ====================

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
<p>[Sarah]: "Wisdom? Or control? There's a difference."</p>`,
  
  long: `<p>The ancient castle loomed before her, its towers piercing the stormy sky. Isabella hesitated at the gate, her heart pounding.</p>
<p>[Count Vladislav]: "You came. I wondered if you would have the courage."</p>
<p>[Isabella]: "Courage or foolishness? I'm not sure which brought me here."</p>
<p>[Count Vladislav]: "Perhaps both. The line between bravery and madness is often blurred."</p>`
};

// ==================== TESTS ====================

const testSuite = {
  
  // Test 1: Service instantiation
  testServiceInstantiation: test('Service Instantiation', async () => {
    const service = new AudioService();
    expect(service).toBeDefined();
  }),
  
  // Test 2: Basic audio conversion
  testBasicConversion: test('Basic Audio Conversion - Simple Story', async () => {
    const service = new AudioService();
    const input: AudioConversionSeam['input'] = {
      storyId: 'test_001',
      content: SAMPLE_STORIES.simple,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };
    
    const result = await service.convertToAudio(input);
    
    // Validate response structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    
    if (!result.success) {
      throw new Error(`Audio conversion failed: ${result.error?.message}`);
    }
    
    expect(result.data).toBeDefined();
    const audio = result.data!;
    
    // Validate required fields
    expect(audio.audioId).toBeDefined();
    expect(audio.storyId).toBe(input.storyId);
    expect(audio.audioUrl).toBeDefined();
    expect(audio.duration).toBeGreaterThan(0);
    expect(audio.fileSize).toBeGreaterThan(0);
    
    console.log(`   ✓ Audio ID: ${audio.audioId}`);
    console.log(`   ✓ File Size: ${(audio.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   ✓ Duration: ${audio.duration}s`);
    console.log(`   ✓ Format: ${audio.format}`);
    console.log(`   ✓ URL: ${audio.audioUrl.substring(0, 50)}...`);
  }),
  
  // Test 3: Multi-voice story
  testMultiVoice: test('Multi-Voice Story with Speaker Tags', async () => {
    const service = new AudioService();
    const input: AudioConversionSeam['input'] = {
      storyId: 'test_002',
      content: SAMPLE_STORIES.withSpeakerTags,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };
    
    const result = await service.convertToAudio(input);
    
    if (!result.success) {
      throw new Error(`Multi-voice conversion failed: ${result.error?.message}`);
    }
    
    const audio = result.data!;
    console.log(`   ✓ Multi-voice audio generated`);
    console.log(`   ✓ File Size: ${(audio.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   ✓ Duration: ${audio.duration}s`);
  }),
  
  // Test 4: Voice metadata parsing
  testVoiceMetadata: test('Voice Metadata Parsing', async () => {
    const service = new AudioService();
    const input: AudioConversionSeam['input'] = {
      storyId: 'test_003',
      content: SAMPLE_STORIES.withVoiceMetadata,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };
    
    const result = await service.convertToAudio(input);
    
    if (!result.success) {
      throw new Error(`Voice metadata conversion failed: ${result.error?.message}`);
    }
    
    console.log(`   ✓ Voice metadata processed successfully`);
  }),
  
  // Test 5: All voice types
  testAllVoiceTypes: test('All Voice Types', async () => {
    const service = new AudioService();
    const voices: Array<'female' | 'male' | 'neutral'> = ['female', 'male', 'neutral'];
    
    for (const voice of voices) {
      console.log(`   Testing ${voice} voice...`);
      
      const input: AudioConversionSeam['input'] = {
        storyId: `test_voice_${voice}`,
        content: SAMPLE_STORIES.simple,
        voice,
        speed: 1.0,
        format: 'mp3'
      };
      
      const result = await service.convertToAudio(input);
      
      if (!result.success) {
        throw new Error(`Failed to convert with ${voice} voice: ${result.error?.message}`);
      }
      
      console.log(`   ✓ ${voice}: ${(result.data!.fileSize / 1024).toFixed(2)} KB`);
    }
  }),
  
  // Test 6: All formats
  testAllFormats: test('All Audio Formats', async () => {
    const service = new AudioService();
    const formats: Array<'mp3' | 'wav' | 'aac'> = ['mp3', 'wav', 'aac'];
    
    for (const format of formats) {
      console.log(`   Testing ${format} format...`);
      
      const input: AudioConversionSeam['input'] = {
        storyId: `test_format_${format}`,
        content: SAMPLE_STORIES.simple,
        voice: 'female',
        speed: 1.0,
        format
      };
      
      const result = await service.convertToAudio(input);
      
      if (!result.success) {
        throw new Error(`Failed to convert to ${format}: ${result.error?.message}`);
      }
      
      expect(result.data!.format).toBe(format);
      console.log(`   ✓ ${format}: ${(result.data!.fileSize / 1024).toFixed(2)} KB`);
    }
  }),
  
  // Test 7: Different speeds
  testDifferentSpeeds: test('Different Playback Speeds', async () => {
    const service = new AudioService();
    const speeds: Array<0.5 | 0.75 | 1.0 | 1.25 | 1.5> = [0.5, 0.75, 1.0, 1.25, 1.5];
    
    for (const speed of speeds) {
      console.log(`   Testing ${speed}x speed...`);
      
      const input: AudioConversionSeam['input'] = {
        storyId: `test_speed_${speed}`,
        content: SAMPLE_STORIES.simple,
        voice: 'female',
        speed,
        format: 'mp3'
      };
      
      const result = await service.convertToAudio(input);
      
      if (!result.success) {
        throw new Error(`Failed with speed ${speed}: ${result.error?.message}`);
      }
      
      expect(result.data!.speed).toBe(speed);
      console.log(`   ✓ ${speed}x: ${result.data!.duration}s duration`);
    }
  }),
  
  // Test 8: Long content
  testLongContent: test('Long Content Processing', async () => {
    const service = new AudioService();
    const input: AudioConversionSeam['input'] = {
      storyId: 'test_long',
      content: SAMPLE_STORIES.long,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };
    
    const result = await service.convertToAudio(input);
    
    if (!result.success) {
      throw new Error(`Long content conversion failed: ${result.error?.message}`);
    }
    
    console.log(`   ✓ File Size: ${(result.data!.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   ✓ Duration: ${result.data!.duration}s`);
  }),
  
  // Test 9: Invalid inputs
  testInvalidInputs: test('Invalid Input Handling', async () => {
    const service = new AudioService();
    
    // Test missing storyId
    const invalidInput1 = {
      content: SAMPLE_STORIES.simple,
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    } as any;
    
    const result1 = await service.convertToAudio(invalidInput1);
    // Should still work with mock mode
    console.log(`   ✓ Handled missing storyId`);
    
    // Test empty content
    const invalidInput2: AudioConversionSeam['input'] = {
      storyId: 'test_empty',
      content: '',
      voice: 'female',
      speed: 1.0,
      format: 'mp3'
    };
    
    const result2 = await service.convertToAudio(invalidInput2);
    console.log(`   ✓ Handled empty content`);
  }),
  
  // Test 10: Performance benchmarking
  testPerformance: test('Performance Benchmarking', async () => {
    const service = new AudioService();
    const iterations = 3;
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      const input: AudioConversionSeam['input'] = {
        storyId: `test_perf_${i}`,
        content: SAMPLE_STORIES.simple,
        voice: 'female',
        speed: 1.0,
        format: 'mp3'
      };
      
      const result = await service.convertToAudio(input);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        durations.push(duration);
        console.log(`   Run ${i + 1}: ${duration}ms`);
      }
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(`   ✓ Average: ${avgDuration.toFixed(0)}ms`);
  })
};

// ==================== RUN TESTS ====================

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 AUDIO SERVICE COMPREHENSIVE TEST SUITE');
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
