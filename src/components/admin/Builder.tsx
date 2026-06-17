import type { Gallery } from './types';
export default function Builder({ initial }: { initial?: Gallery }) {
  return <p>Builder placeholder for {initial?.slug ?? 'new gallery'}.</p>;
}
