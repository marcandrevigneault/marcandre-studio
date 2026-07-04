import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { gallerySchema } from './lib/gallery-schema';

const galleries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/galleries' }),
  schema: gallerySchema,
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    summary: z.string(),
    // Free-form topic tags: "hydroponics", "optics", "physics"...
    topics: z.array(z.string()).default([]),
    cover: z.string().optional(),
    readingTime: z.string().optional(), // "8 min"
    draft: z.boolean().default(false),
  }),
});

export const collections = { galleries, articles };
