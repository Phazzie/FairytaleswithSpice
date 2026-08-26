import { buildStoryHtmlDocument, escapeHtml } from './story-html-exporter';

describe('escapeHtml', () => {
  it('escapes the five reserved characters', () => {
    expect(escapeHtml(`<b>Tom & "Jerry" 'Inc'</b>`)).toBe(
      '&lt;b&gt;Tom &amp; &quot;Jerry&quot; &#39;Inc&#39;&lt;/b&gt;'
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('A quiet chapter, at last.')).toBe('A quiet chapter, at last.');
  });
});

describe('buildStoryHtmlDocument', () => {
  const story = { title: 'The Last Ember', synopsis: 'A spark refuses to die.' };

  it('renders every chapter in order, wrapped in a titled section', () => {
    const chapters = [
      { chapterNumber: 1, title: 'Kindling', htmlContent: '<p>One.</p>' },
      { chapterNumber: 2, title: 'Firestorm', htmlContent: '<p>Two.</p>' }
    ];

    const html = buildStoryHtmlDocument(story, chapters, html => html);

    const firstIndex = html.indexOf('Chapter 1: Kindling');
    const secondIndex = html.indexOf('Chapter 2: Firestorm');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(html).toContain('<p>One.</p>');
    expect(html).toContain('<p>Two.</p>');
  });

  it('escapes the story title and synopsis but not the sanitized chapter body', () => {
    const html = buildStoryHtmlDocument(
      { title: 'Cat & Mouse', synopsis: 'A "chase" begins.' },
      [{ chapterNumber: 1, title: 'Start', htmlContent: '<p>Safe body</p>' }],
      html => html
    );

    expect(html).toContain('<title>Cat &amp; Mouse</title>');
    expect(html).toContain('<h1>Cat &amp; Mouse</h1>');
    expect(html).toContain('<p>A &quot;chase&quot; begins.</p>');
    expect(html).toContain('<p>Safe body</p>');
  });

  it('escapes chapter titles even though chapter bodies pass through the sanitizer untouched', () => {
    const chapters = [{ chapterNumber: 3, title: '<script>', htmlContent: '<p>Body</p>' }];

    const html = buildStoryHtmlDocument(story, chapters, html => html);

    expect(html).toContain('Chapter 3: &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('routes every chapter body through the supplied sanitizer', () => {
    const chapters = [{ chapterNumber: 1, title: 'Only', htmlContent: '<p>dangerous</p>' }];
    const sanitize = jasmine.createSpy('sanitize').and.returnValue('<p>safe</p>');

    const html = buildStoryHtmlDocument(story, chapters, sanitize);

    expect(sanitize).toHaveBeenCalledOnceWith('<p>dangerous</p>');
    expect(html).toContain('<p>safe</p>');
    expect(html).not.toContain('dangerous');
  });

  it('produces a well-formed document shell with no chapters', () => {
    const html = buildStoryHtmlDocument(story, [], html => html);

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<h1>The Last Ember</h1>');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });
});
