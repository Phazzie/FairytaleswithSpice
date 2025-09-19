import { Component, inject, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { StoryService } from '../story.service';
import { StoryGenerationSeam, ApiResponse } from '../contracts';

interface DebugError {
  timestamp: Date;
  type: 'API' | 'NETWORK' | 'RUNTIME';
  message: string;
  details?: any;
  endpoint?: string;
}

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version: string;
}

interface NetworkStatus {
  online: boolean;
  lastChecked: Date;
  latency?: number;
}

@Component({
  selector: 'app-debug-panel',
  imports: [CommonModule],
  templateUrl: './debug-panel.html',
  styleUrl: './debug-panel.css'
})
export class DebugPanel implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private storyService = inject(StoryService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Debug panel state
  isVisible = false;
  errors: DebugError[] = [];

  // API Health Check
  healthStatus: 'checking' | 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
  healthResponse?: HealthCheckResponse;
  lastHealthCheck?: Date;

  // Network Status
  networkStatus: NetworkStatus = {
    online: this.isBrowser ? navigator.onLine : true,
    lastChecked: new Date()
  };

  // Environment Info
  environmentInfo = {
    url: this.isBrowser ? window.location.href : 'SSR',
    userAgent: this.isBrowser ? navigator.userAgent : 'Server-Side',
    timestamp: new Date().toISOString(),
    angularVersion: '20.x',
    buildMode: 'development'
  };

  // Sample story generation states
  generating200 = false;
  generating400 = false;
  generating800 = false;

  private networkCheckInterval?: number;

  ngOnInit() {
    if (this.isBrowser) {
      this.loadDebugState();
      this.startNetworkMonitoring();
      this.setupGlobalErrorHandler();
      this.loadStoredErrors();
    }
  }

  ngOnDestroy() {
    if (this.isBrowser && this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
    }
  }

  // ==================== VISIBILITY CONTROL ====================

  toggleVisibility() {
    this.isVisible = !this.isVisible;
    this.saveDebugState();
  }

  private loadDebugState() {
    if (!this.isBrowser) return;

    const saved = localStorage.getItem('debug-panel-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.isVisible = state.isVisible ?? false;
      } catch (error) {
        console.warn('Failed to load debug panel state:', error);
      }
    }
  }

  private saveDebugState() {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem('debug-panel-state', JSON.stringify({
        isVisible: this.isVisible,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to save debug panel state:', error);
    }
  }

  // ==================== API HEALTH CHECK ====================

  checkApiHealth() {
    this.healthStatus = 'checking';
    this.lastHealthCheck = new Date();

    const startTime = Date.now();

    this.http.get<HealthCheckResponse>('/api/health').subscribe({
      next: (response) => {
        this.healthStatus = 'healthy';
        this.healthResponse = response;
        this.networkStatus.latency = Date.now() - startTime;
        this.networkStatus.lastChecked = new Date();
      },
      error: (error: HttpErrorResponse) => {
        this.healthStatus = 'unhealthy';
        this.addError('API', `Health check failed: ${error.message}`, error, '/health');
      }
    });
  }

  // ==================== SAMPLE STORY GENERATION ====================

  generateSampleStory(wordCount: 200 | 400 | 800) {
    const stateMap = {
      200: 'generating200',
      400: 'generating400',
      800: 'generating800'
    };

    (this as any)[stateMap[wordCount]] = true;

    const sampleInput: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['forbidden_love'],
      userInput: `Debug test story - ${wordCount} words`,
      spicyLevel: 3,
      wordCount: wordCount === 200 ? 700 : wordCount === 400 ? 900 : 1200 // Map to available options
    };

    this.storyService.generateStory(sampleInput).subscribe({
      next: (response) => {
        (this as any)[stateMap[wordCount]] = false;
        if (response.success && response.data) {
          this.addError('API', `✅ Sample story (${wordCount} words) generated successfully`, response.data, '/api/story/generate');
        } else {
          this.addError('API', `❌ Sample story generation failed: ${response.error?.message}`, response.error, '/api/story/generate');
        }
      },
      error: (error) => {
        (this as any)[stateMap[wordCount]] = false;
        this.addError('API', `Sample story (${wordCount} words) generation error: ${error.message}`, error, '/api/story/generate');
      }
    });
  }

  // ==================== ERROR MANAGEMENT ====================

  private addError(type: DebugError['type'], message: string, details?: any, endpoint?: string) {
    const error: DebugError = {
      timestamp: new Date(),
      type,
      message,
      details,
      endpoint
    };

    this.errors.unshift(error); // Add to beginning
    this.saveErrors();

    // Limit to 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(0, 100);
    }
  }

  clearErrors() {
    this.errors = [];
    this.saveErrors();
  }

  private saveErrors() {
    if (!this.isBrowser) return;

    try {
      localStorage.setItem('debug-panel-errors', JSON.stringify(this.errors));
    } catch (error) {
      console.warn('Failed to save debug errors:', error);
    }
  }

  private loadStoredErrors() {
    if (!this.isBrowser) return;

    try {
      const stored = localStorage.getItem('debug-panel-errors');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.errors = parsed.map((error: any) => ({
          ...error,
          timestamp: new Date(error.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored errors:', error);
    }
  }

  exportErrorsAsJson() {
    if (!this.isBrowser) return;

    const exportData = {
      exportedAt: new Date().toISOString(),
      environmentInfo: this.environmentInfo,
      networkStatus: this.networkStatus,
      healthStatus: this.healthStatus,
      errors: this.errors
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-errors-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==================== NETWORK MONITORING ====================

  private startNetworkMonitoring() {
    if (!this.isBrowser) return;

    // Check every 30 seconds
    this.networkCheckInterval = window.setInterval(() => {
      this.networkStatus.online = navigator.onLine;
      this.networkStatus.lastChecked = new Date();
    }, 30000);

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.networkStatus.online = true;
      this.networkStatus.lastChecked = new Date();
      this.addError('NETWORK', '🟢 Network connection restored', null);
    });

    window.addEventListener('offline', () => {
      this.networkStatus.online = false;
      this.networkStatus.lastChecked = new Date();
      this.addError('NETWORK', '🔴 Network connection lost', null);
    });
  }

  // ==================== ERROR HANDLING ====================

  private setupGlobalErrorHandler() {
    if (!this.isBrowser) return;

    // Capture runtime errors
    window.addEventListener('error', (event) => {
      this.addError('RUNTIME', `Runtime error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.addError('RUNTIME', `Unhandled promise rejection: ${event.reason}`, {
        reason: event.reason
      });
    });
  }

  // ==================== UTILITY METHODS ====================

  getErrorTypeColor(type: DebugError['type']): string {
    switch (type) {
      case 'API': return '#ff6b6b';
      case 'NETWORK': return '#4ecdc4';
      case 'RUNTIME': return '#ffe66d';
      default: return '#95a5a6';
    }
  }

  formatTimestamp(timestamp: Date): string {
    return timestamp.toLocaleTimeString();
  }

  refreshEnvironmentInfo() {
    if (!this.isBrowser) return;

    this.environmentInfo = {
      ...this.environmentInfo,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
  }
}
