#!/usr/bin/env tsx
/**
 * Quick API Key Verification Test
 * Tests the XAI API key used by active story generation.
 */

import axios from 'axios';

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
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-4-1-fast-reasoning',
        messages: [
          { role: 'user', content: 'Say "Hello" in exactly one word.' }
        ],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ XAI API Key is VALID');
    console.log(`   Response: ${response.data.choices[0].message.content}`);
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
