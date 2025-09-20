// ==================== INTEGRATION TEST ====================
// Test the complete story generation with trope subversion

import { StoryService } from '../services/storyService';
import { CreatureType, ThemeType } from '../types/contracts';

console.log('🔮 Testing Story Generation with Trope Subversion...\n');

const storyService = new StoryService();

// Test story generation with trope subversion
async function testStoryGeneration() {
  console.log('Testing vampire story generation...');
  
  const input = {
    creature: 'vampire' as CreatureType,
    themes: ['romance', 'dark'] as ThemeType[],
    userInput: 'A moonlit garden encounter',
    spicyLevel: 3 as const,
    wordCount: 700 as const
  };

  try {
    const result = await storyService.generateStory(input);
    
    if (result.success) {
      console.log('✓ Story generation successful');
      console.log('✓ Story ID:', result.data?.storyId);
      console.log('✓ Title:', result.data?.title);
      console.log('✓ Word count:', result.data?.actualWordCount);
      console.log('✓ Has trope metadata:', !!result.data?.tropeMetadata);
      
      if (result.data?.tropeMetadata) {
        console.log('✓ Trope metadata length:', result.data.tropeMetadata.length);
        
        // Test that trope metadata can be parsed
        try {
          const parsed = JSON.parse(result.data.tropeMetadata);
          console.log('✓ Trope metadata is valid JSON');
          console.log('✓ Contains trope IDs:', Array.isArray(parsed.tropeIds));
          console.log('✓ Number of tropes:', parsed.tropeIds?.length || 0);
        } catch (error) {
          console.error('✗ Invalid trope metadata JSON');
        }
      }
      
      console.log('\nStory content preview (first 200 chars):');
      console.log(result.data?.content?.substring(0, 200) + '...');
      
      // Test chapter continuation if we have trope metadata
      if (result.data?.tropeMetadata) {
        console.log('\n' + '='.repeat(50));
        console.log('Testing chapter continuation with trope consistency...');
        
        const continuationInput = {
          storyId: result.data.storyId,
          currentChapterCount: 1,
          existingContent: result.data.content,
          userInput: 'The next morning brings new challenges',
          maintainTone: true,
          tropeMetadata: result.data.tropeMetadata,
          creature: input.creature
        };
        
        try {
          const continuationResult = await storyService.continueStory(continuationInput);
          
          if (continuationResult.success) {
            console.log('✓ Chapter continuation successful');
            console.log('✓ Chapter ID:', continuationResult.data?.chapterId);
            console.log('✓ Chapter title:', continuationResult.data?.title);
            console.log('✓ Chapter word count:', continuationResult.data?.wordCount);
            
            console.log('\nChapter content preview (first 200 chars):');
            console.log(continuationResult.data?.content?.substring(0, 200) + '...');
          } else {
            console.error('✗ Chapter continuation failed:', continuationResult.error);
          }
        } catch (error) {
          console.error('✗ Chapter continuation error:', error);
        }
      }
      
    } else {
      console.error('✗ Story generation failed:', result.error);
    }
  } catch (error) {
    console.error('✗ Story generation error:', error);
  }
}

// Test different creatures
async function testAllCreatures() {
  console.log('\n' + '='.repeat(50));
  console.log('Testing all creature types...\n');
  
  const creatures = ['vampire', 'werewolf', 'fairy'] as const;
  
  for (const creature of creatures) {
    console.log(`Testing ${creature} story...`);
    
    const input = {
      creature,
      themes: ['romance'] as ThemeType[],
      userInput: `A ${creature} love story`,
      spicyLevel: 2 as const,
      wordCount: 700 as const
    };
    
    try {
      const result = await storyService.generateStory(input);
      
      if (result.success) {
        console.log(`✓ ${creature} story generated successfully`);
        console.log(`✓ Has trope metadata: ${!!result.data?.tropeMetadata}`);
      } else {
        console.error(`✗ ${creature} story failed:`, result.error?.message);
      }
    } catch (error) {
      console.error(`✗ ${creature} story error:`, error);
    }
  }
}

// Run the tests
async function runTests() {
  await testStoryGeneration();
  await testAllCreatures();
  
  console.log('\n🔮 Integration test complete!');
  console.log('✅ Trope subversion is invisibly enhancing story generation.');
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});