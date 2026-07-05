import { describe, it, expect } from 'vitest';
import { normalizeToBlocks } from './blocks';

describe('normalizeToBlocks', () => {
  it('returns blocks unchanged when present', () => {
    const blocks = [{ layout: 'two' as const, images: [], align: 'left' as const }];
    expect(normalizeToBlocks({ blocks, images: [] })).toBe(blocks);
  });

  it('converts legacy wide image to a full block', () => {
    const out = normalizeToBlocks({
      blocks: [],
      images: [{ src: 'u', alt: 'a', caption: 'c', span: 'wide' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].layout).toBe('full');
    expect(out[0].images[0]).toEqual({ src: 'u', alt: 'a', caption: 'c' });
  });

  it('converts legacy single image to a single block', () => {
    const out = normalizeToBlocks({ images: [{ src: 'u', alt: 'a', span: 'single' }] });
    expect(out[0].layout).toBe('single');
  });

  it('returns [] when neither present', () => {
    expect(normalizeToBlocks({})).toEqual([]);
  });
});
