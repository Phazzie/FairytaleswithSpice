#!/usr/bin/env tsx
// Created: 2026-08-25 14:05 UTC

import {
  dataUriToBlob,
  downloadHtmlDocument,
  downloadTextDocument,
  type DownloadAnchorLike,
  type DownloadDocumentLike,
  type HtmlDownloadHost
} from '../shared/htmlDocumentDownload';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Records the order the anchor was attached, clicked, and detached in, because
 * that order is the whole of what this function has to get right: a click on an
 * anchor that is not in the document does nothing at all in Firefox.
 */
function createRecordingHost(options: { clickThrows?: boolean } = {}) {
  const events: string[] = [];
  let attached = false;
  const revokes: (() => void)[] = [];
  const blobs: Blob[] = [];

  const anchor: DownloadAnchorLike = {
    href: '',
    download: '',
    click() {
      events.push(attached ? 'click:attached' : 'click:detached');
      if (options.clickThrows) {
        throw new Error('browser refused the download');
      }
    }
  };

  const documentLike: DownloadDocumentLike = {
    createElement(tagName) {
      assert(tagName === 'a', 'download should be triggered through an anchor');
      events.push('createElement');
      return anchor;
    },
    body: {
      appendChild(node) {
        assert(node === anchor, 'the attached node should be the download anchor');
        attached = true;
        events.push('appendChild');
        return node;
      },
      removeChild(node) {
        assert(node === anchor, 'the detached node should be the download anchor');
        attached = false;
        events.push('removeChild');
        return node;
      }
    }
  };

  const host: HtmlDownloadHost = {
    document: documentLike,
    createObjectUrl(blob) {
      blobs.push(blob);
      events.push('createObjectUrl');
      return 'blob:story-download';
    },
    revokeObjectUrl(url) {
      events.push(`revokeObjectUrl:${url}`);
    },
    scheduleRevoke(revoke) {
      events.push('scheduleRevoke');
      revokes.push(revoke);
    }
  };

  return { anchor, blobs, events, host, revokes };
}

const html = '<!doctype html><html lang="en"><body><h1>A vampire story</h1></body></html>';

// The anchor is in the document when it is clicked, and out of it afterwards.
const attached = createRecordingHost();
downloadHtmlDocument(html, 'a-vampire-story.html', attached.host);

assert(
  attached.events.includes('click:attached'),
  'the anchor must be attached to the document before it is clicked'
);
assert(
  attached.events.indexOf('appendChild') < attached.events.indexOf('click:attached'),
  'the anchor should be attached before the click'
);
assert(
  attached.events.indexOf('click:attached') < attached.events.indexOf('removeChild'),
  'the anchor should be detached only after the click'
);
assert(attached.anchor.href === 'blob:story-download', 'the anchor should point at the object URL');
assert(attached.anchor.download === 'a-vampire-story.html', 'the anchor should carry the download filename');

// The object URL outlives the click: revoking it inline, or on the very next
// task, races the transfer the click starts.
assert(
  attached.events.indexOf('scheduleRevoke') > attached.events.indexOf('click:attached'),
  'the revoke should be scheduled after the click'
);
assert(
  !attached.events.some(event => event.startsWith('revokeObjectUrl')),
  'the object URL must not be revoked before the scheduled revoke runs'
);

attached.revokes.forEach(revoke => revoke());
assert(
  attached.events.includes('revokeObjectUrl:blob:story-download'),
  'the scheduled revoke should release the object URL it created'
);

// The document itself is what gets downloaded, as HTML.
assert(attached.blobs.length === 1, 'exactly one blob should be created per download');
const [blob] = attached.blobs;
assert(blob.type === 'text/html', 'the download should be typed as HTML');
assert(blob.size === Buffer.byteLength(html, 'utf8'), 'the blob should carry the rendered document');

// A click that throws still takes the anchor back out of the page, so a second
// attempt does not stack another one on top of it.
const failing = createRecordingHost({ clickThrows: true });
let clickError: unknown;
try {
  downloadHtmlDocument(html, 'a-vampire-story.html', failing.host);
} catch (error) {
  clickError = error;
}

