export type Font = 'serif' | 'sans' | 'mono';
export type Motion = 'none' | 'calm' | 'drift' | 'reveal';
export type Atmosphere = 'none' | 'grain' | 'vignette';
export type Span = 'single' | 'wide';

export interface Theme {
  paper?: string; ink?: string; muted?: string; accent?: string;
  font: Font; motion: Motion; atmosphere: Atmosphere;
}
export interface GalleryImage { src: string; alt: string; caption?: string; span: Span; }
export interface Audio { src: string; title: string; loop: boolean; }

export interface Gallery {
  slug: string;
  title: string;
  place?: string;
  date: string;          // YYYY-MM-DD
  summary: string;
  cover: string;
  draft: boolean;
  featured: boolean;
  theme: Theme;
  audio?: Audio;
  images: GalleryImage[];
  body: string;
}

export const emptyGallery = (): Gallery => ({
  slug: '', title: '', date: new Date().toISOString().slice(0, 10),
  summary: '', cover: '', draft: true, featured: false,
  theme: { font: 'serif', motion: 'calm', atmosphere: 'none' },
  images: [], body: '',
});
