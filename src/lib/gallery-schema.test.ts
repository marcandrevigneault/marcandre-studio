import { describe, it, expect } from 'vitest';
import { blockSchema, gallerySchema } from './gallery-schema';

describe('blockSchema', () => {
  it('parses a full-width image block', () => {
    const b = blockSchema.parse({
      layout: 'full',
      images: [{ src: 'u', alt: 'a' }],
    });
    expect(b.layout).toBe('full');
    expect(b.align).toBe('left'); // default
    expect(b.images[0].alt).toBe('a');
  });

  it('parses an image-text block with align', () => {
    const b = blockSchema.parse({
      layout: 'image-text', align: 'right',
      images: [{ src: 'u', alt: 'a' }], text: 'prose',
    });
    expect(b.align).toBe('right');
    expect(b.text).toBe('prose');
  });

  it('rejects an unknown layout', () => {
    expect(() => blockSchema.parse({ layout: 'nope', images: [] })).toThrow();
  });

  it('gallery accepts a blocks array and defaults it to empty', () => {
    const g = gallerySchema.parse({
      title: 't', date: '2026-01-01', summary: 's', cover: 'c',
    });
    expect(g.blocks).toEqual([]);
    expect(g.images).toEqual([]);
  });
});
