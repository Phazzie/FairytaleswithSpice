#!/usr/bin/env tsx
/**
 * Created: 2025-10-11 02:55
 * 
 * AI Generation Fixes Verification Test
 * 
 * Tests specifically for the fixes made to AI story generation:
 * 1. Token calculation optimization (OPTIMIZED version - not PR#65's conservative version)
 * 2. Model name consistency
 * 3. API parameters (top_p, NO repetition_penalty - not supported by Grok)
 * 4. Timeout increases (90s/60s)
 */

import { StoryService } from '../api/lib/services/storyService';
import { StoryService as StoryGeneratorService } from '../story-generator/src/api/lib/services/storyService';

console.log('\n' + '='.repeat(80));
console.log('🔧 AI GENERATION FIXES VERIFICATION (OPTIMIZED VERSION)');
console.log('='.repeat(80));

// ==================== TEST 1: Token Calculation ====================

console.log('\n📐 TEST 1: Optimized Token Calculation Method');
console.log('-'.repeat(80));

const apiService = new StoryService();
const sgService = new StoryGeneratorService();

// Our OPTIMIZED formula: 1.5 * 1.15 * 1.1 * 1.05 = 1.99x multiplier
const testCases = [
  { words: 700, expected: Math.ceil(700 * 1.5 * 1.15 * 1.1 * 1.05) },   // 1395
  { words: 900, expected: Math.ceil(900 * 1.5 * 1.15 * 1.1 * 1.05) },   // 1793
  { words: 1200, expected: Math.ceil(1200 * 1.5 * 1.15 * 1.1 * 1.05) }  // 2390
];

let tokenTestsPassed = 0;
for (const testCase of testCases) {
  const apiTokens = (apiService as any).calculateOptimalTokens(testCase.words);
  const sgTokens = (sgService as any).calculateOptimalTokens(testCase.words);
  
  const apiPass = apiTokens === testCase.expected;
  const sgPass = sgTokens === testCase.expected;
  const consistent = apiTokens === sgTokens;
  
  // Compare to PR#65's conservative formula
  const pr65Calculation = Math.ceil(testCase.words * 1.5 * 1.2 * 1.15 * 1.1);
  const savings = pr65Calculation - testCase.expected;
  const savingsPercent = (savings / pr65Calculation * 100).toFixed(1);
  
  console.log(`\n${testCase.words} words:`);
  console.log(`  api/lib:           ${apiTokens} tokens ${apiPass ? '✅' : '❌'}`);
  console.log(`  story-generator:   ${sgTokens} tokens ${sgPass ? '✅' : '❌'}`);
  console.log(`  Consistency:       ${consistent ? '✅' : '❌'}`);
  console.log(`  Expected:          ${testCase.expected} tokens`);
  console.log(`  PR#65 would use:   ${pr65Calculation} tokens`);
  console.log(`  Our savings:       ${savings} tokens (${savingsPercent}% more efficient)`);
  
  if (apiPass && sgPass && consistent) {
    tokenTestsPassed++;
  }
}

console.log(`\n✅ Token calculation tests: ${tokenTestsPassed}/${testCases.length} passed`);

// ==================== TEST 2: Model Names ====================

console.log('\n\n🤖 TEST 2: Verifying Model Name in Source Code');
console.log('-'.repeat(80));

import { readFileSync } from 'fs';
import { join } from 'path';

const rootDir = process.cwd();
const apiServicePath = join(rootDir, 'api/lib/services/storyService.ts');
const sgServicePath = join(rootDir, 'story-generator/src/api/lib/services/storyService.ts');

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

console.log('\n\n⚙️  TEST 3: Verifying API Parameters (Grok-Compatible)');
console.log('-'.repeat(80));

const apiHasTopP = apiContent.includes('top_p: 0.95');
const sgHasTopP = sgContent.includes('top_p: 0.95');

// CRITICAL: Should NOT have repetition_penalty (Grok doesn't support it)
const apiHasRepetitionPenalty = apiContent.includes('repetition_penalty');
const sgHasRepetitionPenalty = sgContent.includes('repetition_penalty');

console.log(`\napi/lib/services/storyService.ts:`);
console.log(`  Has top_p parameter:              ${apiHasTopP ? '✅' : '❌'}`);
console.log(`  Has repetition_penalty parameter: ${apiHasRepetitionPenalty ? '❌ (should NOT - unsupported)' : '✅'}`);

console.log(`\nstory-generator/src/api/lib/services/storyService.ts:`);
console.log(`  Has top_p parameter:              ${sgHasTopP ? '✅' : '❌'}`);
console.log(`  Has repetition_penalty parameter: ${sgHasRepetitionPenalty ? '❌ (should NOT - unsupported)' : '✅'}`);

const paramsTestPassed = apiHasTopP && !apiHasRepetitionPenalty && 
                         sgHasTopP && !sgHasRepetitionPenalty;

console.log(`\n${paramsTestPassed ? '✅' : '❌'} API parameters verification: ${paramsTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== TEST 4: Timeouts ====================

console.log('\n\n⏱️  TEST 4: Verifying Timeout Increases');
console.log('-'.repeat(80));

const apiHas90sTimeout = apiContent.includes('timeout: 90000');
const apiHas60sTimeout = apiContent.includes('timeout: 60000');

console.log(`\napi/lib/services/storyService.ts:`);
console.log(`  Has 90s story generation timeout:  ${apiHas90sTimeout ? '✅' : '❌'}`);
console.log(`  Has 60s continuation timeout:      ${apiHas60sTimeout ? '✅' : '❌'}`);

const timeoutTestPassed = apiHas90sTimeout && apiHas60sTimeout;

console.log(`\n${timeoutTestPassed ? '✅' : '❌'} Timeout verification: ${timeoutTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== FINAL SUMMARY ====================

console.log('\n\n' + '='.repeat(80));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(80));

const allPassed = tokenTestsPassed === testCases.length && modelTestPassed && paramsTestPassed && timeoutTestPassed;

console.log(`\n✅ Token Calculation:    ${tokenTestsPassed}/${testCases.length} tests passed (OPTIMIZED formula)`);
console.log(`${modelTestPassed ? '✅' : '❌'} Model Names:          ${modelTestPassed ? 'CORRECT' : 'INCORRECT'}`);
console.log(`${paramsTestPassed ? '✅' : '❌'} API Parameters:       ${paramsTestPassed ? 'CORRECT (no repetition_penalty)' : 'INCORRECT'}`);
console.log(`${timeoutTestPassed ? '✅' : '❌'} Timeouts:             ${timeoutTestPassed ? 'CORRECT (90s/60s)' : 'INCORRECT'}`);

console.log(`\n${allPassed ? '✅ ALL FIXES VERIFIED SUCCESSFULLY!' : '❌ SOME FIXES FAILED VERIFICATION'}`);
console.log('\n💡 NOTE: This uses OPTIMIZED token calculation (~12% more efficient than PR#65)');
console.log('💡 NOTE: No repetition_penalty (correctly removed - not supported by Grok-4)');

console.log('\n' + '='.repeat(80) + '\n');

process.exit(allPassed ? 0 : 1);
