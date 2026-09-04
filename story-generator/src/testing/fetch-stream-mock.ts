/**
 * fetch() Mock Utilities for Streaming Reads
 * Created: 2026-09-04
 *
 * `StoryService.streamStoryLabJobEvents` reads the Story Lab job event
 * stream with `fetch` + `response.body.getReader()` rather than
 * `EventSource`, specifically so it can send a real auth header (see that
 * method's own comment). These mocks drive that same shape — a queue of
 * fake `Response`s, each backed by a hand-rolled reader rather than a real
 * `ReadableStream`, since the code under test only ever calls
 * `getReader().read()` and never needs the rest of the Streams API.
 */

export interface RecordedFetchCall {
  url: string;
  headers: Record<string, string>;
  aborted: () => boolean;
}

export interface FetchStreamMock {
  /** Installs the mock in place of the global `fetch`; call the returned function to restore it. */
  install(): () => void;
  /** Queues a successful response whose body is the given SSE-framed text, split into one or more chunks. */
  enqueueResponse(status: number, bodyChunks: string[]): void;
  /** Queues a `fetch()` call rejecting outright — a network-level failure. */
  enqueueNetworkError(error?: Error): void;
  readonly calls: RecordedFetchCall[];
}

export function createFetchStreamMock(): FetchStreamMock {
  type QueuedOutcome =
    | { kind: 'response'; status: number; chunks: string[] }
    | { kind: 'network-error'; error: Error };

  const queue: QueuedOutcome[] = [];
  const calls: RecordedFetchCall[] = [];
  const encoder = new TextEncoder();

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const outcome = queue.shift();
    const signal = init?.signal as AbortSignal | undefined;
    calls.push({
      url: String(input),
      headers: (init?.headers as Record<string, string>) ?? {},
      aborted: () => signal?.aborted ?? false
    });

    if (!outcome) {
      throw new Error('createFetchStreamMock: no queued outcome for this fetch() call.');
    }

    if (outcome.kind === 'network-error') {
      throw outcome.error;
    }

    let index = 0;
    const reader = {
      read: async (): Promise<{ done: boolean; value?: Uint8Array }> => {
        if (index < outcome.chunks.length) {
          const value = encoder.encode(outcome.chunks[index]);
          index += 1;
          return { done: false, value };
        }
        return { done: true, value: undefined };
      }
    };

    return {
      ok: outcome.status >= 200 && outcome.status < 300,
      status: outcome.status,
      body: { getReader: () => reader }
    } as unknown as Response;
  };

  return {
    install() {
      const original = window.fetch;
      window.fetch = mockFetch as typeof window.fetch;
      return () => {
        window.fetch = original;
      };
    },
    enqueueResponse(status: number, bodyChunks: string[]) {
      queue.push({ kind: 'response', status, chunks: bodyChunks });
    },
    enqueueNetworkError(error: Error = new Error('network error')) {
      queue.push({ kind: 'network-error', error });
    },
    calls
  };
}

/** Formats one SSE frame exactly the way `formatSseFrame` (`api/_lib/http/sseStream.ts`) does. */
export function formatMockSseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
