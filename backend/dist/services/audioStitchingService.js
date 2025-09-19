"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStitchingService = void 0;
class AudioStitchingService {
    /**
     * Combines multiple audio buffers into a single audio file
     * Adds appropriate pauses between dialogue segments
     */
    async stitchAudioSegments(audioSegments, format = 'mp3') {
        // For now, implement a simple concatenation
        // In a real implementation, this would use audio processing libraries like FFmpeg
        const combinedBuffers = [];
        for (let i = 0; i < audioSegments.length; i++) {
            const { audioBuffer, type, segment } = audioSegments[i];
            // Add the audio segment
            combinedBuffers.push(audioBuffer);
            // Add pause between segments (except for the last one)
            if (i < audioSegments.length - 1) {
                const pauseDuration = this.calculatePauseDuration(audioSegments[i], audioSegments[i + 1]);
                const pauseBuffer = this.generateSilence(pauseDuration, format);
                combinedBuffers.push(pauseBuffer);
            }
        }
        // Combine all buffers
        return Buffer.concat(combinedBuffers);
    }
    /**
     * Estimates the total duration of the combined audio
     */
    estimateCombinedDuration(segments) {
        let totalDuration = 0;
        for (const segment of segments) {
            // Estimate duration based on text length
            totalDuration += this.estimateSegmentDuration(segment.text);
            // Add pause duration
            totalDuration += 0.5; // 500ms pause between segments
        }
        return Math.ceil(totalDuration);
    }
    /**
     * Calculates file size estimation for the combined audio
     */
    estimateCombinedFileSize(durationInSeconds, format) {
        // Rough estimation based on format
        const bytesPerSecond = {
            mp3: 16000, // 128 kbps
            wav: 176400, // 16-bit, 44.1kHz, stereo
            aac: 12000 // 96 kbps
        };
        return Math.ceil(durationInSeconds * (bytesPerSecond[format] || bytesPerSecond.mp3));
    }
    /**
     * Validates audio segments before stitching
     */
    validateAudioSegments(audioSegments) {
        const errors = [];
        if (audioSegments.length === 0) {
            errors.push('No audio segments provided');
        }
        for (let i = 0; i < audioSegments.length; i++) {
            const { segment, audioBuffer } = audioSegments[i];
            if (!segment) {
                errors.push(`Missing segment data at index ${i}`);
            }
            if (!audioBuffer || audioBuffer.length === 0) {
                errors.push(`Empty audio buffer at index ${i} for segment ${segment?.id || 'unknown'}`);
            }
            if (segment && (!segment.text || segment.text.trim().length === 0)) {
                errors.push(`Empty text for segment ${segment.id}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Creates metadata for the stitched audio file
     */
    createAudioMetadata(segments, totalDuration) {
        const characterCount = new Set(segments.map(s => s.speaker)).size;
        const segmentCount = segments.length;
        // Create timeline with start times for each segment
        const timeline = this.createSegmentTimeline(segments);
        return {
            totalSegments: segmentCount,
            uniqueCharacters: characterCount,
            totalDuration,
            timeline,
            createdAt: new Date().toISOString(),
            format: 'multi-voice',
            version: '1.0'
        };
    }
    /**
     * Creates a timeline showing when each segment plays
     */
    createSegmentTimeline(segments) {
        const timeline = [];
        let currentTime = 0;
        for (const segment of segments) {
            const duration = this.estimateSegmentDuration(segment.text);
            timeline.push({
                segmentId: segment.id,
                speaker: segment.speaker,
                startTime: currentTime,
                duration,
                text: segment.text
            });
            // Update current time (segment duration + pause)
            currentTime += duration + 0.5; // 500ms pause
        }
        return timeline;
    }
    /**
     * Calculates appropriate pause duration between segments
     */
    calculatePauseDuration(currentSegment, nextSegment) {
        // Different pause lengths based on context
        if (currentSegment.type === 'narrative' && nextSegment.type === 'dialogue') {
            return 0.3; // Shorter pause from narrative to dialogue
        }
        if (currentSegment.type === 'dialogue' && nextSegment.type === 'narrative') {
            return 0.5; // Medium pause from dialogue to narrative
        }
        if (currentSegment.segment.speaker !== nextSegment.segment.speaker) {
            return 0.7; // Longer pause when speaker changes
        }
        // Check emotional context for pause length
        const currentTone = currentSegment.segment.emotionalTone;
        const nextTone = nextSegment.segment.emotionalTone;
        if (currentTone === 'angry' || currentTone === 'menacing') {
            return 0.8; // Longer pause after intense emotions
        }
        if (nextTone === 'tender' || nextTone === 'fearful') {
            return 0.6; // Medium pause before gentle emotions
        }
        return 0.5; // Default pause
    }
    /**
     * Generates silence buffer for pauses
     */
    generateSilence(durationInSeconds, format) {
        const sampleRate = 44100; // 44.1kHz
        const channels = 2; // Stereo
        const bitsPerSample = 16;
        const numSamples = Math.floor(durationInSeconds * sampleRate);
        const bufferSize = numSamples * channels * (bitsPerSample / 8);
        // Create buffer filled with zeros (silence)
        return Buffer.alloc(bufferSize, 0);
    }
    /**
     * Estimates duration of a text segment when spoken
     */
    estimateSegmentDuration(text) {
        // Average reading speed: 150-200 words per minute (2.5-3.3 words per second)
        // For emotional dialogue, slightly slower
        const wordsPerSecond = 2.2;
        const wordCount = text.split(/\s+/).length;
        // Minimum duration of 1 second for very short segments
        return Math.max(1, Math.ceil(wordCount / wordsPerSecond));
    }
    /**
     * Optimizes audio quality by adjusting buffer parameters
     */
    optimizeAudioQuality(audioBuffer, format) {
        // In a real implementation, this would:
        // 1. Normalize audio levels
        // 2. Apply noise reduction
        // 3. Ensure consistent volume across segments
        // 4. Apply format-specific compression
        // For now, return the buffer as-is
        // This is a placeholder for future audio processing enhancements
        return audioBuffer;
    }
    /**
     * Converts audio format if needed
     */
    async convertAudioFormat(audioBuffer, fromFormat, toFormat) {
        // In a real implementation, this would use FFmpeg or similar
        // to convert between audio formats
        // For now, assume all audio is already in the correct format
        return audioBuffer;
    }
    /**
     * Adds audio effects for dramatic enhancement
     */
    applyAudioEffects(audioBuffer, segment, format) {
        // In a real implementation, this would apply effects based on:
        // - Character voice type (reverb for vampires, echo for supernatural beings)
        // - Emotional tone (distortion for anger, soft filter for tenderness)
        // - Scene context (ambient sounds, environmental effects)
        // For now, return the buffer unchanged
        // This is a placeholder for future audio enhancement features
        return audioBuffer;
    }
}
exports.AudioStitchingService = AudioStitchingService;
