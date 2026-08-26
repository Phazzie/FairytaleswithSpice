// Created: 2026-08-25 14:05 UTC

/**
 * Hand a generated HTML document to the browser as a file the reader saves.
 *
 * The "Download story" action built the document, wrapped it in a `Blob`, and
 * clicked an anchor it had created but never put anywhere:
 *
 * ```
 * const link = document.createElement('a');
 * link.href = url;
 * link.download = `${safeTitle}.html`;
 * link.click();
 * setTimeout(() => URL.revokeObjectURL(url), 0);
 * ```
 *
 * Two things are wrong with that, and both of them are silent — no exception,
 * no message, just a button that does nothing.
 *
 * A synthetic click only follows a `download` on an anchor that is in the
 * document. Chrome tolerates a detached one; Firefox has never dispatched the
 * navigation for it, so the whole story a reader had just generated stayed in
 * the tab. Attaching the anchor, clicking it, and taking it back out again is
 * the portable form, and it leaves the page exactly as it found it.
 *
 * Revoking the object URL on the next task is a race with the transfer the
 * click starts. The download reads the blob through that URL, and a browser
 * that has not begun reading by the time the timer fires is handed a URL that
 * no longer resolves — the same empty result, on the same button, only
 * intermittently. The revoke is what stops the blob from being held for the
 * life of the tab, so it still has to happen; it just has to happen after the
 * browser has had a real chance to start.
 */

export interface DownloadAnchorLike {
  href: string;
  download: string;
  click(): void;
}

/**
 * Parameterized by the anchor rather than pinned to the structural minimum
 * above, because a real `Document` is only assignable that way: its
 * `appendChild` is `<T extends Node>(node: T) => T`, which will not take
 * something that is merely anchor-shaped. Inferring the anchor from
 * `createElement` gives `HTMLAnchorElement` for the browser and the plain
 * structural type for a test double, and both sides then line up.
 */
export interface DownloadDocumentLike<TAnchor extends DownloadAnchorLike = DownloadAnchorLike> {
  createElement(tagName: 'a'): TAnchor;
  body: {
    appendChild(node: TAnchor): unknown;
    removeChild(node: TAnchor): unknown;
  };
}

/**
 * Everything this needs from the browser, named so a test can supply it.
 *
 * `scheduleRevoke` rather than a delay in milliseconds: how long to wait is the
 * caller's decision, and a test that had to wait it out would be a slow test
 * asserting on a timer rather than on the order of the work.
 */
export interface HtmlDownloadHost<TAnchor extends DownloadAnchorLike = DownloadAnchorLike> {
  document: DownloadDocumentLike<TAnchor>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  scheduleRevoke(revoke: () => void): void;
}

/**
 * How long the object URL outlives the click, when the caller has no better
 * signal than a timer. Long enough that a browser saving a book-length story
 * over a slow disk has started reading, short enough that the blob is not held
 * for the life of the tab.
 */
export const OBJECT_URL_REVOKE_DELAY_MS = 60_000;

/**
 * Hand any blob to the browser as a file the reader saves.
 *
 * A synthetic click only follows a `download` on an anchor that is in the
 * document, so the anchor is attached, clicked, and detached again — Firefox
 * never dispatches the navigation for a detached one. Both halves of the
 * cleanup are in the `finally`, because a click that throws — a browser that
 * refuses the download, an extension that replaced the handler — has to leave
 * the page as it found it. Detaching the anchor is the visible half.
 * Scheduling the revoke is the half a throw would otherwise skip: the browser
 * holds a blob alive for the life of the tab until its URL is revoked, so a
 * refused attempt would strand it in memory on the path already least likely
 * to be noticed.
 */
export function downloadBlob<TAnchor extends DownloadAnchorLike>(
  blob: Blob,
  filename: string,
  host: HtmlDownloadHost<TAnchor>
): void {
  const url = host.createObjectUrl(blob);
  const link = host.document.createElement('a');
  link.href = url;
  link.download = filename;

  host.document.body.appendChild(link);
  try {
    link.click();
  } finally {
    host.document.body.removeChild(link);
    host.scheduleRevoke(() => host.revokeObjectUrl(url));
  }
}

