export type Font = 'serif' | 'sans' | 'mono';
export type Motion = 'none' | 'calm' | 'drift' | 'reveal';
export type Atmosphere = 'none' | 'grain' | 'vignette';
export type BlockLayout = 'single' | 'full' | 'two' | 'twotall' | 'mosaic' | 'carousel' | 'image-text' | 'quad';

export interface Theme { paper?: string; ink?: string; muted?: string; accent?: string; font: Font; motion: Motion; atmosphere: Atmosphere; }
export interface BlockImage { id: string; src: string; alt: string; caption?: string; }
export interface Block { id: string; layout: BlockLayout; images: BlockImage[]; text?: string; align: 'left' | 'right'; }
export interface Audio { src: string; title: string; loop: boolean; }

export interface Gallery {
  slug: string; title: string; place?: string; date: string; summary: string; cover: string;
  draft: boolean; featured: boolean; theme: Theme; audio?: Audio; blocks: Block[]; body: string;
}

let idc = 0;
export const newId = () => `b${Date.now().toString(36)}-${idc++}`;
export const newBlock = (layout: BlockLayout): Block => ({ id: newId(), layout, images: [], align: 'left' });

export const emptyGallery = (): Gallery => ({
  slug: '', title: '', date: new Date().toISOString().slice(0, 10),
  summary: '', cover: '', draft: true, featured: false,
  theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
  blocks: [], body: '',
});

// The wire format (edit.astro's `initial`) carries no client-only ids. When we
// load an existing gallery into the Builder, stamp a fresh `id` on every block
// and image so React keys / drag-reorder / per-item edits have stable handles.
export const withClientIds = (g: Gallery): Gallery => ({
  ...g,
  blocks: (g.blocks ?? []).map((b) => ({
    ...b,
    id: newId(),
    images: (b.images ?? []).map((im) => ({ ...im, id: newId() })),
  })),
});
