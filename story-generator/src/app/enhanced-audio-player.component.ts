import { Component, Input, OnInit, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AudioCharacter {
  name: string;
  voice: string;
  emotionsUsed: string[];
  segments: number; // Number of audio segments for this character
}

export interface AudioMetadata {
  totalDuration: number;
  characters: AudioCharacter[];
  emotions: string[];
  model: string;
  quality: string;
}

@Component({
  selector: 'enhanced-audio-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="enhanced-audio-player" *ngIf="audioUrl">
      <div class="player-header">
        <h3>🎧 Character-Driven Audio Narration</h3>
        <div class="audio-quality-badge">
          <span class="model-badge">{{metadata.model || 'ElevenLabs Turbo v2.5'}}</span>
          <span class="quality-badge">{{metadata.quality || 'High Quality'}}</span>
        </div>
      </div>

      <!-- Character Information Panel -->
      <div class="character-panel" *ngIf="metadata.characters && metadata.characters.length > 1">
        <h4>🎭 Characters & Voices</h4>
        <div class="character-grid">
          <div *ngFor="let character of metadata.characters" class="character-card">
            <div class="character-info">
              <span class="character-name">{{character.name}}</span>
              <span class="voice-type">{{character.voice}}</span>
              <span class="segment-count">{{character.segments}} segments</span>
            </div>
            <div class="character-emotions" *ngIf="character.emotionsUsed.length > 0">
              <span *ngFor="let emotion of character.emotionsUsed" class="emotion-tag">
                {{emotion}}
              </span>
            </div>
            <button (click)="previewCharacterVoice(character)" 
                    class="preview-btn"
                    [disabled]="isPreviewPlaying">
              <span *ngIf="!isPreviewPlaying">🔊 Preview</span>
              <span *ngIf="isPreviewPlaying" class="loading-spinner">⏳ Playing...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Audio Controls -->
      <div class="main-audio-controls">
        <audio #audioPlayer 
               controls 
               preload="metadata" 
               [src]="audioUrl"
               (timeupdate)="updateProgress($event)"
               (loadedmetadata)="audioLoaded($event)"
               (ended)="audioEnded()"
               (error)="audioError($event)"
               class="audio-element">
          Your browser does not support the audio element.
        </audio>

        <!-- Enhanced Controls -->
        <div class="enhanced-controls">
          <!-- Playback Speed -->
          <div class="speed-control">
            <label for="speed-select">Speed:</label>
            <select id="speed-select" 
                    [(ngModel)]="playbackSpeed" 
                    (change)="setPlaybackSpeed()"
                    class="speed-select">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1.0">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>

          <!-- Loop Toggle -->
          <div class="loop-control">
            <label class="checkbox-label">
              <input type="checkbox" 
                     [(ngModel)]="isLooping" 
                     (change)="toggleLoop()"
                     class="loop-checkbox">
              <span class="checkmark">🔁</span>
              Loop
            </label>
          </div>

          <!-- Volume Control -->
          <div class="volume-control">
            <label for="volume-slider">🔊</label>
            <input type="range" 
                   id="volume-slider"
                   min="0" 
                   max="100" 
                   [(ngModel)]="volume"
                   (input)="setVolume()"
                   class="volume-slider">
            <span class="volume-value">{{volume}}%</span>
          </div>
        </div>
      </div>

      <!-- Progress Information -->
      <div class="progress-info" *ngIf="currentTime >= 0 && duration > 0">
        <div class="time-display">
          <span class="current-time">{{formatTime(currentTime)}}</span>
          <span class="duration">{{formatTime(duration)}}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progressPercentage"></div>
          </div>
        </div>
      </div>

      <!-- Audio Statistics -->
      <div class="audio-stats">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Duration:</span>
            <span class="stat-value">{{formatTime(duration)}}</span>
          </div>
          <div class="stat-item" *ngIf="metadata.characters">
            <span class="stat-label">Characters:</span>
            <span class="stat-value">{{metadata.characters.length}}</span>
          </div>
          <div class="stat-item" *ngIf="metadata.emotions">
            <span class="stat-label">Emotions:</span>
            <span class="stat-value">{{metadata.emotions.length}} unique</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Quality:</span>
            <span class="stat-value">{{audioQuality}}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="audio-actions">
        <a [href]="audioUrl" 
           download="story-audio.mp3" 
           class="action-btn download-btn">
          💾 Download Audio
        </a>
        
        <button (click)="shareAudio()" 
                class="action-btn share-btn"
                [disabled]="!canShare">
          🔗 Share
        </button>
        
        <button (click)="regenerateAudio()" 
                class="action-btn regenerate-btn">
          🎭 Try Different Voices
        </button>
        
        <button (click)="showAudioDetails()" 
                class="action-btn details-btn">
          📊 Audio Details
        </button>
      </div>

      <!-- Error Display -->
      <div class="audio-error" *ngIf="errorMessage">
        <div class="error-content">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{errorMessage}}</span>
          <button (click)="clearError()" class="error-dismiss">✕</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
/* Enhanced Audio Player Styles */
.enhanced-audio-player {
  background: linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 50%, #16213e 100%);
  border-radius: 16px;
  padding: 24px;
  margin: 20px 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Header Section */
.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.player-header h3 {
  margin: 0;
  font-size: 1.4em;
  font-weight: 600;
  background: linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 3s ease infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.audio-quality-badge {
  display: flex;
  gap: 8px;
}

.model-badge, .quality-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8em;
  font-weight: 500;
}

.model-badge {
  background: rgba(72, 219, 251, 0.2);
  border: 1px solid #48dbfb;
  color: #48dbfb;
}

.quality-badge {
  background: rgba(255, 107, 107, 0.2);
  border: 1px solid #ff6b6b;
  color: #ff6b6b;
}

/* Character Panel */
.character-panel {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.character-panel h4 {
  margin: 0 0 16px 0;
  font-size: 1.1em;
  color: #feca57;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.character-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.character-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.character-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.character-name {
  font-weight: 600;
  font-size: 1.1em;
  color: #ffffff;
}

.voice-type {
  color: #48dbfb;
  font-size: 0.9em;
}

.segment-count {
  color: #a0a0a0;
  font-size: 0.8em;
}

.character-emotions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.emotion-tag {
  background: rgba(255, 159, 243, 0.2);
  color: #ff9ff3;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  border: 1px solid rgba(255, 159, 243, 0.3);
}

.preview-btn {
  background: linear-gradient(45deg, #ff6b6b, #feca57);
  border: none;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.preview-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Main Audio Controls */
.main-audio-controls {
  margin-bottom: 20px;
}

.audio-element {
  width: 100%;
  height: 54px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
}

.enhanced-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.speed-control, .loop-control, .volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-select {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.9em;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.loop-checkbox {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  position: relative;
}

.loop-checkbox:checked {
  background: #48dbfb;
  border-color: #48dbfb;
}

.loop-checkbox:checked::after {
  content: '✓';
  position: absolute;
  top: -2px;
  left: 1px;
  color: white;
  font-size: 14px;
}

.volume-slider {
  width: 100px;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  appearance: none;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #feca57;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.volume-value {
  font-size: 0.9em;
  color: #feca57;
  min-width: 35px;
}

/* Action Buttons */
.audio-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  color: white;
  min-width: 140px;
  justify-content: center;
}

.download-btn {
  background: linear-gradient(45deg, #48dbfb, #0abde3);
}

.share-btn {
  background: linear-gradient(45deg, #ff9ff3, #ee5a6f);
}

.regenerate-btn {
  background: linear-gradient(45deg, #feca57, #ff9f43);
}

.details-btn {
  background: linear-gradient(45deg, #a55eea, #8854d0);
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Progress and Stats */
.progress-info {
  margin-bottom: 20px;
}

.time-display {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.9em;
  color: #a0a0a0;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  width: 100%;
  height: 100%;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.audio-stats {
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.8em;
  color: #a0a0a0;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 1.1em;
  font-weight: 600;
  color: #ffffff;
}

/* Error Display */
.audio-error {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid #ff6b6b;
  border-radius: 8px;
  color: #ff6b6b;
}

.error-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.error-icon {
  font-size: 1.2em;
}

.error-text {
  flex-grow: 1;
}

.error-dismiss {
  background: none;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 1.2em;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-dismiss:hover {
  background: rgba(255, 107, 107, 0.2);
  border-radius: 50%;
}

/* Responsive Design */
@media (max-width: 768px) {
  .enhanced-audio-player {
    padding: 16px;
    margin: 16px 0;
  }

  .player-header {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .enhanced-controls {
    flex-direction: column;
    gap: 16px;
  }

  .character-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .audio-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
  `]
})
export class EnhancedAudioPlayerComponent implements OnInit {
  @Input() audioUrl: string = '';
  @Input() metadata: AudioMetadata = {
    totalDuration: 0,
    characters: [],
    emotions: [],
    model: 'ElevenLabs Turbo v2.5',
    quality: 'High Quality'
  };

  @Output() regenerateRequested = new EventEmitter<void>();
  @Output() shareRequested = new EventEmitter<string>();
  @Output() previewRequested = new EventEmitter<AudioCharacter>();

  @ViewChild('audioPlayer') audioPlayer!: ElementRef<HTMLAudioElement>;

  // Audio state
  currentTime: number = 0;
  duration: number = 0;
  playbackSpeed: number = 1.0;
  volume: number = 100;
  isLooping: boolean = false;
  isPreviewPlaying: boolean = false;
  
  // UI state
  errorMessage: string = '';
  canShare: boolean = false;

  // Computed properties
  get progressPercentage(): number {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  get audioQuality(): string {
    if (this.duration === 0) return 'Unknown';
    
    if (this.duration > 300) return 'Premium'; // Long stories
    if (this.metadata.characters.length > 3) return 'Multi-Character';
    return 'Standard';
  }

  ngOnInit() {
    this.canShare = 'share' in navigator;
  }

  // Audio event handlers
  audioLoaded(event: Event) {
    const audio = event.target as HTMLAudioElement;
    this.duration = audio.duration || 0;
    console.log('🎵 Audio loaded, duration:', this.formatTime(this.duration));
  }

  updateProgress(event: Event) {
    const audio = event.target as HTMLAudioElement;
    this.currentTime = audio.currentTime;
  }

  audioEnded() {
    console.log('🎵 Audio playback completed');
    this.currentTime = 0;
    
    if (this.isLooping && this.audioPlayer) {
      this.audioPlayer.nativeElement.currentTime = 0;
      this.audioPlayer.nativeElement.play();
    }
  }

  audioError(event: Event) {
    const audio = event.target as HTMLAudioElement;
    const error = audio.error;
    
    let errorMsg = 'Unknown audio error';
    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMsg = 'Audio playback was aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMsg = 'Network error occurred while loading audio';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMsg = 'Audio file could not be decoded';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = 'Audio format not supported';
          break;
      }
    }
    
    this.errorMessage = errorMsg;
    console.error('🚨 Audio error:', errorMsg);
  }

  // Control methods
  setPlaybackSpeed() {
    if (this.audioPlayer) {
      this.audioPlayer.nativeElement.playbackRate = this.playbackSpeed;
      console.log('🎵 Playback speed set to:', this.playbackSpeed + 'x');
    }
  }

  setVolume() {
    if (this.audioPlayer) {
      this.audioPlayer.nativeElement.volume = this.volume / 100;
    }
  }

  toggleLoop() {
    if (this.audioPlayer) {
      this.audioPlayer.nativeElement.loop = this.isLooping;
      console.log('🔁 Loop mode:', this.isLooping ? 'enabled' : 'disabled');
    }
  }

  // Character-specific methods
  previewCharacterVoice(character: AudioCharacter) {
    console.log('🎭 Previewing voice for character:', character.name);
    this.isPreviewPlaying = true;
    this.previewRequested.emit(character);
    
    // Simulate preview duration
    setTimeout(() => {
      this.isPreviewPlaying = false;
    }, 3000);
  }

  // Action methods
  shareAudio() {
    if (this.canShare && this.audioUrl) {
      this.shareRequested.emit(this.audioUrl);
      
      if (navigator.share) {
        navigator.share({
          title: 'Spicy Fairy Tale Audio',
          text: 'Listen to this character-driven audio story!',
          url: this.audioUrl
        }).catch(err => {
          console.error('Share failed:', err);
          this.copyToClipboard();
        });
      }
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard() {
    navigator.clipboard.writeText(this.audioUrl).then(() => {
      console.log('🔗 Audio URL copied to clipboard');
    });
  }

  regenerateAudio() {
    console.log('🎭 Requesting audio regeneration with different voices');
    this.regenerateRequested.emit();
  }

  showAudioDetails() {
    const details = {
      url: this.audioUrl,
      duration: this.duration,
      characters: this.metadata.characters.length,
      emotions: this.metadata.emotions.length,
      model: this.metadata.model,
      quality: this.audioQuality
    };
    
    console.log('📊 Audio Details:', details);
    
    alert(`Audio Details:\n\nDuration: ${this.formatTime(this.duration)}\nCharacters: ${this.metadata.characters.length}\nEmotions: ${this.metadata.emotions.length}\nModel: ${this.metadata.model}\nQuality: ${this.audioQuality}`);
  }

  clearError() {
    this.errorMessage = '';
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (!seconds || seconds < 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}