import type { Block } from './gallery-schema';

type LegacyImage = { src: string; alt: string; caption?: string; span?: 'single' | 'wide' };

/**
 * Canonical block list for a gallery. New content uses `blocks`; older content
 * only has legacy `images[]`, which we map to single/full blocks so both render.
 */
export function normalizeToBlocks(g: { blocks?: Block[]; images?: LegacyImage[] }): Block[] {
  if (g.blocks && g.blocks.length > 0) return g.blocks;
  return (g.images ?? []).map((img) => ({
    layout: img.span === 'wide' ? 'full' : 'single',
    images: [{ src: img.src, alt: img.alt, ...(img.caption ? { caption: img.caption } : {}) }],
    align: 'left',
  }));
}
