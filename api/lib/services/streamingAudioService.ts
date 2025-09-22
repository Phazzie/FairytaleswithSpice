/**
 * Streaming Audio Service - Background Processing for Enhanced UX
 * Enables real-time audio generation with progress updates and background processing
 */

import { EventEmitter } from 'events';
import { AudioConversionSeam, AudioProgress } from '../types/contracts';
import { CharacterVoiceType } from '../types/contracts';

export interface StreamingAudioChunk {
  chunkId: string;
  speaker: string;
  text: string;
  voice: CharacterVoiceType;
  emotion?: string;
  audioData?: Buffer;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  completedTime?: number;
  error?: string;
}

export interface StreamingAudioJob {
  jobId: string;
  storyId: string;
  chunks: StreamingAudioChunk[];
  totalChunks: number;
  completedChunks: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: AudioProgress;
  startTime: number;
  estimatedCompletionTime?: number;
  audioBuffer?: Buffer;
  audioUrl?: string;
}

/**
 * StreamingAudioProcessor - Handles background audio generation with real-time progress
 */
export class StreamingAudioProcessor extends EventEmitter {
  private activeJobs: Map<string, StreamingAudioJob> = new Map();
  private processingQueue: string[] = [];
  private maxConcurrentJobs: number = 3;
  private currentlyProcessing: Set<string> = new Set();

  constructor() {
    super();
    this.startJobProcessor();
  }

  /**
   * Starts a streaming audio generation job
   */
  async startStreamingJob(
    input: AudioConversionSeam['input'],
    progressCallback?: (progress: AudioProgress) => void
  ): Promise<string> {
    const jobId = this.generateJobId();
    const chunks = await this.parseTextIntoChunks(input.content);

    const job: StreamingAudioJob = {
      jobId,
      storyId: input.storyId,
      chunks,
      totalChunks: chunks.length,
      completedChunks: 0,
      status: 'queued',
      progress: {
        percentage: 0,
        status: 'queued',
        message: 'Preparing audio generation...',
        estimatedTimeRemaining: this.estimateProcessingTime(chunks.length)
      },
      startTime: Date.now()
    };

    this.activeJobs.set(jobId, job);
    this.processingQueue.push(jobId);

    // Set up progress callback if provided
    if (progressCallback) {
      this.on(`progress:${jobId}`, progressCallback);
    }

    // Emit initial progress
    this.emitProgress(jobId);

    console.log(`🎵 Started streaming audio job ${jobId} with ${chunks.length} chunks`);
    return jobId;
  }

  /**
   * Gets the current status of a streaming job
   */
  getJobStatus(jobId: string): StreamingAudioJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Gets the final audio URL for a completed job
   */
  getAudioUrl(jobId: string): string | null {
    const job = this.activeJobs.get(jobId);
    return job?.audioUrl || null;
  }

  /**
   * Cancels a streaming job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    // Remove from queue if not yet processing
    const queueIndex = this.processingQueue.indexOf(jobId);
    if (queueIndex > -1) {
      this.processingQueue.splice(queueIndex, 1);
    }

    // Mark as failed and clean up
    job.status = 'failed';
    job.progress = {
      percentage: 0,
      status: 'failed',
      message: 'Job cancelled by user'
    };

    this.emitProgress(jobId);
    this.cleanupJob(jobId);
    return true;
  }

  /**
   * Processes jobs from the queue
   */
  private startJobProcessor(): void {
    setInterval(() => {
      this.processNextJob();
    }, 1000); // Check for new jobs every second
  }

  /**
   * Processes the next job in queue
   */
  private async processNextJob(): Promise<void> {
    if (this.currentlyProcessing.size >= this.maxConcurrentJobs) {
      return; // At capacity
    }

    const jobId = this.processingQueue.shift();
    if (!jobId) {
      return; // No jobs in queue
    }

    const job = this.activeJobs.get(jobId);
    if (!job) {
      return; // Job no longer exists
    }

    this.currentlyProcessing.add(jobId);
    job.status = 'processing';
    job.progress.status = 'processing';
    job.progress.message = 'Generating audio chunks...';

    try {
      await this.processJobChunks(job);
      await this.finalizeJob(job);
    } catch (error) {
      console.error(`Error processing streaming job ${jobId}:`, error);
      job.status = 'failed';
      job.progress = {
        percentage: 0,
        status: 'failed',
        message: `Audio generation failed: ${error}`
      };
      this.emitProgress(jobId);
    } finally {
      this.currentlyProcessing.delete(jobId);
    }
  }

  /**
   * Processes all chunks for a job with parallel processing
   */
  private async processJobChunks(job: StreamingAudioJob): Promise<void> {
    const { AudioService } = await import('./audioService');
    const audioService = new AudioService();

    // Process chunks in parallel batches
    const batchSize = 3;
    const batches = this.chunkArray(job.chunks, batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Process batch in parallel
      const promises = batch.map(chunk => this.processChunk(chunk, audioService));
      await Promise.allSettled(promises);

      // Update job progress
      job.completedChunks = Math.min(job.completedChunks + batch.length, job.totalChunks);
      this.updateJobProgress(job);
      this.emitProgress(job.jobId);

      // Small delay between batches to prevent API rate limiting
      if (batchIndex < batches.length - 1) {
        await this.delay(500);
      }
    }
  }

