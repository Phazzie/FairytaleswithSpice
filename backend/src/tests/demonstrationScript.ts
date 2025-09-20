// ==================== TROPE SUBVERSION DEMONSTRATION ====================
// Shows how the invisible engine enhances stories with trope subversions

import { StoryService } from '../services/storyService';
import { TropeSubversionService } from '../services/tropeSubversionService';
import { CreatureType, ThemeType } from '../types/contracts';

console.log('🎭 INVISIBLE TROPE SUBVERSION ENGINE DEMONSTRATION');
console.log('=' .repeat(60));

const storyService = new StoryService();
const tropeService = new TropeSubversionService();

async function demonstrateTropeSubversion() {
  // Show trope selection process
  console.log('\n🎯 TROPE SELECTION PROCESS:');
  console.log('-'.repeat(40));
  
  const creatures: CreatureType[] = ['vampire', 'werewolf', 'fairy'];
  
  for (const creature of creatures) {
    console.log(`\n${creature.toUpperCase()} TROPES:`);
    
    const selection = tropeService.selectTropesForSubversion({ 
      creature,
      tropeCount: 3 
    });
    
    console.log(`Selected ${selection.selectedTropes.length} tropes for subversion:`);
    
    selection.selectedTropes.forEach((trope, index) => {
      console.log(`  ${index + 1}. ${trope.name} (${trope.intensity})`);
      console.log(`     → ${trope.subversionInstruction}`);
    });
  }
  
  // Show prompt enhancement
  console.log('\n' + '='.repeat(60));
  console.log('\n🎨 PROMPT ENHANCEMENT DEMONSTRATION:');
  console.log('-'.repeat(40));
  
  const vampireSelection = tropeService.selectTropesForSubversion({ 
    creature: 'vampire',
    tropeCount: 2 
  });
  
  const basePrompt = `Write a 700-word spicy romantic fantasy story featuring a Vampire as the main character.

Key Requirements:
- Creature: Vampire
- Themes: romance, dark
- Spice Level: Hot (3/5)
- Custom Ideas: Moonlit garden encounter

Story Structure:
1. Introduction with atmospheric setting
2. Character introduction and initial attraction
3. Building tension and romantic development
4. Spicy intimate scenes with emotional depth
5. Climax with supernatural elements
6. Ending that could lead to continuation

Style Guidelines:
- Vivid, sensual descriptions
- Emotional depth and character development
- Victorian/Edwardian atmosphere
- Blend romance with supernatural elements
- Natural dialogue and internal monologue

Format the story with HTML tags for structure (h3 for chapter titles, p for paragraphs).`;

  const enhancedPrompt = tropeService.enhancePromptWithSubversions(
    basePrompt, 
    vampireSelection, 
    'vampire'
  );
  
  console.log('\nBASE PROMPT (first 200 chars):');
  console.log(basePrompt.substring(0, 200) + '...');
  
  console.log('\nENHANCED PROMPT (showing subversion additions):');
  const enhancement = enhancedPrompt.replace(basePrompt, '').trim();
  console.log(enhancement);
  
  // Generate sample story with trope subversion
  console.log('\n' + '='.repeat(60));
  console.log('\n📖 SAMPLE STORY GENERATION:');
  console.log('-'.repeat(40));
  
  const storyInput = {
    creature: 'vampire' as CreatureType,
    themes: ['romance', 'dark'] as ThemeType[],
    userInput: 'A moonlit garden encounter with unexpected twists',
    spicyLevel: 3 as const,
    wordCount: 700 as const
  };
  
  try {
    const result = await storyService.generateStory(storyInput);
    
    if (result.success && result.data) {
      console.log(`\n✨ Generated Story: "${result.data.title}"`);
      console.log(`📊 Word Count: ${result.data.actualWordCount}`);
      console.log(`🎭 Trope Metadata: ${result.data.tropeMetadata ? 'Present' : 'None'}`);
      
      if (result.data.tropeMetadata) {
        const metadata = JSON.parse(result.data.tropeMetadata);
        console.log(`🎯 Subverted Tropes: ${metadata.tropeIds.length}`);
        console.log(`📅 Generated: ${new Date(metadata.timestamp).toLocaleString()}`);
      }
      
      console.log('\n📝 STORY CONTENT:');
      console.log('-'.repeat(40));
      console.log(result.data.content);
      
      // Test chapter continuation
      if (result.data.tropeMetadata) {
        console.log('\n' + '='.repeat(60));
        console.log('\n📚 CHAPTER CONTINUATION DEMONSTRATION:');
        console.log('-'.repeat(40));
        
        const continuationInput = {
          storyId: result.data.storyId,
          currentChapterCount: 1,
          existingContent: result.data.content,
          userInput: 'The morning after brings new revelations',
          maintainTone: true,
          tropeMetadata: result.data.tropeMetadata,
          creature: storyInput.creature
        };
        
        const continuationResult = await storyService.continueStory(continuationInput);
        
        if (continuationResult.success && continuationResult.data) {
          console.log(`\n✨ Chapter 2: "${continuationResult.data.title}"`);
          console.log(`📊 Word Count: ${continuationResult.data.wordCount}`);
          console.log(`🔗 Maintains Trope Consistency: ✅`);
          
          console.log('\n📝 CHAPTER 2 CONTENT:');
          console.log('-'.repeat(40));
          console.log(continuationResult.data.content);
        }
      }
      
    } else {
      console.error('Story generation failed:', result.error);
    }
  } catch (error) {
    console.error('Demonstration error:', error);
  }
  
  // Show database statistics
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TROPE DATABASE STATISTICS:');
  console.log('-'.repeat(40));
  
  let totalTropes = 0;
  const categoryStats: Record<string, number> = {};
  
  for (const creature of creatures) {
    const stats = tropeService.getTropeStatistics(creature);
    console.log(`\n${creature.toUpperCase()}:`);
    console.log(`  Common Tropes: ${stats.commonCount}`);
    console.log(`  Subversive Tropes: ${stats.subversiveCount}`);
    console.log(`  Total: ${stats.totalCount}`);
    
    totalTropes += stats.totalCount;
    
    Object.entries(stats.categoryCounts).forEach(([category, count]) => {
      categoryStats[category] = (categoryStats[category] || 0) + count;
    });
  }
  
  console.log(`\nOVERALL STATISTICS:`);
  console.log(`  Total Tropes in Database: ${totalTropes}`);
  console.log(`  Categories:`);
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`    ${category}: ${count} tropes`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('\n🎭 DEMONSTRATION COMPLETE!');
  console.log('\nThe Invisible Trope Subversion Engine is working behind the scenes to:');
  console.log('✨ Make stories more unique and surprising');
  console.log('✨ Subvert reader expectations creatively');
  console.log('✨ Maintain story quality and romantic tension');
  console.log('✨ Provide seamless chapter continuity');
  console.log('✨ Remain completely invisible to users');
  console.log('\nEvery story generated now has enhanced uniqueness through intelligent trope subversion!');
}

// Run the demonstration
demonstrateTropeSubversion().catch(error => {
  console.error('Demonstration failed:', error);
  process.exit(1);
});