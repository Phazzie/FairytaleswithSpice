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
 * 4. Vercel-bounded provider timeouts with fast Grok fallback
 */

import { StoryService } from '../api/_lib/services/storyService';
import {
  DEFAULT_XAI_FAST_MODEL,
  DEFAULT_XAI_FAST_TIMEOUT_MS,
  DEFAULT_XAI_PRIMARY_TIMEOUT_MS,
  DEFAULT_XAI_STORY_MODEL
} from '../api/_lib/config/xaiConfig';

console.log('\n' + '='.repeat(80));
console.log('🔧 AI GENERATION FIXES VERIFICATION (OPTIMIZED VERSION)');
console.log('='.repeat(80));

// ==================== TEST 1: Token Calculation ====================

console.log('\n📐 TEST 1: Optimized Token Calculation Method');
console.log('-'.repeat(80));

const apiService = new StoryService();

// Our OPTIMIZED formula: 1.5 * 1.15 * 1.1 * 1.05 = 1.99x multiplier
const testCases = [
  { words: 700, expected: Math.ceil(700 * 1.5 * 1.15 * 1.1 * 1.05) },   // 1395
  { words: 900, expected: Math.ceil(900 * 1.5 * 1.15 * 1.1 * 1.05) },   // 1793
  { words: 1200, expected: Math.ceil(1200 * 1.5 * 1.15 * 1.1 * 1.05) }  // 2390
];