  /**
   * Processes a single audio chunk
   */
  private async processChunk(chunk: StreamingAudioChunk, audioService: any): Promise<void> {
    try {
      chunk.status = 'processing';
      chunk.startTime = Date.now();

      // Generate audio for this chunk
      const audioData = await audioService.callElevenLabsAPI(
        chunk.text,
        { storyId: 'streaming', content: chunk.text },
        chunk.voice,
        chunk.emotion
      );

      chunk.audioData = audioData;
      chunk.status = 'completed';
      chunk.completedTime = Date.now();

    } catch (error) {
      console.warn(`Failed to process chunk ${chunk.chunkId}:`, error);
      chunk.status = 'failed';
      chunk.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Finalizes a job by merging audio chunks and creating final output
   */
  private async finalizeJob(job: StreamingAudioJob): Promise<void> {
    try {
      job.progress.message = 'Merging audio chunks...';
      job.progress.percentage = 95;
      this.emitProgress(job.jobId);

      // Filter successful chunks and merge audio
      const successfulChunks = job.chunks.filter(chunk => 
        chunk.status === 'completed' && chunk.audioData
      );

      if (successfulChunks.length === 0) {
        throw new Error('No audio chunks were successfully generated');
      }

      // Merge audio chunks (simplified - would use proper audio processing in production)
      const { AudioService } = await import('./audioService');
      const audioService = new AudioService();
      
      job.audioBuffer = audioService.mergeAudioChunks(successfulChunks as any);
      
      // Upload to storage and get URL
      job.audioUrl = await this.uploadAudioToStorage(job.audioBuffer, job.storyId);

      // Mark as completed
      job.status = 'completed';
      job.progress = {
        percentage: 100,
        status: 'completed',
        message: 'Audio generation completed successfully!',
        estimatedTimeRemaining: 0
      };

      this.emitProgress(job.jobId);

      // Schedule cleanup after 1 hour
      setTimeout(() => this.cleanupJob(job.jobId), 60 * 60 * 1000);

    } catch (error) {
      throw new Error(`Failed to finalize job: ${error}`);
    }
  }

  /**
   * Parses text content into processable chunks
   */
  private async parseTextIntoChunks(content: string): Promise<StreamingAudioChunk[]> {
    const chunks: StreamingAudioChunk[] = [];
    const segments = content.split(/(\\[([^\\]]+)\\]:\\s*)/);
    
    let currentSpeaker = 'Narrator';
    let currentVoice: CharacterVoiceType = 'narrator';
    let currentEmotion: string | undefined = undefined;
    let chunkCounter = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (!segment) continue;

      // Check if this segment is a speaker tag
      const speakerMatch = segment.match(/\\[([^\\]]+)\\]:\\s*/);
      
      if (speakerMatch) {
        // Update current speaker and voice
        const speakerInfo = speakerMatch[1];
        const speakerParts = speakerInfo.split(',').map(part => part.trim());
        
        currentSpeaker = speakerParts[0];
        currentEmotion = speakerParts.length > 1 ? speakerParts[1] : undefined;
        currentVoice = this.assignVoiceToSpeaker(currentSpeaker);
      } else if (segment.length > 0) {
        // Create chunk for this dialogue/narrative
        chunks.push({
          chunkId: `chunk_${++chunkCounter}`,
          speaker: currentSpeaker,
          text: segment,
          voice: currentVoice,
          emotion: currentEmotion,
          status: 'queued'
        });
      }
    }

    return chunks;
  }

  /**
   * Updates job progress based on completed chunks
   */
  private updateJobProgress(job: StreamingAudioJob): void {
    const percentage = Math.round((job.completedChunks / job.totalChunks) * 90); // Leave 10% for finalization
    const elapsed = Date.now() - job.startTime;
    const avgTimePerChunk = elapsed / Math.max(job.completedChunks, 1);
    const remainingChunks = job.totalChunks - job.completedChunks;
    const estimatedTimeRemaining = Math.round((remainingChunks * avgTimePerChunk) / 1000);

    job.progress = {
      percentage,
      status: 'processing',
      message: `Processing chunk ${job.completedChunks}/${job.totalChunks}...`,
      estimatedTimeRemaining
    };

    // Update estimated completion time
    job.estimatedCompletionTime = Date.now() + (estimatedTimeRemaining * 1000);
  }

  /**
   * Emits progress update for a job
   */
  private emitProgress(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      this.emit(`progress:${jobId}`, job.progress);
      this.emit('progress', { jobId, progress: job.progress });
    }
  }

  /**
   * Utility methods
   */
  private generateJobId(): string {
    return `streaming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateProcessingTime(chunkCount: number): number {
    // Estimate 2-4 seconds per chunk depending on length
    return Math.round(chunkCount * 3);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private assignVoiceToSpeaker(speakerName: string): CharacterVoiceType {
    // Simplified voice assignment - would import from audioService in production
    const lowerName = speakerName.toLowerCase();
    
    if (lowerName.includes('narrator')) return 'narrator';
    if (lowerName.includes('vampire')) return 'vampire_male';
    if (lowerName.includes('werewolf') || lowerName.includes('wolf')) return 'werewolf_male';
    if (lowerName.includes('fairy') || lowerName.includes('fae')) return 'fairy_female';
    
    return 'human_female';
  }

  private async uploadAudioToStorage(audioBuffer: Buffer, storyId: string): Promise<string> {
    // Mock storage upload - in production would upload to S3, Cloudinary, etc.
    const filename = `streaming-audio-${storyId}-${Date.now()}.mp3`;
    console.log(`📤 Uploading audio file: ${filename} (${audioBuffer.length} bytes)`);
    
    // Simulate upload delay
    await this.delay(1000);
    
    return `https://storage.example.com/streaming-audio/${filename}`;
  }

  private cleanupJob(jobId: string): void {
    this.activeJobs.delete(jobId);
    this.removeAllListeners(`progress:${jobId}`);
    console.log(`🧹 Cleaned up streaming job ${jobId}`);
  }
}