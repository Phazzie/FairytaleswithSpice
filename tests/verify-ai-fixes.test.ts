#!/usr/bin/env tsx
/**
 * Created: 2025-10-11 02:28
 * 
 * AI Generation Fixes Verification Test
 * 
 * Tests specifically for the fixes made to AI story generation:
 * 1. Token calculation optimization
 * 2. Model name consistency
 * 3. API parameters
 */

import { StoryService } from '../api/lib/services/storyService';
import { StoryService as StoryGeneratorService } from '../story-generator/src/api/lib/services/storyService';

console.log('\n' + '='.repeat(80));
console.log('🔧 AI GENERATION FIXES VERIFICATION');
console.log('='.repeat(80));

// ==================== TEST 1: Token Calculation ====================

console.log('\n📐 TEST 1: Token Calculation Method');
console.log('-'.repeat(80));

const apiService = new StoryService();
const sgService = new StoryGeneratorService();

const testCases = [
  { words: 700, expected: 1594 },
  { words: 900, expected: 2050 },
  { words: 1200, expected: 2733 }
];

let tokenTestsPassed = 0;
for (const testCase of testCases) {
  const apiTokens = (apiService as any).calculateOptimalTokens(testCase.words);
  const sgTokens = (sgService as any).calculateOptimalTokens(testCase.words);
  
  const apiPass = apiTokens === testCase.expected;
  const sgPass = sgTokens === testCase.expected;
  const consistent = apiTokens === sgTokens;
  
  console.log(`\n${testCase.words} words:`);
  console.log(`  api/lib:           ${apiTokens} tokens ${apiPass ? '✅' : '❌'}`);
  console.log(`  story-generator:   ${sgTokens} tokens ${sgPass ? '✅' : '❌'}`);
  console.log(`  Consistency:       ${consistent ? '✅' : '❌'}`);
  console.log(`  Expected:          ${testCase.expected} tokens`);
  
  if (apiPass && sgPass && consistent) {
    tokenTestsPassed++;
  }
}

console.log(`\n✅ Token calculation tests: ${tokenTestsPassed}/${testCases.length} passed`);

// ==================== TEST 2: Model Names ====================

console.log('\n\n🤖 TEST 2: Verifying Model Name in Source Code');
console.log('-'.repeat(80));

import { readFileSync } from 'fs';

const apiServicePath = '/home/runner/work/FairytaleswithSpice/FairytaleswithSpice/api/lib/services/storyService.ts';
const sgServicePath = '/home/runner/work/FairytaleswithSpice/FairytaleswithSpice/story-generator/src/api/lib/services/storyService.ts';

const apiContent = readFileSync(apiServicePath, 'utf-8');
const sgContent = readFileSync(sgServicePath, 'utf-8');

// Check for the correct model name
const correctModel = 'grok-4-fast-reasoning';
const incorrectModel = 'grok-beta';

const apiHasCorrectModel = apiContent.includes(`model: '${correctModel}'`);
const apiHasIncorrectModel = apiContent.includes(`model: '${incorrectModel}'`);
const sgHasCorrectModel = sgContent.includes(`model: '${correctModel}'`);
const sgHasIncorrectModel = sgContent.includes(`model: '${incorrectModel}'`);

console.log(`\napi/lib/services/storyService.ts:`);
console.log(`  Uses '${correctModel}':  ${apiHasCorrectModel ? '✅' : '❌'}`);
console.log(`  Uses '${incorrectModel}':        ${apiHasIncorrectModel ? '❌ (should not)' : '✅'}`);

console.log(`\nstory-generator/src/api/lib/services/storyService.ts:`);
console.log(`  Uses '${correctModel}':  ${sgHasCorrectModel ? '✅' : '❌'}`);
console.log(`  Uses '${incorrectModel}':        ${sgHasIncorrectModel ? '❌ (should not)' : '✅'}`);

const modelTestPassed = apiHasCorrectModel && !apiHasIncorrectModel && 
                        sgHasCorrectModel && !sgHasIncorrectModel;

console.log(`\n${modelTestPassed ? '✅' : '❌'} Model name verification: ${modelTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== TEST 3: API Parameters ====================

console.log('\n\n⚙️  TEST 3: Verifying API Parameters');
console.log('-'.repeat(80));

const apiHasTopP = apiContent.includes('top_p: 0.95');
const apiHasRepetitionPenalty = apiContent.includes('repetition_penalty: 1.1');
const sgHasTopP = sgContent.includes('top_p: 0.95');
const sgHasRepetitionPenalty = sgContent.includes('repetition_penalty: 1.1');

console.log(`\napi/lib/services/storyService.ts:`);
console.log(`  Has top_p parameter:              ${apiHasTopP ? '✅' : '❌'}`);
console.log(`  Has repetition_penalty parameter: ${apiHasRepetitionPenalty ? '✅' : '❌'}`);

console.log(`\nstory-generator/src/api/lib/services/storyService.ts:`);
console.log(`  Has top_p parameter:              ${sgHasTopP ? '✅' : '❌'}`);
console.log(`  Has repetition_penalty parameter: ${sgHasRepetitionPenalty ? '✅' : '❌'}`);

const paramsTestPassed = apiHasTopP && apiHasRepetitionPenalty && 
                         sgHasTopP && sgHasRepetitionPenalty;

console.log(`\n${paramsTestPassed ? '✅' : '❌'} API parameters verification: ${paramsTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== FINAL SUMMARY ====================

console.log('\n\n' + '='.repeat(80));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(80));

const allPassed = tokenTestsPassed === testCases.length && modelTestPassed && paramsTestPassed;

console.log(`\n✅ Token Calculation:    ${tokenTestsPassed}/${testCases.length} tests passed`);
console.log(`${modelTestPassed ? '✅' : '❌'} Model Names:          ${modelTestPassed ? 'CORRECT' : 'INCORRECT'}`);
console.log(`${paramsTestPassed ? '✅' : '❌'} API Parameters:       ${paramsTestPassed ? 'CORRECT' : 'INCORRECT'}`);

console.log(`\n${allPassed ? '✅ ALL FIXES VERIFIED SUCCESSFULLY!' : '❌ SOME FIXES FAILED VERIFICATION'}`);

console.log('\n' + '='.repeat(80) + '\n');

process.exit(allPassed ? 0 : 1);