/**
 * Hand any generated text to the browser as a file the reader saves.
 *
 * The story download is not the only button that offers one. Proving Grounds
 * exports its test history as JSON, and built that download the way the story
 * download used to: a detached anchor, clicked, with the payload in a `data:`
 * URI. It is the same silent failure — Firefox does not dispatch a synthetic
 * click on an anchor that is not in the document — plus one the story download
 * never had, because a `data:` URI carries the whole payload in the URL and a
 * history of twenty-five generated stories is not a URL-sized thing. Routing
 * both through `downloadBlob` is what keeps the second button from
 * rediscovering what the first one already learned.
 *
 * `mimeType` is the only thing that differs between them, so it is the only
 * thing the caller supplies.
 */
export function downloadTextDocument<TAnchor extends DownloadAnchorLike>(
  content: string,
  filename: string,
  mimeType: string,
  host: HtmlDownloadHost<TAnchor>
): void {
  downloadBlob(new Blob([content], { type: mimeType }), filename, host);
}

export function downloadHtmlDocument<TAnchor extends DownloadAnchorLike>(
  html: string,
  filename: string,
  host: HtmlDownloadHost<TAnchor>
): void {
  downloadTextDocument(html, filename, 'text/html', host);
}

/**
 * Match a base64 `data:` URI and split it into its media type and its payload.
 *
 * The media type is everything between `data:` and the `;base64` that ends the
 * header, not everything up to the first `;`. RFC 2397 lets the media type carry
 * parameters — `data:text/plain;charset=utf-8;base64,…` is an ordinary data URI,
 * and the one this app's own exports would grow the moment a text format
 * declared its encoding — and a pattern that stops at the first `;` does not
 * match it at all, so the whole URI was refused rather than decoded. Capturing
 * the parameters with the type also keeps them: they end up on the `Blob`, which
 * is where a charset belongs.
 *
 * `[^,]*` cannot run past the comma that starts the payload, so the header is
 * decided in one pass; the trailing `;base64` is backtracked out of the type by
 * the literal that follows. Case-insensitive because a URI scheme and the
 * `base64` token both are.
 */
const BASE64_DATA_URI_PATTERN = /^data:([^,]*);base64,(.*)$/is;

/**
 * Decode a base64 `data:` URI into a `Blob`, so a file the backend returned
 * inline can be handed to `downloadBlob` exactly like one built client-side.
 *
 * Throws for anything it cannot decode — a URI that is not base64, or a payload
 * `atob` refuses. Callers hand the result straight to a download, so a caller
 * that has a way to tell the reader the file did not arrive has to catch this:
 * a throw inside an RxJS `next` callback does not reach that subscription's
 * `error` handler, it is reported as an unhandled error, and the reader is left
 * with a button that did nothing at all.
 */
export function dataUriToBlob(dataUri: string): Blob {
  const match = BASE64_DATA_URI_PATTERN.exec(dataUri);
  if (!match) {
    throw new Error('Not a base64-encoded data: URI');
  }

  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

/**
 * The browser-backed host. Separated from the function above so that what runs
 * in production is the same code the test drives, with only the four calls that
 * touch the browser swapped out.
 */
export function createBrowserHtmlDownloadHost(
  browserDocument: Document,
  objectUrls: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void },
  delayMs: number = OBJECT_URL_REVOKE_DELAY_MS
): HtmlDownloadHost<HTMLAnchorElement> {
  // Annotated rather than inferred: `Document.createElement` is overloaded, so
  // inference picks the default anchor type and then refuses the real `body`,
  // whose `appendChild` is `<T extends Node>(node: T) => T`. Naming
  // `HTMLAnchorElement` is what lets both halves line up without a cast.
  const anchorDocument: DownloadDocumentLike<HTMLAnchorElement> = {
    createElement: tagName => browserDocument.createElement(tagName),
    body: browserDocument.body
  };

  return {
    document: anchorDocument,
    createObjectUrl: blob => objectUrls.createObjectURL(blob),
    revokeObjectUrl: url => objectUrls.revokeObjectURL(url),
    scheduleRevoke: revoke => {
      setTimeout(revoke, delayMs);
    }
  };
}
