// Created: 2026-08-26

/**
 * Build the standalone HTML document the "Download story" and "Export story"
 * actions hand off — the reader's own copy, openable without this app.
 *
 * Pulled out of `AppComponent` so the markup can be exercised without a
 * `TestBed`: the component version was a private method reachable only through
 * `downloadStory`/`exportStory`, both of which also touch the DOM, the
 * clipboard, or an HTTP call, so nothing here was under direct test.
 *
 * `sanitizeChapterHtml` stays a caller-supplied function rather than a fixed
 * import: the component sanitizes chapter markup through Angular's
 * `DomSanitizer`, which only exists inside injection context, so this module
 * takes whatever sanitizer the caller already has instead of constructing its
 * own.
 */

export interface ExportableStory {
  title: string;
  synopsis: string;
}

export interface ExportableChapter {
  chapterNumber: number;
  title: string;
  htmlContent: string;
}

export function escapeHtml(value: string): string {
  let escaped = '';

  for (const char of value) {
    switch (char) {
      case '&':
        escaped += '&amp;';
        break;
      case '<':
        escaped += '&lt;';
        break;
      case '>':
        escaped += '&gt;';
        break;
      case '"':
        escaped += '&quot;';
        break;
      case '\'':
        escaped += '&#39;';
        break;
      default:
        escaped += char;
    }
  }

  return escaped;
}

export function buildStoryHtmlDocument(
  story: ExportableStory,
  chapters: readonly ExportableChapter[],
  sanitizeChapterHtml: (html: string) => string
): string {
  const chapterMarkup = chapters
    .map(chapter => {
      const body = sanitizeChapterHtml(chapter.htmlContent);
      return `<section><h2>Chapter ${chapter.chapterNumber}: ${escapeHtml(chapter.title)}</h2>${body}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(story.title)}</title>
<style>
body{font-family:Georgia,serif;line-height:1.65;max-width:760px;margin:40px auto;padding:0 20px;color:#251914;background:#fff8ee}
h1,h2{line-height:1.15}hr{border:0;border-top:1px solid #d8c5aa;margin:28px 0}
</style>
</head>
<body>
<h1>${escapeHtml(story.title)}</h1>
<p>${escapeHtml(story.synopsis)}</p>
<hr>
${chapterMarkup}
</body>
</html>`;
}