assert(clickError instanceof Error, 'a click that throws should reach the caller');
assert(failing.events.includes('removeChild'), 'a failed click should still detach the anchor');

// …and still releases the blob. A browser holds one alive for the life of the
// tab until its URL is revoked, so a revoke that the throw skipped would strand
// a whole story or a whole exported history in memory on every refused attempt.
assert(
  failing.events.includes('scheduleRevoke'),
  'a failed click should still schedule the object URL revoke'
);
failing.revokes.forEach(revoke => revoke());
assert(
  failing.events.includes('revokeObjectUrl:blob:story-download'),
  'the scheduled revoke should release the object URL of a failed download'
);

// The Proving Grounds history export is the other download this module serves,
// and it is JSON rather than a document. It has to reach the reader the same
// way — an attached anchor over an object URL — because the two things that
// went wrong for the story download are properties of the anchor and the URL,
// not of what they carry.
const json = JSON.stringify([{ id: 'test_1', generatedStory: '<h3>A vampire story</h3>' }], null, 2);
const exported = createRecordingHost();
downloadTextDocument(json, 'proving-grounds-results.json', 'application/json', exported.host);

assert(
  exported.events.includes('click:attached'),
  'a text download must attach its anchor before clicking it'
);
assert(
  exported.events.indexOf('click:attached') < exported.events.indexOf('removeChild'),
  'a text download should detach its anchor only after the click'
);
assert(
  exported.anchor.download === 'proving-grounds-results.json',
  'the anchor should carry the export filename'
);
assert(exported.anchor.href === 'blob:story-download', 'the export should be offered as an object URL');
assert(exported.blobs.length === 1, 'exactly one blob should be created per export');
assert(exported.blobs[0].type === 'application/json', 'the export should be typed as JSON');
assert(
  exported.blobs[0].size === Buffer.byteLength(json, 'utf8'),
  'the blob should carry the whole exported history'
);

exported.revokes.forEach(revoke => revoke());
assert(
  exported.events.includes('revokeObjectUrl:blob:story-download'),
  'the export should release its object URL on the scheduled revoke'
);

// `/api/export/save` hands the exported bytes back inline as a `data:` URI, so
// this is the decode the export button runs before it can offer anything at
// all.
const epubBlob = dataUriToBlob('data:application/epub+zip;base64,QUJD');
assert(epubBlob.type === 'application/epub+zip', 'the blob should carry the media type the URI declared');
assert(epubBlob.size === 3, 'the blob should carry the decoded payload');

// The media type is everything before `;base64`, not everything before the
// first `;`. RFC 2397 lets it carry parameters, and a pattern that stopped at
// the first one did not match such a URI at all — so an ordinary
// `data:text/plain;charset=utf-8;base64,…` was refused rather than decoded, and
// the refusal reached the reader as a button that did nothing.
const parameterisedBlob = dataUriToBlob('data:text/plain;charset=utf-8;base64,QUJD');
assert(
  parameterisedBlob.type === 'text/plain;charset=utf-8',
  `a media type with parameters should survive the decode, got ${JSON.stringify(parameterisedBlob.type)}`
);
assert(parameterisedBlob.size === 3, 'a parameterised URI should decode its payload too');

// A URI scheme and the `base64` token are both case-insensitive.
assert(dataUriToBlob('DATA:text/plain;BASE64,QUJD').size === 3, 'the header tokens are case-insensitive');

// No media type at all is a legal data URI; the blob falls back rather than
// being typed with an empty string.
assert(
  dataUriToBlob('data:;base64,QUJD').type === 'application/octet-stream',
  'a URI with no media type should fall back to a generic one'
);

// And what it still refuses, so the caller has something to catch. A throw from
// here inside an RxJS `next` callback does not reach that subscription's
// `error` handler, which is why `AppComponent.exportStory` wraps the call.
for (const refused of ['not-a-data-uri', 'data:text/plain,plain%20text', 'data:text/plain;base64,!!!']) {
  let decodeError: unknown;
  try {
    dataUriToBlob(refused);
  } catch (error) {
    decodeError = error;
  }
  assert(decodeError instanceof Error, `${refused} should be refused rather than decoded`);
}

console.log('HTML document download tests passed');
