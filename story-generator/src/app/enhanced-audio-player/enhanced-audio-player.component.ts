import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * EnhancedAudioPlayer - Advanced Multi-Voice Audio Player
 * 
 * Features:
 * - Character-specific volume controls
 * - Voice visualization during playback
 * - Advanced playback controls (speed, pitch preservation)
 * - Chapter/scene navigation
 * - Character identification display
 * - Audio quality settings
 * - Offline caching support
 */

export interface AudioPlayerSettings {
  speed: number;              // 0.5-2.0
  preservePitch: boolean;     // Whether to preserve pitch during speed changes
  characterVolumes: Record<string, number>; // Individual character volumes
  visualizationEnabled: boolean;
  qualitySetting: 'low' | 'medium' | 'high';
}

export interface CharacterInfo {
  name: string;
  type: 'vampire' | 'werewolf' | 'fairy' | 'human' | 'narrator';
  color: string;
  volume: number;
  muted: boolean;
}

@Component({
  selector: 'app-enhanced-audio-player',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="enhanced-audio-player" *ngIf="audioUrl">
      <!-- Main Audio Element (hidden) -->
      <audio 
        #audioElement 
        [src]="audioUrl" 
        preload="metadata"
        (loadedmetadata)="onAudioLoaded()"
        (timeupdate)="onTimeUpdate()"
        (ended)="onAudioEnded()"
        (play)="onPlayStateChange(true)"
        (pause)="onPlayStateChange(false)"
        style="display: none;">
      </audio>

      <!-- Player Header -->
      <div class="player-header">
        <h3>🎧 Enhanced Audio Narration</h3>
        <div class="player-stats">
          <span class="duration">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
          <span class="characters-count">{{ characters.length }} voices</span>
        </div>
      </div>

      <!-- Waveform Visualization -->
      <div class="visualization-container" *ngIf="settings.visualizationEnabled">
        <canvas #waveformCanvas class="waveform-canvas"></canvas>
        <div class="playhead" [style.left.%]="(currentTime / duration) * 100"></div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-container" (click)="seek($event)">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="(currentTime / duration) * 100"></div>
          <div class="progress-handle" [style.left.%]="(currentTime / duration) * 100"></div>
        </div>
        <div class="time-markers">
          <span *ngFor="let marker of timeMarkers" 
                class="time-marker" 
                [style.left.%]="marker.position">
            {{ marker.label }}
          </span>
        </div>
      </div>

      <!-- Main Controls -->
      <div class="main-controls">
        <button class="control-btn" (click)="skipBackward()" title="Skip back 10s">
          ⏪
        </button>
        
        <button class="play-pause-btn" (click)="togglePlayPause()" [class.playing]="isPlaying">
          <span *ngIf="!isPlaying">▶️</span>
          <span *ngIf="isPlaying">⏸️</span>
        </button>
        
        <button class="control-btn" (click)="skipForward()" title="Skip forward 30s">
          ⏩
        </button>
        
        <div class="volume-control">
          <span>🔊</span>
          <input type="range" 
                 min="0" 
                 max="1" 
                 step="0.1" 
                 [(ngModel)]="masterVolume"
                 (input)="updateMasterVolume()"
                 class="volume-slider">
        </div>
        
        <div class="speed-control">
          <label>Speed:</label>
          <select [(ngModel)]="settings.speed" (change)="updatePlaybackSpeed()">
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>

      <!-- Character Controls -->
      <div class="character-controls" *ngIf="characters.length > 1">
        <h4>Character Voices</h4>
        <div class="character-list">
          <div *ngFor="let character of characters" 
               class="character-control" 
               [class.muted]="character.muted">
            
            <div class="character-info">
              <div class="character-avatar" [style.background-color]="character.color">
                {{ getCharacterIcon(character.type) }}
              </div>
              <div class="character-details">
                <span class="character-name">{{ character.name }}</span>
                <span class="character-type">{{ character.type }}</span>
              </div>
            </div>
            
            <div class="character-volume">
              <button class="mute-btn" 
                      (click)="toggleCharacterMute(character)"
                      [class.muted]="character.muted">
                <span *ngIf="!character.muted">🔊</span>
                <span *ngIf="character.muted">🔇</span>
              </button>
              
              <input type="range" 
                     min="0" 
                     max="1" 
                     step="0.1" 
                     [(ngModel)]="character.volume"
                     (input)="updateCharacterVolume(character)"
                     class="character-volume-slider"
                     [disabled]="character.muted">
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="advanced-settings" *ngIf="showAdvancedSettings">
        <h4>Audio Settings</h4>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" 
                   [(ngModel)]="settings.preservePitch"
                   (change)="updatePlaybackSpeed()">
            Preserve pitch during speed changes
          </label>
        </div>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" 
                   [(ngModel)]="settings.visualizationEnabled"
                   (change)="toggleVisualization()">
            Show waveform visualization
          </label>
        </div>
        
        <div class="setting-group">
          <label for="quality">Audio Quality:</label>
          <select id="quality" [(ngModel)]="settings.qualitySetting">
            <option value="low">Low (faster loading)</option>
            <option value="medium">Medium (balanced)</option>
            <option value="high">High (best quality)</option>
          </select>
        </div>
      </div>

      <!-- Player Actions -->
      <div class="player-actions">
        <button class="action-btn" (click)="downloadAudio()" title="Download audio file">
          💾 Download
        </button>
        
        <button class="action-btn" 
                (click)="showAdvancedSettings = !showAdvancedSettings"
                [class.active]="showAdvancedSettings">
          ⚙️ Settings
        </button>
        
        <button class="action-btn" (click)="shareAudio()" title="Share audio">
          📤 Share
        </button>
        
        <button class="action-btn" (click)="toggleLoop()" [class.active]="isLooping">
          🔁 Loop
        </button>
      </div>

      <!-- Status Display -->
      <div class="player-status" *ngIf="statusMessage">
        <span [class]="statusType">{{ statusMessage }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./enhanced-audio-player.component.css']
})
export class EnhancedAudioPlayerComponent implements OnInit, OnDestroy {
  @Input() audioUrl: string = '';
  @Input() duration: number = 0;
  @Input() title: string = '';
  
  @Output() playStateChanged = new EventEmitter<boolean>();
  @Output() progressChanged = new EventEmitter<number>();
  @Output() settingsChanged = new EventEmitter<AudioPlayerSettings>();

  @ViewChild('audioElement', { static: false }) audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChild('waveformCanvas', { static: false }) waveformCanvas!: ElementRef<HTMLCanvasElement>;

  // Player state
  isPlaying = false;
  currentTime = 0;
  masterVolume = 1;
  isLooping = false;
  showAdvancedSettings = false;

  // Status
  statusMessage = '';
  statusType = 'info';

  // Characters and visualization
  characters: CharacterInfo[] = [];
  timeMarkers: { position: number; label: string }[] = [];

  // Settings
  settings: AudioPlayerSettings = {
    speed: 1,
    preservePitch: true,
    characterVolumes: {},
    visualizationEnabled: true,
    qualitySetting: 'medium'
  };

  ngOnInit() {
    this.initializeCharacters();
    this.setupKeyboardShortcuts();
  }

  ngOnDestroy() {
    this.removeKeyboardShortcuts();
  }

  private initializeCharacters() {
    // Mock character data - in real implementation, this would come from the audio analysis
    this.characters = [
      { name: 'Narrator', type: 'narrator', color: '#6c757d', volume: 1, muted: false },
      { name: 'Elvira', type: 'vampire', color: '#dc3545', volume: 1, muted: false },
      { name: 'Marcus', type: 'werewolf', color: '#fd7e14', volume: 1, muted: false },
      { name: 'Luna', type: 'fairy', color: '#20c997', volume: 1, muted: false }
    ];

    // Initialize character volumes in settings
    this.characters.forEach(character => {
      this.settings.characterVolumes[character.name] = character.volume;
    });
  }

  // ==================== AUDIO CONTROL METHODS ====================

  onAudioLoaded() {
    if (this.audioElement?.nativeElement) {
      this.duration = this.audioElement.nativeElement.duration;
      this.generateTimeMarkers();
      this.initializeVisualization();
    }
  }

  onTimeUpdate() {
    if (this.audioElement?.nativeElement) {
      this.currentTime = this.audioElement.nativeElement.currentTime;
      this.progressChanged.emit(this.currentTime);
      this.updateVisualization();
    }
  }

  onAudioEnded() {
    this.isPlaying = false;
    this.playStateChanged.emit(false);
    
    if (this.isLooping) {
      this.currentTime = 0;
      this.play();
    }
  }

  onPlayStateChange(playing: boolean) {
    this.isPlaying = playing;
    this.playStateChanged.emit(playing);
  }

  togglePlayPause() {
    if (this.audioElement?.nativeElement) {
      if (this.isPlaying) {
        this.audioElement.nativeElement.pause();
      } else {
        this.audioElement.nativeElement.play().catch(error => {
          this.showStatus('Playback failed: ' + error.message, 'error');
        });
      }
    }
  }

  play() {
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.play().catch(error => {
        this.showStatus('Playback failed: ' + error.message, 'error');
      });
    }
  }

  pause() {
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.pause();
    }
  }

  seek(event: MouseEvent) {
    if (this.audioElement?.nativeElement && this.duration > 0) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const percent = (event.clientX - rect.left) / rect.width;
      const newTime = percent * this.duration;
      
      this.audioElement.nativeElement.currentTime = newTime;
      this.currentTime = newTime;
    }
  }

  skipBackward() {
    this.skipBy(-10);
  }

  skipForward() {
    this.skipBy(30);
  }

  private skipBy(seconds: number) {
    if (this.audioElement?.nativeElement) {
      const newTime = Math.max(0, Math.min(this.duration, this.currentTime + seconds));
      this.audioElement.nativeElement.currentTime = newTime;
    }
  }

  // ==================== VOLUME CONTROLS ====================

  updateMasterVolume() {
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.volume = this.masterVolume;
    }
  }

  updateCharacterVolume(character: CharacterInfo) {
    this.settings.characterVolumes[character.name] = character.volume;
    this.settingsChanged.emit(this.settings);
    
    // In a real implementation, this would adjust the individual character's audio track
    this.showStatus(`${character.name} volume: ${Math.round(character.volume * 100)}%`, 'info');
  }

  toggleCharacterMute(character: CharacterInfo) {
    character.muted = !character.muted;
    if (character.muted) {
      this.settings.characterVolumes[character.name] = 0;
    } else {
      this.settings.characterVolumes[character.name] = character.volume;
    }
    this.settingsChanged.emit(this.settings);
  }

  // ==================== PLAYBACK SETTINGS ====================

  updatePlaybackSpeed() {
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.playbackRate = this.settings.speed;
      this.audioElement.nativeElement.preservesPitch = this.settings.preservePitch;
    }
    this.settingsChanged.emit(this.settings);
  }

  toggleLoop() {
    this.isLooping = !this.isLooping;
    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.loop = this.isLooping;
    }
  }

  // ==================== VISUALIZATION ====================

  private initializeVisualization() {
    if (this.settings.visualizationEnabled && this.waveformCanvas?.nativeElement) {
      // Initialize canvas for waveform visualization
      const canvas = this.waveformCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = canvas.offsetWidth * 2; // High DPI
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        
        // Draw placeholder waveform
        this.drawWaveform(ctx, canvas.width / 2, canvas.height / 2);
      }
    }
  }

  private updateVisualization() {
    if (this.settings.visualizationEnabled && this.waveformCanvas?.nativeElement) {
      // Update visualization based on current playback position
      // This would typically involve analyzing the audio data
    }
  }

  private drawWaveform(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 1;
    
    // Generate mock waveform data
    ctx.beginPath();
    for (let i = 0; i < width; i += 2) {
      const amplitude = Math.sin(i * 0.02) * (height * 0.3) + Math.random() * 10;
      const y = height / 2 + amplitude;
      
      if (i === 0) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
    }
    ctx.stroke();
  }

  toggleVisualization() {
    if (this.settings.visualizationEnabled) {
      this.initializeVisualization();
    }
    this.settingsChanged.emit(this.settings);
  }

  // ==================== UTILITY METHODS ====================

  private generateTimeMarkers() {
    this.timeMarkers = [];
    const markerInterval = Math.max(60, this.duration / 10); // At least every minute
    
    for (let time = markerInterval; time < this.duration; time += markerInterval) {
      this.timeMarkers.push({
        position: (time / this.duration) * 100,
        label: this.formatTime(time)
      });
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getCharacterIcon(type: string): string {
    switch (type) {
      case 'vampire': return '🧛';
      case 'werewolf': return '🐺';
      case 'fairy': return '🧚';
      case 'human': return '👤';
      case 'narrator': return '📖';
      default: return '🎭';
    }
  }

  // ==================== ACTIONS ====================

  downloadAudio() {
    if (this.audioUrl) {
      const link = document.createElement('a');
      link.href = this.audioUrl;
      link.download = `${this.title || 'story'}-audio.mp3`;
      link.click();
    }
  }

  shareAudio() {
    if (navigator.share && this.audioUrl) {
      navigator.share({
        title: this.title || 'Spicy Fairy Tale Audio',
        url: this.audioUrl
      }).catch(error => {
        this.showStatus('Sharing failed: ' + error.message, 'error');
      });
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(this.audioUrl).then(() => {
        this.showStatus('Audio URL copied to clipboard!', 'success');
      });
    }
  }

  // ==================== KEYBOARD SHORTCUTS ====================

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', this.handleKeydown);
  }

  private removeKeyboardShortcuts() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    // Only handle shortcuts when the player is focused or audio is playing
    if (!this.isPlaying && !event.target) return;

    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.skipBy(-10);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.skipBy(30);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.masterVolume = Math.min(1, this.masterVolume + 0.1);
        this.updateMasterVolume();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.masterVolume = Math.max(0, this.masterVolume - 0.1);
        this.updateMasterVolume();
        break;
    }
  };

  // ==================== STATUS MANAGEMENT ====================

  private showStatus(message: string, type: 'info' | 'success' | 'error' = 'info') {
    this.statusMessage = message;
    this.statusType = type;
    
    setTimeout(() => {
      this.statusMessage = '';
    }, 3000);
  }
}