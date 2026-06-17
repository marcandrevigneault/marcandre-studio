import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build
export default defineConfig({
  // Change this to your real domain before deploying (used for sitemap + canonical URLs).
  site: 'https://marcandre.studio',
  integrations: [mdx(), sitemap()],
  markdown: {
    // Math in science articles:  $E = mc^2$  inline, or $$ ... $$ for display blocks.
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    // Code highlighting that follows our CSS variables (so it adapts to each theme).
    shikiConfig: { theme: 'css-variables' },
  },
});
