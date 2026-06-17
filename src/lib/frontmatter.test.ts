import { describe, it, expect } from 'vitest';
import { parseGallery, serializeGallery, gallerySchema } from './frontmatter';

const SAMPLE = `---
title: A Morning in the Alps
place: Chamonix, France
date: 2026-06-01
summary: One sentence that sets the mood.
cover: https://res.cloudinary.com/x/image/upload/alps_cover.jpg
draft: false
featured: true
theme:
  paper: "#0e1320"
  ink: "#eef2f8"
  font: serif
  motion: drift
  atmosphere: vignette
audio:
  src: https://res.cloudinary.com/x/video/upload/wind.mp3
  title: Wind on the glacier
  loop: true
images:
  - src: https://res.cloudinary.com/x/image/upload/01.jpg
    alt: A ridge at dawn
    caption: First light
    span: wide
---
<p class="intro">An optional opener.</p>`;

describe('frontmatter', () => {
  it('parses a gallery into typed data', () => {
    const g = parseGallery('alps', SAMPLE);
    expect(g.slug).toBe('alps');
    expect(g.title).toBe('A Morning in the Alps');
    expect(g.featured).toBe(true);
    expect(g.theme.motion).toBe('drift');
    expect(g.audio?.title).toBe('Wind on the glacier');
    expect(g.images).toHaveLength(1);
    expect(g.images[0].span).toBe('wide');
    expect(g.body.trim()).toBe('<p class="intro">An optional opener.</p>');
  });

  it('round-trips (parse -> serialize -> parse) preserving values', () => {
    const g1 = parseGallery('alps', SAMPLE);
    const md = serializeGallery(g1);
    const g2 = parseGallery('alps', md);
    expect(g2).toEqual(g1);
  });

  it('validates against the schema (rejects missing alt)', () => {
    const bad = { images: [{ src: 'x', span: 'single' }] };
    expect(() => gallerySchema.parse({
      title: 't', date: '2026-01-01', summary: 's', cover: 'c', ...bad,
    })).toThrow();
  });
});