let tokenTestsPassed = 0;
for (const testCase of testCases) {
  const apiTokens = (apiService as any).calculateOptimalTokens(testCase.words);
  
  const apiPass = apiTokens === testCase.expected;
  
  // Compare to PR#65's conservative formula
  const pr65Calculation = Math.ceil(testCase.words * 1.5 * 1.2 * 1.15 * 1.1);
  const savings = pr65Calculation - testCase.expected;
  const savingsPercent = (savings / pr65Calculation * 100).toFixed(1);
  
  console.log(`\n${testCase.words} words:`);
  console.log(`  api/_lib:          ${apiTokens} tokens ${apiPass ? '✅' : '❌'}`);
  console.log(`  Expected:          ${testCase.expected} tokens`);
  console.log(`  PR#65 would use:   ${pr65Calculation} tokens`);
  console.log(`  Our savings:       ${savings} tokens (${savingsPercent}% more efficient)`);
  
  if (apiPass) {
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
const apiServicePath = join(rootDir, 'api/_lib/services/storyService.ts');
const configPath = join(rootDir, 'api/_lib/config/xaiConfig.ts');
const xaiClientPath = join(rootDir, 'api/_lib/services/xaiTextClient.ts');

const apiContent = readFileSync(apiServicePath, 'utf-8');
const configContent = readFileSync(configPath, 'utf-8');
const xaiClientContent = readFileSync(xaiClientPath, 'utf-8');

// Check for the correct model name
const correctModel = DEFAULT_XAI_STORY_MODEL;
const incorrectModel = 'grok-beta';
const previousModel = 'grok-4-1-fast-reasoning';

const configHasCorrectModel = configContent.includes(`DEFAULT_XAI_STORY_MODEL = '${correctModel}'`);
const apiHasIncorrectModel = apiContent.includes(`model: '${incorrectModel}'`);
const apiHasPreviousModel = apiContent.includes(previousModel);

console.log(`\napi/_lib/config/xaiConfig.ts and api/_lib/services/storyService.ts:`);
console.log(`  Central default model '${correctModel}': ${configHasCorrectModel ? '✅' : '❌'}`);
console.log(`  StoryService still embeds '${previousModel}': ${apiHasPreviousModel ? '❌ (should not)' : '✅'}`);
console.log(`  Uses '${incorrectModel}':        ${apiHasIncorrectModel ? '❌ (should not)' : '✅'}`);

const modelTestPassed = configHasCorrectModel && !apiHasIncorrectModel && !apiHasPreviousModel;

console.log(`\n${modelTestPassed ? '✅' : '❌'} Model name verification: ${modelTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== TEST 3: API Parameters ====================

console.log('\n\n⚙️  TEST 3: Verifying API Parameters (Grok-Compatible)');
console.log('-'.repeat(80));

const apiHasTopP = apiContent.includes('topP: 0.95');

// CRITICAL: Should NOT have repetition_penalty (Grok doesn't support it)
const apiHasRepetitionPenalty = apiContent.includes('repetition_penalty');

console.log(`\napi/_lib/services/storyService.ts:`);
console.log(`  Has top_p parameter:              ${apiHasTopP ? '✅' : '❌'}`);
console.log(`  Has repetition_penalty parameter: ${apiHasRepetitionPenalty ? '❌ (should NOT - unsupported)' : '✅'}`);

const paramsTestPassed = apiHasTopP && !apiHasRepetitionPenalty;

console.log(`\n${paramsTestPassed ? '✅' : '❌'} API parameters verification: ${paramsTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== TEST 4: Timeouts ====================

console.log('\n\n⏱️  TEST 4: Verifying Vercel-Bounded Timeouts');
console.log('-'.repeat(80));

const configHasPrimaryTimeout = configContent.includes(`DEFAULT_XAI_PRIMARY_TIMEOUT_MS = ${DEFAULT_XAI_PRIMARY_TIMEOUT_MS}`);
const configHasFastTimeout = configContent.includes(`DEFAULT_XAI_FAST_TIMEOUT_MS = ${DEFAULT_XAI_FAST_TIMEOUT_MS}`);
const configHasFastModel = configContent.includes(`DEFAULT_XAI_FAST_MODEL = '${DEFAULT_XAI_FAST_MODEL}'`);
const apiUsesPrimaryTimeoutHelper = apiContent.includes('timeoutMs: getXaiPrimaryTimeoutMs()');
const apiUsesFastFallbackTimeoutHelper = apiContent.includes('fallbackTimeoutMs: getXaiFastTimeoutMs()');
const apiBudgetsExtraGenesisChapters = apiContent.includes('preferFastModel: chapterNumber > 1');
const apiBudgetsExtraContinuationChapters = apiContent.includes('preferFastModel: offset > 1');
const xaiClientHasRetryableFallback = xaiClientContent.includes('isRetryableProviderError')
  && xaiClientContent.includes('fallbackFromModel');

console.log(`\napi/_lib/services/storyService.ts:`);
console.log(`  Uses primary timeout helper:        ${apiUsesPrimaryTimeoutHelper ? '✅' : '❌'}`);
console.log(`  Uses fast fallback timeout helper:  ${apiUsesFastFallbackTimeoutHelper ? '✅' : '❌'}`);
console.log(`  Fast path for extra genesis chapters:      ${apiBudgetsExtraGenesisChapters ? '✅' : '❌'}`);
console.log(`  Fast path for extra continuation chapters: ${apiBudgetsExtraContinuationChapters ? '✅' : '❌'}`);
console.log(`\napi/_lib/config/xaiConfig.ts:`);
console.log(`  Primary timeout ${DEFAULT_XAI_PRIMARY_TIMEOUT_MS}ms:      ${configHasPrimaryTimeout ? '✅' : '❌'}`);
console.log(`  Fast timeout ${DEFAULT_XAI_FAST_TIMEOUT_MS}ms:         ${configHasFastTimeout ? '✅' : '❌'}`);
console.log(`  Fast model '${DEFAULT_XAI_FAST_MODEL}':       ${configHasFastModel ? '✅' : '❌'}`);
console.log(`\napi/_lib/services/xaiTextClient.ts:`);
console.log(`  Has retryable fast fallback path:   ${xaiClientHasRetryableFallback ? '✅' : '❌'}`);

const timeoutTestPassed = configHasPrimaryTimeout
  && configHasFastTimeout
  && configHasFastModel
  && apiUsesPrimaryTimeoutHelper
  && apiUsesFastFallbackTimeoutHelper
  && apiBudgetsExtraGenesisChapters
  && apiBudgetsExtraContinuationChapters
  && xaiClientHasRetryableFallback;

console.log(`\n${timeoutTestPassed ? '✅' : '❌'} Timeout/fallback verification: ${timeoutTestPassed ? 'PASSED' : 'FAILED'}`);

// ==================== FINAL SUMMARY ====================

console.log('\n\n' + '='.repeat(80));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(80));

const allPassed = tokenTestsPassed === testCases.length && modelTestPassed && paramsTestPassed && timeoutTestPassed;

console.log(`\n✅ Token Calculation:    ${tokenTestsPassed}/${testCases.length} tests passed (OPTIMIZED formula)`);
console.log(`${modelTestPassed ? '✅' : '❌'} Model Names:          ${modelTestPassed ? 'CORRECT' : 'INCORRECT'}`);
console.log(`${paramsTestPassed ? '✅' : '❌'} API Parameters:       ${paramsTestPassed ? 'CORRECT (no repetition_penalty)' : 'INCORRECT'}`);
console.log(`${timeoutTestPassed ? '✅' : '❌'} Timeouts/Fallback:    ${timeoutTestPassed ? 'CORRECT (Vercel-bounded)' : 'INCORRECT'}`);

console.log(`\n${allPassed ? '✅ ALL FIXES VERIFIED SUCCESSFULLY!' : '❌ SOME FIXES FAILED VERIFICATION'}`);
console.log('\n💡 NOTE: This uses OPTIMIZED token calculation (~12% more efficient than PR#65)');
console.log('💡 NOTE: No repetition_penalty (correctly removed - not supported by Grok-4)');

console.log('\n' + '='.repeat(80) + '\n');

process.exit(allPassed ? 0 : 1);
