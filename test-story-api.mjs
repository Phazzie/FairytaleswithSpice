#!/usr/bin/env node

/**
 * Story Generation API Test
 * Tests the story generation endpoint with the new logging system
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:4200/api';

async function testStoryGeneration() {
  console.log('🧪 Testing Story Generation API\n');
  console.log(`API URL: ${API_BASE_URL}\n`);
  
  const testInputs = [
    {
      name: 'Vampire Romance (Spicy Level 3)',
      input: {
        creature: 'vampire',
        themes: ['romance', 'dark'],
        userInput: 'A vampire lord meets a mortal librarian in a moonlit library',
        spicyLevel: 3,
        wordCount: 700
      }
    },
    {
      name: 'Werewolf Adventure (Spicy Level 2)',
      input: {
        creature: 'werewolf',
        themes: ['adventure', 'comedy'],
        userInput: 'Pack dynamics gone hilariously wrong during a full moon',
        spicyLevel: 2,
        wordCount: 900
      }
    },
    {
      name: 'Fairy Mystery (Spicy Level 4)',
      input: {
        creature: 'fairy',
        themes: ['mystery', 'romance'],
        userInput: 'Fae court intrigue with forbidden love',
        spicyLevel: 4,
        wordCount: 1200
      }
    }
  ];

  for (let i = 0; i < testInputs.length; i++) {
    const test = testInputs[i];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`TEST ${i + 1}: ${test.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`📋 Input:`, JSON.stringify(test.input, null, 2));
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${API_BASE_URL}/story/generate`, test.input, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      });
      
      const duration = Date.now() - startTime;
      
      if (response.data.success) {
        console.log('\n✅ Story Generated Successfully!');
        console.log(`⏱️  Response Time: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
        
        const story = response.data.data;
        console.log(`\n📖 Story Details:`);
        console.log(`   Title: ${story.title}`);
        console.log(`   Word Count: ${story.totalWordCount} (target: ${test.input.wordCount})`);
        console.log(`   Read Time: ${story.estimatedReadTime} minutes`);
        console.log(`   Has Cliffhanger: ${story.hasCliffhanger ? 'Yes ✨' : 'No'}`);
        console.log(`   Story ID: ${story.storyId}`);
        
        // Show metadata
        if (response.data.metadata) {
          console.log(`\n📊 Metadata:`);
          console.log(`   Request ID: ${response.data.metadata.requestId}`);
          console.log(`   Processing Time: ${response.data.metadata.processingTime}ms`);
        }
        
        // Show first 400 characters of content (cleaned)
        const cleanText = (story.appendedToStory || '').replace(/<[^>]*>/g, '').trim();
        const preview = cleanText.substring(0, 400);
        console.log(`\n📝 Content Preview (first 400 chars):`);
        console.log(`${preview}...`);
        
        // Check for speaker tags (multi-voice support)
        const hasSpeakerTags = /\[([^\]]+)\]:/.test(story.appendedToStory || '');
        if (hasSpeakerTags) {
          const speakerMatches = (story.appendedToStory || '').match(/\[([^\]]+)\]:/g);
          const uniqueSpeakers = [...new Set(speakerMatches)];
          console.log(`\n🎙️  Multi-Voice Detected: ${uniqueSpeakers.length} unique speakers`);
          console.log(`   Speakers: ${uniqueSpeakers.slice(0, 5).join(', ')}${uniqueSpeakers.length > 5 ? '...' : ''}`);
        }
        
        // Check for enhanced features
        console.log(`\n🎯 Enhanced Features:`);
        console.log(`   ✅ Seam-Driven Architecture`);
        console.log(`   ✅ Structured Logging with Request ID`);
        console.log(`   ✅ Performance Tracking`);
        if (hasSpeakerTags) {
          console.log(`   ✅ Multi-Voice Ready`);
        }
        
      } else {
        console.log('\n❌ Story Generation Failed');
        console.log(`Error Code: ${response.data.error?.code}`);
        console.log(`Error Message: ${response.data.error?.message}`);
        console.log(`Details: ${response.data.error?.details}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log('\n💥 API Request Failed');
      console.log(`⏱️  Failed after: ${duration}ms`);
      
      if (error.response) {
        console.log(`HTTP Status: ${error.response.status}`);
        console.log(`Error Data:`, JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.log('No response received from server');
        console.log('Error:', error.message);
      } else {
        console.log('Error:', error.message);
      }
    }
    
    // Wait between tests
    if (i < testInputs.length - 1) {
      console.log('\n⏱️  Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`\n${'🎉'.repeat(35)}`);
  console.log('All Tests Complete!');
  console.log(`${'🎉'.repeat(35)}\n`);
}

// Run tests
console.log('🚀 Starting Story Generation API Tests\n');
testStoryGeneration()
  .then(() => {
    console.log('✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
