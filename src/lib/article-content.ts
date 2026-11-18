import matter from 'gray-matter';
import { frenchText } from './content-translations';
import { articleEditPath, parseArticleEdit, type ArticleEdit, type ArticleLanguage } from './article-editing';

const originals = import.meta.glob('../content/articles/*.{md,mdx}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const french = import.meta.glob('../content-translations/fr/*.mdx', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const edits = import.meta.glob('../content/edits/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export function originalArticle(slug: string, language: ArticleLanguage): ArticleEdit | null {
  articleEditPath(slug, language);
  const raw = originals[`../content/articles/${slug}.mdx`] ?? originals[`../content/articles/${slug}.md`];
  if (raw === undefined) return null;
  const { data, content } = matter(raw);
  const translate = (value: string) => language === 'fr' ? frenchText(value) : value;
  return {
    title: translate(data.title), subtitle: translate(data.subtitle ?? ''), summary: translate(data.summary),
    body: language === 'fr' ? french[`../content-translations/fr/${slug}.mdx`] ?? content : content,
  };
}
export function articleCopy(slug: string, language: ArticleLanguage): ArticleEdit {
  const original = originalArticle(slug, language);
  if (!original) throw new Error('Unknown article.');
  const edit = edits[`../content/edits/${slug}.${language}.md`];
  return edit === undefined ? original : parseArticleEdit(edit);
}
