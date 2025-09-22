import { AudioService } from './audioService';
import { AudioConversionSeam, CharacterVoiceType } from '../types/contracts';

describe('AudioService - Emotion Mapping Enhancement', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    // Clear environment variables for consistent testing
    delete process.env.ELEVENLABS_API_KEY;
  });

  describe('Emotion System', () => {
    describe('testEmotionCombination', () => {
      it('should recognize supported emotions', () => {
        const result = audioService.testEmotionCombination('seductive');
        
        expect(result.isSupported).toBe(true);
        expect(result.emotion).toBe('seductive');
        expect(result.parameters).toBeDefined();
        expect(result.parameters.stability).toBe(0.8);
        expect(result.parameters.similarity_boost).toBe(0.9);
        expect(result.parameters.style).toBe(0.8);
        expect(result.parameters.pitch_shift).toBe(-0.1);
      });

      it('should handle unsupported emotions with suggestions', () => {
        const result = audioService.testEmotionCombination('flirtatious');
        
        expect(result.isSupported).toBe(false);
        expect(result.emotion).toBe('flirtatious');
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions!.length).toBeGreaterThan(0);
      });

      it('should provide fuzzy matching suggestions', () => {
        const result = audioService.testEmotionCombination('angrr'); // typo in "angry"
        
        expect(result.isSupported).toBe(false);
        expect(result.suggestions).toContain('angry');
      });

      it('should handle case insensitive emotions', () => {
        const result = audioService.testEmotionCombination('PASSIONATE');
        
        expect(result.isSupported).toBe(true);
        expect(result.emotion).toBe('passionate');
      });

      it('should trim whitespace from emotions', () => {
        const result = audioService.testEmotionCombination('  sultry  ');
        
        expect(result.isSupported).toBe(true);
        expect(result.emotion).toBe('sultry');
      });
    });

    describe('getEmotionInfo', () => {
      it('should return comprehensive emotion information', () => {
        const info = audioService.getEmotionInfo();
        
        expect(info.totalEmotions).toBeGreaterThan(70); // Should have 90+ emotions
        expect(info.categories).toBeDefined();
        expect(info.categories['Primary Emotions']).toContain('angry');
        expect(info.categories['Spicy Fairy Tale']).toContain('seductive');
        expect(info.categories['Vampire Specific']).toContain('bloodthirsty');
        expect(info.categories['Werewolf Specific']).toContain('feral');
        expect(info.categories['Fairy Specific']).toContain('ethereal');
        expect(info.recentlyUsed).toBeDefined();
        expect(Array.isArray(info.recentlyUsed)).toBe(true);
      });

      it('should have all required emotion categories', () => {
        const info = audioService.getEmotionInfo();
        const requiredCategories = [
          'Primary Emotions',
          'Spicy Fairy Tale',
          'Vampire Specific',
          'Werewolf Specific',
          'Fairy Specific',
          'Advanced States',
          'Intensity Variations',
          'Relationship Dynamics',
          'Narrative Specific'
        ];

        requiredCategories.forEach(category => {
          expect(info.categories[category]).toBeDefined();
          expect(info.categories[category].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Multi-Voice with Emotions', () => {
    const emotionalStoryContent = `
      [Narrator]: In the moonlit forest, two figures approached each other.
      [Vampire Lord, seductive]: "Come closer, my dear. I won't bite... much."
      [Fairy Princess, defiant]: "Stay back, bloodsucker! I'm not afraid of you."
      [Vampire Lord, amused]: "Such fire! I do so enjoy a challenge."
      [Fairy Princess, worried]: "My magic is weakening... I need to get away."
      [Narrator, dramatic]: The vampire's eyes glowed crimson in the darkness.
    `;

    it('should parse speaker tags with emotions correctly', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'emotion_test_001',
        content: emotionalStoryContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.audioUrl).toBeDefined();
      // In mock mode, should still generate audio successfully
    });

    it('should handle multiple emotions for same character', async () => {
      const multiEmotionContent = `
        [Alice, happy]: "This is wonderful!"
        [Alice, sad]: "Oh no, I'm so disappointed."
        [Alice, angry]: "How dare you!"
        [Alice, seductive]: "Come here, darling."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'multi_emotion_test',
        content: multiEmotionContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Character consistency should be maintained across emotions
    });

    it('should fallback gracefully for unrecognized emotions', async () => {
      const unknownEmotionContent = `
        [Character, nonexistent_emotion]: "This should still work."
        [Character]: "This is normal dialogue."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'fallback_test',
        content: unknownEmotionContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Should not fail even with unrecognized emotions
    });

    it('should handle creature-specific emotions', async () => {
      const creatureEmotionContent = `
        [Vampire Count, bloodthirsty]: "I hunger for your essence."
        [Werewolf Alpha, feral]: "The beast within demands release!"
        [Fairy Queen, ethereal]: "Magic flows through all living things."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'creature_emotion_test',
        content: creatureEmotionContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeGreaterThan(0);
    });

    it('should handle intensity variations', async () => {
      const intensityContent = `
        [Character, whisper]: "Shh... can you hear that?"
        [Character, shout]: "LOOK OUT BEHIND YOU!"
        [Character, growl]: "I'll make you pay for this."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'intensity_test',
        content: intensityContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
    });

    it('should maintain speaker consistency without emotion tags', async () => {
      const mixedContent = `
        [Alice, happy]: "I'm so excited!"
        [Alice]: "This is regular dialogue."
        [Bob, angry]: "I'm furious!"
        [Bob]: "Now I'm speaking normally."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'consistency_test',
        content: mixedContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Should use character consistency for non-emotion tagged dialogue
    });
  });

  describe('Voice Parameter Calculation', () => {
    it('should blend emotion parameters correctly', () => {
      // This tests the internal parameter blending logic
      // We can't directly test private methods, but we can test the public API results
      const seductiveTest = audioService.testEmotionCombination('seductive');
      const angryTest = audioService.testEmotionCombination('angry');

      expect(seductiveTest.parameters.stability).toBe(0.8);
      expect(angryTest.parameters.stability).toBe(0.3);
      
      // Seductive should be more stable than angry
      expect(seductiveTest.parameters.stability).toBeGreaterThan(angryTest.parameters.stability);
    });

    it('should have different parameters for contrasting emotions', () => {
      const whisperTest = audioService.testEmotionCombination('whisper');
      const shoutTest = audioService.testEmotionCombination('shout');

      // Whisper should be more stable than shout
      expect(whisperTest.parameters.stability).toBeGreaterThan(shoutTest.parameters.stability);
      
      // Shout should have higher style intensity
      expect(shoutTest.parameters.style).toBeGreaterThan(whisperTest.parameters.style);
    });

    it('should have appropriate parameters for creature emotions', () => {
      const etherealTest = audioService.testEmotionCombination('ethereal');
      const feralTest = audioService.testEmotionCombination('feral');

      // Ethereal (fairy) should be more stable than feral (werewolf)
      expect(etherealTest.parameters.stability).toBeGreaterThan(feralTest.parameters.stability);
      
      // Feral should have higher pitch shift
      expect(feralTest.parameters.pitch_shift).toBeGreaterThan(etherealTest.parameters.pitch_shift);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty emotion strings', () => {
      const result = audioService.testEmotionCombination('');
      
      expect(result.isSupported).toBe(false);
      expect(result.suggestions).toBeDefined();
    });

    it('should handle special characters in emotions', () => {
      const result = audioService.testEmotionCombination('angry!!!');
      
      expect(result.isSupported).toBe(false);
      expect(result.suggestions).toContain('angry');
    });

    it('should handle malformed speaker tags gracefully', async () => {
      const malformedContent = `
        []: "No speaker name"
        [Character,]: "Empty emotion"
        [Character, , ]: "Multiple commas"
        [Normal Character]: "This should work"
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'malformed_test',
        content: malformedContent
      };

      const result = await audioService.convertToAudio(input);

      // Should not fail completely due to malformed tags
      expect(result.success).toBe(true);
    });

    it('should handle very long emotion strings', () => {
      const longEmotion = 'a'.repeat(100);
      const result = audioService.testEmotionCombination(longEmotion);
      
      expect(result.isSupported).toBe(false);
      expect(result.suggestions).toBeDefined();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large number of emotions efficiently', () => {
      const startTime = Date.now();
      
      // Test 100 emotion lookups
      for (let i = 0; i < 100; i++) {
        audioService.testEmotionCombination('seductive');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should limit character memory to prevent memory leaks', async () => {
      // Generate many different characters to test memory management
      let largeContent = '';
      for (let i = 0; i < 50; i++) {
        largeContent += `[Character${i}, happy]: "Hello from character ${i}!"\n`;
      }

      const input: AudioConversionSeam['input'] = {
        storyId: 'memory_test',
        content: largeContent
      };

      const result = await audioService.convertToAudio(input);
      
      expect(result.success).toBe(true);
      // Memory management should prevent excessive memory usage
    });
  });
});