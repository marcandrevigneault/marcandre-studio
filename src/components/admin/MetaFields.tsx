import type { Gallery } from './types';
import { slugify } from './slugify';

interface Props { value: Gallery; onChange: (g: Gallery) => void; lockSlug: boolean; }

export default function MetaFields({ value, onChange, lockSlug }: Props) {
  const set = (patch: Partial<Gallery>) => onChange({ ...value, ...patch });
  return (
    <fieldset>
      <legend>Details</legend>
      <label>Title<input value={value.title}
        onChange={(e) => set({ title: e.target.value, ...(lockSlug ? {} : { slug: slugify(e.target.value) }) })} /></label>
      <label>Slug<input value={value.slug} disabled={lockSlug}
        onChange={(e) => set({ slug: slugify(e.target.value) })} /></label>
      <label>Place<input value={value.place ?? ''} onChange={(e) => set({ place: e.target.value })} /></label>
      <label>Date<input type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} /></label>
      <label>Summary<textarea value={value.summary} onChange={(e) => set({ summary: e.target.value })} /></label>
      <label><input type="checkbox" checked={value.draft} onChange={(e) => set({ draft: e.target.checked })} /> Draft</label>
      <label><input type="checkbox" checked={value.featured} onChange={(e) => set({ featured: e.target.checked })} /> Featured</label>
    </fieldset>
  );
}
