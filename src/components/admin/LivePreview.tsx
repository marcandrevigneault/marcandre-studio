import type { Gallery } from './types';
export default function LivePreview({ gallery }: { gallery: Gallery }) {
  return <aside><p>Preview of {gallery.title || 'untitled'} (wired in Task 11).</p></aside>;
}
