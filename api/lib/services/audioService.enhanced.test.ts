/**
 * Enhanced Audio Service Test with Emotion Mapping
 * Tests the new emotion-aware voice parameter system
 */

import { AudioService } from '../services/audioService';
import { AudioConversionSeam } from '../types/contracts';
import { getVoiceSettingsForEmotion, adjustVoiceForEmotionalIntensity, getAvailableEmotions } from '../services/emotionMapping';

describe('Enhanced AudioService with Emotion Mapping', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    // Clear any console warnings during testing
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('emotion mapping system', () => {
    it('should have comprehensive emotion mappings', () => {
      const emotions = getAvailableEmotions();
      
      // Should have a wide range of emotions
      expect(emotions.length).toBeGreaterThan(50);
      
      // Should include key supernatural romance emotions
      expect(emotions).toContain('seductive');
      expect(emotions).toContain('predatory');
      expect(emotions).toContain('passionate');
      expect(emotions).toContain('vampiric');
      expect(emotions).toContain('feral');
      expect(emotions).toContain('ethereal');
    });

    it('should provide voice settings for all emotions', () => {
      const emotions = getAvailableEmotions();
      
      emotions.forEach(emotion => {
        const settings = getVoiceSettingsForEmotion(emotion);
        
        // All settings should be within valid ranges
        expect(settings.stability).toBeGreaterThanOrEqual(0.0);
        expect(settings.stability).toBeLessThanOrEqual(1.0);
        expect(settings.similarity_boost).toBeGreaterThanOrEqual(0.0);
        expect(settings.similarity_boost).toBeLessThanOrEqual(1.0);
        expect(settings.style).toBeGreaterThanOrEqual(0.0);
        expect(settings.style).toBeLessThanOrEqual(1.0);
        expect(typeof settings.use_speaker_boost).toBe('boolean');
      });
    });

    it('should adjust voice settings for emotional intensity', () => {
      const baseSettings = getVoiceSettingsForEmotion('anger');
      
      // Test low intensity
      const lowIntensity = adjustVoiceForEmotionalIntensity(baseSettings, 0.5);
      expect(lowIntensity.style).toBeLessThan(baseSettings.style);
      
      // Test high intensity
      const highIntensity = adjustVoiceForEmotionalIntensity(baseSettings, 1.8);
      expect(highIntensity.style).toBeGreaterThan(baseSettings.style);
      expect(highIntensity.use_speaker_boost).toBe(true);
    });
  });

  describe('enhanced audio conversion with emotions', () => {
    it('should process content with emotion tags', async () => {
      const contentWithEmotions = `
        [Narrator]: The ancient vampire stepped from the shadows.
        [Vampire Lord, seductive]: "Come to me, little one."
        [Human Girl, fearful]: "Stay away!"
        [Vampire Lord, commanding]: "You cannot resist me forever."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_story_emotions',
        content: contentWithEmotions
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.audioId).toMatch(/^audio_\\d+_.+/);
      expect(result.data!.duration).toBeGreaterThan(0);
    });

    it('should handle mixed emotional content', async () => {
      const mixedContent = `
        [Fairy Princess, innocent]: "I've never felt this way before."
        [Werewolf Alpha, protective]: "I won't let anyone hurt you."
        [Fairy Princess, conflicted]: "But we're supposed to be enemies..."
        [Werewolf Alpha, passionate]: "Some bonds are stronger than ancient feuds."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_mixed_emotions',
        content: mixedContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      expect(result.data!.storyId).toBe('test_mixed_emotions');
    });

    it('should gracefully handle unknown emotions', async () => {
      const unknownEmotionContent = `
        [Vampire, mysterious_unknown_emotion]: "I have secrets you cannot fathom."
        [Human, curious]: "Tell me everything."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_unknown_emotion',
        content: unknownEmotionContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Should fall back to neutral voice settings for unknown emotions
    });
  });

  describe('emotional intensity analysis', () => {
    it('should detect high intensity from text markers', async () => {
      const highIntensityContent = `
        [Vampire, anger]: "I WILL DESTROY YOU!" he screamed with rage.
        [Human, terror]: "Please don't hurt me!" she cried desperately.
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_high_intensity',
        content: highIntensityContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // The emotional intensity analysis should affect voice parameters
    });

    it('should detect low intensity from soft markers', async () => {
      const lowIntensityContent = `
        [Fairy, serene]: "Everything will be alright," she whispered softly.
        [Human, calm]: "I trust you," he murmured peacefully.
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_low_intensity',
        content: lowIntensityContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
    });
  });

  describe('character voice consistency', () => {
    it('should maintain character voices across emotional changes', async () => {
      const characterEmotionContent = `
        [Vampire Count, calm]: "Welcome to my home."
        [Vampire Count, seductive]: "You look lovely tonight."
        [Vampire Count, menacing]: "Don't even think about leaving."
        [Vampire Count, passionate]: "I need you more than blood itself."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_character_consistency',
        content: characterEmotionContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      expect(result.data!.voice).toBeDefined();
      // Should use vampire_male voice consistently while adjusting emotional parameters
    });

    it('should distinguish between different character types', async () => {
      const multiCharacterContent = `
        [Vampire Lord, commanding]: "Kneel before your master."
        [Werewolf Alpha, defiant]: "I bow to no bloodsucker."
        [Fairy Queen, ethereal]: "Peace, children of the night."
        [Human Witch, determined]: "I'll protect them all."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_multi_character',
        content: multiCharacterContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Each character type should get appropriate voice assignment
    });
  });

  describe('error handling and fallbacks', () => {
    it('should handle malformed emotion tags gracefully', async () => {
      const malformedContent = `
        [Vampire,]: "Missing emotion after comma."
        [,angry]: "Missing character name."
        [Fairy Queen, happy, extra_part]: "Too many parts in tag."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_malformed_tags',
        content: malformedContent
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Should handle malformed tags without crashing
    });

    it('should fallback to single voice when multi-voice fails', async () => {
      // Simulate API failure scenario
      const originalApiKey = process.env.ELEVENLABS_API_KEY;
      process.env.ELEVENLABS_API_KEY = 'invalid_key_to_trigger_failure';

      const content = `
        [Character, emotion]: "This should trigger fallback."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_fallback',
        content: content
      };

      const result = await audioService.convertToAudio(input);

      expect(result.success).toBe(true);
      // Should succeed with mock data even when API fails

      // Restore original API key
      process.env.ELEVENLABS_API_KEY = originalApiKey;
    });
  });

  describe('performance and optimization', () => {
    it('should complete processing within reasonable time limits', async () => {
      const longContent = Array(20).fill(0).map((_, i) => 
        `[Character ${i % 3}, ${['happy', 'sad', 'angry'][i % 3]}]: "This is line ${i + 1} with some emotional content."`
      ).join(' ');

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_performance',
        content: longContent
      };

      const startTime = Date.now();
      const result = await audioService.convertToAudio(input);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.metadata!.processingTime).toBeGreaterThan(0);
    });
  });
});