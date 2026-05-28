#!/usr/bin/env tsx
/**
 * Quick API Key Verification Test
 * Tests the XAI API key used by active story generation.
 */

import { XaiTextClient } from '../api/_lib/services/xaiTextClient';
import { getXaiReasoningEffort, getXaiStoryModel } from '../api/_lib/config/xaiConfig';

async function testXAI() {
  console.log('\n🧪 Testing XAI (Grok) API Key...');
  console.log('='.repeat(60));
  
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ XAI_API_KEY not found in environment');
    return false;
  }
  
  console.log(`✓ API Key found: ${apiKey.substring(0, 15)}...`);
  
  try {
    const client = new XaiTextClient();
    const response = await client.generateText({
      operation: 'smoke',
      system: 'Return exactly one word.',
      user: 'Say Hello in exactly one word.',
      maxOutputTokens: 20,
      temperature: 0.1,
      topP: 0.9,
      timeoutMs: 30000
    });
    
    console.log('✅ XAI API Key is VALID');
    console.log(`   Configured model: ${getXaiStoryModel()}`);
    console.log(`   Reasoning effort: ${getXaiReasoningEffort()}`);
    console.log(`   Output characters: ${response.text.length}`);
    return true;
    
  } catch (error: any) {
    console.log('❌ XAI API Key test FAILED');
    console.log(`   Error: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔑 API KEY VERIFICATION TEST');
  console.log('='.repeat(60));
  
  const xaiResult = await testXAI();
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`XAI (Grok):      ${xaiResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log('='.repeat(60) + '\n');
  
  process.exit(xaiResult ? 0 : 1);
}

main();
