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

/** The three `EventSource.readyState` values, spelled out for test callers. */
export const MOCK_EVENT_SOURCE_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
} as const;

/**
 * Creates a mock that can be manually controlled, including its `readyState`
 * — which a caller needs to simulate the Story Lab job event stream's
 * "replay and close" design: the backend closes the response after every
 * replay, so a real `EventSource` moves to `CONNECTING` while it reconnects
 * on its own and only reaches `CLOSED` if it gives up. Code that reads
 * `readyState` off an `error` event (`classifyEventStreamError`) behaves
 * differently for those two cases, so a mock that always reports the same
 * `readyState` cannot exercise the distinction.
 */
export function createControllableMock(): {
  MockClass: any;
  triggerMessage: (data: any) => void;
  triggerRawMessage: (rawData: string) => void;
  triggerError: (readyState?: number) => void;
  closeHandlerCallCount: () => number;
  lastUrl: () => string | undefined;
} {
  let messageHandlers: any[] = [];
  let errorHandlers: any[] = [];
  let instance: any = null;
  let closeCallCount = 0;
  let capturedUrl: string | undefined;

  const MockClass = class MockEventSource {
    onmessage: any;
    onerror: any;
    readyState: number = MOCK_EVENT_SOURCE_READY_STATE.CONNECTING;

    constructor(url: string) {
      instance = this;
      capturedUrl = url;
      this.readyState = MOCK_EVENT_SOURCE_READY_STATE.OPEN;
    }

    addEventListener(event: string, handler: any) {
      if (event === 'message') {
        messageHandlers.push(handler);
      } else if (event === 'error') {
        errorHandlers.push(handler);
      }
    }

    close() {
      closeCallCount += 1;
      this.readyState = MOCK_EVENT_SOURCE_READY_STATE.CLOSED;
    }
  };

  return {
    MockClass,
    // Real `EventSource` supports both the `onmessage`/`onerror` IDL
    // attributes and `addEventListener`; a real caller may use either, so
    // this drives both.
    triggerMessage: (data: any) => {
      const messageEvent = { data: JSON.stringify(data) };
      if (instance && instance.onmessage) {
        instance.onmessage(messageEvent);
      }
      messageHandlers.forEach(handler => {
        handler(messageEvent);
      });
    },
    // Unlike `triggerMessage`, sends `rawData` as-is rather than through
    // `JSON.stringify` — for exercising a caller's handling of a frame that
    // fails to parse, which a real server would never intentionally send but
    // a reader still has to survive.
    triggerRawMessage: (rawData: string) => {
      const messageEvent = { data: rawData };
      if (instance && instance.onmessage) {
        instance.onmessage(messageEvent);
      }
      messageHandlers.forEach(handler => {
        handler(messageEvent);
      });
    },
    // Defaults to the reconnect-shaped disconnect (`CONNECTING`) rather than
    // a terminal one, since that is the common case this route's replay-and-
    // close design produces on every successful read.
    triggerError: (readyState: number = MOCK_EVENT_SOURCE_READY_STATE.CONNECTING) => {
      if (instance) {
        instance.readyState = readyState;
      }
      if (instance && instance.onerror) {
        instance.onerror(new Event('error'));
      }
      errorHandlers.forEach(handler => {
        handler(new Event('error'));
      });
    },
    closeHandlerCallCount: () => closeCallCount,
    lastUrl: () => capturedUrl
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
