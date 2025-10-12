/**
 * EventSource Mock Utilities
 * Created: 2025-10-12
 * 
 * Shared mock implementations for EventSource to reduce code duplication across tests
 */

export interface MockEventSourceConfig {
  url?: string;
  messageDelay?: number;
  onMessage?: (handler: any) => void;
  onError?: () => void;
  autoTriggerError?: boolean;
}

/**
 * Creates a mock EventSource class with configurable behavior
 */
export function createMockEventSource(config: MockEventSourceConfig = {}): any {
  const {
    messageDelay = 10,
    onMessage,
    onError,
    autoTriggerError = false
  } = config;

  return class MockEventSource {
    onerror: any;
    
    constructor(url: string) {
      if (config.url !== undefined) {
        config.url = url;
      }
      
      if (autoTriggerError) {
        setTimeout(() => {
          this.onerror && this.onerror(new Event('error'));
        }, messageDelay);
      }
    }
    
    addEventListener(event: string, handler: any) {
      if (event === 'message' && onMessage) {
        setTimeout(() => onMessage(handler), messageDelay);
      }
    }
    
    close() {
      if (onError) {
        onError();
      }
    }
  };
}

/**
 * Creates a simple EventSource mock that captures the URL
 */
export function createUrlCapturingMock(urlCallback: (url: string) => void): any {
  return class MockEventSource {
    onerror: any;
    
    constructor(url: string) {
      urlCallback(url);
      setTimeout(() => {
        this.onerror && this.onerror(new Event('error'));
      }, 10);
    }
    
    addEventListener() {}
    close() {}
  };
}

/**
 * Creates a mock that emits a specific message
 */
export function createMessageEmittingMock(messageData: any, delay = 10): any {
  return class MockEventSource {
    onerror: any;
    
    constructor(url: string) {}
    
    addEventListener(event: string, handler: any) {
      if (event === 'message') {
        setTimeout(() => {
          handler({
            data: JSON.stringify(messageData)
          });
        }, delay);
      }
    }
    
    close() {}
  };
}

/**
 * Creates a mock that can be manually controlled
 */
export function createControllableMock(): {
  MockClass: any;
  triggerMessage: (data: any) => void;
  triggerError: () => void;
} {
  let messageHandlers: any[] = [];
  let errorHandlers: any[] = [];
  let instance: any = null;

  const MockClass = class MockEventSource {
    onerror: any;
    
    constructor(url: string) {
      instance = this;
    }
    
    addEventListener(event: string, handler: any) {
      if (event === 'message') {
        messageHandlers.push(handler);
      } else if (event === 'error') {
        errorHandlers.push(handler);
      }
    }
    
    close() {}
  };

  return {
    MockClass,
    triggerMessage: (data: any) => {
      messageHandlers.forEach(handler => {
        handler({ data: JSON.stringify(data) });
      });
    },
    triggerError: () => {
      if (instance && instance.onerror) {
        instance.onerror(new Event('error'));
      }
      errorHandlers.forEach(handler => {
        handler(new Event('error'));
      });
    }
  };
}

/**
 * Saves and restores the original EventSource
 */
export function withMockEventSource<T>(
  mockClass: any,
  testFn: () => T
): T {
  const originalEventSource = (window as any).EventSource;
  (window as any).EventSource = mockClass;
  
  try {
    return testFn();
  } finally {
    (window as any).EventSource = originalEventSource;
  }
}
