#!/usr/bin/env tsx
// Created: 2026-08-25 14:05 UTC

import {
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

console.log('HTML document download tests passed');
