import { AudioService } from '../services/audioService';
import { AudioConversionSeam, VoiceType, AudioSpeed, AudioFormat } from '../types/contracts';
import axios from 'axios';

// Mock axios to control API responses
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AudioService', () => {
  let audioService: AudioService;

  // Common test input used across all test cases
  const validInput: AudioConversionSeam['input'] = {
    storyId: 'story_123',
    content: '<h3>Chapter 1</h3><p>This is a test story content with <em>emphasis</em> and other HTML tags.</p>',
    voice: 'female',
    speed: 1.0,
    format: 'mp3'
  };

  beforeEach(() => {
    audioService = new AudioService();
    jest.clearAllMocks();
    // Clear environment variables for consistent testing
    delete process.env.ELEVENLABS_API_KEY;
  });

  describe('convertToAudio', () => {

    it('should convert audio with valid input (mock mode)', async () => {
      const result = await audioService.convertToAudio(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.audioId).toMatch(/^audio_\d+_.+/);
      expect(result.data!.storyId).toBe('story_123');
      expect(result.data!.audioUrl).toContain('mock-audio-storage.com');
      expect(result.data!.duration).toBeGreaterThan(0);
      expect(result.data!.fileSize).toBeGreaterThan(0);
      expect(result.data!.format).toBe('mp3');
      expect(result.data!.voice).toBe('female');
      expect(result.data!.speed).toBe(1.0);
      expect(result.data!.progress.percentage).toBe(100);
      expect(result.data!.progress.status).toBe('completed');
      expect(result.data!.completedAt).toBeInstanceOf(Date);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.requestId).toMatch(/^req_\d+_.+/);
      expect(result.metadata!.processingTime).toBeGreaterThan(0);
    });

    it('should handle API mode with successful response', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-api-key';
      audioService = new AudioService(); // Recreate to pick up env var

      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockResponse = { data: mockAudioBuffer };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await audioService.convertToAudio(validInput);

      expect(result.success).toBe(true);
      expect(result.data!.audioUrl).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('elevenlabs.io'),
        expect.objectContaining({
          text: expect.stringContaining('test story content'),
          model_id: expect.any(String)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'xi-api-key': 'test-api-key',
            'Content-Type': 'application/json'
          }),
          responseType: 'arraybuffer'
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-api-key';
      audioService = new AudioService();

      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await audioService.convertToAudio(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('CONVERSION_FAILED');
      expect(result.error!.message).toBe('Failed to convert text to audio');
    });

    it('should handle all voice types correctly', async () => {
      const voices: VoiceType[] = ['female', 'male', 'neutral'];

      for (const voice of voices) {
        const input = { ...validInput, voice };
        const result = await audioService.convertToAudio(input);

        expect(result.success).toBe(true);
        expect(result.data!.voice).toBe(voice);
      }
    });

    it('should handle all speed settings correctly', async () => {
      const speeds: AudioSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5];

      for (const speed of speeds) {
        const input = { ...validInput, speed };
        const result = await audioService.convertToAudio(input);

        expect(result.success).toBe(true);
        expect(result.data!.speed).toBe(speed);
      }
    });

    it('should handle all audio formats correctly', async () => {
      const formats: AudioFormat[] = ['mp3', 'wav', 'aac'];

      for (const format of formats) {
        const input = { ...validInput, format };
        const result = await audioService.convertToAudio(input);

        expect(result.success).toBe(true);
        expect(result.data!.format).toBe(format);
      }
    });

    it('should use default values for optional parameters', async () => {
      const minimalInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Test content</p>'
      };

      const result = await audioService.convertToAudio(minimalInput);

      expect(result.success).toBe(true);
      expect(result.data!.voice).toBe('female'); // default
      expect(result.data!.speed).toBe(1.0); // default
      expect(result.data!.format).toBe('mp3'); // default
    });

    it('should clean HTML content properly', async () => {
      const htmlInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<h3>Title</h3><p>Content with <em>emphasis</em> and <strong>bold</strong>.</p><script>alert("bad")</script>'
      };

      const result = await audioService.convertToAudio(htmlInput);

      expect(result.success).toBe(true);
      // The mock implementation should have removed HTML tags
      expect(result.data!.duration).toBeGreaterThan(0);
    });

    it('should estimate duration correctly', async () => {
      const longInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<p>' + 'Word '.repeat(1000) + '</p>' // 1000 words
      };

      const result = await audioService.convertToAudio(longInput);

      expect(result.success).toBe(true);
      // Should be approximately 6-7 minutes for 1000 words at normal speed
      expect(result.data!.duration).toBeGreaterThan(300); // More than 5 minutes
      expect(result.data!.duration).toBeLessThan(500); // Less than 8 minutes
    });

    it('should generate unique audio IDs', async () => {
      const result1 = await audioService.convertToAudio(validInput);
      const result2 = await audioService.convertToAudio(validInput);

      expect(result1.data!.audioId).not.toBe(result2.data!.audioId);
    });

    it('should handle empty content gracefully', async () => {
      const emptyInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: ''
      };

      const result = await audioService.convertToAudio(emptyInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('UNSUPPORTED_CONTENT');
    });

    it('should handle very long content', async () => {
      const veryLongContent = '<p>' + 'This is a very long story. '.repeat(10000) + '</p>';
      const longInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: veryLongContent
      };

      const result = await audioService.convertToAudio(longInput);

      // Should either succeed or fail gracefully with appropriate error
      if (result.success) {
        expect(result.data!.duration).toBeGreaterThan(1000); // Very long duration
      } else {
        expect(result.error!.code).toBe('CONVERSION_FAILED');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle malformed HTML', async () => {
      const malformedInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Unclosed tag <em>emphasis <strong>bold</p>'
      };

      const result = await audioService.convertToAudio(malformedInput);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeGreaterThan(0);
    });

    it('should handle content with only HTML tags', async () => {
      const tagsOnlyInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<div></div><span></span><br><hr>'
      };

      const result = await audioService.convertToAudio(tagsOnlyInput);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('UNSUPPORTED_CONTENT');
    });

    it('should handle special characters and unicode', async () => {
      const unicodeInput: AudioConversionSeam['input'] = {
        storyId: 'story_123',
        content: '<p>Content with émojis 🔥 and spëcial chäracters ñ</p>'
      };

      const result = await audioService.convertToAudio(unicodeInput);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    it('should estimate realistic durations for different speeds', async () => {
      const input = { ...validInput };
      const baseResult = await audioService.convertToAudio({ ...input, speed: 1.0 });
      const fastResult = await audioService.convertToAudio({ ...input, speed: 1.5 });
      const slowResult = await audioService.convertToAudio({ ...input, speed: 0.5 });

      expect(baseResult.success).toBe(true);
      expect(fastResult.success).toBe(true);
      expect(slowResult.success).toBe(true);

      // Faster speed should result in shorter duration
      expect(fastResult.data!.duration).toBeLessThan(baseResult.data!.duration);
      // Slower speed should result in longer duration
      expect(slowResult.data!.duration).toBeGreaterThan(baseResult.data!.duration);
    });
  });
});