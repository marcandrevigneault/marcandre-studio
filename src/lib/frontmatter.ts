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
  // Normalize date to YYYY-MM-DD so round-trips are stable.
  const front = {
    ...fields,
    date: fields.date instanceof Date
      ? fields.date.toISOString().slice(0, 10)
      : fields.date,
  };
  const frontYaml = yaml.dump(front, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${frontYaml}\n---\n${body}\n`;
}
