import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * A gallery's "world": the look, motion, and sound that make each gallery feel
 * like its own place. Everything here is optional and falls back to a calm,
 * minimal default — so a gallery can be as plain or as elaborate as you want.
 */
const theme = z
  .object({
    // Core palette. Any CSS color works (#hex, rgb(), oklch(), etc.).
    paper: z.string().optional(), // page background
    ink: z.string().optional(), // primary text
    muted: z.string().optional(), // secondary text / captions
    accent: z.string().optional(), // links, highlights, the audio control
    // Typography mood for the gallery's display type.
    font: z.enum(['serif', 'sans', 'mono']).default('serif'),
    // How images enter the page as you scroll.
    motion: z.enum(['none', 'calm', 'drift', 'reveal']).default('calm'),
    // Optional grain/vignette atmosphere over the whole page.
    atmosphere: z.enum(['none', 'grain', 'vignette']).default('none'),
  })
  .default({});

const audio = z
  .object({
    src: z.string(), // e.g. "/audio/kyoto-rain.mp3" (placed in /public/audio)
    title: z.string(), // shown on the player, e.g. "Rain over Kiyomizu"
    loop: z.boolean().default(true),
  })
  .optional();

const image = z.object({
  src: z.string(), // e.g. "/photos/kyoto/01.jpg" (placed in /public/photos)
  alt: z.string(),
  caption: z.string().optional(),
  // Optional layout hint: a "wide" image spans the full row.
  span: z.enum(['single', 'wide']).default('single'),
});

const galleries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/galleries' }),
  schema: z.object({
    title: z.string(),
    place: z.string().optional(), // "Kyoto, Japan"
    date: z.coerce.date(),
    summary: z.string(),
    cover: z.string(), // hero image path
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    theme,
    audio,
    images: z.array(image).default([]),
  }),
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
