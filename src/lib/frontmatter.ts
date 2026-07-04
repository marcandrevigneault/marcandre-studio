import matter from 'gray-matter';
import yaml from 'js-yaml';
import { gallerySchema, type GalleryFields } from './gallery-schema';

export { gallerySchema };
export type GalleryData = GalleryFields & { slug: string; body: string };

export function parseGallery(slug: string, markdown: string): GalleryData {
  const { data, content } = matter(markdown);
  const fields = gallerySchema.parse(data);
  return { ...fields, slug, body: content.trim() };
}

export function serializeGallery(data: GalleryData): string {
  const { slug, body, ...fields } = data;
  const front: Record<string, unknown> = {
    ...fields,
    date: fields.date instanceof Date
      ? fields.date.toISOString().slice(0, 10)
      : fields.date,
  };
  // Blocks are canonical; don't write the legacy images array.
  if (Array.isArray(front.blocks) && front.blocks.length > 0) delete front.images;
  // Drop empty arrays so files stay clean.
  for (const key of ['images', 'blocks'] as const) {
    if (Array.isArray(front[key]) && (front[key] as unknown[]).length === 0) delete front[key];
  }
  const frontYaml = yaml.dump(front, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${frontYaml}\n---\n${body}\n`;
}
