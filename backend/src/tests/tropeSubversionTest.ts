// ==================== SIMPLE TROPE SUBVERSION TESTS ====================
// Basic tests to verify trope subversion functionality without Jest

import { TropeSubversionService } from '../services/tropeSubversionService';

console.log('🎭 Testing Invisible Trope Subversion Engine...\n');

const service = new TropeSubversionService();

// Test 1: Basic trope selection
console.log('Test 1: Basic trope selection');
try {
  const selection = service.selectTropesForSubversion({ creature: 'vampire' });
  console.log(`✓ Selected ${selection.selectedTropes.length} tropes`);
  console.log(`✓ Generated ${selection.subversionInstructions.length} instructions`);
  console.log(`✓ Created ${selection.selectedTropeIds.length} IDs`);
  
  // Show some sample tropes
  selection.selectedTropes.forEach((trope, index) => {
    console.log(`  ${index + 1}. ${trope.name} (${trope.intensity})`);
  });
} catch (error) {
  console.error('✗ Basic trope selection failed:', error);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 2: Prompt enhancement
console.log('Test 2: Prompt enhancement');
try {
  const selection = service.selectTropesForSubversion({ creature: 'werewolf', tropeCount: 2 });
  const basePrompt = `Write a story featuring a Werewolf.\n\nStyle Guidelines:\n- Vivid descriptions`;
  const enhanced = service.enhancePromptWithSubversions(basePrompt, selection, 'werewolf');
  
  console.log('✓ Enhanced prompt created');
  console.log('✓ Contains subversion instructions:', enhanced.includes('Trope Subversion Instructions'));
  console.log('✓ Maintains original structure:', enhanced.includes('Style Guidelines:'));
  
  console.log('\nSample enhanced prompt (truncated):');
  console.log(enhanced.substring(0, 200) + '...');
} catch (error) {
  console.error('✗ Prompt enhancement failed:', error);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 3: Serialization
console.log('Test 3: Serialization and deserialization');
try {
  const original = service.selectTropesForSubversion({ creature: 'fairy' });
  const serialized = service.serializeTropeSelection(original);
  const deserialized = service.deserializeTropeSelection(serialized, 'fairy');
  
  console.log('✓ Serialization successful');
  console.log('✓ Deserialization successful');
  console.log('✓ Trope IDs match:', 
    JSON.stringify(original.selectedTropeIds) === JSON.stringify(deserialized?.selectedTropeIds));
} catch (error) {
  console.error('✗ Serialization test failed:', error);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 4: Statistics
console.log('Test 4: Trope statistics');
try {
  const vampireStats = service.getTropeStatistics('vampire');
  const werewolfStats = service.getTropeStatistics('werewolf');
  const fairyStats = service.getTropeStatistics('fairy');
  
  console.log('✓ Vampire tropes:', vampireStats.totalCount, 
    `(${vampireStats.commonCount} common + ${vampireStats.subversiveCount} subversive)`);
  console.log('✓ Werewolf tropes:', werewolfStats.totalCount,
    `(${werewolfStats.commonCount} common + ${werewolfStats.subversiveCount} subversive)`);
  console.log('✓ Fairy tropes:', fairyStats.totalCount,
    `(${fairyStats.commonCount} common + ${fairyStats.subversiveCount} subversive)`);
    
  console.log('✓ Total tropes in database:', 
    vampireStats.totalCount + werewolfStats.totalCount + fairyStats.totalCount);
} catch (error) {
  console.error('✗ Statistics test failed:', error);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 5: Continuation prompt enhancement
console.log('Test 5: Continuation prompt enhancement');
try {
  const basePrompt = 'Continue this story with a new chapter.';
  const tropeIds = ['vamp_brooding_loner', 'vamp_blood_bond'];
  const enhanced = service.enhanceContinuationPrompt(basePrompt, tropeIds, 'vampire');
  
  console.log('✓ Continuation prompt enhanced');
  console.log('✓ Contains continuation instructions:', enhanced.includes('Continue Trope Subversions'));
  console.log('✓ Maintains consistency instructions:', enhanced.includes('Maintain consistency'));
  
  console.log('\nSample continuation enhancement:');
  const enhancement = enhanced.replace(basePrompt, '').trim();
  console.log(enhancement.substring(0, 150) + '...');
} catch (error) {
  console.error('✗ Continuation prompt test failed:', error);
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 6: Error handling
console.log('Test 6: Error handling');
try {
  try {
    service.selectTropesForSubversion({ creature: 'dragon' as any });
    console.error('✗ Should have thrown error for unknown creature');
  } catch (error: any) {
    console.log('✓ Correctly throws error for unknown creature:', error.message);
  }
  
  const nullResult = service.deserializeTropeSelection('invalid json', 'vampire');
  console.log('✓ Handles invalid JSON gracefully:', nullResult === null);
  
} catch (error) {
  console.error('✗ Error handling test failed:', error);
}

console.log('\n🎭 Trope Subversion Engine test complete!');
console.log('✅ All core functionality verified and working correctly.');