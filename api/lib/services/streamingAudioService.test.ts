/**
 * Streaming Audio Service Tests
 * Comprehensive test suite for background audio processing
 */

import { StreamingAudioProcessor, StreamingAudioJob } from '../services/streamingAudioService';
import { AudioService } from '../services/audioService';
import { AudioConversionSeam } from '../types/contracts';

describe('StreamingAudioProcessor', () => {
  let processor: StreamingAudioProcessor;
  let audioService: AudioService;

  beforeEach(() => {
    processor = new StreamingAudioProcessor();
    audioService = new AudioService();
    
    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('job management', () => {
    it('should start a streaming job and return job ID', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'test_story_streaming',
        content: `
          [Narrator]: Once upon a time in a dark forest.
          [Vampire Lord, seductive]: "Come closer, my dear."
          [Human Girl, fearful]: "I should go home."
        `
      };

      const jobId = await processor.startStreamingJob(input);

      expect(jobId).toMatch(/^streaming_\\d+_[a-z0-9]+$/);
      
      const status = processor.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(status!.storyId).toBe('test_story_streaming');
      expect(status!.status).toBe('queued');
      expect(status!.totalChunks).toBeGreaterThan(0);
    });

    it('should track job progress correctly', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'test_progress',
        content: `
          [Character 1]: "First line."
          [Character 2]: "Second line."
          [Character 3]: "Third line."
        `
      };

      const progressUpdates: any[] = [];
      const progressCallback = (progress: any) => {
        progressUpdates.push(progress);
      };

      const jobId = await processor.startStreamingJob(input, progressCallback);
      
      // Wait for processing to start
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const status = processor.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Should have received initial progress update
      expect(progressUpdates[0]).toHaveProperty('percentage');
      expect(progressUpdates[0]).toHaveProperty('status');
      expect(progressUpdates[0]).toHaveProperty('message');
    });

    it('should handle job cancellation', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'test_cancel',
        content: '[Character]: "This job will be cancelled."'
      };

      const jobId = await processor.startStreamingJob(input);
      const cancelled = processor.cancelJob(jobId);

      expect(cancelled).toBe(true);
      
      const status = processor.getJobStatus(jobId);
      expect(status?.status).toBe('failed');
      expect(status?.progress.message).toContain('cancelled');
    });

    it('should handle non-existent job operations gracefully', () => {
      const fakeJobId = 'streaming_fake_job_id';
      
      const status = processor.getJobStatus(fakeJobId);
      expect(status).toBeNull();
      
      const audioUrl = processor.getAudioUrl(fakeJobId);
      expect(audioUrl).toBeNull();
      
      const cancelled = processor.cancelJob(fakeJobId);
      expect(cancelled).toBe(false);
    });
  });

  describe('content parsing and chunking', () => {
    it('should parse content into appropriate chunks', async () => {
      const complexContent = `
        [Narrator]: The moonlight cast eerie shadows across the ancient castle.
        [Vampire Count, brooding]: "Another century passes, yet the loneliness remains."
        [Human Maiden, curious]: "What brought you to this life of darkness?"
        [Vampire Count, passionate]: "Love... and the curse that followed."
        [Narrator]: Their eyes met in the candlelit chamber.
        [Human Maiden, conflicted]: "I should fear you, but I don't."
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_parsing',
        content: complexContent
      };

      const jobId = await processor.startStreamingJob(input);
      const status = processor.getJobStatus(jobId);

      expect(status).toBeDefined();
      expect(status!.totalChunks).toBe(6); // Should identify 6 distinct chunks
      expect(status!.chunks.length).toBe(6);

      // Check chunk properties
      const narratorChunks = status!.chunks.filter(chunk => chunk.speaker === 'Narrator');
      const vampireChunks = status!.chunks.filter(chunk => chunk.speaker === 'Vampire Count');
      const humanChunks = status!.chunks.filter(chunk => chunk.speaker === 'Human Maiden');

      expect(narratorChunks.length).toBe(2);
      expect(vampireChunks.length).toBe(2);
      expect(humanChunks.length).toBe(2);

      // Check emotion extraction
      const broodingChunk = status!.chunks.find(chunk => chunk.emotion === 'brooding');
      const passionateChunk = status!.chunks.find(chunk => chunk.emotion === 'passionate');
      const conflictedChunk = status!.chunks.find(chunk => chunk.emotion === 'conflicted');

      expect(broodingChunk).toBeDefined();
      expect(passionateChunk).toBeDefined();
      expect(conflictedChunk).toBeDefined();
    });

    it('should handle malformed content gracefully', async () => {
      const malformedContent = `
        [Character with no closing]: "Missing bracket
        []: "Empty speaker name"
        Regular text without speaker tags
        [Character,]: "Missing emotion"
        [,emotion]: "Missing character"
      `;

      const input: AudioConversionSeam['input'] = {
        storyId: 'test_malformed',
        content: malformedContent
      };

      const jobId = await processor.startStreamingJob(input);
      const status = processor.getJobStatus(jobId);

      expect(status).toBeDefined();
      expect(status!.totalChunks).toBeGreaterThan(0);
      // Should handle malformed content without crashing
    });
  });

  describe('parallel processing and performance', () => {
    it('should process multiple jobs concurrently', async () => {
      const job1Input: AudioConversionSeam['input'] = {
        storyId: 'concurrent_1',
        content: '[Character 1]: "First concurrent job."'
      };

      const job2Input: AudioConversionSeam['input'] = {
        storyId: 'concurrent_2',
        content: '[Character 2]: "Second concurrent job."'
      };

      const job3Input: AudioConversionSeam['input'] = {
        storyId: 'concurrent_3',
        content: '[Character 3]: "Third concurrent job."'
      };

      const startTime = Date.now();
      
      const [jobId1, jobId2, jobId3] = await Promise.all([
        processor.startStreamingJob(job1Input),
        processor.startStreamingJob(job2Input),
        processor.startStreamingJob(job3Input)
      ]);

      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId3).toBeDefined();

      // All jobs should be different
      expect(new Set([jobId1, jobId2, jobId3]).size).toBe(3);

      // Jobs should start quickly
      const startupTime = Date.now() - startTime;
      expect(startupTime).toBeLessThan(1000);
    });

    it('should handle processing queue efficiently', async () => {
      // Create several jobs to test queue management
      const jobs = Array(5).fill(0).map((_, i) => ({
        storyId: `queue_test_${i}`,
        content: `[Character ${i}]: "Queue test message ${i}."`
      }));

      const jobIds = await Promise.all(
        jobs.map(job => processor.startStreamingJob(job))
      );

      expect(jobIds.length).toBe(5);
      
      // All jobs should be tracked
      jobIds.forEach(jobId => {
        const status = processor.getJobStatus(jobId);
        expect(status).toBeDefined();
        expect(['queued', 'processing']).toContain(status!.status);
      });
    });

    it('should estimate processing times accurately', async () => {
      const shortContent = '[Character]: "Short message."';
      const longContent = Array(10).fill(0).map((_, i) => 
        `[Character ${i}]: "This is a longer message with more content to process."`
      ).join(' ');

      const shortInput: AudioConversionSeam['input'] = {
        storyId: 'short_estimate',
        content: shortContent
      };

      const longInput: AudioConversionSeam['input'] = {
        storyId: 'long_estimate',
        content: longContent
      };

      const shortJobId = await processor.startStreamingJob(shortInput);
      const longJobId = await processor.startStreamingJob(longInput);

      const shortStatus = processor.getJobStatus(shortJobId);
      const longStatus = processor.getJobStatus(longJobId);

      expect(shortStatus!.progress.estimatedTimeRemaining).toBeDefined();
      expect(longStatus!.progress.estimatedTimeRemaining).toBeDefined();
      
      // Longer content should have longer estimated time
      expect(longStatus!.progress.estimatedTimeRemaining!).toBeGreaterThan(
        shortStatus!.progress.estimatedTimeRemaining!
      );
    });
  });

  describe('integration with main AudioService', () => {
    it('should integrate streaming functionality with main audio service', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'integration_test',
        content: '[Vampire, seductive]: "Integration test with emotion mapping."'
      };

      const streamingResult = await audioService.startStreamingAudio(input);

      expect(streamingResult).toHaveProperty('jobId');
      expect(streamingResult).toHaveProperty('estimatedDuration');
      expect(streamingResult.jobId).toMatch(/^streaming_\\d+_[a-z0-9]+$/);
      expect(streamingResult.estimatedDuration).toBeGreaterThan(0);

      // Should be able to check status through main service
      const status = audioService.getStreamingJobStatus(streamingResult.jobId);
      expect(status).toBeDefined();
      expect(status!.storyId).toBe('integration_test');
    });

    it('should provide streaming job cancellation through main service', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'cancel_integration_test',
        content: '[Character]: "This will be cancelled through main service."'
      };

      const { jobId } = await audioService.startStreamingAudio(input);
      const cancelled = audioService.cancelStreamingJob(jobId);

      expect(cancelled).toBe(true);
    });
  });

  describe('error handling and resilience', () => {
    it('should handle chunk processing failures gracefully', async () => {
      // Mock a scenario where some chunks fail
      const input: AudioConversionSeam['input'] = {
        storyId: 'error_handling_test',
        content: `
          [Character 1]: "This should work."
          [Character 2]: "This might fail."
          [Character 3]: "This should also work."
        `
      };

      const jobId = await processor.startStreamingJob(input);
      
      // Job should start successfully even if some chunks might fail
      const status = processor.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(status!.status).toBe('queued');
    });

    it('should provide detailed error information', async () => {
      const input: AudioConversionSeam['input'] = {
        storyId: 'error_detail_test',
        content: '[Character]: "Test error handling."'
      };

      const jobId = await processor.startStreamingJob(input);
      const status = processor.getJobStatus(jobId);

      expect(status!.progress).toHaveProperty('message');
      expect(status!.progress).toHaveProperty('status');
      expect(status!.progress).toHaveProperty('percentage');
    });
  });
});