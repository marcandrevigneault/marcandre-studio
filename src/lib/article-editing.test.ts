import { describe, it, expect } from 'vitest';
import { parseArticleEdit, serializeArticleEdit, renderArticleMarkdown, articleEditPath, safeReturnPath } from './article-editing';

const content = { title: 'L’heure dorée', subtitle: '', summary: 'La lumière expliquée.', body: '## Bonjour\n\nUne **image** et $x^2$.' };
describe('article edits', () => {
  it('round trips text including colons, quotes, Unicode and Markdown without modifying it', () => {
    const edited = { ...content, title: '« Soleil: lumière »', body: 'Texte\n\n---\n\n{x}\n' };
    expect(parseArticleEdit(serializeArticleEdit(edited))).toEqual(edited);
  });
  it('rejects blank titles, oversized bodies and non-text fields before saving', () => {
    expect(() => serializeArticleEdit({ ...content, title: ' ' })).toThrow();
    expect(() => serializeArticleEdit({ ...content, body: 'x'.repeat(150001) })).toThrow();
    expect(() => serializeArticleEdit({ ...content, body: 10 } as any)).toThrow();
  });
  it('renders Markdown and math without allowing active HTML or unsafe links', async () => {
    const html = await renderArticleMarkdown('## Bonjour\n\n**gras** $x^2$\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[bad](javascript:alert)');
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('katex');
    expect(html).not.toMatch(/<script|onerror|href="javascript:/);
  });
  it('allows ordinary braces and angle brackets as text without executing MDX', async () => {
    expect(await renderArticleMarkdown('Value: {process.env.SECRET}\n\nimport x from "node:fs"')).toContain('{process.env.SECRET}');
  });
  it('confines edits to a language-specific content file', () => {
    expect(articleEditPath('why-golden-hour', 'fr')).toBe('src/content/edits/why-golden-hour.fr.md');
    expect(articleEditPath('why-golden-hour', 'en')).toBe('src/content/edits/why-golden-hour.en.md');
    for (const slug of ['../secret', 'a/b', '', '%2e%2e']) expect(() => articleEditPath(slug, 'fr')).toThrow();
    expect(() => articleEditPath('valid', 'de' as any)).toThrow();
  });
  it('allows local return links but blocks external and backslash redirects', () => {
    expect(safeReturnPath('/science/why-golden-hour/?edit=1&lang=fr')).toBe('/science/why-golden-hour/?edit=1&lang=fr');
    for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', '/%5cevil.test', null]) expect(safeReturnPath(path)).toBe('/admin');
  });
});
