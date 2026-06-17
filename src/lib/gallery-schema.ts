import { z } from 'zod';

export const themeSchema = z.object({
  paper: z.string().optional(),
  ink: z.string().optional(),
  muted: z.string().optional(),
  accent: z.string().optional(),
  font: z.enum(['serif', 'sans', 'mono']).default('serif'),
  motion: z.enum(['none', 'calm', 'drift', 'reveal']).default('calm'),
  atmosphere: z.enum(['none', 'grain', 'vignette']).default('none'),
}).default({});

export const audioSchema = z.object({
  src: z.string(),
  title: z.string(),
  loop: z.boolean().default(true),
}).optional();

export const imageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
  span: z.enum(['single', 'wide']).default('single'),
});

export const gallerySchema = z.object({
  title: z.string(),
  place: z.string().optional(),
  date: z.coerce.date(),
  summary: z.string(),
  cover: z.string(),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  theme: themeSchema,
  audio: audioSchema,
  images: z.array(imageSchema).default([]),
});

export type GalleryFields = z.infer<typeof gallerySchema>;
