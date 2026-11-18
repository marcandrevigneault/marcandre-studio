import matter from 'gray-matter';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

export type ArticleLanguage = 'fr' | 'en';
export interface ArticleEdit { title: string; subtitle: string; summary: string; body: string }
export class ArticleEditError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateArticleEdit(value: unknown): ArticleEdit {
  if (!value || typeof value !== 'object') throw new ArticleEditError('Invalid article.');
  const data = value as Record<string, unknown>;
  const limits = { title: 240, subtitle: 1000, summary: 2000, body: 150000 };
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof data[key] !== 'string' || data[key].length > limit) throw new ArticleEditError(`Invalid ${key} (maximum ${limit} characters).`);
  }
  if (!(data.title as string).trim()) throw new ArticleEditError('A title is required.');
  return { title: data.title as string, subtitle: data.subtitle as string, summary: data.summary as string, body: data.body as string };
}
export function serializeArticleEdit(value: unknown): string {
  const { body, ...data } = validateArticleEdit(value);
  // JSON-quoted scalar values are also valid YAML and preserve Unicode/newlines.
  return `---\n${Object.entries(data).map(([key, v]) => `${key}: ${JSON.stringify(v)}`).join('\n')}\n---\n${body}`;
}
export function parseArticleEdit(markdown: string): ArticleEdit {
  const { data, content } = matter(markdown);
  return validateArticleEdit({ ...data, subtitle: data.subtitle ?? '', body: content });
}
export function articleEditPath(slug: string, language: ArticleLanguage): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !['fr', 'en'].includes(language)) {
    throw new ArticleEditError('Unknown article or language.', 404);
  }
  return `src/content/edits/${slug}.${language}.md`;
}
export { safeReturnPath } from './return-path';

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;
export async function renderArticleMarkdown(body: string): Promise<string> {
  processor ??= createMarkdownProcessor({
    syntaxHighlight: false,
    smartypants: false,
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeSanitize, { ...defaultSchema, attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ['className', 'language-math', 'math-inline', 'math-display']] } }],
      [rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 1000 }],
      // These URLs are rendered as ordinary Markdown images, not Astro asset imports.
      () => (_tree: unknown, file: any) => { file.data.astro.localImagePaths = []; file.data.astro.remoteImagePaths = []; },
    ],
  });
  return (await (await processor).render(body)).code;
}
