#!/usr/bin/env tsx
/**
 * Quick API Key Verification Test
 * Tests both XAI and ElevenLabs API keys
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
        model: 'grok-4-fast-reasoning',
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

async function testElevenLabs() {
  console.log('\n🧪 Testing ElevenLabs API Key...');
  console.log('='.repeat(60));
  
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.log('❌ ELEVENLABS_API_KEY not found in environment');
    return false;
  }
  
  console.log(`✓ API Key found: ${apiKey.substring(0, 15)}...`);
  
  try {
    // First, try to get user info (simpler endpoint)
    const userResponse = await axios.get(
      'https://api.elevenlabs.io/v1/user',
      {
        headers: {
          'xi-api-key': apiKey
        },
        timeout: 10000
      }
    );
    
    console.log('✅ ElevenLabs API Key is VALID');
    console.log(`   Subscription: ${userResponse.data.subscription?.tier || 'Free'}`);
    console.log(`   Character Count: ${userResponse.data.subscription?.character_count || 0}`);
    console.log(`   Character Limit: ${userResponse.data.subscription?.character_limit || 'N/A'}`);
    
    // Now test actual TTS
    console.log('\n   Testing TTS generation...');
    const ttsResponse = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
      {
        text: 'Hello, this is a test.',
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );
    
    const audioSize = Buffer.from(ttsResponse.data).length;
    console.log(`   ✅ TTS Generated: ${(audioSize / 1024).toFixed(2)} KB`);
    
    return true;
    
  } catch (error: any) {
    console.log('❌ ElevenLabs API Key test FAILED');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔑 API KEY VERIFICATION TEST');
  console.log('='.repeat(60));
  
  const xaiResult = await testXAI();
  const elevenLabsResult = await testElevenLabs();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`XAI (Grok):      ${xaiResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`ElevenLabs:      ${elevenLabsResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log('='.repeat(60) + '\n');
  
  process.exit(xaiResult && elevenLabsResult ? 0 : 1);
}

main();
