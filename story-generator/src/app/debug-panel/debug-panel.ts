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
  severity: 'info' | 'warning' | 'error' | 'critical';
  userAgent?: string;
  url?: string;
  stackTrace?: string;
  httpStatus?: number;
  requestHeaders?: any;
  responseHeaders?: any;
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
  
  // API test state
  testingAPI = false;
  generatingTestStory = false;
  generatingHeatherStory = false;
  lastTestStoryId?: string;
  heatherStoryResult?: StoryGenerationSeam['output'];
  
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
        if (error.status === 404) {
          this.addError(
            'API',
            'Health endpoint 404 – Likely deployment routing issue (check vercel.json and that serverless functions were included in build).',
            { status: error.status, message: error.message },
            '/api/health',
            'critical'
          );
        } else if (error.status === 0) {
          this.addError(
            'NETWORK',
            'Health check failed – Network unreachable or CORS blocked.',
            { status: error.status, message: error.message },
            '/api/health',
            'warning'
          );
        } else {
          this.addError('API', `Health check failed: HTTP ${error.status} ${error.statusText}`, error, '/api/health');
        }
      }
    });
  }
  
  // ==================== SAMPLE STORY GENERATION ====================
  
  testAPIConnection() {
    this.testingAPI = true;
    
    // Simple health check test
    this.checkApiHealth();
    
    // Set a timeout to reset the testing state
    setTimeout(() => {
      this.testingAPI = false;
      if (this.healthStatus === 'healthy') {
        this.addError('API', '✅ API connection test successful', this.healthResponse, '/api/health');
      } else {
        this.addError('API', '❌ API connection test failed - API not responding', null, '/api/health');
      }
    }, 3000);
  }

  // ==================== DIRECT STORY GENERATION TEST ====================

  testStoryGeneration() {
    if (this.generatingTestStory) return;
    this.generatingTestStory = true;
    const payload: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      // Use existing ThemeType value(s) from contract (e.g., 'desire')
      themes: ['desire'],
      userInput: '',
      spicyLevel: 2,
      wordCount: 700
    };

    const start = performance.now();
    this.storyService.generateStory(payload).subscribe({
      next: (resp: ApiResponse<StoryGenerationSeam['output']>) => {
        if (resp.success && resp.data) {
          this.lastTestStoryId = resp.data.storyId;
          const duration = Math.round(performance.now() - start);
            this.addError(
              'API',
              `✅ Test story generation succeeded in ${duration}ms (id=${resp.data.storyId})`,
              { storyId: resp.data.storyId, title: resp.data.title, duration },
              '/api/story/generate',
              'info'
            );
        } else {
          this.addError(
            'API',
            '❌ Test story generation returned unsuccessful response',
            resp,
            '/api/story/generate'
          );
        }
        this.generatingTestStory = false;
      },
      error: (err) => {
        const code = err?.error?.code || err?.error || 'UNKNOWN';
        const severity = code === 'ENDPOINT_NOT_FOUND' ? 'critical' : 'error';
        this.addError(
          'API',
          `❌ Test story generation failed (${code})`,
          err,
          '/api/story/generate',
          severity
        );
        this.generatingTestStory = false;
      }
    });
  }
  
  // ==================== HEATHER VAMPIRE STORY GENERATION ====================
  
  generateHeatherStory() {
    if (this.generatingHeatherStory) return;
    this.generatingHeatherStory = true;
    this.heatherStoryResult = undefined;
    
    const payload: StoryGenerationSeam['input'] = {
      creature: 'vampire',
      themes: ['forbidden_love', 'desire', 'passion'],
      userInput: 'Write a 250-word story about Heather, an immortal vampire who has lived for centuries. Focus on a moment of vulnerability when she encounters something that reminds her of her lost humanity.',
      spicyLevel: 3,
      wordCount: 700 // Using minimum word count for shorter story
    };

    const start = performance.now();
    this.storyService.generateStory(payload).subscribe({
      next: (resp: ApiResponse<StoryGenerationSeam['output']>) => {
        if (resp.success && resp.data) {
          this.heatherStoryResult = resp.data;
          const duration = Math.round(performance.now() - start);
          this.addError(
            'API',
            `✅ Heather's story generated successfully in ${duration}ms (${resp.data.actualWordCount} words)`,
            { storyId: resp.data.storyId, title: resp.data.title, duration, wordCount: resp.data.actualWordCount },
            '/api/story/generate',
            'info'
          );
        } else {
          this.addError(
            'API',
            '❌ Heather story generation returned unsuccessful response',
            resp,
            '/api/story/generate'
          );
        }
        this.generatingHeatherStory = false;
      },
      error: (err) => {
        const code = err?.error?.code || err?.error || 'UNKNOWN';
        this.addError(
          'API',
          `❌ Heather story generation failed (${code})`,
          err,
          '/api/story/generate',
          'error'
        );
        this.generatingHeatherStory = false;
      }
    });
  }
  
  // ==================== ERROR MANAGEMENT ====================
  
  private addError(type: DebugError['type'], message: string, details?: any, endpoint?: string, severity: DebugError['severity'] = 'error') {
    const error: DebugError = {
      timestamp: new Date(),
      type,
      message,
      details,
      endpoint,
      severity,
      userAgent: this.isBrowser ? navigator.userAgent : 'SSR',
      url: this.isBrowser ? window.location.href : 'SSR',
      stackTrace: new Error().stack,
      httpStatus: details?.status || details?.response?.status,
      requestHeaders: details?.config?.headers,
      responseHeaders: details?.response?.headers
    };
    
    this.errors.unshift(error); // Add to beginning
    this.saveErrors();
    
    // Enhanced console logging based on severity
    const logMessage = `[${type}] ${message}`;
    switch (severity) {
      case 'critical':
      case 'error':
        console.error(logMessage, details);
        break;
      case 'warning':
        console.warn(logMessage, details);
        break;
      case 'info':
        console.info(logMessage, details);
        break;
    }
    
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
