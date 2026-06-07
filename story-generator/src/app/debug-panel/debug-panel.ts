import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { StoryService } from '../story.service';
import {
  StoryGenerationSeam,
  GeneratedChapter,
  StoryIterationPayload,
  StoryStateSnapshot,
  StorySummary,
  ApiResponse
} from '../contracts';

interface HealthStatus {
  state: 'idle' | 'checking' | 'healthy' | 'unhealthy';
  timestamp?: string;
  latencyMs?: number;
  message?: string;
}

interface HealthPayload {
  status: 'healthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    grok: 'configured' | 'mock';
  };
  cors: {
    allowedOrigin: string;
  };
}

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debug-panel.html',
  styleUrl: './debug-panel.css'
})
export class DebugPanel {
  private readonly http = inject(HttpClient);
  private readonly storyService = inject(StoryService);

  readonly health = signal<HealthStatus>({ state: 'idle' });
  readonly sampleBlueprint = signal<StoryGenerationSeam['input']>({
    creature: 'vampire',
    themes: [{ id: 'forbidden_love', label: 'Forbidden Love', description: 'Star-crossed lovers defy their courts.' }],
    logline: 'A vampire envoy must betray her court to save a mortal lover.',
    spicyLevel: 3,
    tone: 'dark_romance',
    desiredWordBudget: 900,
    chapterBatchSize: 1,
    heatContract: {
      adultOnlyConfirmed: true,
      tensionMode: 'slow_burn',
      intimacyBoundary: 'fade_to_black',
      noGoContent: ''
    },
    narrativeDirectives: 'Keep the tension simmering with political intrigue.'
  });

  readonly lastPayload = signal<StoryIterationPayload | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly generating = signal(false);

  checkApiHealth() {
    this.health.set({ state: 'checking' });
    const started = performance.now();

    this.http.get<ApiResponse<HealthPayload>>('/api/health').subscribe({
      next: response => {
        if (!response.success) {
          this.health.set({
            state: 'unhealthy',
            timestamp: new Date().toISOString(),
            latencyMs: Math.round(performance.now() - started),
            message: response.error.message
          });
          return;
        }

        this.health.set({
          state: response.data.status === 'healthy' ? 'healthy' : 'unhealthy',
          timestamp: response.data.timestamp,
          latencyMs: Math.round(performance.now() - started),
          message: `grok: ${response.data.services.grok}`
        });
      },
      error: error => {
        this.health.set({
          state: 'unhealthy',
          timestamp: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - started),
          message: error.message
        });
      }
    });
  }

  triggerSampleGenesis() {
    if (this.generating()) {
      return;
    }

    this.generating.set(true);
    this.lastError.set(null);

    this.storyService.beginStory(this.sampleBlueprint()).subscribe({
      next: response => {
        if (!response.success || !response.data) {
          this.lastError.set(response.error?.message ?? 'Unknown error');
          this.lastPayload.set(null);
        } else {
          this.lastPayload.set(response.data);
        }
        this.generating.set(false);
      },
      error: error => {
        this.lastError.set(error.message ?? 'Request failed');
        this.lastPayload.set(null);
        this.generating.set(false);
      }
    });
  }

  get lastSummary(): StorySummary | null {
    return this.lastPayload()?.summary ?? null;
  }

  get lastState(): StoryStateSnapshot | null {
    return this.lastPayload()?.state ?? null;
  }

  get lastChapters(): GeneratedChapter[] {
    return this.lastPayload()?.batch.chapters ?? [];
  }
}
